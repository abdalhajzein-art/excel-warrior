/**
 * api/geminiService.js – Sovereign Gemini Service
 * ✅ جسر تواصل بسيط، لا يحتوي على تعليمات خاصة
 * ✅ يستقبل التعليمات من kernel الذي يستوردها من system.js
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not defined in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-3.5-flash-lite";

// ✅ تعليمات أساسية بسيطة جداً، لأن كل التعليمات تأتي من system.js
const BASE_INSTRUCTION = `أنت "الأثير" — المساعد الذكي.`;

export default async function geminiService(prompt, context = {}) {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: BASE_INSTRUCTION,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      }
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const response = await result.response;

    auditExecution({
      action: "llm_inference",
      target: context.fileName || "General Query",
      isLocal: false,
      usage: response.usageMetadata || null
    });

    return response.text().trim();

  } catch (error) {
    console.error("❌ Gemini Service Error:", error);
    return "⚠️ حدث خطأ أثناء توليد الرد.";
  }
}

// ✅ دالة chat
geminiService.chat = async function(messages, extra = {}) {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: BASE_INSTRUCTION,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      }
    });

    const history = [];
    let lastUserMessage = "";

    for (const msg of messages) {
      if (msg.role === "system") {
        // ✅ رسائل النظام تمرر كسياق، لا نتجاهلها
        continue;
      }
      if (msg.role === "user") {
        lastUserMessage = msg.content;
        history.push({ role: "user", parts: [{ text: msg.content }] });
      } else if (msg.role === "assistant" || msg.role === "model") {
        history.push({ role: "model", parts: [{ text: msg.content }] });
      }
    }

    // ✅ نضيف رسائل النظام كسياق في بداية آخر رسالة
    const systemMessages = messages.filter(m => m.role === "system");
    if (systemMessages.length > 0) {
      const systemContent = systemMessages.map(m => m.content).join('\n');
      if (lastUserMessage) {
        lastUserMessage = `${systemContent}\n\n[المستخدم]:\n${lastUserMessage}`;
      }
    }

    // ✅ إضافة معلومات الملف
    if (extra.fileName && extra.extractedContent?.metadata) {
      const meta = extra.extractedContent.metadata;
      const fileInfo = `
📎 [ملف مرفق]: ${extra.fileName}
- الصفوف: ${meta.rows || 'غير معروف'}
- الأعمدة: ${meta.columns || 'غير معروف'}
`;
      if (lastUserMessage) {
        lastUserMessage += "\n\n" + fileInfo;
      }
    }

    const chat = model.startChat({
      history: history.slice(0, -1),
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      }
    });

    const result = await chat.sendMessage(lastUserMessage);
    const response = await result.response;

    auditExecution({
      action: "llm_chat",
      target: extra.fileName || "Active Chat Session",
      isLocal: false,
      usage: response.usageMetadata || null
    });

    return response.text().trim();

  } catch (error) {
    console.error("❌ Gemini Chat Error:", error);
    throw error;
  }
};
