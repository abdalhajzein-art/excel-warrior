/**
 * api/core/kernel.js – Sovereign Kernel (Dual-Mode: Modification & Greenfield Generation)
 * يفصل بذكاء بين تعديل الملفات القائمة وتوليد الملفات الجديدة من الصفر مع التحقق الذاتي.
 * ✅ إخفاء كود بايثون عن المستخدم
 * ✅ إصلاح مشكلة استخراج كود Python من رد Gemini
 * ✅ دعم بصمة الملف (Fingerprint) لتوفير التوكنز
 * ✅ إصلاح مشكلة تمرير filePath للتعديل
 */

import fs from "fs";
import path from "path";
import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { executeDynamicPython, extractPreviewAsync } from "./dynamic_executor.js";
import fusionMemory from "./fusion_memory.js";

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

    console.log(`🔍 [Kernel] استقبال: fileName=${fileName}, filePath=${filePath}`);

    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const schema = extractedContent.columns_schema || {};
        const headerRow = extractedContent.detected_header_row || 1;
        fileContext = `ملف: ${fileName}\nمؤشر صف العناوين: ${headerRow}\nالأعمدة المتوفرة: ${JSON.stringify(schema)}\n`;
    }

    // ✅ استرجاع بصمة الملف من الذاكرة
    const fingerprintText = fusionMemory.getFingerprintText(sessionId);

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-20) : [];

    // 🎯 شمولية النية: الكشف عن تعديل ملف قائم أو طلب توليد/إنشاء جدول جديد
    const excelActionRegex = /(ضيف|أضف|احذف|شيل|امسح|عدل|غيّر|حدث|نسّق|لوّن|دمج|فك دمج|معادلة|صيغة|عمود|أعمدة|صف|صفوف|خلية|خلايا|شيت|ورقة|أنشئ|ولد|صمم|اعمل|سوي|اطبع|جدول|تقرير)/i;
    const isExcelAction = excelActionRegex.test(message);

    // 🛡️ [تعديل سيادي صارم]: التحقق الحاسم من وجود ملف حقيقي وتحديد نوع الطلب
    const userExplicitlyWantsNew = /(ملف جديد|من الصفر|جديد كلياً|اصنع ملفاً جديداً)/i.test(message);
    const isModifyRequest = /طور|عدل|حسن|ضيف|أضف|تطوير|إضافة|add|update|modify|تحسين|توسيع/i.test(message);
    const hasExistingFile = filePath && fs.existsSync(filePath);

    console.log(`📂 [Kernel] hasExistingFile=${hasExistingFile}, filePath=${filePath}`);

    // ✅ تحديد نوع الطلب بشكل صحيح
    let isGenerationRequest = false;

    if (userExplicitlyWantsNew && /(أنشئ|ولد|صمم|اعمل|سوي|جدول|تقرير)/i.test(message)) {
        // ✅ طلب صريح لملف جديد
        isGenerationRequest = true;
        console.log("🆕 [Kernel] طلب صريح لملف جديد");
    } else if (!hasExistingFile) {
        // ✅ لا يوجد ملف موجود -> توليد جديد
        isGenerationRequest = true;
        console.log("🆕 [Kernel] لا يوجد ملف موجود، توليد جديد");
    } else if (isModifyRequest && hasExistingFile) {
        // ✅ تعديل ملف موجود
        isGenerationRequest = false;
        console.log(`📂 [Kernel] تطوير الملف الموجود: ${filePath}`);
    } else {
        // ✅ افتراضي: إذا كان هناك ملف، اعتبره تعديل
        isGenerationRequest = false;
        console.log(`📂 [Kernel] استخدام الملف الموجود: ${filePath}`);
    }

    let systemContent = SYSTEM_PROMPT;
    if (fileContext) {
        systemContent += `\n\n[سياق الملف الحالي]:\n${fileContext}`;
    }

    // ✅ إضافة بصمة الملف للنظام إن وجدت
    if (fingerprintText) {
        systemContent += `\n\n[بصمة الملف الحالية]:\n${fingerprintText}`;
    }

    // ✅ تحديد مسار الملف بشكل صحيح
    if (isGenerationRequest) {
        // إنشاء مسار افتراضي آمن للملف الجديد
        fileName = `Alatheer_Report_${Date.now()}.xlsx`;
        filePath = path.join(process.cwd(), fileName);
        systemContent += `\n\n[تعليمات النظام للتوليد]: المستخدم يطلب توليد ملف إكسل جديد كلياً. قم بكتابة كود بايثون متكامل باستخدام مكتبة openpyxl لإنشاء الملف، تعبئة البيانات، تنسيق الترويسة بلون مميز وخط غامق ومحاذاة مركزية، وحفظه حصراً في مسار الملف المستلم عبر sys.argv[1].`;
    } else if (!isGenerationRequest && hasExistingFile) {
        // ✅ تأكد من أن المسار صحيح
        console.log(`📂 [Kernel] تعديل الملف الموجود: ${filePath}`);
        systemContent += `\n\n[تعليمات النظام للتعديل المباشر]: المستخدم يطلب تعديل الملف الحالي الموجود في مسار sys.argv[1]. يجب قراءة الملف باستخدام pandas أو openpyxl، تطبيق التعديلات المطلوبة بدقة، وحفظ التعديلات **نفسها** على نفس المسار (sys.argv[1]) دون تغيير اسمه أو إنشاء ملف جديد.`;
    } else if (!isGenerationRequest && !hasExistingFile) {
        // ✅ حالة خاصة: طلب تعديل ولكن لا يوجد ملف - نتعامل كتوليد جديد
        console.log(`🆕 [Kernel] لا يوجد ملف موجود، سيتم التوليد من الصفر`);
        fileName = `Alatheer_Report_${Date.now()}.xlsx`;
        filePath = path.join(process.cwd(), fileName);
        systemContent += `\n\n[تعليمات النظام]: لا يوجد ملف سابق، سيتم إنشاء ملف جديد.`;
    }

    // ✅ تعليمات إضافية للحفاظ على التنسيق
    if (fingerprintText) {
        systemContent += `\n\n[تعليمات الحفاظ على التنسيق]:
1. لا تحذف أي ورقة من الأوراق الموجودة في البصمة
2. لا تحذف أي معادلة من المعادلات الموجودة
3. حافظ على نفس نظام الألوان والتنسيق
4. أضف الميزات الجديدة فقط دون المساس بالميزات الموجودة
5. استخدم openpyxl بشكل صحيح لكتابة المعادلات كصيغ وليس كنصوص
6. تأكد من استخدام write_formula() لكتابة المعادلات`;
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

        // ✅ استخراج كود Python من رد Gemini (متعدد المحاولات)
        let pythonMatch = finalReplyText.match(/```python\s*\n([\s\S]*?)\n\s*```/);
        if (!pythonMatch) {
            pythonMatch = finalReplyText.match(/```python\s*([\s\S]*?)\s*```/);
        }
        if (!pythonMatch) {
            pythonMatch = finalReplyText.match(/```python\n([\s\S]*?)```/);
        }
        if (!pythonMatch) {
            pythonMatch = finalReplyText.match(/```([\s\S]*?)```/);
        }

        if (pythonMatch) {
            let pythonCode = pythonMatch[1].trim();
            
            // ✅ إخفاء الكود عن المستخدم
            finalReplyText = finalReplyText.replace(/```python[\s\S]*?```/g, "").trim();
            if (finalReplyText.includes('```') && !finalReplyText.includes('python')) {
                finalReplyText = finalReplyText.replace(/```[\s\S]*?```/g, "").trim();
            }
            
            if (!finalReplyText) {
                finalReplyText = "جاري تجهيز الملف يا شريكي...";
            }

            const maxRetries = 2;
            let currentAttempt = 0;
            let isSuccess = false;

            while (currentAttempt < maxRetries && !isSuccess) {
                currentAttempt++;
                console.log(`⚡ [Kernel] تنفيذ سكربت بايثون (${isGenerationRequest ? 'توليد جديد' : 'تعديل'}) - محاولة ${currentAttempt}...`);
                console.log(`📁 [Kernel] المسار المستهدف: ${filePath}`);

                executionResult = await executeDynamicPython(pythonCode, filePath, isGenerationRequest);

                const outputStr = (executionResult?.output || "").toLowerCase();
                const hasLogicalError = outputStr.includes("error:") || outputStr.includes("valueerror") || outputStr.includes("exception");

                if (executionResult && executionResult.success && !hasLogicalError && fs.existsSync(filePath)) {
                    isSuccess = true;
                    finalReplyText += `\n\n✅ تم ${isGenerationRequest ? 'توليد' : 'تعديل'} الملف بنجاح والتحقق من صحته. جاهز للتحميل يا هندسة!`;
                    fileBase64 = fs.readFileSync(filePath).toString("base64");
                    
                    // ✅ تخزين البصمة بعد النجاح
                    try {
                        const previewData = await extractPreviewAsync(filePath);
                        if (previewData && !previewData.error) {
                            fusionMemory.storeFileFingerprint(sessionId, filePath, previewData);
                        }
                    } catch (e) {
                        console.warn("⚠️ [Kernel] فشل تخزين البصمة:", e.message);
                    }
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

                        let newMatch = fixReply.match(/```python\s*\n([\s\S]*?)\n\s*```/);
                        if (!newMatch) {
                            newMatch = fixReply.match(/```python\s*([\s\S]*?)\s*```/);
                        }
                        if (!newMatch) {
                            newMatch = fixReply.match(/```\s*([\s\S]*?)```/);
                        }
                        
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
            console.warn("⚠️ [Kernel] لم يتم العثور على كود Python في رد Gemini");
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
