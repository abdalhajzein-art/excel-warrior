/**
 * api/chat.js – Sovereign Chat Layer (نسخة سيادية خفيفة + ذاكرة مزدوجة)
 */

import fs from "fs";
import path from "path";
import os from "os";

import memory from "./core/memory.js";
import conversationOrchestrator from "./core/conversation_orchestrator.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ reply: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    const {
      message,
      prompt,
      uploadedFile,
      sessionId,
      history
    } = body;

    const userContent = (message || prompt || "").trim();
    const sessionKey = sessionId || "default";

    const session = memory.getSession(sessionKey);

    // 🧠 تحديث تاريخ الدردشة فقط (persona)
    if (Array.isArray(history) && history.length > (session.persona.history?.length || 0)) {
      history.forEach(entry => {
        memory.appendPersonaHistory(sessionKey, entry);
      });
    }

    // 🧠 تجهيز الملف إن وجد (Base64 → ملف مؤقت في /tmp)
    let fileObj = null;

    if (uploadedFile && uploadedFile.fileBase64) {
      const buffer = Buffer.from(uploadedFile.fileBase64, "base64");
      const fileName = uploadedFile.fileName || "uploaded_file";
      const tempPath = path.join(os.tmpdir(), `${Date.now()}_${fileName}`);

      fs.writeFileSync(tempPath, buffer);

      fileObj = {
        path: tempPath,
        name: fileName
      };

      // تخزين آخر ملف في الذاكرة السيادية
      memory.saveFile(sessionKey, fileObj);
    } else if (session.sovereign.lastFile) {
      // استخدام آخر ملف معروف في الجلسة إن وجد
      fileObj = session.sovereign.lastFile;
    }

    // 🧠 استدعاء المنسّق السيادي
    const output = await conversationOrchestrator(sessionKey, userContent, {
      file: fileObj
    });

    // 🧠 تطبيع الرد
    let reply = "";
    let fileBase64 = null;
    let fileName = null;

    if (typeof output === "string") {
      reply = output;
    } else if (output && typeof output === "object") {
      reply = output.reply || "تم إنجاز طلبك بنجاح!";
      fileBase64 = output.fileBase64 || null;
      fileName = output.fileName || null;
    } else {
      reply = "تم إنجاز طلبك بنجاح!";
    }

    return res.status(200).json({
      reply,
      fileBase64,
      fileName
    });

  } catch (error) {
    console.error("❌ خطأ في api/chat.js:", error);
    return res.status(200).json({
      reply: `⚠️ خطأ داخلي أثناء المعالجة: ${error.message}`
    });
  }
}