/**
 * api/geminiService.js – Sovereign Gemini Service (Ultra Harmonized Edition)
 * متوافق بالكامل مع Dual‑Mode Kernel + Excel Intent Detector + Multi‑Sheet Preview
 * ✅ دعم Failover بين النماذج تلقائياً (Model Fallback)
 * ✅ زيادة maxOutputTokens لاستيعاب الكود الطويل
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
   🔁 تنفيذ مع إعادة المحاولة السيادية (مع Fallback بين النماذج)
   ============================================================ */

// ✅ قائمة النماذج المدعومة (مرتبة حسب الأولوية)
const MODEL_FALLBACK_LIST = [
    'gemini-3.6-flash',          // الأحدث، الأقوى (Stable)
    'gemini-3.5-flash-lite',     // الأسرع، الأقل تكلفة
    'gemini-3.1-pro-preview'     // الأقوى في الاستدلال (Preview)
];

// ✅ الدوال التي ترمي أخطاء Quota
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
            console.log(`🔄 [GeminiService] محاولة النموذج ${i+1}/${modelList.length}: ${modelName}`);
            
            // ✅ تمرير النموذج الحالي للدالة
            const result = await fn(modelName);
            
            // ✅ إذا نجحنا، نعيد النتيجة
            console.log(`✅ [GeminiService] نجح النموذج: ${modelName}`);
            return result;
            
        } catch (err) {
            lastError = err;
            
            // ✅ إذا كان خطأ Quota أو Rate Limit، ننتقل للنموذج التالي
            if (isQuotaError(err)) {
                console.warn(`⚠️ [GeminiService] النموذج ${modelName} تجاوز الحدود اليومية، جرب التالي...`);
                continue;
            }
            
            // ✅ إذا كان خطأ آخر، نرميه فوراً (لا نستمر)
            throw err;
        }
    }

    // ✅ إذا انتهت القائمة ولم ينجح أي نموذج
    throw new Error(`❌ جميع النماذج فشلت: ${lastError?.message || 'خطأ غير معروف'}`);
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

/* ============================================================
   🧠 وضع المحادثة الأحادي
   ============================================================ */
export default async function geminiService(prompt, ctx = {}) {
  return executeWithFallback(async (modelName) => {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: ctx.systemInstruction || "أنت مساعد سيادي في منصة الأثير.",
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 32768, // ✅ زيادة لاستيعاب الكود الطويل
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
   💬 وضع المحادثة المتعدد الأدوار (Ultra Chat – Harmonized)
   ============================================================ */
geminiService.chat = async function(messages, extra = {}) {
  return executeWithFallback(async (modelName) => {

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
          history.push({ role: "model", parts: [{ text: msg.content }] });
        }
      }
    }

    /* ------------------------------------------------------------
       3) حقن معلومات الملف فقط عند وجود نية تعديل إكسل
       ------------------------------------------------------------ */
    const isExcelModification = extra.intent === "excel_modification";

    if (isExcelModification && extra.fileName && extra.extractedContent) {
      const meta = extra.extractedContent;

      const fileInfo = `
📎 **الملف النشط:** ${extra.fileName}
📊 عدد الشيتات: ${meta.sheets_count || meta.sheets?.length || "?"}
🧩 الشيتات: ${Array.isArray(meta.sheets) ? meta.sheets.join(", ") : "?"}
`;

      lastUserMessage += "\n\n" + fileInfo;
    }

    /* ------------------------------------------------------------
       4) بدء جلسة المحادثة السيادية
       ------------------------------------------------------------ */
    const client = getClient();
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 32768, // ✅ زيادة لاستيعاب الكود الطويل
      }
    });

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 32768, // ✅ زيادة لاستيعاب الكود الطويل
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
