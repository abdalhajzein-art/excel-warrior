import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// ⭐ تفعيل CORS بشكل كامل
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

app.post("/process", async (req, res) => {
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
    console.log("RAW RESPONSE:", raw);

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

    res.json({ csv: data.choices[0].message.content.trim() });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({
      error: "AI processing failed",
      details: error.message
    });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Excel Warrior API running on Railway")
);
