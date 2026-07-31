/**
 * api/chat.js – Sovereign Chat Layer
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";

export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : (req.body || {});

    const userContent = (body.message || body.prompt || "").trim();
    const sessionKey = body.sessionId || "default";
    const fileResult = body.fileResult || null;
    const history = body.history || [];

    if (!userContent && !fileResult) {
      return res.status(400).json({
        reply: "⚠️ الرجاء إرسال رسالة أو ملف."
      });
    }

    const output = await conversationOrchestrator(sessionKey, userContent, {
      fileResult,
      history
    });

    let reply = "تم إنجاز طلبك بنجاح!";
    let fileBase64 = null;
    let fileName = null;

    if (typeof output === "string") {
      reply = output;
    } else if (output && typeof output === "object") {
      reply = output.reply || reply;
      fileBase64 = output.fileBase64 || null;
      fileName = output.fileName || null;
    }

    return res.status(200).json({
      reply,
      fileBase64,
      fileName
    });

  } catch (error) {
    console.error("❌ خطأ في api/chat.js:", error);
    return res.status(500).json({
      reply: `⚠️ خطأ داخلي أثناء المعالجة: ${error.message}`
    });
  }
}
