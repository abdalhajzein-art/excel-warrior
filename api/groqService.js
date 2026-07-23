import Groq from "groq-sdk";

// تهيئة عميل Groq باستخدام مفتاح البيئة
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function askGroqStructured(metadata, userInstruction) {
  try {
    const prompt = `
أنت المستشار التقني والمهندس المعماري الخبير لمنصة "الأثير / Alatheer AI Suite".
هيكل الملف الحالي (Metadata) - قد يكون فارغاً إذا كان الطلب يتطلب إنشاء ملف جديد:
${JSON.stringify(metadata, null, 2)}

طلب المستخدم: "${userInstruction}"

قواعد التشغيل الاستشاري والتفاعلي (Agentic Consultation Protocol):
1. قم بتحليل طلب المستخدم بدقة:
   - إذا كان الطلب عاماً، مختصراً، أو ينقصه تفاصيل جوهرية (مثل: نوع البيانات، الأعمدة المطلوبة، أو الفترة الزمنية)، فلا تقم بالتوليد الفوري. بدلاً من ذلك، حدد الأسئلة الاستفسارية اللازمة وضَعها ضمن مصفوفة الأسئلة، واجعل الحالة "need_clarification".
   - إذا كان الطلب واضحاً أو يحتوي على تفاصيل كافية (أو رداً على أسئلة سابقة)، فقم بإعداد خطة تنفيذ كاملة ودقيقة ("generate" أو "modify").

2. أرجع النتيجة حصراً بصيغة JSON نقي بدون أي نص إضافي خارجه بالهيكل التالي:
{
  "status": "need_clarification" | "ready_to_execute",
  "questions": ["السؤال الأول للتوضيح إن وجد", "السؤال الثاني إن وجد"],
  "action": "generate" | "modify",
  "sheetName": "اسم الورقة المستهدفة أو المقترحة",
  "columns": ["العمود الأول", "العمود الثاني", "..."] (في حال التوليد),
  "rows": [
    [قيمة1, قيمة2, ...],
    [قيمة1, قيمة2, ...]
  ] (بيانات تجريبية واقعية ومناسبة لسياق طلب المدير),
  "actionType": "add_columns" | "format_headers" | "update_column" | "generate_new" | "custom",
  "targetColumn": "اسم العمود المرجعي إن وجد أو null",
  "newColumns": ["أسماء الأعمدة الجديدة إن وجدت"],
  "formulaTemplate": "صيغة إكسل مقترحة إن وجدت أو null",
  "modificationsDescription": ["وصف دقيق لما تم التخطيط له أو تنفيذه"]
}
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: "أنت مساعد استشاري ذكي يرجع بيانات JSON صالحة حصراً بدون أي نصوص إضافية." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
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
