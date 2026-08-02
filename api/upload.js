/**
 * api/upload.js – Sovereign File Intake (Final Edition)
 * يستقبل الملف ويمرّره مباشرة إلى الجسر السيادي لمعالجة الملفات.
 */

import externalBridge from "./tools/external/external_file_bridge.js";

export default async function uploadHandler(req, res) {
  try {
    // 🟩 التحقق من وجود ملف
    if (!req.file) {
      return res.status(400).json({
        error: "⚠️ ما وصلني أي ملف."
      });
    }

    // 🚫 إزالة أي تعامل مع الاسم الأصلي
    // 🚫 لا decodeURIComponent
    // 🚫 لا originalName
    // 🚫 لا ترميز عربي

    console.log(`✅ [الأثير Intake] تم استلام الملف الآمن: ${req.file.originalname}`);

    // 🟦 تمرير الطلب للجسر السيادي مباشرة
    return await externalBridge(req, res);

  } catch (error) {
    console.error("❌ خطأ في api/upload.js:", error);
    return res.status(500).json({
      error: `⚠️ صار خطأ أثناء رفع الملف: ${error.message}`
    });
  }
}
