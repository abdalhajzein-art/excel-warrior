export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  try {
    // ⭐ CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    // ⭐ قراءة جسم الطلب يدويًا
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const rawBody = Buffer.concat(buffers).toString();
    const body = rawBody ? JSON.parse(rawBody) : {};
    const message = body?.message;

    if (!message) {
      return res.status(400).json({ error: "No message provided." });
    }

    // ⭐ رد تجريبي بدل OpenRouter
    const reply = `📂 استلمت رسالتك: "${message}"\n(هالرد تجريبي من السيرفر بدون OpenRouter)`;

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
}
