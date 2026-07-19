import xlsx from "xlsx";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { instruction } = req.body;

    if (!instruction) {
      return res.status(400).json({ error: "لا يوجد طلب توليد" });
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
            content: "ولّد جدول Excel بصيغة JSON فقط."
          },
          {
            role: "user",
            content: instruction
          }
        ]
      })
    });

    const aiData = await aiRes.json();
    const json = JSON.parse(aiData.choices[0].message.content);

    const worksheet = xlsx.utils.json_to_sheet(json);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=generated.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return res.status(200).send(buffer);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
