/**
 * api/geminiService.js – Sovereign Gemini Service (Multi-Key & Native Prompt Edition)
 * ✅ دعم التدوير الآلي لمفاتيح API (Multi-Key Rotation) لتجاوز قيود Rate Limits 429.
 * ✅ التمرير المباشر لـ System Instructions بداخل SDK بدلاً من دمجها في نص المستخدم.
 * ✅ مرونة اسم النموذج واستقرار الاتصال.
 * ✅ تسجيل سجلات الأداء والأداة عبر auditExecution.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";

// 🔑 استخراج المفاتيح ودعم التدوير الآلي (Multi-Key Failover)
const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const API_KEYS = rawKeys.split(",").map(k => k.trim()).filter(Boolean);

if (API_KEYS.length === 0) {
  console.warn("⚠️ WARNING: لم يتم العثور على مفاتيح GEMINI_API_KEY في متغيرات البيئة!");
}

let currentKeyIndex = 0;

/**
 * جلب العميل مع التدوير بين المفاتيح المتاحة
 */
function getGenAIClient() {
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex++;
  return new GoogleGenerativeAI(key);
}

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

/**
 * 🛠️ تنفيذ الاستدعاء مع إعادة المحاولة التلقائية عند حدوث ضغط على المفاتيح
 */
async function executeWithRetry(fn) {
  let attempts = 0;
  const maxAttempts = Math.max(1, API_KEYS.length);
  let lastError = null;

  while (attempts < maxAttempts) {
    try {
      const client = getGenAIClient();
      return await fn(client);
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ [GeminiService] فشل الطلب بالمفتاح الحالي (المحاولة ${attempts + 1}/${maxAttempts}): ${err.message}`);
      attempts++;
    }
  }
  throw lastError;
}

export default async function geminiService(prompt, context = {}) {
  return executeWithRetry(async (client) => {
    const model = client.getGenerativeModel({
      model: MODEL_NAME,
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
  });
}

// ✅ دالة المحادثة التفاعلية (Chat Mode)
geminiService.chat = async function(messages, extra = {}) {
  return executeWithRetry(async (client) => {
    // 1. استخراج رسائل النظام وتمريرها أصلياً لـ systemInstruction
    const systemMessages = messages.filter(m => m.role === "system");
    const systemInstructionText = systemMessages.map(m => m.content).join('\n\n') || `أنت "الأثير" — المساعد الذكي.`;

    const model = client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemInstructionText,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      }
    });

    // 2. بناء تاريخ المحادثة دون خلط رسائل النظام مع رسائل المستخدم
    const history = [];
    let lastUserMessage = "";

    const conversationMsgs = messages.filter(m => m.role !== "system");

    for (let i = 0; i < conversationMsgs.length; i++) {
      const msg = conversationMsgs[i];
      const isLast = i === conversationMsgs.length - 1;

      if (msg.role === "user") {
        if (isLast) {
          lastUserMessage = msg.content;
        } else {
          history.push({ role: "user", parts: [{ text: msg.content }] });
        }
      } else if (msg.role === "assistant" || msg.role === "model") {
        if (!isLast) {
          history.push({ role: "model", parts: [{ text: msg.content }] });
        }
      }
    }

    // 3. إضافة معلومات وصفيّة للملف المرفق بداخل الرسالة الأخيرة فقط
    if (extra.fileName && extra.extractedContent?.metadata && lastUserMessage) {
      const meta = extra.extractedContent.metadata;
      const fileInfo = `
📎 [الملف المرفق النشط]: ${extra.fileName}
- الأبعاد: ${meta.rows || 'غير محدد'} صف | ${meta.columns || 'غير محدد'} عمود
`;
      if (!lastUserMessage.includes(extra.fileName)) {
        lastUserMessage += "\n\n" + fileInfo;
      }
    }

    // 4. بدء جلسة المحادثة وإرسال الطلب
    const chat = model.startChat({
      history: history,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      }
    });

    const result = await chat.sendMessage(lastUserMessage || "مرحباً");
    const response = await result.response;

    auditExecution({
      action: "llm_chat",
      target: extra.fileName || "Active Chat Session",
      isLocal: false,
      usage: response.usageMetadata || null
    });

    return response.text().trim();
  });
};
