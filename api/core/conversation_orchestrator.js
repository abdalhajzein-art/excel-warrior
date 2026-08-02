/**
 * api/core/conversation_orchestrator.js – النسخة السيادية المرتبطة بالأدوات التنفيذية
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";
import { excelModify } from "../tools/index.js"; // استدعاء أداة تعديل الإكسل البرمجية

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    console.log(`📥 [Orchestrator] جلسة ${sessionId}: "${message}"`);

    const session = memory.getSession(sessionId);

    const lowerMsg = message.toLowerCase();
    const isResetFile = lowerMsg.includes("انسى الملف") || 
                        lowerMsg.includes("اغلق الملف") || 
                        lowerMsg.includes("ملف جديد") || 
                        lowerMsg.includes("احذف الملف") ||
                        lowerMsg.includes("سكر الملف");

    if (isResetFile && session.activeFile) {
      console.log(`🗑️ [Orchestrator] تم مسح سياق الملف النشط للجلسة.`);
      session.activeFile = null;
    }

    let fileData = extraCtx.fileData || null;
    let fileName = extraCtx.fileName || null;
    let filePath = extraCtx.filePath || null;
    const hasFile = !!fileData || !!filePath;

    if (hasFile) {
      session.activeFile = { fileData, fileName, filePath };
    } else if (session.activeFile && !isResetFile) {
      fileData = session.activeFile.fileData;
      fileName = session.activeFile.fileName;
      filePath = session.activeFile.filePath;
    }

    memory.appendChatHistory(sessionId, { role: "user", content: message });

    // 🚀 كشف النية التنفيذية: هل يطلب المستخدم تعديل ملف إكسل نشط؟
    let toolResult = null;
    const isExcelFile = fileName && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv'));
    const isModificationIntent = lowerMsg.includes("أضف") || lowerMsg.includes("اضيف") || lowerMsg.includes("عدل") || 
                                 lowerMsg.includes("عمود") || lowerMsg.includes("قائمة") || lowerMsg.includes("تنسيق") ||
                                 lowerMsg.includes("سبب الغياب");

    if (isExcelFile && isModificationIntent && filePath) {
      console.log(`⚙️ [Orchestrator] تم رصد نية تعديل إكسل. جاري استدعاء محرك التنفيذ البرمجي...`);
      try {
        // استدعاء أداة التعديل الفعلية من مجلد tools
        toolResult = await excelModify(filePath, message);
        console.log(`✅ [Orchestrator] تمت معالجة الملف برمجياً بنجاح.`);
      } catch (toolErr) {
        console.error(`❌ [Orchestrator Tool Error]:`, toolErr);
      }
    }

    const fusedMemory = fusionMemory.apply(sessionId);
    let history = memory.getChatHistory(sessionId, 30);
    history = history.map(msg => ({ ...msg, content: (msg.content || "").slice(0, 2000) }));

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
      toolResult // تمرير نتيجة التنفيذ البرمجي للنموذج ليصيغ الرد بناءً عليها
    };

    const kernelOutput = await kernel(sessionId, message, kernelContext);

    let reply = "تم إنجاز طلبك بنجاح!";
    let fileBase64 = null;
    let returnedFileName = fileName;

    if (typeof kernelOutput === "string") {
      reply = kernelOutput;
    } else if (kernelOutput && typeof kernelOutput === "object") {
      reply = kernelOutput.reply || kernelOutput.message || reply;
      fileBase64 = kernelOutput.fileBase64 || null;
      returnedFileName = kernelOutput.fileName || returnedFileName;
    }

    // إذا نجح التنفيذ البرمجي للأداة، نضمن ربط اسم الملف الناتج
    if (toolResult && typeof toolResult === "object") {
      returnedFileName = toolResult.fileName || `Updated_${fileName}`;
      fileBase64 = toolResult.fileBase64 || fileBase64;
      if (toolResult.message) {
        reply = toolResult.message;
      }
    }

    memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

    return {
      ok: true,
      reply,
      fileBase64,
      fileName: returnedFileName
    };

  } catch (err) {
    console.error("🔥 [Orchestrator Error]:", err);
    return {
      ok: false,
      reply: `⚠️ صار خطأ بالنظام أثناء المعالجة: ${err.message}`,
      error: err.message,
      fileBase64: null,
      fileName: null
    };
  }
}
