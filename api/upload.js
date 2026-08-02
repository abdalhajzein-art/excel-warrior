/**
 * api/upload.js – Sovereign File Intake (Final Edition)
 * يستقبل الملف ويمرّره مباشرة إلى الجسر السيادي لمعالجة الملفات.
 * يدعم قراءة الميتاداتا إذا كانت موجودة في الطلب.
 */

import externalBridge from "./tools/external/external_file_bridge.js";
import fs from "fs";

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
    
    // ✅ قراءة الملف من المسار المؤقت للتأكد من وجوده
    if (req.file.path && fs.existsSync(req.file.path)) {
      const stats = fs.statSync(req.file.path);
      console.log(`📊 [Intake] حجم الملف المؤقت: ${stats.size} bytes`);
      
      // ✅ إذا كان الملف صغيراً جداً، قد يكون تالفاً
      if (stats.size < 10) {
        console.warn(`⚠️ [Intake] الملف صغير جداً (${stats.size} bytes)، قد يكون تالفاً.`);
      }
    } else {
      console.error(`❌ [Intake] الملف غير موجود في المسار: ${req.file.path}`);
    }

    // ✅ التحقق من وجود ميتاداتا
    const metadata = req.body?.metadata || null;
    const fileInfo = {
      originalname: req.file.originalname || "unknown_file",
      mimetype: req.file.mimetype || "application/octet-stream",
      size: req.file.size || 0,
      path: req.file.path,
      metadata: metadata,
      buffer: req.file.buffer || null // ✅ حفظ الـ Buffer إذا كان موجوداً
    };

    console.log(`✅ [الأثير Intake] تم استلام الملف الآمن: ${fileInfo.originalname}`);
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
