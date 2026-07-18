export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  try {
    // ⭐ CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    // ⭐ قراءة جسم الطلب يدويًا
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const rawBody = Buffer.concat(buffers).toString();
    const body = rawBody ? JSON.parse(rawBody) : {};
    const message = body?.message;

    if (!message) {
      return res.status(400).json({ error: "No message provided." });
    }

    // ⭐ إرسال الطلب إلى OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://excel-warrior.vercel.app",   // ← عدّلها حسب دومين واجهتك
        "X-Title": "Excel Warrior AI"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1",
        messages: [
          { role: "user", content: message }
        ]
      })
    });

    // ⭐ فحص نجاح الطلب
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({
        error: "OpenRouter error",
        details: errorText
      });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "No response from model.";

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
}
