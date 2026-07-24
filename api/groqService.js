import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function askGeminiStructured(metadata, userInstruction) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-3.5-flash", // ✅ النموذج الصحيح
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        });

        const prompt = `
أنت العقل التنفيذي السيادي لمنصة "الأثير / Alatheer AI Suite".
هيكل الملف الحالي وحجمه (Metadata):
${JSON.stringify(metadata, null, 2)}

طلب المستخدم الحالي والسياق السابق: "${userInstruction}"

قواعد التشغيل الحازمة:
1. قم بتحليل الطلب بدقة:
   - إذا كان الطلب مبهمًا، اجعل "isClear" false، واطرح أسئلة.
   - إذا كان الطلب واضحاً، اجعل "isClear" true، و"questions" [].
2. ضع خطة عمل هندسية دقيقة في "plan".
3. أرجع النتيجة حصراً بصيغة JSON:
{
  "isClear": true/false,
  "action": "modify" أو "generate",
  "summary": "ملخص الطلب",
  "plan": "خطة التنفيذ",
  "questions": [],
  "response": "الرد المباشر للمستخدم",
  "actionType": "add_columns" | "format_headers" | "update_column" | "add_dropdown" | "custom",
  "targetColumn": "اسم العمود المرجعي أو null",
  "newColumns": ["أسماء الأعمدة الجديدة"],
  "dropdownOptions": ["خيارات القائمة المنسدلة"],
  "formulaTemplate": "صيغة مقترحة أو null"
}
`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("لم يتم العثور على JSON في الرد");
        }
        
        return {
            success: true,
            data: JSON.parse(jsonMatch[0])
        };

    } catch (error) {
        console.error("❌ Error in Gemini Service:", error);
        return {
            success: false,
            error: error.message
        };
    }
}
