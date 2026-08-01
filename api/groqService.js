/**
 * api/groqService.js – Sovereign Gemini Gateway (Wrapped)
 * تم تحويل المحرك الداخلي بالكامل إلى Google Gemini لضمان الذاكرة العملاقة والسيادة المطلقة
 * يدعم نفس الواجهة القديمة تماماً لضمان عدم كسر أي استدعاءات:
 * 1) groqService(prompt)  ← الوضع القديم
 * 2) groqService.chat(messages) ← الوضع السيادي الجديد (Orchestrator)
 */

import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not defined in environment variables.");
}

// تهيئة حزمة جوجل الرسمية باستخدام مفتاحك السيادي
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// اختيار نموذج جيميني الفائق والسريع
const MODEL_NAME = "gemini-2.5-flash";

/* ============================================================
   🟩 الوضع القديم: رسالة واحدة (prompt)
   ============================================================ */
export default async function groqService(prompt) {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0.6,
        maxOutputTokens: 1500,
      }
    });

    return response.text.trim();

  } catch (error) {
    console.error("❌ Gemini Gateway Error (Legacy Mode):", error);
    return "⚠️ حدث خطأ أثناء توليد الرد من محرك جيميني السيادي.";
  }
}

/* ============================================================
   🟦 الوضع السيادي الجديد: مصفوفة رسائل كاملة (مربوط بالـ Orchestrator)
   ============================================================ */
groqService.chat = async function(messages) {
  try {
    let systemInstruction = "";
    const contents = [];

    // تحويل هيكل مصفوفة الرسائل ليتوافق بدقة مع متطلبات محرك جيميني
    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction += msg.content + "\n";
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      }
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        temperature: 0.4,
        maxOutputTokens: 1500,
      }
    });

    return response.text.trim();

  } catch (error) {
    console.error("❌ Gemini Chat Error (Sovereign Mode):", error);
    throw error; // تمرير الخطأ لطبقة الـ Agentic Loop
  }
};
