export default async function handler(req, res) {
  try {
    // قراءة جسم الطلب يدويًا لأن req.json() غير موجود في Node.js
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

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1",
        messages: [
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "No response from model.";

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: "Server error", details: error.message });
  }
}
