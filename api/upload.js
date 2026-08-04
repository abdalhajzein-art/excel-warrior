/**
 * api/upload.js – Sovereign Clean File Intake
 * استقبال الملف، تأمينه، وحفظه بنجاح دون أي تعقيدات أو محركات مكسورة.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function uploadHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "⚠️ ما وصلني أي ملف. يرجى إرفاق الملف المطلوب مع الطلب يا شريكي."
      });
    }

    console.log(`📊 [Intake] الملف الأصلي: ${req.file.originalname}`);
    console.log(`📊 [Intake] الحجم الأصلي: ${req.file.size} bytes`);
    console.log(`📊 [Intake] المسار المؤقت: ${req.file.path}`);

    let sourcePath = req.file.path;

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return res.status(400).json({ error: "⚠️ الملف غير موجود على السيرفر." });
    }

    const stats = fs.statSync(sourcePath);
    if (stats.size < 10) {
      return res.status(400).json({ error: "⚠️ الملف تالف أو فارغ." });
    }

    const fileBuffer = fs.readFileSync(sourcePath);

    const persistentDir = path.join(__dirname, "../persistent_uploads");
    if (!fs.existsSync(persistentDir)) {
      fs.mkdirSync(persistentDir, { recursive: true });
    }

    const safeFilename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    const persistentPath = path.join(persistentDir, safeFilename);

    fs.writeFileSync(persistentPath, fileBuffer);

    console.log(`🛡️ [Intake] تم حفظ الملف بنجاح في المسار الدائم: ${persistentPath}`);

    return res.status(200).json({
      reply: `تم استلام الملف وتأمينه بنجاح يا شريكي: ${req.file.originalname}`,
      fileName: req.file.originalname,
      filePath: persistentPath,
      size: req.file.size
    });

  } catch (error) {
    console.error("❌ خطأ حرج في api/upload.js:", error);
    return res.status(500).json({
      error: `⚠️ حدث خطأ غير متوقع أثناء معالجة الملف: ${error.message}`
    });
  }
}
