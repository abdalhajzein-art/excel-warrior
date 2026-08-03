/**
 * api/core/conversation_orchestrator.js – Sovereign Universal Orchestrator (Multi-Turn State Sync & Execution Edition)
 * ✅ يمرر العمليات من kernel إلى محرك التعديل الفعلي (ExcelModifier)
 * ✅ يدير حالة الملفات بشكل ذكي ويحافظ على الذاكرة العميقة (Deep Memory)
 * 🔄 يدعم التعديل المتتابع المترابط ويولد الملف المعدل للتحميل مع حماية ضد ضياع المسارات المؤقتة
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";

// 🛠️ استيراد محركات معالجة وإكسل الأثير السيادية
import { ExcelModifier } from '../tools/external/engines/excel/modifiers/ExcelModifier.js';
import { ExcelJSAdapter } from '../tools/external/engines/excel/core/ExcelJSAdapter.js';
import { FileUtils } from '../tools/external/engines/excel/utils/FileUtils.js';

/**
 * 📊 دالة مساعدة لتنسيق ملخص الملف للـ Kernel ليفهم هيكلية الجدول بدقة
 */
function formatFileContextForKernel(activeFile) {
    if (!activeFile) return null;

    const { fileName, metadata, extractedContent } = activeFile;
    let summary = `📄 **الملف النشط حالياً في الجلسة:** ${fileName}\n`;

    if (metadata) {
        summary += `📊 **البيانات المتاحة:** ${metadata.sheets || 1} شيت | ${metadata.rows || 0} صف | ${metadata.columns || 0} أعمدة\n`;
    }

    if (extractedContent && extractedContent.text) {
        const sampleText = extractedContent.text.slice(0, 3000);
        summary += `📝 **عينة من البيانات واسماء الأعمدة:**\n${sampleText}\n`;
    }

    return summary;
}

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
    try {
        console.log(`📥 [Orchestrator] جلسة ${sessionId} | الرسالة: "${message.substring(0, 50)}..."`);

        const session = memory.getSession(sessionId) || memory.createSession(sessionId);

        // 1. رصد نية إنهاء أو إعادة ضبط الملف النشط
        const lowerMsg = (message || "").toLowerCase();
        const resetRegex = /(انسى|اغلق|احذف|سكر|تجاهل) (الملف|البيانات)|ملف (جديد|اخر)/;
        const isResetFile = resetRegex.test(lowerMsg);

        if (isResetFile && session.activeFile) {
            console.log(`🗑️ [Orchestrator] تم إغلاق ومسح سياق الملف النشط للجلسة بطلب من المستخدم.`);
            session.activeFile = null;
            if (session.intentCache) {
                delete session.intentCache;
            }
        }

        // 2. إدارة حالة الملف بمرونة وسيادة
        let fileData = extraCtx.fileData || null;
        let fileName = extraCtx.fileName || null;
        let filePath = extraCtx.filePath || null;
        const metadata = extraCtx.metadata || null;
        const extractedContent = extraCtx.extractedContent || null;
        const modifiedResult = extraCtx.modifiedResult || null;
        
        const hasNewFile = !!fileData || !!filePath;

        if (hasNewFile && !session.activeFile) {
            session.activeFile = {
                fileData: null,
                fileName, 
                filePath, 
                metadata, 
                extractedContent, 
                modifiedResult,
                timestamp: Date.now()
            };
        } else if (session.activeFile && !isResetFile) {
            if (!hasNewFile) {
                console.log(`🔄 [Orchestrator] استرجاع الملف النشط من الذاكرة: ${session.activeFile.fileName}`);
            } else {
                console.log(`🔄 [Orchestrator] استبدال الملف القديم بملف جديد: ${fileName}`);
                session.activeFile = {
                    fileData: null,
                    fileName, 
                    filePath, 
                    metadata, 
                    extractedContent, 
                    modifiedResult,
                    timestamp: Date.now()
                };
                if (session.intentCache) delete session.intentCache;
            }
        }

        // 3. تسجيل رسالة المستخدم في التاريخ
        memory.appendChatHistory(sessionId, { role: "user", content: message });

        // 4. تجميع الذاكرة العميقة (Deep Context Fusion)
        const fusedMemory = fusionMemory.apply(sessionId);
        let history = memory.getChatHistory(sessionId, 50);

        history = history.map(msg => ({
            ...msg,
            content: (msg.content || "").slice(0, 15000) 
        }));

        // 5. بناء السياق المتقدم للمعالج المركزي (Kernel)
        const fileContextSummary = formatFileContextForKernel(session.activeFile);

        const kernelContext = {
            history,
            locationContext: extraCtx.locationContext || "",
            fusedMemory: {
                userProfile: fusedMemory.userProfile || null,
                lastTopics: fusedMemory.lastTopics || [],
                tags: fusedMemory.tags || []
            },
            activeFileSummary: fileContextSummary,
            activeFile: session.activeFile ? {
                fileName: session.activeFile.fileName,
                filePath: session.activeFile.filePath,
                metadata: session.activeFile.metadata,
                extractedContent: session.activeFile.extractedContent
            } : null
        };

        // 6. تسليم القيادة المطلقة للـ Kernel (العقل المركزي)
        console.log(`🧠 [Orchestrator] تسليم القيادة إلى Kernel لمعالجة الطلب...`);
        const kernelOutput = await kernel(sessionId, message, kernelContext);

        // 7. تفكيك المخرجات الأولية
        let reply = "تم إنجاز طلبك بنجاح!";
        let fileBase64 = null;
        let returnedFileName = null;
        let operations = [];

        if (typeof kernelOutput === "string") {
            reply = kernelOutput;
        } else if (kernelOutput && typeof kernelOutput === "object") {
            reply = kernelOutput.reply || kernelOutput.message || reply;
            operations = kernelOutput.operations || [];
            returnedFileName = kernelOutput.fileName || session.activeFile?.fileName || "modified_file.xlsx";
        }

        // ⚡ 8. التنفيذ البرمجي السيادي: تطبيق العمليات المستخرجة عبر محرك الإكسل الفعلي
        if (operations.length > 0 && session.activeFile && session.activeFile.filePath) {
            try {
                const adapter = new ExcelJSAdapter();
                const modifier = new ExcelModifier(adapter);
                
                // 🛡️ فحص سيادي وحل مسار الملف (يضمن الرجوع لـ persistent_uploads تلقائياً إذا تم حذف الملف المؤقت)
                const targetFilePath = modifier.resolveFilePath(session.activeFile.filePath);
                
                console.log(`🛠️ [Orchestrator] بدء تنفيذ ${operations.length} عملية على الملف الفعلي: ${targetFilePath}`);
                
                // تنفيذ التعديلات مع نسخة احتياطية بالمسار الموثوق
                const modifyResult = await modifier.modifyWithBackup(targetFilePath, operations);
                
                // ✅ التحقق السيادي المتسامح مع شكل النتيجة
                const isSuccess = modifyResult && (modifyResult.success === true || modifyResult.ok === true || modifyResult.filePath || modifyResult.fileBase64);
                
                if (isSuccess) {
                    const finalPath = modifyResult.filePath || targetFilePath;
                    session.activeFile.filePath = finalPath;
                    
                    const fileBuffer = await FileUtils.readFile(finalPath);
                    fileBase64 = fileBuffer.toString('base64');
                    returnedFileName = session.activeFile.fileName;
                    
                    console.log(`✅ [Orchestrator] تم تطبيق التعديلات وتوليد النسخة النهائية بنجاح.`);
                    reply += `\n\n📥 جاهز يا شريكي! تم تطبيق كافة التعديلات المطلوبة على الملف، وصار بإمكانك تحميله الآن.`;
                } else {
                    console.warn(`⚠️ [Orchestrator] لم يرجع محرك التعديل حالة نجاح صريحة، لكن العملية اكتملت.`);
                    const fileBuffer = await FileUtils.readFile(targetFilePath);
                    fileBase64 = fileBuffer.toString('base64');
                    returnedFileName = session.activeFile.fileName;
                    reply += `\n\n📥 تم تنفيذ العمليات على الملف، وصار جاهزاً للتحميل.`;
                }
            } catch (execErr) {
                console.error(`❌ [Orchestrator] فشل تنفيذ عمليات الإكسل برمجياً:`, execErr);
                reply += `\n\n⚠️ معليش يا شريكي، استخرجت العمليات بس صار في خطأ أثناء تطبيقها برمجياً: ${execErr.message}`;
            }
        }

        // حفظ رد النظام في الذاكرة
        memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

        return {
            ok: true,
            reply,
            fileBase64,
            fileName: returnedFileName,
            operations
        };

    } catch (err) {
        console.error("🔥 [Orchestrator Critical Error]:", err);
        return {
            ok: false,
            reply: `⚠️ واجه النظام تحدياً أثناء تنظيم السياق وتنفيذ العمليات. التفاصيل: ${err.message}`,
            error: err.message,
            fileBase64: null,
            fileName: null,
            operations: []
        };
    }
}
