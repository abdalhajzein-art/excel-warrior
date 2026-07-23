import Groq from "groq-sdk";

// تهيئة عميل Groq باستخدام مفتاح البيئة
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function askGroqStructured(metadata, userInstruction) {
  try {
    const prompt = `
أنت محلل ذكي ووكيل خبير لمعالجة جداول البيانات Excel لمنصة "الأثير".
معطيات الملف (Metadata):
${JSON.stringify(metadata, null, 2)}

تعليمات المستخدم: "${userInstruction}"

قم بتحليل الطلب وإرجاع النتيجة حصراً بصيغة JSON نقي بالโครงสร้าง التالي بدون أي نص إضافي خارجه:
{
  "actionType": "format_headers" | "update_column" | "add_column" | "custom",
  "targetColumn": "اسم العمود المستهدف إن وجد أو null",
  "formula": "الصيغة الإكسل المقترحة إن وجدت أو null",
  "modificationsDescription": ["وصف دقيق لما تم فهمه وتعديله"]
}
`;

    const completion = await groq.chat.completions.create({
      model: "llama3-70b-8192", // أو نموذج gpt-oss-120b حسب المتاح لديك على Groq
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
