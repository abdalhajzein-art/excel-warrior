/**
 * api/chat.js – Sovereign Chat Layer (النسخة المعمارية المحصنة بالكامل)
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

    // 🛡️ معالجة مرنة جداً لجميع أشكال المخرجات (نصوص، كائنات، أو JSON Strings)
    let parsedOutput = output;
    if (typeof output === "string") {
      try {
        parsedOutput = JSON.parse(output);
      } catch (e) {
        // إذا لم يكن JSON صالحاً، فهو نص عادي
        reply = output;
      }
    }

    if (parsedOutput && typeof parsedOutput === "object") {
      // دعم جميع المفاتيح المحتملة (reply, message, response)
      reply = parsedOutput.reply || parsedOutput.message || parsedOutput.response || reply;
      
      // دعم جميع مفاتيح الملفات (fileBase64, file_base64)
      fileBase64 = parsedOutput.fileBase64 || parsedOutput.file_base64 || null;
      
      // دعم جميع مفاتيح أسماء الملفات (fileName, file_name)
      returnedFileName = parsedOutput.fileName || parsedOutput.file_name || null;
    }

    // 🛡️ التعديل المعماري السيادي: معالجة الملفات وتوليد رابط التحميل المباشر
    if (returnedFileName) {
      const realFileUrl = `/uploads/${returnedFileName}`;

      // إذا كان هناك Base64، نقوم بحفظه في مجلد الـ uploads للتأكد من توفره
      if (fileBase64) {
        try {
          const buffer = Buffer.from(fileBase64, 'base64');
          const uploadDir = path.join(__dirname, '../uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          fs.writeFileSync(path.join(uploadDir, returnedFileName), buffer);
        } catch (err) {
          console.error("❌ خطأ في حفظ الملف من الـ Base64:", err);
        }
      }

      // تنظيف واستبدال أي روابط وهمية أو علامات هاش (#) بالرابط الحقيقي
      reply = reply.replace(/sandbox:\/[^\s)]+/g, realFileUrl);
      reply = reply.replace(/\(sandbox:[^)]+\)/g, `(${realFileUrl})`);
      reply = reply.replace(/["']download_link["']\s*:\s*["']#["']/g, `"download_link": "${realFileUrl}"`);
      reply = reply.replace(/href=["']#["']/g, `href="${realFileUrl}"`);

      // إضافة رابط التحميل المباشر بوضوح إذا لم يكن مضمناً في النص
      if (!reply.includes(realFileUrl)) {
        reply += `\n\n📥 **[تحميل الملف المحدث مباشرة](${realFileUrl})**`;
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
