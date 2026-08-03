/**
 * api/core/conversation_orchestrator.js – Sovereign Universal Orchestrator
 * ✅ يمرر العمليات من kernel إلى chat.js
 * ✅ يدير حالة الملفات بشكل ذكي
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
    try {
        console.log(`📥 [Orchestrator] جلسة ${sessionId}: "${message}"`);

        const session = memory.getSession(sessionId);

        // 1. رصد نية إنهاء أو إعادة ضبط الملف النشط
        const lowerMsg = (message || "").toLowerCase();
        const isResetFile = lowerMsg.includes("انسى الملف") ||
            lowerMsg.includes("اغلق الملف") ||
            lowerMsg.includes("ملف جديد") ||
            lowerMsg.includes("احذف الملف") ||
            lowerMsg.includes("سكر الملف");

        if (isResetFile && session.activeFile) {
            console.log(`🗑️ [Orchestrator] تم مسح سياق الملف النشط للجلسة.`);
            session.activeFile = null;
            if (session.intentCache) {
                delete session.intentCache;
            }
        }

        // 2. إدارة حالة الملف بمرونة
        let fileData = extraCtx.fileData || null;
        let fileName = extraCtx.fileName || null;
        let filePath = extraCtx.filePath || null;
        const metadata = extraCtx.metadata || null;
        const extractedContent = extraCtx.extractedContent || null;
        const modifiedResult = extraCtx.modifiedResult || null;
        const hasFile = !!fileData || !!filePath;

        let sessionMetadata = metadata;
        let sessionExtractedContent = extractedContent;

        if (hasFile && !session.activeFile) {
            session.activeFile = {
                fileData,
                fileName,
                filePath,
                metadata,
                extractedContent,
                modifiedResult
            };
            sessionMetadata = metadata;
            sessionExtractedContent = extractedContent;
        } else if (session.activeFile && !isResetFile) {
            if (!hasFile) {
                fileData = session.activeFile.fileData;
                fileName = session.activeFile.fileName;
                filePath = session.activeFile.filePath;
                sessionMetadata = session.activeFile.metadata || null;
                sessionExtractedContent = session.activeFile.extractedContent || null;
                console.log(`🔄 [Orchestrator] استرجاع الملف من الجلسة: ${fileName}`);
            } else {
                session.activeFile = {
                    fileData,
                    fileName,
                    filePath,
                    metadata,
                    extractedContent,
                    modifiedResult
                };
                if (session.intentCache) {
                    delete session.intentCache;
                }
            }
        }

        // 3. تسجيل رسالة المستخدم في التاريخ
        memory.appendChatHistory(sessionId, { role: "user", content: message });

        // 4. تجميع الذاكرة والسياق العام
        const fusedMemory = fusionMemory.apply(sessionId);
        let history = memory.getChatHistory(sessionId, 30);

        history = history.map(msg => ({
            ...msg,
            content: (msg.content || "").slice(0, 2000)
        }));

        // 5. بناء السياق للمعالج (Kernel)
        const kernelContext = {
            history,
            locationContext: extraCtx.locationContext || "",
            fusedMemory: {
                userProfile: fusedMemory.userProfile || null,
                lastTopics: fusedMemory.lastTopics || [],
                tags: fusedMemory.tags || []
            },
            fileData,
            fileName,
            filePath,
            activeFile: session.activeFile || null,
            metadata: sessionMetadata,
            extractedContent: sessionExtractedContent,
            modifiedResult: modifiedResult || session.activeFile?.modifiedResult || null
        };

        // 6. تسليم القيادة المطلقة للـ Kernel
        const kernelOutput = await kernel(sessionId, message, kernelContext);

        let reply = "تم إنجاز طلبك بنجاح!";
        let fileBase64 = null;
        let returnedFileName = null;
        let operations = [];

        if (typeof kernelOutput === "string") {
            reply = kernelOutput;
        } else if (kernelOutput && typeof kernelOutput === "object") {
            reply = kernelOutput.reply || kernelOutput.message || reply;
            fileBase64 = kernelOutput.fileBase64 || null;
            returnedFileName = kernelOutput.fileName || null;
            operations = kernelOutput.operations || [];  // ✅ استقبال العمليات
        }

        memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

        return {
            ok: true,
            reply,
            fileBase64,
            fileName: returnedFileName,
            operations: operations  // ✅ تمرير العمليات
        };

    } catch (err) {
        console.error("🔥 [Orchestrator Error]:", err);
        return {
            ok: false,
            reply: `⚠️ صار خطأ بالنظام أثناء المعالجة: ${err.message}`,
            error: err.message,
            fileBase64: null,
            fileName: null,
            operations: []
        };
    }
                    }
