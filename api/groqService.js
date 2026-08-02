/**
 * api/groqService.js – Sovereign Gemini Gateway
 * محرك الربط السيادي لـ Google Gemini عبر الحزمة الرسمية والمستقرة
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not defined in environment variables.");
}

// تهيئة العميل باستخدام المفتاح السيادي الخاص بك
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// استخدام أحدث نموذج فائق السرعة
const MODEL_NAME = "gemini-3.5-flash-lite";

/* ============================================================
   🟩 الوضع القديم: رسالة واحدة (prompt)
   ============================================================ */
export default async function groqService(prompt) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: "أنت الأثير — رد دائماً برد لغوي واضح."
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();

  } catch (error) {
    console.error("❌ Gemini Gateway Error (Legacy Mode):", error);
    return "⚠️ حدث خطأ أثناء توليد الرد من محرك جيميني.";
  }
}

/* ============================================================
   🟦 الوضع السيادي الجديد: مصفوفة رسائل كاملة + دعم fileData (الحقن المباشر الآمن)
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

    // استخراج الرسالة الأخيرة للمستخدم لتكون هي الطلب الحالي
    const lastMessage = history.pop();

    // ⭐ الحقن المباشر لبيانات الملف ضمن النص (أكثر استقراراً وأماناً مع جيميني وتوفيراً للتوكنز)
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

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      ...(systemInstruction ? { systemInstruction: systemInstruction.trim() } : {})
    });

    const chat = model.startChat({
      history: history,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1500,
      }
    });

    // إرسال الرسالة الأخيرة مع سياق الملف المدمج
    const result = await chat.sendMessage(lastMessage ? lastMessage.parts[0].text : "");
    const response = await result.response;
    return response.text().trim();

  } catch (error) {
    console.error("❌ Gemini Chat Error (Sovereign Mode):", error);
    throw error;
  }
};

