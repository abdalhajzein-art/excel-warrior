/**
 * api/geminiService.js – Sovereign Gemini Service (Ultra Edition)
 * Multi‑Key + SystemInstruction + DeepContext + FileAware + OperationAware
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";

const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const API_KEYS = rawKeys.split(",").map(k => k.trim()).filter(Boolean);

let currentKeyIndex = 0;

/* ============================================================
   🔑 اختيار المفتاح مع Failover ذكي
   ============================================================ */
function getClient() {
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex++;
  return new GoogleGenerativeAI(key);
}

/* ============================================================
   🔁 تنفيذ مع إعادة المحاولة السيادية
   ============================================================ */
async function executeWithRetry(fn) {
  let attempts = 0;
  let lastError = null;

  while (attempts < API_KEYS.length) {
    try {
      const client = getClient();
      return await fn(client);
    } catch (err) {
      lastError = err;
      attempts++;
      console.warn(`⚠️ [GeminiService] فشل المفتاح رقم ${attempts}: ${err.message}`);
    }
  }

  throw lastError;
}

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

/* ============================================================
   🧠 وضع المحادثة السيادي
   ============================================================ */
export default async function geminiService(prompt, ctx = {}) {
  return executeWithRetry(async (client) => {
    const model = client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: ctx.systemInstruction || "أنت مساعد سيادي في منصة الأثير.",
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 4096,
      }
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const response = await result.response;

    auditExecution({
      action: "llm_inference",
      target: ctx.fileName || "General Query",
      usage: response.usageMetadata || null
    });

    return response.text().trim();
  });
}

/* ============================================================
   💬 وضع المحادثة المتعدد الأدوار (Ultra Chat)
   ============================================================ */
geminiService.chat = async function(messages, extra = {}) {
  return executeWithRetry(async (client) => {

    /* ------------------------------------------------------------
       1) استخراج رسائل النظام وتمريرها كـ systemInstruction
       ------------------------------------------------------------ */
    const systemMessages = messages.filter(m => m.role === "system");
    const systemInstruction = systemMessages.map(m => m.content).join("\n\n");

    /* ------------------------------------------------------------
       2) بناء History نظيف بدون خلط الأدوار
       ------------------------------------------------------------ */
    const history = [];
    let lastUserMessage = "";

    const conv = messages.filter(m => m.role !== "system");

    for (let i = 0; i < conv.length; i++) {
      const msg = conv[i];
      const isLast = i === conv.length - 1;

      if (msg.role === "user") {
        if (isLast) {
          lastUserMessage = msg.content;
        } else {
          history.push({ role: "user", parts: [{ text: msg.content }] });
        }
      }

      if (msg.role === "assistant") {
        if (!isLast) {
          history.push({ role: "assistant", parts: [{ text: msg.content }] });
        }
      }
    }

    /* ------------------------------------------------------------
       3) حقن معلومات الملف النشط داخل الرسالة الأخيرة فقط
       ------------------------------------------------------------ */
    if (extra.fileName && extra.extractedContent?.metadata) {
      const meta = extra.extractedContent.metadata;

      const fileInfo = `
📎 **الملف النشط:** ${extra.fileName}
- الصفوف: ${meta.rows || "?"}
- الأعمدة: ${meta.columns || "?"}
`;

      lastUserMessage += "\n\n" + fileInfo;
    }

    /* ------------------------------------------------------------
       4) بدء جلسة المحادثة السيادية
       ------------------------------------------------------------ */
    const model = client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction,
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 4096,
      }
    });

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 4096,
      }
    });

    const result = await chat.sendMessage(lastUserMessage || "مرحبا");
    const response = await result.response;

    auditExecution({
      action: "llm_chat",
      target: extra.fileName || "Active Chat",
      usage: response.usageMetadata || null
    });

    return response.text().trim();
  });
};
