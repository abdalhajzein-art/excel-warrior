import xlsx from "xlsx";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { content, instruction } = req.body;

    if (!content || !instruction) {
      return res.status(400).json({ error: "البيانات غير كاملة" });
    }

    const apiKey = process.env.GROQ_API_KEY;

    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "عدّل بيانات الجدول حسب طلب المستخدم وأرجع JSON فقط."
          },
          {
            role: "user",
            content: `البيانات:\n${JSON.stringify(content)}\n\nالتعديل المطلوب:\n${instruction}`
          }
        ]
      })
    });

    const aiData = await aiRes.json();
    const modifiedJson = JSON.parse(aiData.choices[0].message.content);

    const worksheet = xlsx.utils.json_to_sheet(modifiedJson);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=modified.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return res.status(200).send(buffer);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
