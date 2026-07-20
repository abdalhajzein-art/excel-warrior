// api/chat.js
import { SYSTEM_PROMPT } from "./agent/system.js";

export const handler = async (event, context) => {
  // 1. التأكد من أن الطلب من نوع POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 2. تحليل جسم الطلب
    const body = JSON.parse(event.body);
    const { message, excelJSON } = body;
    const apiKey = process.env.GROQ_API_KEY;

    // 3. الاتصال بـ Groq
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message }
        ],
        temperature: 0.5
      })
    });

    const data = await response.json();

    // 4. إرجاع الرد بتنسيق Netlify المطلوب
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: data.choices[0].message.content })
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: "⚠️ خطأ في معالجة الطلب: " + error.message })
    };
  }
};
