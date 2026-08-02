/**
 * api/groqService.js – Sovereign Gemini Gateway (Optimized & Natural Edition)
 * جسر الاتصال السيادي مع Google Gemini - مصمم لدعم الحوار الطبيعي ومنع عرض الـ JSON الخام
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not defined in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-3.5-flash-lite";

/* ============================================================
   🟩 الوضع القديم: رسالة واحدة (Legacy Prompt Mode)
   ============================================================ */
export default async function groqService(prompt) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: "أنت الأثير — المساعد السيادي الذكي. قدم إجابات دقيقة، مهنية، وواضحة باللغة العربية."
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      }
    });
    
    const response = await result.response;

    auditExecution({
      action: "llm_inference_legacy",
      target: "General Prompt",
      isLocal: false,
      usage: response.usageMetadata || null
    });

    return response.text().trim();

  } catch (error) {
    console.error("❌ Gemini Gateway Error (Legacy Mode):", error);
    return "⚠️ حدث خطأ أثناء توليد الرد من محرك جيميني.";
  }
}

/* ============================================================
   🟦 الوضع السيادي المتقدم: معالجة المحادثة والسياق الطبيعي
   ============================================================ */
groqService.chat = async function(messages, extra = {}) {
  try {
    let systemInstruction = "";
    const history = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction += msg.content + "\n";
      } else {
        history.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      }
    }

    const lastMessage = history.pop();

    // 🛡️ حماية التوكنز: حقن ملخص خفيف لبيانات الملف بدلاً من رميها كاملة في كل رسالة
    if (extra.fileData && lastMessage) {
      const fileSummarySnippet = `\n\n[ملاحظة نظامية: يوجد ملف نشط مرفق في الجلسة حالياً باسم "${extra.fileName || 'ملف بيانات'}" وتم استلامه بنجاح].`;
      lastMessage.parts[0].text += fileSummarySnippet;
    }

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      ...(systemInstruction ? { systemInstruction: systemInstruction.trim() } : {})
    });

    const chat = model.startChat({
      history: history,
      generationConfig: {
        temperature: 0.3, // مرونة موزونة للسياق اللغوي
        maxOutputTokens: 8192,
        // تم حذف responseMimeType: "application/json" نهائياً ليتمكن النموذج من الرد بشكل نصي طبيعي وجميل
      }
    });

    const result = await chat.sendMessage(lastMessage ? lastMessage.parts[0].text : "");
    const response = await result.response;

    auditExecution({
      action: "llm_strategic_analysis",
      target: extra.fileName || "Active Chat Session",
      isLocal: false,
      usage: response.usageMetadata || null
    });

    return response.text().trim();

  } catch (error) {
    console.error("❌ Gemini Chat Error (Sovereign Mode):", error);
    throw error;
  }
};

