/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Self-Correction Edition)
 * ✅ الاعتماد على التنفيذ الديناميكي وحلقة التصحيح الذاتي المتقدمة.
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { executeDynamicPython } from "./dynamic_executor.js";
import fs from "fs";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return { reply: "هلا والله يا شريكي... آمرني، شو عنا شغل اليوم؟", fileBase64: null, fileName: null, operations: [] };
    }

    const activeFile = ctx.activeFile || null;
    const extractedContent = ctx.extractedContent || activeFile?.extractedContent || null;
    const fileName = ctx.fileName || activeFile?.fileName || "الملف النشط";
    const filePath = ctx.filePath || activeFile?.filePath || null;

    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || "";
        fileContext = `📄 **معلومات الملف:** [${fileName}]\n📊 **الأبعاد:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود.\n📝 **عينة:**\n${text.slice(0, 25000)}`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
    let systemContent = SYSTEM_PROMPT;
    if (fileContext) systemContent += `\n\n[سياق الملف الحالي للرجوع إليه]:\n${fileContext}`;

    const conversationMessages = [
        { role: "system", content: systemContent },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
    ];

    let finalReplyText = "";
    let fileBase64 = null;
    let executionResult = null;

    try {
        console.log(`🧠 [Kernel] معالجة الطلب في جيميني...`);
        let rawReply = await geminiService.chat(conversationMessages, { fileName, extractedContent, systemInstruction: systemContent });
        finalReplyText = rawReply || "تم يا شريكي.";

        // ✅ البحث عن كود بايثون
        let pythonMatch = finalReplyText.match(/```python\s*([\s\S]*?)\s*```/);

        if (pythonMatch && filePath && fs.existsSync(filePath)) {
            let pythonCode = pythonMatch[1].trim();
            
            // إزالة بلوك الكود من الرد الأساسي للمستخدم
            finalReplyText = finalReplyText.replace(/```python[\s\S]*?```/g, "").trim();
            
            // 🔄 حلقة التصحيح الذاتي (Self-Correction Loop - ماكس محاولتان)
            const maxRetries = 2;
            let currentAttempt = 0;
            let isSuccess = false;

            while (currentAttempt < maxRetries && !isSuccess) {
                currentAttempt++;
                console.log(`⚡ [Kernel] تنفيذ سكربت بايثون (محاولة رقم ${currentAttempt})...`);
                
                executionResult = await executeDynamicPython(pythonCode, filePath);

                if (executionResult && executionResult.success) {
                    isSuccess = true;
                    console.log(`✅ [Kernel] نجح التنفيذ في المحاولة ${currentAttempt}`);
                    finalReplyText += `\n\n✅ تم تنفيذ السكربت على الملف بنجاح يا هندسة، والملف جاهز للتحميل!`;
                    fileBase64 = fs.readFileSync(filePath).toString("base64");
                } else {
                    console.warn(`⚠️ [Kernel Warning] فشل التنفيذ في المحاولة ${currentAttempt}:`, executionResult?.error);

                    if (currentAttempt < maxRetries) {
                        console.log(`🔄 [Kernel Self-Correction] إرسال الخطأ إلى جيميني للإصلاح التلقائي...`);
                        
                        const errorFeedbackPrompt = `حدث خطأ تقني في تنفيذ سكربت بايثون السابق:\n\`\`\`text\n${executionResult.error}\n\`\`\`\nالرجاء تحليل الخطأ، تصحيح الكود البرمجي، وإرجاع سكربت بايثون جديد وكامل ومصحح حصراً داخل وسم python.`;

                        // توسيع سياق المحادثة مؤقتاً لتنبيه النموذج بالخطأ
                        const correctionMessages = [
                            ...conversationMessages,
                            { role: "assistant", content: pythonMatch[0] },
                            { role: "user", content: errorFeedbackPrompt }
                        ];

                        const fixReply = await geminiService.chat(correctionMessages, { fileName, extractedContent, systemInstruction: systemContent });
                        const newMatch = fixReply.match(/```python\s*([\s\S]*?)\s*```/);

                        if (newMatch) {
                            pythonCode = newMatch[1].trim();
                            // تحديث نص الرد ليكون متوافقاً مع الإصلاح الأخير
                            finalReplyText = fixReply.replace(/```python[\s\S]*?```/g, "").trim();
                        } else {
                            break; // إذا لم يُرجع النموذج كوداً جديداً، نخرج من الحلقة
                        }
                    } else {
                        // استنفاد المحاولات
                        finalReplyText += `\n\n❌ **فشل التنفيذ بعد ${maxRetries} محاولات تصحيح:** \n\`\`\`text\n${executionResult?.error || 'خطأ غير معروف'}\n\`\`\``;
                        console.error("❌ [Kernel Critical Error]: فشل التنفيذ النهائي.");
                    }
                }
            }
        }

    } catch (error) {
        console.error("❌ [Kernel Exception]:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ تقني بالاتصال: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });

    return { reply: finalReplyText, fileName, fileBase64, operations: [], execution: executionResult };
}
