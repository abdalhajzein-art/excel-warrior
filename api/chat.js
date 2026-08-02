/**
 * api/chat.js – Sovereign Chat Layer
 * النسخة الخفيفة بعد إزالة decision_kernel وكل الطبقات الزائدة
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";

export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : (req.body || {});

    const userContent = (body.message || body.prompt || "").trim();
    const sessionKey = body.sessionId || "default";

    // ⭐ الطريقة الجديدة: استقبال full.data مباشرة
    const fileData = body.fileData || null;
    const fileName = body.fileName || null;

    const history = body.history || [];

    if (!userContent && !fileData) {
      return res.status(400).json({
        reply: "⚠️ الرجاء إرسال رسالة أو ملف."
      });
    }

    // ⭐ تمرير الرسالة + full.data للطبقة السيادية المركزية
    const output = await conversationOrchestrator(sessionKey, userContent, {
      fileData,
      fileName,
      history
    });

    let reply = "تم إنجاز طلبك بنجاح!";
    let fileBase64 = null;
    let returnedFileName = null;

    if (typeof output === "string") {
      reply = output;
    } else if (output && typeof output === "object") {
      reply = output.reply || reply;
      fileBase64 = output.fileBase64 || null;
      returnedFileName = output.fileName || null;
    }

    return res.status(200).json({
      reply,
      fileBase64,
      fileName: returnedFileName
    });

  } catch (error) {
    console.error("❌ خطأ في api/chat.js:", error);
    return res.status(500).json({
      reply: `⚠️ خطأ داخلي أثناء المعالجة: ${error.message}`
    });
  }
}
