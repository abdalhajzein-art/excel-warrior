export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // استخدام الرابط العام مع تمرير المفتاح في الـ Header (أكثر أماناً وموثوقية)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;

    const response = await fetch(`${url}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    });

    const data = await response.json();
    
    // طباعة كاملة للـ data إذا حدث خطأ لنرى السبب الحقيقي
    if (data.candidates) {
      return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });
    } else {
      return res.status(500).json({ reply: "الخطأ الكامل من جوجل: " + JSON.stringify(data) });
    }
  } catch (error) {
    return res.status(500).json({ reply: "خطأ في الاتصال: " + error.message });
  }
}
