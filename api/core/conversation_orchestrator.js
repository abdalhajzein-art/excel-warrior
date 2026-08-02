/**
 * api/core/conversation_orchestrator.js
 * النسخة السيادية النهائية - الموجه الذكي المعتمد على JSON الصادر من الـ System
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";
import pandasEngine from "../tools/external/engines/pandas.js"; // 🔥 محرك بايثون التنفيذي

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    console.log(`📥 [Orchestrator] جلسة ${sessionId}: "${message}"`);
    const session = memory.getSession(sessionId);

    // 1. رصد نية تطهير الملف
    const lowerMsg = message.toLowerCase();
    const isResetFile = lowerMsg.includes("انسى الملف") || 
                        lowerMsg.includes("اغلق الملف") || 
                        lowerMsg.includes("ملف جديد") || 
                        lowerMsg.includes("احذف الملف") ||
                        lowerMsg.includes("سكر الملف");

    if (isResetFile && session.activeFile) {
      console.log(`🗑️ [Orchestrator] تم مسح سياق الملف النشط.`);
      session.activeFile = null;
    }

    // إدارة السياق والملف النشط
    let fileData = extraCtx.fileData || null;
    let fileName = extraCtx.fileName || null;
    let filePath = extraCtx.filePath || extraCtx.file?.path || null;
    const hasFile = !!fileData;

    if (hasFile) {
      session.activeFile = { fileData, fileName, filePath };
    } else if (session.activeFile && !isResetFile) {
      fileData = session.activeFile.fileData;
      fileName = session.activeFile.fileName;
      filePath = session.activeFile.filePath;
    }

    const locationContext = extraCtx.locationContext || "";

    // 2. تسجيل المحادثة واستخراج الذاكرة
    memory.appendChatHistory(sessionId, { role: "user", content: message });
    const fusedMemory = fusionMemory.apply(sessionId);
    let history = memory.getChatHistory(sessionId, 20);

    // تجهيز سياق الكرنل
    const kernelContext = {
      history,
      locationContext,
      fusedMemory: {
        userProfile: fusedMemory.userProfile || null,
        lastTopics: fusedMemory.lastTopics || [],
        tags: fusedMemory.tags || []
      },
      fileData,
      fileName,
      filePath: filePath ? true : false
    };

    // 3. استدعاء الكرنل (الذي يستمد توجيهاته حصراً من system.js)
    const rawKernelResponse = await kernel(sessionId, message, kernelContext);

    // 4. محاولة تحليل الرد (هل هو JSON تنفيذي أم دردشة نصية عادية؟)
    let decision;
    try {
        // تنظيف الرد من أي زوائد إذا وجدت للتأكد من سلامة الـ JSON
        const cleanJsonStr = rawKernelResponse.trim().replace(/^```json/, '').replace(/```$/, '').trim();
        decision = JSON.parse(cleanJsonStr);
    } catch (e) {
        // إذا لم يكن JSON، نعتبره رداً نصياً عادياً (محادثة طبيعية)
        decision = {
            intent: "chat",
            reply: rawKernelResponse,
            python_code: ""
        };
    }

    let reply = decision.reply || rawKernelResponse;
    let generatedFileBase64 = null;
    let generatedFileName = null;

    /* ============================================================
       ⚡ التنفيذ البرمجي الأعمى (عندما يقرر العقل تعديل الملف)
       ============================================================ */
    if (decision.intent === "modify_file" && filePath && decision.python_code) {
      console.log(`⚙️ [Orchestrator] الأثير قرر تعديل الملف برمجياً: ${fileName}`);
      
      const toolResult = await pandasEngine(filePath, "modify", { 
        custom_python_code: decision.python_code,
        originalName: fileName 
      });

      if (toolResult.ok) {
        generatedFileBase64 = toolResult.fileBase64;
        generatedFileName = toolResult.fileName || `alatheer_modified_${fileName || 'file.xlsx'}`;
      } else {
        reply = `⚠️ واجهت مشكلة بتنفيذ الكود البرمجي: ${toolResult.error || toolResult.reply}`;
      }
    }

    // 5. حفظ الرد النهائي بالذاكرة وإرجاعه للواجهة
    memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

    return {
      ok: true,
      reply,
      fileBase64: generatedFileBase64,
      fileName: generatedFileName
    };

} catch (err) {
    console.error("🔥 [Orchestrator Error]:", err);
    return {
      ok: false,
      reply: `⚠️ صار خطأ بالنظام أثناء المعالجة: ${err.message}`,
      error: err.message
    };
  }
}

