/**
 * api/upload.js – Sovereign File Intake (Final Edition)
 * يستقبل الملف ويمرّره مباشرة إلى الجسر السيادي لمعالجة الملفات.
 * يدعم قراءة الميتاداتا وحفظ نسخة دائمة بمنطقة آمنة لمنع حذفها بواسطة Garbage Collection.
 */

import externalBridge from "./tools/external/external_file_bridge.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function uploadHandler(req, res) {
  try {
    // ✅ التحقق من وجود ملف
    if (!req.file) {
      return res.status(400).json({
        error: "⚠️ ما وصلني أي ملف. يرجى إرفاق الملف المطلوب مع الطلب."
      });
    }

    // ✅ تسجيل معلومات الملف الأصلية (للتصحيح)
    console.log(`📊 [Intake] الملف الأصلي: ${req.file.originalname}`);
    console.log(`📊 [Intake] الحجم الأصلي: ${req.file.size} bytes`);
    console.log(`📊 [Intake] المسار المؤقت: ${req.file.path}`);
    
    let sourcePath = req.file.path;

    // ✅ قراءة الملف من المسار المؤقت والتأكد من صحته
    if (sourcePath && fs.existsSync(sourcePath)) {
      const stats = fs.statSync(sourcePath);
      console.log(`📊 [Intake] حجم الملف المؤقت: ${stats.size} bytes`);
      
      if (stats.size < 10) {
        console.warn(`⚠️ [Intake] الملف صغير جداً (${stats.size} bytes)، قد يكون تالفاً.`);
        return res.status(400).json({
          error: `⚠️ الملف تالف أو فارغ (الحجم: ${stats.size} bytes). يرجى إعادة رفع الملف.`
        });
      }
      
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (stats.size > maxSize) {
        return res.status(400).json({
          error: `⚠️ الملف كبير جداً (${stats.size} bytes). الحد الأقصى هو 50MB.`
        });
      }
    } else {
      console.error(`❌ [Intake] الملف غير موجود في المسار: ${sourcePath}`);
      return res.status(400).json({
        error: "⚠️ الملف غير موجود على السيرفر."
      });
    }

    // ✅ قراءة الملف كـ Buffer
    let fileBuffer = fs.readFileSync(sourcePath);

    // 🛡️ [حماية السيادة]: نقل وتثبيت الملف في مجلد دائمة وآمن لمنع الـ Garbage Collection من مسحه
    const persistentDir = path.join(__dirname, "../persistent_uploads");
    if (!fs.existsSync(persistentDir)) {
      fs.mkdirSync(persistentDir, { recursive: true });
    }

    const safeFilename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    const persistentPath = path.join(persistentDir, safeFilename);
    
    fs.writeFileSync(persistentPath, fileBuffer);
    console.log(`🛡️ [Intake] تم حفظ نسخة دائمة وآمنة للملف في: ${persistentPath}`);

    // ✅ التحقق من وجود ميتاداتا
    const metadata = req.body?.metadata || null;

    const fileInfo = {
      originalname: req.file.originalname || "unknown_file",
      mimetype: req.file.mimetype || "application/octet-stream",
      size: req.file.size || 0,
      path: persistentPath, // ✅ توجيه المسار للمجلد الدائم الآمن حصراً
      metadata: metadata,
      buffer: fileBuffer // ✅ تمرير الـ Buffer السيادي للجسر
    };

    console.log(`✅ [الأثير Intake] تم استلام وتأمين الملف بنجاح: ${fileInfo.originalname}`);
    if (metadata && metadata.sheet_name) {
      console.log(`📋 [الأثير Intake] تم استلام ميتاداتا للملف: ${metadata.sheet_name}`);
    }

    // ✅ تمرير الملف مع الميتاداتا إلى الجسر السيادي
    return await externalBridge(req, res, fileInfo);

  } catch (error) {
    console.error("❌ خطأ حرج في api/upload.js:", error);
    return res.status(500).json({
      error: `⚠️ حدث خطأ غير متوقع أثناء معالجة الملف: ${error.message}`
    });
  }
}
