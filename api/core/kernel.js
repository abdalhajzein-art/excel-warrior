/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Dual-Mode + Self-Correction)
 * ✅ يفصل بين وضع الدردشة ووضع تنفيذ سكربتات بايثون على الإكسل.
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
            reply: "هلا والله يا شريكي... آمرني، شو عنا شغل اليوم؟",
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

    // 🧠 سياق الملف (لما يكون في ملف فعّال)
    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || "";
        fileContext = `📄 **معلومات الملف:** [${fileName}]\n📊 **الأبعاد:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود.\n📝 **عينة:**\n${text.slice(0, 25000)}`;
    }

    // 🧠 تاريخ المحادثة
    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];

    // 🧠 Detector بسيط لتمييز طلبات تعديل الإكسل عن الدردشة
    const excelModificationRegex =
        /(ضيف|أضف|احذف|شيل|امسح|عدل|غيّر|حدث|نسّق|لوّن|دمج|فك دمج|pivot|فلتر|معادلة|صيغة|عمود|أعمدة|صف|صفوف|خلية|خلايا|شيت|ورقة)/i;
    const isExcelModification = excelModificationRegex.test(message);

    // 🧠 بناء systemContent مع سياق الملف
    let systemContent = SYSTEM_PROMPT;
    if (fileContext) {
        systemContent += `\n\n[سياق الملف الحالي للرجوع إليه]:\n${fileContext}`;
    }

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

        // 🧠 استدعاء النموذج
        let rawReply = await geminiService.chat(conversationMessages, {
            fileName,
            extractedContent,
            systemInstruction: systemContent
        });

        finalReplyText = rawReply || "تم يا شريكي.";

        // إذا الطلب **مو تعديل إكسل** → نعتبره دردشة/تحليل نصي ونرجّع الرد كما هو
        if (!isExcelModification || !filePath || !fs.existsSync(filePath)) {
            // ما مندوّر على بايثون، وما مننفّذ شي
            memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });
            return {
                reply: finalReplyText,
                fileName,
                fileBase64: null,
                operations: [],
                execution: null
            };
        }

        // إذا الطلب تعديل إكسل → نبحث عن سكربت بايثون وننفّذه
        let pythonMatch = finalReplyText.match(/```python\s*([\s\S]*?)\s*```/);

        if (pythonMatch) {
            let pythonCode = pythonMatch[1].trim();

            // إزالة بلوك الكود من الرد الظاهر للمستخدم
            finalReplyText = finalReplyText.replace(/```python[\s\S]*?```/g, "").trim();

            // 🔄 حلقة التصحيح الذاتي (محاولتان كحد أقصى)
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

                        const errorFeedbackPrompt =
                            `حدث خطأ تقني في تنفيذ سكربت بايثون السابق:\n\`\`\`text\n${executionResult?.error || "Unknown Error"}\n\`\`\`\n` +
                            `الرجاء تحليل الخطأ، تصحيح الكود البرمجي، وإرجاع سكربت بايثون جديد وكامل ومصحح حصراً داخل وسم python.`;

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
                            `\n\n❌ **فشل التنفيذ بعد ${maxRetries} محاولات تصحيح:** \n` +
                            `\`\`\`text\n${executionResult?.error || "خطأ غير معروف"}\n\`\`\``;
                        console.error("❌ [Kernel Critical Error]: فشل التنفيذ النهائي.");
                    }
                }
            }
        } else {
            // طلب تعديل، لكن النموذج ما رجّع سكربت بايثون
            console.warn("⚠️ [Kernel] طلب تعديل إكسل لكن النموذج لم يرجّع سكربت بايثون.");
            finalReplyText += `\n\n⚠️ يا هندسة، شكلك طلبت تعديل على الملف بس النموذج ما رجّع سكربت بايثون لتنفيذه. جرّب توضّح الطلب أكثر.`;
        }

    } catch (error) {
        console.error("❌ [Kernel Exception]:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ تقني بالاتصال: ${error.message}`;
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
