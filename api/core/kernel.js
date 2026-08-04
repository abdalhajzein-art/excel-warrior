/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Fixed Structured JSON Edition)
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return {
            reply: "هلا والله يا شريكي... آمرني، شو عنا شغل اليوم؟",
            fileBase64: null,
            fileName: null,
            operations: []
        };
    }

    const activeFile = ctx.activeFile || null;
    const extractedContent = ctx.extractedContent || activeFile?.extractedContent || null;
    const fileName = ctx.fileName || activeFile?.fileName || "الملف النشط";

    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || "";
        const MAX_CHARS = 25000;

        fileContext = `
📄 **معلومات الملف النشط:** [${fileName}]
📊 **الأبعاد:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود.

📝 **عينة البيانات:**
${text.slice(0, MAX_CHARS)}
`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];

    let systemContent = `
${SYSTEM_PROMPT}

[التوجيهات الصارمة لشخصيتك وتعديل الملفات]:
- أنت زميل ومهندس معماري لمنصة "الأثير". خاطب المستخدم دائماً بروح الزميل باللهجة السورية المهنية المحببة (يا شريكي، يا هندسة، تكرم عينك، إلخ).
- إذا طلب المستخدم أي تعديل (إضافة عمود، تعديل خلية، حذف عمود، تطبيق معادلة)، **يجب عليك إجبارياً** أن تضمن في نهاية ردك كتلة كود برمجية بصيغة JSON تحتوي على مفتاح "operations" تماماً كالمثال أدناه، لكي يتم تنفيذها برمجياً عبر بايثون:

\`\`\`json
{
  "operations": [
    {"type": "add_column", "header": "اسم العمود الجديد", "after": "اسم العمود السابق", "dropdown_options": "خيار1,خيار2,خيار3", "default_value": "-"}
  ]
}
\`\`\`
- إذا لم يكن هناك طلب لتعديل ملف، اكتفِ بالرد النصي الطبيعي دون كتلة JSON.
`;

    if (fileContext) {
        systemContent += `\n\n${fileContext}`;
    }

    const conversationMessages = [
        { role: "system", content: systemContent },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
    ];

    let finalReplyText = "";
    let operations = [];
    let fileBase64 = null;
    let returnedFileName = fileName;

    try {
        console.log(`🧠 [Kernel] معالجة الطلب في جيميني...`);

        // ⭐⭐ التعديل الحاسم هنا ⭐⭐
        const rawReply = await geminiService.chat(conversationMessages, {
            fileName,
            extractedContent,
            systemInstruction: systemContent   // ← هذا هو التعديل المطلوب
        });

        finalReplyText = rawReply || "تم يا شريكي، جهزتلك المطلوب.";

        // استخراج operations من JSON
        const jsonMatch =
            finalReplyText.match(/```json\s*([\s\S]*?)\s*```/) ||
            finalReplyText.match(/\{[\s\S]*"operations"[\s\S]*\}/);

        if (jsonMatch) {
            try {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonStr);
                if (parsed.operations && Array.isArray(parsed.operations)) {
                    operations = parsed.operations;
                }
            } catch (parseErr) {
                console.error("⚠️ [Kernel] فشل تحليل JSON للعمليات:", parseErr);
            }
        }

        // تنظيف الرد من كتلة JSON
        finalReplyText = finalReplyText.replace(/```json[\s\S]*?```/g, "").trim();

        if (message.includes("عمود") && operations.length === 0) {
            console.warn("⚠️ [Kernel] طلب المستخدم تعديلاً لكن نموذج جيميني لم يولّد عمليات JSON.");
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ بالاتصال أو التنفيذ: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: finalReplyText,
    });

    return {
        reply: finalReplyText,
        fileName: returnedFileName,
        fileBase64,
        operations,
    };
}
