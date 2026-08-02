/**
 * api/upload.js – Sovereign File Intake (Final Edition)
 * يستقبل الملف ويمرّره مباشرة إلى الجسر السيادي لمعالجة الملفات.
 * يدعم قراءة الميتاداتا إذا كانت موجودة في الطلب.
 */

import externalBridge from "./tools/external/external_file_bridge.js";

export default async function uploadHandler(req, res) {
  try {
    // ✅ التحقق من وجود ملف
    if (!req.file) {
      return res.status(400).json({
        error: "⚠️ ما وصلني أي ملف. يرجى إرفاق الملف المطلوب مع الطلب."
      });
    }

    // ✅ التحقق من وجود ميتاداتا (إذا كانت مرسلة من الواجهة)
    const metadata = req.body?.metadata || null;
    const fileInfo = {
      originalname: req.file.originalname || "unknown_file",
      mimetype: req.file.mimetype || "application/octet-stream",
      size: req.file.size || 0,
      path: req.file.path,
      metadata: metadata // ✅ تمرير الميتاداتا إن وجدت
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
