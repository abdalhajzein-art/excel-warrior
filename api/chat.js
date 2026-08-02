/**
 * api/chat.js – Sovereign Chat Layer (النسخة المعمارية المحصنة بالكامل لتناول الملفات)
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

    // 🛡️ الحفظ الفيزيائي الفوري الآمن والمحصن للملف المرفق
    let localFilePath = null;
    if (fileData && fileName) {
      try {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        localFilePath = path.join(uploadDir, fileName);

        if (typeof fileData === 'string') {
          const cleanBase64 = fileData.replace(/^data:.*;base64,/, '');
          fs.writeFileSync(localFilePath, Buffer.from(cleanBase64, 'base64'));
        } else if (Buffer.isBuffer(fileData)) {
          fs.writeFileSync(localFilePath, fileData);
        } else if (typeof fileData === 'object' && fileData !== null) {
          // تحويل الكائن أو المصفوفة القادمة من الواجهة إلى Buffer بطريقة سليمة وآمنة
          const values = Object.values(fileData);
          fs.writeFileSync(localFilePath, Buffer.from(values));
        }
      } catch (err) {
        console.error("❌ خطأ في حفظ الملف الفيزيائي:", err);
      }
    }

    // تمرير الطلب + مسار الملف المادي للـ Orchestrator
    const output = await conversationOrchestrator(sessionKey, userContent, {
      fileData,
      fileName,
      filePath: localFilePath,
      history
    });

    let reply = "تم إنجاز طلبك بنجاح!";
    let fileBase64 = null;
    let returnedFileName = null;

    if (typeof output === "string") {
      reply = output;
    } else if (output && typeof output === "object") {
      reply = output.reply || output.message || "تم إنجاز طلبك بنجاح!";
      fileBase64 = output.fileBase64 || null;
      returnedFileName = output.fileName || null;
    }

    // إذا تم إنتاج ملف جديد نتيجة المعالجة البرمجية
    if (returnedFileName) {
      const realFileUrl = `/uploads/${returnedFileName}`;
      
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
