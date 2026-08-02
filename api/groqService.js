/**
 * api/groqService.js – Sovereign Gemini Gateway (Optimized for Gemini 3.6 Flash)
 * محرك الربط السيادي لـ Google Gemini مع إدارة محسنة للنافذة والتوكنز والـ JSON الإلزامي
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not defined in environment variables.");
}

// تهيئة العميل باستخدام المفتاح السيادي
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// استخدام النموذج المعتمد
const MODEL_NAME = "gemini-3.5-flash-lite";

/* ============================================================
   🟩 الوضع القديم: رسالة واحدة (Legacy Prompt Mode)
   ============================================================ */
export default async function groqService(prompt) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: "أنت الأثير — المساعد السيادي الذكي. رد دائماً بدقة واحترافية بصيغة JSON."
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      }
    });
    
    const response = await result.response;

    // 🛡️ تسجيل الاستدعاء في المرصد السيادي
    auditExecution({
      action: "llm_inference_legacy",
      target: "General Prompt",
      isLocal: false,
      usage: response.usageMetadata || null
    });

    return response.text().trim();

  } catch (error) {
    console.error("❌ Gemini Gateway Error (Legacy Mode):", error);
    return JSON.stringify({
      intent: "chat",
      reply: "⚠️ حدث خطأ أثناء توليد الرد من محرك جيميني.",
      python_code: ""
    });
  }
}

/* ============================================================
   🟦 الوضع السيادي المتقدم: معالجة مصفوفة الرسائل + السياق والملفات
   ============================================================ */
groqService.chat = async function(messages, extra = {}) {
  try {
    let systemInstruction = "";
    const history = [];

    // تصفية وترتيب الرسائل بنظام هيكل جيميني
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

    // استخراج الرسالة الأخيرة للمستخدم
    const lastMessage = history.pop();

    // الحقن البرمجي لبيانات الملف المستخرجة إن وجدت
    if (extra.fileData) {
      const fileContextSnippet = `\n\n[بيانات الملف المرفق المستخرجة]:\n${JSON.stringify(extra.fileData, null, 2)}`;
      if (lastMessage) {
        lastMessage.parts[0].text += fileContextSnippet;
      } else {
        history.push({
          role: "user",
          parts: [{ text: fileContextSnippet }]
        });
      }
    }

    // إعداد النموذج مع التعليمات النظامية المحسنة
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      ...(systemInstruction ? { systemInstruction: systemInstruction.trim() } : {})
    });

    const chat = model.startChat({
      history: history,
      generationConfig: {
        temperature: 0.1, // تثبيت الدقة لضمان صياغة دقيقة لـ JSON وكود بايثون
        maxOutputTokens: 8192,
        responseMimeType: "application/json", // 🔥 القفل السيادي الإلزامي لجيميني لمنع الدردشة النصية وإجبار الـ JSON
      }
    });

    // إرسال الطلب النهائي
    const result = await chat.sendMessage(lastMessage ? lastMessage.parts[0].text : "");
    const response = await result.response;

    // 🛡️ توثيق استهلاك التوكنز في المرصد السيادي
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
