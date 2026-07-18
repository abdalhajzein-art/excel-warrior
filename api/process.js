export default async function handler(req, res) {
  // ⭐ السماح بالـ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ⭐ معالجة طلب OPTIONS (preflight)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ⭐ السماح فقط بـ POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { csv, prompt } = req.body;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: "أنت خبير Excel. أرجع CSV فقط." },
          { role: "user", content: `CSV:\n${csv}\n\nتعليمات:\n${prompt}` }
        ]
      })
    });

    const raw = await response.text();

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({
        error: "AI returned invalid JSON",
        raw
      });
    }

    if (!data?.choices?.[0]?.message?.content) {
      return res.status(500).json({
        error: "AI response missing content",
        raw: data
      });
    }

    return res.status(200).json({
      csv: data.choices[0].message.content.trim()
    });

  } catch (error) {
    return res.status(500).json({
      error: "AI processing failed",
      details: error.message
    });
  }
}
