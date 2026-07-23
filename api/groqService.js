import Groq from "groq-sdk";

// تهيئة عميل Groq باستخدام مفتاح البيئة
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function askGroqStructured(metadata, userInstruction) {
  try {
    const prompt = `
أنت العقل التنفيذي السيادي لمنصة "الأثير / Alatheer AI Suite".
هيكل الملف الحالي وحجمه (Metadata):
${JSON.stringify(metadata, null, 2)}

طلب المستخدم الحالي والسياق السابق: "${userInstruction}"

قواعد التشغيل الحازمة (Strict Agentic Execution Rules):
1. قم بتحليل الطلب بدقة:
   - إذا كان الطلب مبهمًا بالكامل وينقصه عناصر أساسية مفقودة تماماً، اجعل "isClear" تساوي false، واطرح أسئلة قصيرة ومباشرة، و"action" تساوي "modify".
   - إذا كان الطلب واضحاً أو اكتملت التفاصيل في الحوار (مثل تحديد اسم العمود، مكانه، أو الخيارات المطلوبة مثل القوائم المنسدلة)، اجعل "isClear" تساوي true، و"questions" مصفوفة فارغة [], و"action" تساوي "modify" أو "generate".
2. ضع خطة عمل هندسية دقيقة في "plan" وضع تفاصيل التعديل البرمجي بوضوح (مثل اسم العمود الجديد، موقع إضافته، والمعادلات أو القوائم المطلوبة).
3. أرجع النتيجة حصراً بصيغة JSON نقي بالهيكل التالي وبدون أي نص خارجه:
{
  "isClear": true أو false,
  "action": "modify" أو "generate",
  "summary": "ملخص دقيق لما سيتم تنفيذه بالعربية",
  "plan": "خطوات مفصلة وواضحة لتنفيذها برمجياً",
  "questions": ["أسئلة قصيرة إن وُجدت وisClear كانت false فقط، وإلا اتركها فارغة []"],
  "response": "الرد المباشر للمستخدم",
  "actionType": "add_columns" | "format_headers" | "update_column" | "add_dropdown" | "custom",
  "targetColumn": "اسم العمود المرجعي للإضافة بعده أو null",
  "newColumns": ["أسماء الأعمدة الجديدة المراد إضافتها إن وجدت"],
  "dropdownOptions": ["الخيارات المطلوبة للقائمة المنسدلة إن وجدت أو null"],
  "formulaTemplate": "صيغة مقترحة أو null"
}
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: "أنت مساعد برمجي ذكي وحاسم يرجع بيانات JSON صالحة حصراً بدون أي نصوص إضافية." },
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
