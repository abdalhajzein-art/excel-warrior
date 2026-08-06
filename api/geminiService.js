/**
 * api/geminiService.js – Sovereign Gemini Service (Gemini-Like Harmonized Edition)
 * ⭐ النسخة المصحّحة بالكامل – مع تمرير systemInstruction داخل startChat
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
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview'
];

function isQuotaError(error) {
    return error?.message?.includes('quota') || 
           error?.status === 429 || 
           error?.message?.includes('rate limit') ||
           error?.message?.includes('exhausted');
}

async function executeWithFallback(fn, modelList = MODEL_FALLBACK_LIST) {
    let lastError = null;

    for (let i = 0; i < modelList.length; i++) {
        const modelName = modelList[i];
        try {
            const result = await fn(modelName);
            return result;
        } catch (err) {
            lastError = err;
            if (isQuotaError(err)) {
                console.warn(`⚠️ [GeminiService] النموذج ${modelName} تجاوز الحدود، جرب التالي...`);
                continue;
            }
            throw err;
        }
    }

    throw new Error(`❌ جميع النماذج فشلت: ${lastError?.message || 'خطأ غير معروف'}`);
}

export default async function geminiService(prompt, ctx = {}) {
  return executeWithFallback(async (modelName) => {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: ctx.systemInstruction || "أنت مساعد سيادي في منصة الأثير.",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 32768,
      }
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const response = await result.response;
    return response.text().trim();
  });
}

/* ============================================================
   💬 وضع المحادثة المتعدد الأدوار (Gemini-Like Chat)
   ============================================================ */
geminiService.chat = async function(messages, extra = {}) {
  return executeWithFallback(async (modelName) => {

    let systemMessages = messages.filter(m => m.role === "system");
    let systemInstruction = systemMessages.map(m => m.content).join("\n\n");

    if (extra.fileName && extra.extractedContent) {
      const meta = extra.extractedContent;
      const fileContextDesc = `\n\n[سياق الملف النشط حالياً في الجلسة]:\n- اسم الملف: ${extra.fileName}\n- عينة المحتوى:\n${meta.text ? meta.text.slice(0, 2000) : 'متاح للتحليل'}\n`;
      systemInstruction += fileContextDesc;
    }

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
          history.push({ role: "model", parts: [{ text: msg.content }] });
        }
      }
    }

    const client = getClient();
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction,   // ← مهم جداً
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 32768,
      }
    });

    const chat = model.startChat({
      history,
      systemInstruction,   // ← السطر السحري الذي كان ناقصاً
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 32768,
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
