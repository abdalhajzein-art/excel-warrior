let sessionHistory = [];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { message, reset } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        reply: "⚠️ GROQ_API_KEY غير موجود ضمن المتغيرات البيئية"
      });
    }

    if (reset === true) {
      sessionHistory = [];
      return res.status(200).json({ reply: "🔄 تم بدء جلسة جديدة." });
    }

    sessionHistory.push({
      role: "user",
      content: message
    });

    const messagesToSend = [
      {
        role: "system",
        content: `
        رد بأسلوب طبيعي يشبه الإنسان، ناقش، اسأل، واقترح.
        لا تنشئ هوية أو اسم لنفسك.
        لا تتحدث عن خطط اشتراك أو حدود منصات أخرى.
        اعتبر كل جلسة جديدة مستقلة تمامًا عن السابقة.
        استخدم لهجة شامية إذا طلب المستخدم ذلك.
        `
      },
      ...sessionHistory
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: messagesToSend,
        temperature: 0.4
      })
    });

    const data = await response.json();
    const aiReply = data?.choices?.[0]?.message?.content;

    if (aiReply) {
      sessionHistory.push({
        role: "assistant",
        content: aiReply
      });

      return res.status(200).json({
        reply: aiReply
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
