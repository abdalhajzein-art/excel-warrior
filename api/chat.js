import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { executeTool } from "./tools/execute.js";
import { toolsRegistry } from "./tools/index.js";
import fs from "fs";
import path from "path";
import os from "os";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const sessions = {};

const toolMap = {
  modify: "excel_modify",
  generate: "excel_generate",
  convert: "file_convert",
};

async function callFunction(action, parameters) {
  const toolName = toolMap[action] || "excel_modify";
  if (!toolsRegistry[toolName]) {
    throw new Error(`أداة غير معروفة: ${action}`);
  }
  return await executeTool(toolName, parameters);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ reply: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { message, excelJSON, sessionId } = body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        reply: "⚠️ خطأ داخلي: مفتاح GEMINI_API_KEY غير موجود."
      });
    }

    const sessionKey = sessionId || "default";
    if (!sessions[sessionKey]) {
      sessions[sessionKey] = { lastFile: null };
    }
    const session = sessions[sessionKey];

    let userContent = (message || "").trim();
    let tempFilePath = null;
    let fileName = null;

    const hasFile = excelJSON && excelJSON[0] && excelJSON[0].fileBase64;

    if (hasFile) {
      const fileObj = excelJSON[0];
      const buffer = Buffer.from(fileObj.fileBase64, 'base64');
      fileName = fileObj.fileName || "ملف.xlsx";
      tempFilePath = path.join(os.tmpdir(), `${Date.now()}_${fileName}`);
      fs.writeFileSync(tempFilePath, buffer);

      session.lastFile = { path: tempFilePath, name: fileName };
    } else if (session.lastFile) {
      tempFilePath = session.lastFile.path;
      fileName = session.lastFile.name;
    }

    // 🧠 عقل التوجيه الذكي (Gemini) لتحديد نية المستخدم بدقة
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            action: { type: SchemaType.STRING, description: "اختر read إذا طلب قراءة أو ملخص أو تحليل، أو formulas إذا طلب الدوال والمعادلات، أو modify إذا طلب تعديل وتغيير، أو chat للدردشة العامة" },
            response: { type: SchemaType.STRING, description: "مقدمة أو رد أولي مناسب" }
          },
          required: ["action", "response"]
        }
      }
    });

    const prompt = `أنت المساعد الذكي لمنصة "الأثير".
طلب المستخدم: "${userContent}"
هل الملف مرفق أو موجود في الجلسة؟ ${tempFilePath ? "نعم" : "لا"}
صنف الطلب بدقة إلى أحد الإجراءات التالية: read (للقراءة والتحليل), formulas (للدوال), modify (للتعديل), chat (للدردشة).`;

    const result = await model.generateContent(prompt);
    let analysisResult;
    try {
      analysisResult = JSON.parse(result.response.text());
    } catch {
      analysisResult = {
        action: tempFilePath ? "read" : "chat",
        response: "أهلاً بك يا مهندس، أنا مستعد لمعالجة الملف برمجياً."
      };
    }

    if (analysisResult.action === "chat" || !tempFilePath) {
      return res.json({ reply: analysisResult.response });
    }

    // تشغيل محرك بايثون عبر الأداة
    try {
      let toolResult = await callFunction("modify", {
        instruction: userContent,
        inputPath: tempFilePath,
        fileName,
        action: analysisResult.action
      });

      let finalReply = `${analysisResult.response}\n\n`;

      // إذا أعطانا بايثون بيانات وصفية (Metadata)، نجعل Gemini يصيغها بأسلوب هندسي مباشر ومختصر
      if (toolResult && toolResult.metadata) {
        const meta = toolResult.metadata;
        const secondModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        const formattingPrompt = `بناءً على البيانات المستخرجة من ملف الإكسل (إجمالي الصفوف: ${meta.total_rows}, الأعمدة: ${meta.headers.join(', ')}، عينة البيانات: ${JSON.stringify(meta.sample_data.slice(0, 5))})، 
اكتب تقريراً هندسياً مختصراً ومباشراً جداً:
- اعطني ملخصاً سريعاً لما يمثله الملف.
- اذكر الأعمدة الرئيسية.
- اذكر عينة كافية سريعة ومنظمة من البيانات.
- تجنب تماماً المقدمات الإدارية الطويلة، أو الديباجات الحكومية (مثل سعادة المهندس والموضوع). كن تقنياً، مختصراً، وعملياً جداً.`;
        
        const formattedRes = await secondModel.generateContent(formattingPrompt);
        finalReply += formattedRes.response.text();
      } else if (toolResult && toolResult.formulas_list) {
        finalReply += `⚙️ **الدوال المكتشفة:**\n` + toolResult.formulas_list.join('\n');
      } else if (toolResult && toolResult.message) {
        finalReply += `📊 **النتيجة:** ${toolResult.message}`;
      }

      // إرسال الرد وملف التصدير (إن وجد تعديل)
      if (toolResult && toolResult.fileBase64) {
        return res.json({
          reply: finalReply,
          fileBase64: toolResult.fileBase64,
          fileName: toolResult.fileName || fileName,
          contentType: toolResult.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      }

      return res.json({ reply: finalReply });

    } catch (toolError) {
      console.error("❌ خطأ في تنفيذ الأداة:", toolError);
      return res.json({ reply: "⚠️ حدث خطأ أثناء المعالجة المحلية عبر محرك الكواليس: " + toolError.message });
    }

  } catch (error) {
    return res.status(500).json({ reply: "⚠️ خطأ تقني في المعالج: " + error.message });
  }
}

