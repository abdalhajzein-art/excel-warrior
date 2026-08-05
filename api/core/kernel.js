/**
 * api/core/kernel.js – Sovereign Kernel (Simplified + Self-Correction)
 * يفصل بين الدردشة وتنفيذ سكربتات بايثون على الإكسل بشكل بسيط ومستقر.
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { executeDynamicPython } from "./dynamic_executor.js";
import fs from "fs";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return {
            reply: "هلا يا شريكي... آمرني.",
            fileBase64: null,
            fileName: null,
            operations: [],
            execution: null
        };
    }

    const activeFile = ctx.activeFile || null;
    const extractedContent = ctx.extractedContent || activeFile?.extractedContent || null;
    const fileName = ctx.fileName || activeFile?.fileName || "الملف النشط";
    const filePath = ctx.filePath || activeFile?.filePath || null;

    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || "";
        fileContext = `ملف: ${fileName}\nصفوف: ${meta.rows || 0}، أعمدة: ${meta.columns || 0}\nعينة:\n${text.slice(0, 5000)}`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-20) : [];

    const excelModificationRegex =
        /(ضيف|أضف|احذف|شيل|امسح|عدل|غيّر|حدث|نسّق|لوّن|دمج|فك دمج|معادلة|صيغة|عمود|أعمدة|صف|صفوف|خلية|خلايا|شيت|ورقة)/i;
    const isExcelModification = excelModificationRegex.test(message);

    let systemContent = SYSTEM_PROMPT;
    if (fileContext) {
        systemContent += `\n\n[سياق الملف الحالي]:\n${fileContext}`;
    }

    const conversationMessages = [
        { role: "system", content: systemContent },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message }
    ];

    let finalReplyText = "";
    let fileBase64 = null;
    let executionResult = null;

    try {
        console.log("🧠 [Kernel] استدعاء النموذج...");

        const rawReply = await geminiService.chat(conversationMessages, {
            fileName,
            extractedContent,
            systemInstruction: systemContent
        });

        finalReplyText = rawReply || "تم يا شريكي.";

        if (!isExcelModification || !filePath || !fs.existsSync(filePath)) {
            memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });
            return {
                reply: finalReplyText,
                fileName,
                fileBase64: null,
                operations: [],
                execution: null
            };
        }

        let pythonMatch = finalReplyText.match(/```python\s*([\s\S]*?)\s*```/);

        if (pythonMatch) {
            let pythonCode = pythonMatch[1].trim();
            finalReplyText = finalReplyText.replace(/```python[\s\S]*?```/g, "").trim();

            const maxRetries = 2;
            let currentAttempt = 0;
            let isSuccess = false;

            while (currentAttempt < maxRetries && !isSuccess) {
                currentAttempt++;
                console.log(`⚡ [Kernel] تنفيذ سكربت بايثون (محاولة ${currentAttempt})...`);

                executionResult = await executeDynamicPython(pythonCode, filePath);

                if (executionResult && executionResult.success) {
                    isSuccess = true;
                    finalReplyText += `\n\n✅ تم تنفيذ السكربت على الملف بنجاح، والملف جاهز للتحميل.`;
                    fileBase64 = fs.readFileSync(filePath).toString("base64");
                } else {
                    console.warn(`⚠️ فشل التنفيذ في المحاولة ${currentAttempt}:`, executionResult?.error);

                    if (currentAttempt < maxRetries) {
                        const errorFeedbackPrompt =
                            `حدث خطأ في تنفيذ سكربت بايثون السابق:\n\`\`\`text\n${executionResult?.error || "Unknown Error"}\n\`\`\`\n` +
                            `رجاءً صحّح الكود وأرجع سكربت بايثون جديد داخل وسم \`\`\`python فقط.`;

                        const correctionMessages = [
                            ...conversationMessages,
                            { role: "assistant", content: pythonMatch[0] },
                            { role: "user", content: errorFeedbackPrompt }
                        ];

                        const fixReply = await geminiService.chat(correctionMessages, {
                            fileName,
                            extractedContent,
                            systemInstruction: systemContent
                        });

                        const newMatch = fixReply.match(/```python\s*([\s\S]*?)\s*```/);
                        if (newMatch) {
                            pythonCode = newMatch[1].trim();
                            finalReplyText = fixReply.replace(/```python[\s\S]*?```/g, "").trim();
                        } else {
                            break;
                        }
                    } else {
                        finalReplyText +=
                            `\n\n❌ فشل التنفيذ بعد ${maxRetries} محاولات:\n\`\`\`text\n${executionResult?.error || "خطأ غير معروف"}\n\`\`\``;
                    }
                }
            }
        } else {
            finalReplyText += `\n\n⚠️ طلبت تعديل على الملف لكن النموذج ما رجّع سكربت بايثون للتنفيذ. جرّب توضّح الطلب أكثر.`;
        }
    } catch (error) {
        console.error("❌ [Kernel Exception]:", error);
        finalReplyText = `صار في خطأ تقني: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });

    return {
        reply: finalReplyText,
        fileName,
        fileBase64,
        operations: [],
        execution: executionResult
    };
}
