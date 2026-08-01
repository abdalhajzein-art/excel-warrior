/**
 * api/groqService.js – Sovereign LLM Gateway
 */

import { Groq } from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function groqService(prompt) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "أنت الأثير — رد دائماً برد لغوي واضح." },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_completion_tokens: 1500,
      top_p: 1,
      stream: false
    });

    // ⭐⭐⭐ الأسطر المطلوبة:
    console.log("🔍 Raw Groq Response:", completion);
    console.log("🔍 Message Object:", completion.choices[0].message);
    console.log("🔍 Message Content:", completion.choices[0].message.content);

    return completion.choices[0].message.content.trim();

  } catch (error) {
    console.error("❌ Groq Gateway Error:", error);
    return "⚠️ حدث خطأ أثناء توليد الرد.";
  }
}
