import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// السماح للواجهة بالاتصال بالسيرفر
app.use(cors());
app.use(express.json());

// المسار الرسمي الذي تتصل به الواجهة
app.post("/process", async (req, res) => {
  try {
    const { csv, prompt } = req.body;

    // إرسال الطلب إلى OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "أنت خبير Excel. أرجع CSV فقط." },
          { role: "user", content: `CSV:\n${csv}\n\nتعليمات:\n${prompt}` }
        ]
      })
    });

    const data = await response.json();

    // إرجاع CSV المعدّل للواجهة
    res.json({ csv: data.choices[0].message.content });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "AI processing failed" });
  }
});

// تشغيل السيرفر على المنفذ الصحيح الخاص بـ Railway
app.listen(process.env.PORT || 3000, () =>
  console.log("Excel Warrior API running")
);
