/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Adaptive Smart Edition)
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return {
            reply: "هلا والله يا صديقي... آمرني، شو عنا شغل اليوم؟",
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

    /* ============================================================
       🧠 نظام تعليمات ذكي غير خانق
       ============================================================ */
    let systemContent = `
${SYSTEM_PROMPT}

[قواعد تشغيلك السيادية]:

- أنت زميل ومهندس ملفات في منصة "الأثير"، وتخاطب المستخدم بروح الزمالة باللهجة السورية المهنية (يا شريكي، يا صديقي…).

- إذا فهمت من سياق كلام المستخدم أنه يطلب **تعديل ملف Excel** (مثل: إضافة، حذف، تعديل، تنسيق، دمج، صيغ، Pivot، نطاقات، صفوف، أعمدة، شيتات…)،  
  عندها فقط يجب عليك إرجاع كتلة JSON في نهاية الرد تحتوي على مفتاح "operations".

- العمليات يجب أن تكون من الأنواع المدعومة في المنصة، وتختارها أنت حسب سياق الطلب، وليس عبر مثال ثابت.

- إذا كان طلب المستخدم **توليد محتوى، شرح، تحليل، كتابة نص، أو أي شيء غير تعديل ملف**،  
  عندها يجب أن يكون الرد نصياً فقط بدون JSON.

- لا تستخدم أمثلة ثابتة، ولا تفرض عملية واحدة.  
  اختر العملية المناسبة حسب فهمك لسياق كلام المستخدم.
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

        const rawReply = await geminiService.chat(conversationMessages, {
            fileName,
            extractedContent,
            systemInstruction: systemContent
        });

        finalReplyText = rawReply || "تم يا شريكي.";

        // استخراج JSON إذا كان موجود
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
                console.error("⚠️ [Kernel] فشل تحليل JSON:", parseErr);
            }
        }

        // تنظيف الرد من كتلة JSON
        finalReplyText = finalReplyText.replace(/```json[\s\S]*?```/g, "").trim();

    } catch (error) {
        console.error("❌ [Kernel] خطأ:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ: ${error.message}`;
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
