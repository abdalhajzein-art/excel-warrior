Import Groq from "groq-sdk";

// تهيئة عميل Groq باستخدام مفتاح البيئة
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function askGroqStructured(metadata, userInstruction) {
  try {
    const prompt = `
أنت العقل التنفيذي السيادي لمنصة "الأثير / Alatheer AI Suite".
هيكل الملف الحالي (Metadata) - قد يكون فارغاً إذا كان الطلب يتطلب إنشاء ملف جديد من الصفر:
${JSON.stringify(metadata, null, 2)}

طلب المستخدم: "${userInstruction}"

قواعد التشغيل الإلزامي (Proactive Execution Protocol):
1. حدد ما إذا كان الطلب يتطلب "توليد ملف جديد من الصفر" (actionType: "generate") أو "تعديل ملف موجود" (actionType: "modify" أو ما يناسبه).
2. ممنوع منعاً باتاً طرح أي أسئلة استفسارية على المستخدم. إذا كان الطلب عاماً أو مختصراً (مثل: "ولد لي جدول مبيعات" أو "أنشئ جدول رواتب")، عليك فوراً ابتكار هيكل افتراضي احترافي متكامل (تسمية الورقة، الأعمدة، وبيانات تجريبية واقعية لـ 3 إلى 5 صفوف).
3. أرجع النتيجة حصراً بصيغة JSON نقي بدون أي نص إضافي خارجه بالهيكل التالي:
{
  "action": "generate" | "modify",
  "sheetName": "اسم الورقة المستهدفة أو المبتكرة",
  "columns": ["العمود الأول", "العمود الثاني", "..."] (تستخدم في حالة التوليد من الصفر),
  "rows": [
    [قيمة1, قيمة2, ...],
    [قيمة1, قيمة2, ...]
  ] (بيانات تجريبية واقعية تستخدم في حالة التوليد من الصفر),
  "actionType": "add_columns" | "format_headers" | "update_column" | "generate_new" | "custom",
  "targetColumn": "اسم العمود المرجعي للإضافة بعده إن وجد أو null",
  "newColumns": ["أسماء الأعمدة الجديدة المراد إضافتها إن وجدت"],
  "formulaTemplate": "صيغة إكسل مقترحة إن وجدت أو null",
  "modificationsDescription": ["وصف دقيق بالعربية لما تم تنفيذه أو توليده"]
}
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: "أنت مساعد برمجي ذكي ومبادر يرجع بيانات JSON صالحة حصراً بدون أي نصوص إضافية أو أسئلة." },
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
