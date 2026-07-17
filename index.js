import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// ⭐ خدمة ملفات الواجهة من الجذر
app.use(express.static("."));

app.post("/process", async (req, res) => {
  try {
    const { csv, prompt } = req.body;

    // ⭐ طلب OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",   // ⭐ الموديل الصحيح
        messages: [
          { role: "system", content: "أنت خبير Excel. أرجع CSV فقط." },
          { role: "user", content: `CSV:\n${csv}\n\nتعليمات:\n${prompt}` }
        ]
      })
    });

    // ⭐ طباعة الرد الخام من OpenRouter
    const raw = await response.text();
    console.log("RAW RESPONSE:", raw);

    // ⭐ محاولة تحويل الرد إلى JSON
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({
        error: "AI returned invalid JSON",
        raw
      });
    }

    // ⭐ التحقق من وجود الرد الصحيح
    if (!data?.choices?.[0]?.message?.content) {
      return res.status(500).json({
        error: "AI response missing content",
        raw: data
      });
    }

    // ⭐ إرسال CSV المعدّل للواجهة
    res.json({ csv: data.choices[0].message.content.trim() });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({
      error: "AI processing failed",
      details: error.message
    });
  }
});

// ⭐ تشغيل السيرفر
app.listen(process.env.PORT || 3000, () =>
  console.log("Excel Warrior API running")
);
