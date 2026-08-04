/**
 * api/core/conversation_orchestrator.js – Sovereign Ultra Orchestrator
 * النسخة السيادية الكاملة – Multi‑Engine + Deep Memory + Kernel Delegation
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";

// 🛠️ استيراد المحرك السيادي الكامل
import { ExcelAdapter } from '../tools/external/engines/excel/core/ExcelAdapter.js';
import { ExcelModifier } from '../tools/external/engines/excel/modifiers/ExcelModifier.js';
import { FileUtils } from '../tools/external/engines/excel/utils/FileUtils.js';

/* ============================================================
   📊 بناء ملخص سياق الملف للـ Kernel
   ============================================================ */
function formatFileContextForKernel(activeFile) {
    if (!activeFile) return null;

    const { fileName, metadata, extractedContent } = activeFile;
    let summary = `📄 **الملف النشط:** ${fileName}\n`;

    if (metadata) {
        summary += `📊 **الأبعاد:** ${metadata.sheets || 1} شيت | ${metadata.totalRows || 0} صف | ${metadata.totalColumns || 0} عمود\n`;
    }

    if (extractedContent?.text) {
        const sample = extractedContent.text.slice(0, 3000);
        summary += `📝 **عينة بيانات:**\n${sample}\n`;
    }

    return summary;
}

/* ============================================================
   🎛️ الـ Orchestrator السيادي
   ============================================================ */
export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
    try {
        console.log(`📥 [Orchestrator] جلسة ${sessionId} | "${message.substring(0, 50)}..."`);

        const session = memory.getSession(sessionId) || memory.createSession(sessionId);

        /* ============================================================
           1) إدارة حالة الملف (فتح / إغلاق / استبدال)
           ============================================================ */
        const lowerMsg = (message || "").toLowerCase();
        const resetRegex = /(انسى|اغلق|احذف|سكر|تجاهل) (الملف|البيانات)|ملف (جديد|اخر)/;
        const isResetFile = resetRegex.test(lowerMsg);

        if (isResetFile && session.activeFile) {
            console.log(`🗑️ [Orchestrator] تم مسح الملف النشط بطلب المستخدم.`);
            session.activeFile = null;
            delete session.intentCache;
        }

        const hasNewFile = extraCtx.fileData || extraCtx.filePath;

        if (hasNewFile) {
            session.activeFile = {
                fileName: extraCtx.fileName,
                filePath: extraCtx.filePath,
                metadata: extraCtx.metadata,
                extractedContent: extraCtx.extractedContent,
                modifiedResult: extraCtx.modifiedResult,
                timestamp: Date.now()
            };
        }

        /* ============================================================
           2) حفظ رسالة المستخدم
           ============================================================ */
        memory.appendChatHistory(sessionId, { role: "user", content: message });

        /* ============================================================
           3) دمج الذاكرة العميقة
           ============================================================ */
        const fusedMemory = fusionMemory.apply(sessionId);
        let history = memory.getChatHistory(sessionId, 50).map(msg => ({
            ...msg,
            content: (msg.content || "").slice(0, 15000)
        }));

        /* ============================================================
           4) بناء سياق الـ Kernel
           ============================================================ */
        const kernelContext = {
            history,
            fusedMemory,
            activeFileSummary: formatFileContextForKernel(session.activeFile),
            activeFile: session.activeFile
        };

        /* ============================================================
           5) تسليم القيادة للـ Kernel
           ============================================================ */
        console.log(`🧠 [Orchestrator] تسليم القيادة للـ Kernel...`);
        const kernelOutput = await kernel(sessionId, message, kernelContext);

        let reply = kernelOutput.reply || "تم يا شريكي.";
        let operations = kernelOutput.operations || [];
        let returnedFileName = kernelOutput.fileName || session.activeFile?.fileName;
        let fileBase64 = null;

        /* ============================================================
           6) تنفيذ عمليات Excel عبر المحرك السيادي الكامل
           ============================================================ */
        if (operations.length > 0 && session.activeFile?.filePath) {
            try {
                const adapter = new ExcelAdapter();        // المحرك السيادي الكامل
                const modifier = new ExcelModifier(adapter);

                const targetFilePath = modifier.resolveFilePath(session.activeFile.filePath);

                console.log(`🛠️ [Orchestrator] تنفيذ ${operations.length} عملية على: ${targetFilePath}`);

                const modifyResult = await modifier.modifyWithBackup(targetFilePath, operations);

                const finalPath = modifyResult.filePath || targetFilePath;
                session.activeFile.filePath = finalPath;

                const buffer = await FileUtils.readFile(finalPath);
                fileBase64 = buffer.toString("base64");

                reply += `\n\n📥 جاهز يا شريكي! الملف المعدل صار جاهز للتحميل.`;

            } catch (err) {
                console.error(`❌ [Orchestrator] خطأ أثناء تنفيذ عمليات الإكسل:`, err);
                reply += `\n⚠️ صار خطأ أثناء تنفيذ العمليات: ${err.message}`;
            }
        }

        /* ============================================================
           7) حفظ رد المساعد
           ============================================================ */
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
            reply: `⚠️ صار خطأ أثناء تنظيم السياق وتنفيذ العمليات: ${err.message}`,
            error: err.message,
            fileBase64: null,
            fileName: null,
            operations: []
        };
    }
}
