export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed" });

  try {
    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // سنستخدم gemini-1.5-flash ولكن مع تصحيح المسار ليكون متوافقاً مع v1beta
    // وهذا المسار هو المسار الرسمي المعتمد حالياً للنماذج
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: message }] }]
      })
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });
    } else {
      return res.status(500).json({ reply: "خطأ في استجابة جوجل: " + JSON.stringify(data) });
    }
  } catch (error) {
    return res.status(500).json({ reply: "خطأ تقني: " + error.message });
  }
}
