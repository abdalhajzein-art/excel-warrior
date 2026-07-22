import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsRegistry, toolsDefinition } from "./tools/index.js";
import { modifyExcelHandler } from './excel/modify.js';
import { generateExcelHandler } from './excel/generate.js';
import XLSX from 'xlsx';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ✅ تعريف الأدوات لـ Groq (بنفس صيغة OpenAI)
const tools = [
  {
    type: "function",
    function: {
      name: "excel_modify",
      description: "تعديل ملف Excel موجود بناءً على تعليمات المستخدم (إضافة عمود، تعديل بيانات، حذف صفوف).",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "ملف Excel بصيغة Base64" },
          instruction: { type: "string", description: "تعليمات التعديل المطلوبة" }
        },
        required: ["base64", "instruction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "excel_generate",
      description: "توليد ملف Excel جديد بناءً على تعليمات المستخدم.",
      parameters: {
        type: "object",
        properties: {
          instruction: { type: "string", description: "وصف الملف المطلوب توليده" }
        },
        required: ["instruction"]
      }
    }
  }
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ reply: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, excelJSON } = body || {};

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ reply: "⚠️ خطأ: مفتاح GROQ_API_KEY غير مضاف في متغيرات البيئة." });
    }

    // =========================
    // 1) تجهيز السياق الأساسي
    // =========================
    let userContent = (message || "").trim();
    let extractedBase64 = null;
    let fileMimeType = null;
    let fileName = null;
    let fileSummary = "";

    const hasText = userContent.length > 0;
    const hasFile = excelJSON && Array.isArray(excelJSON) && excelJSON[0] && excelJSON[0].fileBase64;

    // 2) استقبال الملف وتحليل أولي
    if (hasFile) {
      const fileObj = excelJSON[0];
      extractedBase64 = fileObj.fileBase64;
      fileMimeType = fileObj.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileName = fileObj.fileName || 'ملف';

      try {
        const buffer = Buffer.from(extractedBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // ✅ تحويل الملف بالكامل إلى JSON
        const fullData = XLSX.utils.sheet_to_json(worksheet);
        
        fileSummary = `[ملف مرفق: ${fileName}]\n`;
        fileSummary += `نوع الملف: إكسل\n`;
        fileSummary += `عدد الصفوف: ${rawData.length}\n`;
        fileSummary += `الشيت الأولى: ${firstSheetName}\n`;
        fileSummary += `\nالبيانات كاملة (JSON):\n${JSON.stringify(fullData, null, 2)}`;
        
        console.log(`✅ تم تحليل الملف: ${fileName}, عدد الصفوف: ${rawData.length}`);
        
      } catch (parseErr) {
        console.error("Error parsing Excel in chat:", parseErr);
        fileSummary = `[ملف مرفق: ${fileName} - تعذّر تحليل المحتوى]`;
      }
    }

    // =========================
    // 2) بناء الرسالة النهائية لـ Groq
    // =========================
    const fullMessage = `المستخدم طلب: ${userContent || "مرحبا"}\n\n${fileSummary}`;

    // =========================
    // 3) استدعاء Groq مع الأدوات
    // =========================
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: fullMessage }
      ],
      temperature: 0.3,
      max_completion_tokens: 512,
      tools: tools,
      tool_choice: "auto"
    });

    const responseMessage = completion.choices[0].message;

    // =========================
    // 4) معالجة الأدوات (إذا استدعاها Groq)
    // =========================
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      console.log(`🔧 Groq استدعى الأداة: ${toolName}`);

      // ✅ تنفيذ الأداة المناسبة
      if (toolName === "excel_modify") {
        if (!toolArgs.base64 && extractedBase64) {
          toolArgs.base64 = extractedBase64;
        }
        try {
          const result = await modifyExcelHandler({ body: toolArgs });
          if (result.success && result.fileBase64) {
            return res.json({
              reply: result.message || "✅ تم تعديل الملف بنجاح",
              fileBase64: result.fileBase64,
              fileName: result.fileName || "modified.xlsx"
            });
          } else {
            return res.json({ reply: result.error || "❌ فشل تعديل الملف" });
          }
        } catch (err) {
          console.error("❌ Error executing excel_modify:", err);
          return res.json({ reply: "❌ حدث خطأ أثناء تنفيذ التعديل: " + err.message });
        }
      }

      if (toolName === "excel_generate") {
        try {
          const result = await generateExcelHandler({ body: toolArgs });
          if (result.success && result.fileBase64) {
            return res.json({
              reply: result.message || "✅ تم توليد الملف بنجاح",
              fileBase64: result.fileBase64,
              fileName: result.fileName || "generated.xlsx"
            });
          } else {
            return res.json({ reply: result.error || "❌ فشل توليد الملف" });
          }
        } catch (err) {
          console.error("❌ Error executing excel_generate:", err);
          return res.json({ reply: "❌ حدث خطأ أثناء تنفيذ التوليد: " + err.message });
        }
      }
    }

    // =========================
    // 5) إذا ما في أدوات، نرجع الرد النصي
    // =========================
    const replyText = responseMessage.content || "تم الاستلام";

    // تحسين الرد البشري
    function humanizeReply(text) {
      if (!text) return "تمام، خلّيني ساعدك بخطوة تانية إذا حابب.";
      let reply = text.trim();
      reply = reply.replace(/نموذج|ذكاء اصطناعي|أداة|معالجة/g, "");
      reply = reply.replace(/JSON|Base64|API|endpoint|parameters/gi, "");
      reply = reply
        .replace(/تم التنفيذ بنجاح/g, "تمام، خلّصنا الشغلة بنجاح")
        .replace(/تمت المعالجة/g, "تمام، خلّصنا المطلوب")
        .replace(/خطأ/g, "في شغلة بسيطة لازم ننتبه عليها");
      if (!reply.includes("تمام") && !reply.includes("طيب")) {
        reply = "تمام… " + reply;
      }
      return reply;
    }

    return res.json({ reply: humanizeReply(replyText) });

  } catch (error) {
    console.error("❌ خطأ في Groq:", error);
    return res.status(500).json({
      reply: "⚠️ خطأ: " + (error.message || "مشكلة في الاتصال بـ Groq")
    });
  }
  }
