import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
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
        model: "mistral-tiny",
        messages: [
          { role: "system", content: "أنت خبير Excel. أرجع CSV فقط." },
          { role: "user", content: `CSV:\n${csv}\n\nتعليمات:\n${prompt}` }
        ]
      })
    });

    const data = await response.json();

    res.json({ csv: data.choices[0].message.content });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "AI processing failed" });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Excel Warrior API running")
);
