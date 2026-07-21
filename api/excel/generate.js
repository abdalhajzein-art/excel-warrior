// api/excel/generate.js
import xlsx from "xlsx";

// الدالة المسؤولة عن التوليد البرمجي الفعلي (تستخدم داخلياً أو عبر الأدوات)
export async function generateExcelHandler(payload) {
  const { instruction } = payload || {};
  if (!instruction) {
    throw new Error("لا يوجد طلب توليد مرفق.");
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("مفتاح API غير متوفر.");
  }

  const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b", // النموذج القوي لتوليد البيانات بدقة
      messages: [
        {
          role: "system",
          content: "ولّد جدول Excel بصيغة JSON array فقط بدون أي نصوص إضافية."
        },
        {
          role: "user",
          content: instruction
        }
      ]
    })
  });

  const aiData = await aiRes.json();
  if (aiData.error) {
    throw new Error(aiData.error.message);
  }

  let rawContent = aiData.choices[0].message.content.trim();
  // تنظيف النص في حال أضاف النموذج علامات تدوين كود
  if (rawContent.startsWith("```json")) {
    rawContent = rawContent.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (rawContent.startsWith("```")) {
    rawContent = rawContent.replace(/^```/, "").replace(/```$/, "").trim();
  }

  const json = JSON.parse(rawContent);

  const worksheet = xlsx.utils.json_to_sheet(json);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buffer);
}

// مسار الـ API للطلبات المباشرة
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const bufferResult = await generateExcelHandler(body);

    res.setHeader("Content-Disposition", "attachment; filename=generated.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return res.status(200).send(bufferResult);

  } catch (err) {
    console.error("Error in generate excel:", err);
    return res.status(500).json({ error: "خطأ في التوليد: " + err.message });
  }
}
