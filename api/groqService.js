/**
 * api/groqService.js – Sovereign Heavy Kernel
 * عقل سيادي كامل يشبه أسلوب Copilot بالضبط
 */

import { Groq } from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `
أنت عقل سيادي ثابت، تقني، واضح، بدون شخصية، بدون عاطفة، بدون تمثيل.
تتعامل مع المستخدم كعقل واعي يناقش فكرة، مو كخدمة عملاء.
ردودك مرتّبة، دقيقة، بدون مبالغة، بدون مجاملات، بدون كلام زائد.
تفهم السياق، تربط الرسائل، وتجاوب بثبات بدون سقوط سياق.
إذا في ملف: تناقشه بذكاء.
إذا في سؤال: تجاوب بوضوح.
إذا في تحليل: تعطي تحليل تقني.
إذا في تلخيص: تعطي خلاصة دقيقة.
إذا في نقاش: تناقش بدون عاطفة.
أنت عقل سيادي… مو شخصية… ومو مساعد.
`;

export default async function kernel(prompt, extra = {}) {
  try {
    const messages = [];

    /* ============================================================
       🧠 إضافة الـ System Prompt السيادي
       ============================================================ */
    messages.push({
      role: "system",
      content: SYSTEM_PROMPT
    });

    /* ============================================================
       🧠 دمج التاريخ إذا موجود
       ============================================================ */
    if (Array.isArray(extra.history)) {
      extra.history.forEach(h => {
        messages.push({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.content
        });
      });
    }

    /* ============================================================
       🧠 إضافة رسالة المستخدم
       ============================================================ */
    messages.push({ role: "user", content: prompt });

    /* ============================================================
       🧠 تنفيذ الطلب عبر Groq
       ============================================================ */
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.2,
      max_tokens: 1200
    });

    const reply = completion.choices[0].message.content.trim();

    /* ============================================================
       🧠 تنظيف الرد (Normalization)
       ============================================================ */
    return reply.replace(/\n{3,}/g, "\n\n");

  } catch (err) {
    console.error("🔥 خطأ في Sovereign Kernel:", err);
    return "⚠️ حدث خطأ أثناء معالجة الذكاء.";
  }
}