import Groq from "groq-sdk";

// تهيئة عميل Groq باستخدام مفتاح البيئة
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function askGroqStructured(metadata, userInstruction) {
  try {
    const prompt = `
أنت خبير معالجة جداول بيانات Excel لمنصة "الأثير".
هيكل الملف (Metadata):
${JSON.stringify(metadata, null, 2)}

طلب المستخدم: "${userInstruction}"

قم بتحليل الطلب وإرجاع النتيجة حصراً بصيغة JSON نقي بالهيكل التالي بدون أي نص إضافي خارجه:
{
  "actionType": "add_columns" | "format_headers" | "update_column" | "custom",
  "targetColumn": "اسم العمود المرجعي للإضافة بعده إن وجد أو null",
  "newColumns": ["أسماء الأعمدة الجديدة المراد إضافتها إن وجدت كالمتطلبات"],
  "formula": "صيغة إكسل مقترحة إن وجدت أو null",
  "modificationsDescription": ["وصف دقيق بالعربية لما تم تنفيذه"]
}
`;

    const completion = await groq.chat.completions.create({
      model: "gpt-oss-120b",
      messages: [
        { role: "system", content: "أنت مساعد برمجي يرجع بيانات JSON صالحة حصراً بدون أي نصوص إضافية." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const responseContent = completion.choices[0]?.message?.content;
    return {
      success: true,
      data: JSON.parse(responseContent)
    };

  } catch (error) {
    console.error("❌ Error in Groq Service:", error);
    return {
      success: false,
      error: error.message
    };
  }
}
