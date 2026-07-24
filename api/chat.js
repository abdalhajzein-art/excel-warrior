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
  const toolName = toolMap[action];
  if (!toolName || !toolsRegistry[toolName]) {
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
    let extractedBase64 = null;
    let fileName = null;
    let tempFilePath = null;

    const hasFile = excelJSON && excelJSON[0] && excelJSON[0].fileBase64;

    if (hasFile) {
      const fileObj = excelJSON[0];
      extractedBase64 = fileObj.fileBase64;
      fileName = fileObj.fileName || "ملف.xlsx";
      
      // حفظ الملف مؤقتماً على السيرفر لكي يقرأه بايثون مباشرة
      const buffer = Buffer.from(extractedBase64, 'base64');
      tempFilePath = path.join(os.tmpdir(), `${Date.now()}_${fileName}`);
      fs.writeFileSync(tempFilePath, buffer);

      session.lastFile = {
        path: tempFilePath,
        name: fileName,
        base64: extractedBase64
      };
    } else if (session.lastFile) {
      tempFilePath = session.lastFile.path;
      fileName = session.lastFile.name;
      extractedBase64 = session.lastFile.base64;
    }

    // 🧠 عقل التوجيه الخفيف (Gemini 3.5 Flash) لتحديد الإجراء فقط
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            action: { type: SchemaType.STRING, description: "modify إذا طلب قراءة أو تعديل، أو chat للدردشة العامة" },
            response: { type: SchemaType.STRING, description: "الرد البشري المناسب" }
          },
          required: ["action", "response"]
        }
      }
    });

    const prompt = `أنت المساعد الذكي لمنصة "الأثير".
طلب المستخدم: "${userContent}"
هل الملف مرفق أو موجود في الجلسة؟ ${tempFilePath ? "نعم" : "لا"}
حدد الإجراء المناسب (modify إذا كان هناك ملف ويطلب قراءته أو تعديله، وإلا chat).`;

    const result = await model.generateContent(prompt);
    let analysisResult;
    try {
      analysisResult = JSON.parse(result.response.text());
    } catch {
      analysisResult = {
        action: tempFilePath ? "modify" : "chat",
        response: "أهلاً بك يا مهندس، أنا مستعد لمعالجة الملف برمجياً."
      };
    }

    if (analysisResult.action === "chat" || !tempFilePath) {
      return res.json({ reply: analysisResult.response });
    }

    // التنفيذ الفوري عبر الأداة ومحرك بايثون مع تمرير مسار الملف الحقيقي
    if (analysisResult.action === "modify" && tempFilePath) {
      try {
        let toolResult = await callFunction("modify", {
          instruction: userContent,
          inputPath: tempFilePath,
          fileName,
        });

        let finalReply = `${analysisResult.response}\n\n`;
        if (toolResult && toolResult.message) {
          finalReply += `📊 **النتيجة:** ${toolResult.message}`;
        }

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
        return res.json({ reply: "⚠️ حدث خطأ أثناء المعالجة المحلية: " + toolError.message });
      }
    }

    return res.json({ reply: analysisResult.response });
  } catch (error) {
    return res.status(500).json({ reply: "⚠️ خطأ تقني: " + error.message });
  }
}

