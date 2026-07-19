export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { message } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        reply: "⚠️ GROQ_API_KEY غير موجود ضمن المتغيرات البيئية"
      });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "رد بشكل طبيعي حسب أسلوب المستخدم، ولا تنشئ هوية أو اسم لنفسك."
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.4
      })
    });

    const data = await response.json();

    if (data?.choices?.[0]?.message?.content) {
      return res.status(200).json({
        reply: data.choices[0].message.content
      });
    } else {
      return res.status(500).json({
        reply: "⚠️ الخطأ الكامل من Groq: " + JSON.stringify(data)
      });
    }

  } catch (error) {
    return res.status(500).json({
      reply: "⚠️ خطأ في الاتصال: " + error.message
    });
  }
}
