/**
 * api/core/kernel.js – Sovereign Kernel (Dual-Mode: Modification & Greenfield Generation)
 * يفصل بذكاء بين تعديل الملفات القائمة وتوليد الملفات الجديدة من الصفر مع التحقق الذاتي.
 */

import fs from "fs";
import path from "path";
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
    let fileName = ctx.fileName || activeFile?.fileName || null;
    let filePath = ctx.filePath || activeFile?.filePath || null;

    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const schema = extractedContent.columns_schema || {};
        const headerRow = extractedContent.detected_header_row || 1;
        fileContext = `ملف: ${fileName}\nمؤشر صف العناوين: ${headerRow}\nالأعمدة المتوفرة: ${JSON.stringify(schema)}\n`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-20) : [];

    // 🎯 شمولية النية: الكشف عن تعديل ملف قائم أو طلب توليد/إنشاء جدول جديد
    const excelActionRegex = /(ضيف|أضف|احذف|شيل|امسح|عدل|غيّر|حدث|نسّق|لوّن|دمج|فك دمج|معادلة|صيغة|عمود|أعمدة|صف|صفوف|خلية|خلايا|شيت|ورقة|أنشئ|ولد|صمم|اعمل|سوي|اطبع|جدول|تقرير)/i;
    const isExcelAction = excelActionRegex.test(message);

    // تحديد ما إذا كان الطلب "توليد من الصفر" (Greenfield) أو "تعديل"
    const isGenerationRequest = /(أنشئ|ولد|صمم|اعمل|سوي|جدول|تقرير)/i.test(message) && (!filePath || !fs.existsSync(filePath));

    let systemContent = SYSTEM_PROMPT;
    if (fileContext) {
        systemContent += `\n\n[سياق الملف الحالي]:\n${fileContext}`;
    }

    if (isGenerationRequest && !filePath) {
        // إنشاء مسار افتراضي آمن للملف الجديد
        fileName = `Alatheer_Report_${Date.now()}.xlsx`;
        filePath = path.join(process.cwd(), fileName);
        systemContent += `\n\n[تعليمات النظام للتوليد]: المستخدم يطلب توليد ملف إكسل جديد كلياً. قم بكتابة كود بايثون متكامل باستخدام مكتبة openpyxl لإنشاء الملف، تعبئة البيانات، تنسيق الترويسة بلون مميز وخط غامق ومحاذاة مركزية، وحفظه حصراً في مسار الملف المستلم عبر sys.argv[1].`;
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
        console.log("🧠 [Kernel] استدعاء النموذج للتحليل الأولي (Dual-Mode)...");

        const rawReply = await geminiService.chat(conversationMessages, {
            fileName,
            extractedContent,
            systemInstruction: systemContent
        });

        finalReplyText = rawReply || "تم يا شريكي.";

        if (!isExcelAction || !filePath) {
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
                console.log(`⚡ [Kernel] تنفيذ سكربت بايثون (${isGenerationRequest ? 'توليد جديد' : 'تعديل'}) - محاولة ${currentAttempt}...`);

                // إذا كان ملف جديد، نسمح للمتنفيذ بتجاوز فحص الوجود المسبق للنسخ الاحتياطي
                executionResult = await executeDynamicPython(pythonCode, filePath, isGenerationRequest);

                const outputStr = (executionResult?.output || "").toLowerCase();
                const hasLogicalError = outputStr.includes("error:") || outputStr.includes("valueerror") || outputStr.includes("exception");

                if (executionResult && executionResult.success && !hasLogicalError && fs.existsSync(filePath)) {
                    isSuccess = true;
                    finalReplyText += `\n\n✅ تم ${isGenerationRequest ? 'توليد' : 'تعديل'} الملف بنجاح والتحقق من صحته. جاهز للتحميل يا هندسة!`;
                    fileBase64 = fs.readFileSync(filePath).toString("base64");
                } else {
                    const actualError = executionResult?.error || executionResult?.output || "خطأ منطقي في التنفيذ";
                    console.warn(`⚠️ فشل التنفيذ في المحاولة ${currentAttempt}:`, actualError);

                    if (currentAttempt < maxRetries) {
                        const errorFeedbackPrompt =
                            `الكود واجه مشكلة:\n\`\`\`text\n${actualError}\n\`\`\`\n` +
                            `قم بتصحيح كود البايثون وتأكد من حفظ الملف في المسار المدرج في sys.argv[1]. أرجع الكود داخل وسم \`\`\`python فقط.`;

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
                        } else {
                            break;
                        }
                    } else {
                        finalReplyText +=
                            `\n\n❌ عذراً يا شريكي، واجهتني مشكلة أثناء بناء الملف:\n\`\`\`text\n${actualError.substring(0, 400)}\n\`\`\``;
                    }
                }
            }
        } else {
            finalReplyText += `\n\n⚠️ طلبت عملية إكسل ولكن لم يُرجع النموذج كود بايثون للتنفيذ.`;
        }
    } catch (error) {
        console.error("❌ [Kernel Exception]:", error);
        finalReplyText = `صار خطأ تقني داخلي: ${error.message}`;
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

