import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { executeTool } from "./tools/execute.js";
import { toolsRegistry } from "./tools/index.js";

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

    const hasFile = excelJSON && excelJSON[0] && excelJSON[0].fileBase64;

    if (hasFile) {
      const fileObj = excelJSON[0];
      extractedBase64 = fileObj.fileBase64;
      fileName = fileObj.fileName || "ملف.xlsx";
      session.lastFile = { base64: extractedBase64, name: fileName };
    } else if (session.lastFile) {
      extractedBase64 = session.lastFile.base64;
      fileName = session.lastFile.name;
    }

    // 🧠 الاعتماد الحصري على نموذج gemini-3.5-flash للسرعة وصفر استهلاك للتوكنز
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            action: { type: SchemaType.STRING, description: "modify أو chat" },
            response: { type: SchemaType.STRING, description: "الرد البشري المناسب" }
          },
          required: ["action", "response"]
        }
      }
    });

    const prompt = `أنت المساعد الذكي لمنصة "الأثير". افهم طلب المستخدم:
طلب المستخدم: "${userContent}"
هل يتطلب تعديل ملف إكسل؟ حدد الإجراء بـ modify وإلا اجعله chat.`;

    const result = await model.generateContent(prompt);
    let analysisResult;
    try {
      analysisResult = JSON.parse(result.response.text());
    } catch {
      analysisResult = {
        action: hasFile ? "modify" : "chat",
        response: "أهلاً بك يا مهندس، أنا مستعد لتنفيذ طلبك عبر محرك بايثون العام."
      };
    }

    if (analysisResult.action === "chat" || !hasFile) {
      return res.json({ reply: analysisResult.response });
    }

    if (analysisResult.action === "modify" && extractedBase64) {
      try {
        let toolResult = await callFunction("modify", {
          instruction: userContent,
          base64: extractedBase64,
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
        console.error("❌ خطأ في التنفيذ:", toolError);
        return res.json({ reply: "⚠️ حدث خطأ أثناء المعالجة المحلية: " + toolError.message });
      }
    }

    return res.json({ reply: analysisResult.response });
  } catch (error) {
    return res.status(500).json({ reply: "⚠️ خطأ تقني: " + error.message });
  }
}
