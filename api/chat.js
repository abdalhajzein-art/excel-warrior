// api/chat.js
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsDefinition } from "./tools/index.js"; // استيراد تعريف الأدوات

export const handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { message } = body;
    const apiKey = process.env.GROQ_API_KEY;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // تم التحديث إلى الموديل الأقوى
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message }
        ],
        tools: toolsDefinition,
        tool_choice: "auto",
        temperature: 0.5
      })
    });

    const data = await response.json();
    
    // للتحقق من الاستجابة في حال ظهر خطأ من الـ API بسبب الموديل
    if (data.error) {
        throw new Error(data.error.message);
    }

    const messageContent = data.choices[0].message;

    // التحقق إذا كان النموذج يريد استدعاء أداة
    if (messageContent.tool_calls) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            reply: "تم استدعاء الأداة", 
            tool_calls: messageContent.tool_calls 
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: messageContent.content })
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: "⚠️ خطأ في المعالجة: " + error.message })
    };
  }
};
