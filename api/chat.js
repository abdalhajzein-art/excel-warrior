import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsRegistry, toolsDefinition } from "./tools/index.js";
import { modifyExcelHandler } from './excel/modify.js';
import { generateExcelHandler } from './excel/generate.js';
import XLSX from 'xlsx'; // ✅ للقراءة الأساسية (آمن ومستقر)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ✅ دالة للتحقق من وجود المكتبة المتقدمة
async function getAdvancedWorkbook() {
  try {
    const module = await import('@office-kit/xlsx');
    return module.Workbook;
  } catch (err) {
    console.warn('⚠️ @office-kit/xlsx غير متوفرة، سنستخدم xlsx الأساسية');
    return null;
  }
}

// ✅ تعريف الأدوات لـ Groq (مبسطة)
const tools = [
  {
    type: "function",
    function: {
      name: "excel_modify",
      description: "تعديل ملف Excel موجود. استخدم هذه الأداة عندما يطلب المستخدم تعديل ملف مرفق.",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "ملف Excel بصيغة Base64 (يتم تمريره تلقائياً)" },
          instruction: { type: "string", description: "تعليمات التعديل المطلوبة من المستخدم" }
        },
        required: ["instruction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "excel_generate",
      description: "توليد ملف Excel جديد. استخدم هذه الأداة عندما يطلب المستخدم إنشاء ملف جديد.",
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

    // =========================
    // 2) استقبال الملف وتحليل أولي (باستخدام xlsx أولاً)
    // =========================
    if (hasFile) {
      const fileObj = excelJSON[0];
      extractedBase64 = fileObj.fileBase64;
      fileMimeType = fileObj.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileName = fileObj.fileName || 'ملف';

      console.log(`📦 Base64 موجود: ${extractedBase64 ? '✅ نعم (الطول: ' + extractedBase64.length + ')' : '❌ لا'}`);

      if (!extractedBase64) {
        console.error("❌ Base64 مفقود من الملف المرفق");
        fileSummary = `[ملف مرفق: ${fileName} - تعذّر قراءة الملف]`;
      } else {
        let useAdvanced = false;
        let rowCount = 0;
        let colCount = 0;
        let fullData = [];
        let firstSheetName = 'Sheet1';

        try {
          // ✅ محاولة استخدام المكتبة المتقدمة أولاً
          const AdvancedWorkbook = await getAdvancedWorkbook();
          if (AdvancedWorkbook) {
            const buffer = Buffer.from(extractedBase64, 'base64');
            const workbook = new AdvancedWorkbook();
            await workbook.loadFromBuffer(buffer);
            
            const worksheet = workbook.getWorksheet(1);
            if (worksheet) {
              useAdvanced = true;
              rowCount = worksheet.getRowCount();
              colCount = worksheet.getColumnCount();
              firstSheetName = worksheet.name || 'Sheet1';
              
              for (let i = 1; i <= rowCount; i++) {
                const row = [];
                for (let j = 1; j <= colCount; j++) {
                  const cell = worksheet.getCell(i, j);
                  row.push(cell.value !== undefined ? cell.value : '');
                }
                fullData.push(row);
              }
              console.log(`✅ تم تحليل الملف باستخدام @office-kit/xlsx: ${fileName}, عدد الصفوف: ${rowCount}`);
            }
          }
        } catch (advErr) {
          console.warn('⚠️ فشل استخدام @office-kit/xlsx، نعود لـ xlsx:', advErr.message);
          useAdvanced = false;
        }

        // ✅ إذا فشلت المتقدمة، نستخدم xlsx
        if (!useAdvanced) {
          try {
            const buffer = Buffer.from(extractedBase64, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            firstSheetName = workbook.SheetNames[0] || 'Sheet1';
            const worksheet = workbook.Sheets[firstSheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            rowCount = data.length;
            colCount = data[0] ? data[0].length : 0;
            fullData = data;
            
            console.log(`✅ تم تحليل الملف باستخدام xlsx: ${fileName}, عدد الصفوف: ${rowCount}`);
          } catch (xlsxErr) {
            console.error("Error parsing Excel with xlsx:", xlsxErr);
            fileSummary = `[ملف مرفق: ${fileName} - تعذّر تحليل المحتوى]`;
          }
        }

        // ✅ بناء الملخص
        if (fullData.length > 0) {
          fileSummary = `[ملف مرفق: ${fileName}]\n`;
          fileSummary += `نوع الملف: إكسل\n`;
          fileSummary += `عدد الصفوف: ${rowCount}\n`;
          fileSummary += `الشيت الأولى: ${firstSheetName}\n`;
          fileSummary += `\nالبيانات كاملة (JSON):\n${JSON.stringify(fullData.slice(0, 20), null, 2)}`; // أول 20 صف فقط
        }
      }
    } else {
      console.log("ℹ️ لا يوجد ملف مرفق في الطلب");
    }

    // =========================
    // 2) بناء الرسالة النهائية لـ Groq
    // =========================
    const fullMessage = `المستخدم طلب: ${userContent || "مرحبا"}\n\n${fileSummary}`;

    // =========================
    // 3) استدعاء Groq مع الأدوات
    // =========================
    let completion;
    try {
      completion = await groq.chat.completions.create({
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
    } catch (groqErr) {
      console.error("❌ Groq API Error:", groqErr);
      return handleManualFallback(res, userContent, extractedBase64);
    }

    const responseMessage = completion.choices[0].message;

    // =========================
    // 4) معالجة الأدوات (إذا استدعاها Groq)
    // =========================
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const toolName = toolCall.function.name;
      let toolArgs;
      
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch (parseErr) {
        console.error("❌ Failed to parse tool arguments:", parseErr);
        return handleManualFallback(res, userContent, extractedBase64);
      }

      console.log(`🔧 Groq استدعى الأداة: ${toolName}`);
      console.log(`📦 Arguments:`, toolArgs);

      if (toolName === "excel_modify") {
        if (!toolArgs.base64 && extractedBase64) {
          toolArgs.base64 = extractedBase64;
        }
        
        if (!toolArgs.base64) {
          return res.json({ 
            reply: "❌ عذراً، لم أستطع العثور على الملف المرفق. يرجى إعادة رفع الملف والمحاولة مرة أخرى." 
          });
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
    // 4.5) Manual Fallback
    // =========================
    if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
      console.log("🔍 Groq ما استدعى أداة، نستخدم الكلمات المفتاحية");
      
      const lowerMsg = (userContent || "").toLowerCase();
      
      const modifyKeywords = [
        'عدل', 'تعديل', 'غيّر', 'تغيير', 'edit', 'update',
        'اضف', 'أضف', 'حذف', 'ازل', 'إزالة', 'أدخل', 'إدراج',
        'insert', 'place', 'ضع', 'رتب', 'أضف عمود', 'ضيف عمود',
        'نظم', 'رتب', 'إضافة', 'اضافة', 'حذف عمود', 'ازالة عمود',
        'غير', 'بدل', 'استبدل', 'replace', 'ملف', 'sheet', 'جدول'
      ];
      
      const wantsModify = modifyKeywords.some(keyword => lowerMsg.includes(keyword));
      const wantsGenerate = /ولد|توليد|انشئ|إنشاء|create|generate|جهز|حضّر|اصنع|عمل|بناء/.test(lowerMsg);

      console.log(`🔍 Manual Fallback: wantsModify=${wantsModify}, wantsGenerate=${wantsGenerate}, hasBase64=${!!extractedBase64}`);

      if (wantsModify && extractedBase64) {
        console.log("🔧 Manual Fallback: تنفيذ تعديل");
        try {
          const result = await modifyExcelHandler({ 
            body: { 
              base64: extractedBase64, 
              instruction: userContent || "تعديل الملف" 
            } 
          });
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
          console.error("❌ Error executing manual excel_modify:", err);
          return res.json({ reply: "❌ حدث خطأ أثناء التعديل: " + err.message });
        }
      }

      if (wantsGenerate) {
        console.log("🔧 Manual Fallback: تنفيذ توليد");
        try {
          const result = await generateExcelHandler({ 
            body: { 
              instruction: userContent || "توليد ملف Excel" 
            } 
          });
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
          console.error("❌ Error executing manual excel_generate:", err);
          return res.json({ reply: "❌ حدث خطأ أثناء التوليد: " + err.message });
        }
      }
    }

    // =========================
    // 5) إذا ما في أدوات ولا طلب تعديل/توليد، نرجع الرد النصي
    // =========================
    const replyText = responseMessage.content || "تم الاستلام";

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

// =========================
// دالة مساعدة للـ Manual Fallback
// =========================
async function handleManualFallback(res, userContent, extractedBase64) {
  const lowerMsg = (userContent || "").toLowerCase();
  const modifyKeywords = [
    'عدل', 'تعديل', 'غيّر', 'تغيير', 'edit', 'update',
    'اضف', 'أضف', 'حذف', 'ازل', 'إزالة', 'أدخل', 'إدراج',
    'insert', 'place', 'ضع', 'رتب', 'أضف عمود', 'ضيف عمود',
    'نظم', 'رتب', 'إضافة', 'اضافة', 'حذف عمود', 'ازالة عمود',
    'غير', 'بدل', 'استبدل', 'replace', 'ملف', 'sheet', 'جدول'
  ];
  const wantsModify = modifyKeywords.some(keyword => lowerMsg.includes(keyword));
  const wantsGenerate = /ولد|توليد|انشئ|إنشاء|create|generate|جهز|حضّر|اصنع|عمل|بناء/.test(lowerMsg);
  
  if (wantsModify && extractedBase64) {
    console.log("🔧 Manual Fallback (from error): تنفيذ تعديل");
    try {
      const result = await modifyExcelHandler({ 
        body: { 
          base64: extractedBase64, 
          instruction: userContent || "تعديل الملف" 
        } 
      });
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
      console.error("❌ Manual fallback error:", err);
      return res.json({ reply: "❌ حدث خطأ أثناء التعديل: " + err.message });
    }
  }
  
  if (wantsGenerate) {
    console.log("🔧 Manual Fallback (from error): تنفيذ توليد");
    try {
      const result = await generateExcelHandler({ 
        body: { 
          instruction: userContent || "توليد ملف Excel" 
        } 
      });
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
      console.error("❌ Manual fallback error:", err);
      return res.json({ reply: "❌ حدث خطأ أثناء التوليد: " + err.message });
    }
  }
  
  return res.json({ 
    reply: "تمام… عفواً، ما قدرت أفهم طلبك بوضوح. حاول تطلب تعديل أو توليد ملف بشكل مباشر." 
  });
          }
