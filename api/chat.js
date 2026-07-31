/**
 * api/chat.js – Sovereign Chat Layer (مع تتبع كامل للتدفق واللوجات)
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";

export default async function handler(req, res) {
  console.log("🔌 [Chat API] تم استلام طلب جديد في مسار /api/chat");
  
  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : (req.body || {});

    const sessionKey = body.sessionId || "default";
    console.log(`📦 [Chat API] تحليل بيانات الجلسة [${sessionKey}] بنجاح.`);

    const userContent = (body.message || body.prompt || "").trim();
    const fileResult = body.fileResult || null;
    const history = body.history || [];

    if (!userContent && !fileResult) {
      console.log("⚠️ [Chat API] الطلب مرفوض: الرسالة والملف فارغان.");
      return res.status(400).json({
        reply: "⚠️ الرجاء إرسال رسالة أو ملف."
      });
    }

    console.log("🤖 [Chat API] جاري تمرير الطلب إلى conversationOrchestrator...");
    const output = await conversationOrchestrator(sessionKey, userContent, {
      fileResult,
      history
    });
    console.log("✅ [Chat API] تم استلام الرد من conversationOrchestrator بنجاح.");

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

    console.log("📤 [Chat API] إرسال الاستجابة النهائية (200 OK) للعميل...");
    return res.status(200).json({
      reply,
      fileBase64,
      fileName
    });

  } catch (error) {
    console.error("🔥 [Chat API Fatal Error]:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        reply: `⚠️ خطأ داخلي أثناء المعالجة: ${error.message}`
      });
    }
  }
}
