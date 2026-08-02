/**
 * api/chat.js – Sovereign Chat Layer (النسخة المحصنة لتوليد روابط التحميل المباشر)
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : (req.body || {});

    const userContent = (body.message || body.prompt || "").trim();
    const sessionKey = body.sessionId || "default";

    const fileData = body.fileData || null;
    const fileName = body.fileName || null;
    const history = body.history || [];

    if (!userContent && !fileData) {
      return res.status(400).json({
        reply: "⚠️ الرجاء إرسال رسالة أو ملف."
      });
    }

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

    // 🛡️ التعديل المعماري السيادي: تحويل الـ Base64 إلى ملف حقيقي قابل للتحميل الفوري
    if (fileBase64 && returnedFileName) {
      try {
        const buffer = Buffer.from(fileBase64, 'base64');
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const savedPath = path.join(uploadDir, returnedFileName);
        fs.writeFileSync(savedPath, buffer);

        // بناء الرابط الحقيقي المباشر على السيرفر
        const realFileUrl = `/uploads/${returnedFileName}`;

        // استبدال أي رابط sandbox وهمي برابط التحميل الحقيقي في رد النموذج
        reply = reply.replace(/sandbox:\/[^\s)]+/g, realFileUrl);
        reply = reply.replace(/\(sandbox:[^)]+\)/g, `(${realFileUrl})`);

        // إضافة زر أو رابط واضح إذا لم يكن موجوداً
        if (!reply.includes(realFileUrl)) {
          reply += `\n\n📥 **[تحميل الملف المحدث مباشرة](${realFileUrl})**`;
        }
      } catch (err) {
        console.error("❌ خطأ في حفظ الملف المؤقت للتحميل:", err);
      }
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
