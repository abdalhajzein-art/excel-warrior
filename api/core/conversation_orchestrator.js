/**
 * api/core/conversation_orchestrator.js
 * النسخة السيادية التفيذية – معالجة ذكية + تنفيذ برمجي مباشر عبر بايثون عند طلب التعديل
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";
import pandasEngine from "../tools/external/engines/pandas.js"; // 🔥 ربط محرك بايثون التنفيذي

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    console.log(`📥 [Orchestrator] جلسة ${sessionId}: "${message}"`);

    const session = memory.getSession(sessionId);

    // رصد نية المستخدم لإلغاء أو تطهير الملف الحالي والبدء بصفحة جديدة
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
    let filePath = extraCtx.filePath || extraCtx.file?.path || null;
    const hasFile = !!fileData;

    if (hasFile) {
      // حفظ الملف ومساره في ذاكرة الجلسة المؤقتة
      session.activeFile = { fileData, fileName, filePath };
    } else if (session.activeFile && !isResetFile) {
      // استرجاع الملف المحفوظ مسبقاً
      fileData = session.activeFile.fileData;
      fileName = session.activeFile.fileName;
      filePath = session.activeFile.filePath;
    }

    const locationContext = extraCtx.locationContext || "";

    // 🟩 إضافة رسالة المستخدم للذاكرة
    memory.appendChatHistory(sessionId, { role: "user", content: message });

    // 🟩 استخراج الذاكرة المدمجة
    const fusedMemory = fusionMemory.apply(sessionId);

    /* ============================================================
       ⚡ فحص نية التعديل التنفيذي (Execution Interception)
       إذا كان هناك ملف نشط والمستخدم يطلب تعديلاً أو إضافة على الإكسل
       ============================================================ */
    const isModificationRequest = session.activeFile && (
      lowerMsg.includes("أضف") || 
      lowerMsg.includes("ضيف") || 
      lowerMsg.includes("عدل") || 
      lowerMsg.includes("عمود") || 
      lowerMsg.includes("قائمة") ||
      lowerMsg.includes("xlsx") ||
      lowerMsg.includes("حط") ||
      lowerMsg.includes("تنسيق")
    );

    let reply = "";
    let generatedFileBase64 = null;
    let generatedFileName = null;

    if (isModificationRequest && filePath) {
      console.log(`⚙️ [Orchestrator] رصد طلب تعديل إكسل تنفيذي على الملف: ${fileName}`);
      
      // استدعاء محرك بايثون لمعالجة الملف وهندسته برمجياً
      const toolResult = await pandasEngine(filePath, "openpyxl_manipulate", { 
        prompt: message,
        originalName: fileName 
      });

      if (toolResult.ok) {
        reply = toolResult.reply || "🎨 تم تنفيذ التعديل وهندسة الملف بنجاح عبر محرك بايثون السيادي.";
        generatedFileBase64 = toolResult.fileBase64;
        generatedFileName = toolResult.fileName || `modified_${fileName || 'file.xlsx'}`;
      } else {
        reply = `⚠️ فشل تنفيذ التعديل البرمجي على الملف: ${toolResult.error || toolResult.reply}`;
      }

    } else {
      /* ============================================================
         🟦 مسار المحادثة والتحليل الطبيعي عبر الكرنل (جيميني)
         ============================================================ */
      let history = memory.getChatHistory(sessionId, 30);

      history = history.map(msg => ({
        ...msg,
        content: msg.content.slice(0, 2000)
      }));

      const kernelContext = {
        history,
        locationContext,
        fusedMemory: {
          userProfile: fusedMemory.userProfile || null,
          lastTopics: fusedMemory.lastTopics || [],
          tags: fusedMemory.tags || []
        },
        fileData,
        fileName
      };

      reply = await kernel(sessionId, message, kernelContext);
    }

    memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

    return {
      ok: true,
      reply,
      fileBase64: generatedFileBase64,
      fileName: generatedFileName
    };

  } catch (err) {
    console.err("🔥 [Orchestrator Error]:", err);
    return {
      ok: false,
      reply: `⚠️ صار خطأ بالنظام أثناء المعالجة: ${err.message}`,
      error: err.message
    };
  }
}
