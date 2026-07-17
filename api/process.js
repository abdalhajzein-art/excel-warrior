export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { csv, prompt } = req.body;

  try {
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
    } catch {
      return res.status(500).json({ error: "AI returned invalid JSON", raw });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: "AI response missing content", raw: data });
    }

    res.status(200).json({ csv: content.trim() });

  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
      }
