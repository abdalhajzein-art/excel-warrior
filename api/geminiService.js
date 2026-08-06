/**
 * api/geminiService.js – Sovereign Gemini Service (Flash‑Safe Edition)
 * ✔ بدون systemInstruction نهائياً
 * ✔ SYSTEM_PROMPT داخل history فقط
 * ✔ أول رسالة = user
 * ✔ متوافق مع Node.js 20 + Railway
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";

const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const API_KEYS = rawKeys.split(",").map(k => k.trim()).filter(Boolean);

let currentKeyIndex = 0;

function getClient() {
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex++;
  return new GoogleGenerativeAI(key);
}

const MODEL_FALLBACK_LIST = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview"
];

function isQuotaError(error) {
  return (
    error?.message?.includes("quota") ||
    error?.status === 429 ||
    error?.message?.includes("rate limit") ||
    error?.message?.includes("exhausted")
  );
}

async function executeWithFallback(fn, modelList = MODEL_FALLBACK_LIST) {
  let lastError = null;

  for (let i = 0; i < modelList.length; i++) {
    const modelName = modelList[i];
    try {
      return await fn(modelName);
    } catch (err) {
      lastError = err;
      if (isQuotaError(err)) continue;
      throw err;
    }
  }

  throw new Error(`❌ جميع النماذج فشلت: ${lastError?.message || "خطأ غير معروف"}`);
}

/* ============================================================
   🧠 generateContent (بدون systemInstruction)
   ============================================================ */
export default async function geminiService(prompt) {
  return executeWithFallback(async (modelName) => {
    const client = getClient();

    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 32768
      }
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    return (await result.response).text().trim();
  });
}

/* ============================================================
   💬 Chat Mode (Flash‑Safe)
   ============================================================ */
geminiService.chat = async function (messages, extra = {}) {
  return executeWithFallback(async (modelName) => {

    /* استخراج SYSTEM_PROMPT */
    const systemMessages = messages.filter(m => m.role === "system");
    const systemPromptText = systemMessages.map(m => m.content).join("\n\n");

    /* بناء history */
    const history = [];
    let lastUserMessage = "";

    const conv = messages.filter(m => m.role !== "system");

    for (let i = 0; i < conv.length; i++) {
      const msg = conv[i];
      const isLast = i === conv.length - 1;

      if (msg.role === "user") {
        if (isLast) lastUserMessage = msg.content;
        else history.push({ role: "user", parts: [{ text: msg.content }] });
      }

      if (msg.role === "assistant" && !isLast) {
        history.push({ role: "model", parts: [{ text: msg.content }] });
      }
    }

    /* نضيف SYSTEM_PROMPT داخل history */
    history.push({
      role: "system",
      parts: [{ text: systemPromptText }]
    });

    /* إنشاء النموذج بدون systemInstruction */
    const client = getClient();
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 32768
      }
    });

    /* بدء جلسة الدردشة */
    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 32768
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
