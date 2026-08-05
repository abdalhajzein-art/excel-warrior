/**
 * api/core/kernel.js – Sovereign Kernel (Simplified + Self-Correction)
 * يفصل بين الدردشة وتنفيذ سكربتات بايثون على الإكسل مع وعي مكاني وتحقق ذاتي.
 */

import fs from "fs";
import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { executeDynamicPython } from "./dynamic_executor.js";

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
        // نستخدم المخطط الذكي الجديد من المعالج المسبق
        const schema = extractedContent.columns_schema || {};
        const headerRow = extractedContent.detected_header_row || 1;
        fileContext = `ملف: ${fileName}\nمؤشر صف العناوين: ${headerRow}\nالأعمدة المتوفرة: ${JSON.stringify(schema)}\n`;
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
        console.log("🧠 [Kernel] استدعاء النموذج للتحليل الأولي...");

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

            const maxRetries = 2; // محاولتان كحد أقصى لتوفير التوكنز
            let currentAttempt = 0;
            let isSuccess = false;

            while (currentAttempt < maxRetries && !isSuccess) {
                currentAttempt++;
                console.log(`⚡ [Kernel] تنفيذ سكربت بايثون (محاولة ${currentAttempt})...`);

                executionResult = await executeDynamicPython(pythonCode, filePath);

                // فحص الأخطاء البرمجية + الأخطاء المنطقية القادمة من التحقق الذاتي (Self-Verification)
                const outputStr = (executionResult?.output || "").toLowerCase();
                const hasLogicalError = outputStr.includes("error:") || outputStr.includes("valueerror") || outputStr.includes("exception");

                if (executionResult && executionResult.success && !hasLogicalError) {
                    isSuccess = true;
                    finalReplyText += `\n\n✅ تم التنفيذ والتحقق من صحة البيانات. الملف جاهز يا هندسة.`;
                    fileBase64 = fs.readFileSync(filePath).toString("base64");
                } else {
                    const actualError = executionResult?.error || executionResult?.output || "خطأ منطقي في التحقق الذاتي";
                    console.warn(`⚠️ فشل التنفيذ أو التحقق في المحاولة ${currentAttempt}:`, actualError);

                    if (currentAttempt < maxRetries) {
                        const errorFeedbackPrompt =
                            `الكود السابق واجه مشكلة أثناء التنفيذ أو التحقق الذاتي:\n\`\`\`text\n${actualError}\n\`\`\`\n` +
                            `اكتشف الخطأ برمجياً (تأكد من استخدامك للبحث الديناميكي عن اسم العمود بدلاً من الفهرس الثابت). قم بتصحيح الكود وأرجع سكربت بايثون جديد وموثوق داخل وسم \`\`\`python فقط.`;

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
                            // سيستمر في الحلقة للمحاولة الثانية
                        } else {
                            break; // فشل النموذج في إرجاع كود للإصلاح
                        }
                    } else {
                        finalReplyText +=
                            `\n\n❌ حاولت لكن واجهتني مشكلة بالتعديل:\n\`\`\`text\n${actualError.substring(0, 500)}\n\`\`\`\nشريكي، جرب توضح الطلب أكثر أو تتأكد من أسماء الأعمدة.`;
                    }
                }
            }
        } else {
            finalReplyText += `\n\n⚠️ طلبت تعديل على الملف لكن لم أتمكن من توليد السكربت. جرّب توضّح الطلب أكثر.`;
        }
    } catch (error) {
        console.error("❌ [Kernel Exception]:", error);
        finalReplyText = `صار في خطأ تقني داخلي: ${error.message}`;
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

