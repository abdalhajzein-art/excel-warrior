import xlsx from "xlsx";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

export async function generateExcelHandler(payload) {
  const { instruction } = payload || {};
  if (!instruction) {
    throw new Error("لا يوجد طلب توليد مرفق.");
  }

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: `ولّد جدول Excel بناءً على الطلب التالي وأرجعه حصرياً بصيغة JSON array (مصفوفة كائنات) بدون أي نصوص أو شروحات إضافية وبدون علامات تنسيق الكود:\n${instruction}`
  });

  let rawContent = response.text.trim();
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
