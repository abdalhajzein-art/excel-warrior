/**
 * api/upload.js – Sovereign File Intake + Heavy Processing Bridge (Final Edition)
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

    // 🟨 معالجة الاسم الأصلي العربي إن وُجد (تم إرساله من الـ Frontend)
    if (req.body.originalName) {
        // فك تشفير الاسم في حال وصوله بتشفير URI لحمايته
        req.file.originalname = decodeURIComponent(req.body.originalName); 
        console.log(`✅ [الأثير Intake] تم استلام الملف. الاسم الآمن: ${req.file.filename || 'تم إنشاؤه'}, الاسم الأصلي: ${req.file.originalname}`);
    }

    // 🟦 تمرير الطلب للجسر السيادي مباشرة
    return await externalBridge(req, res);

  } catch (error) {
    console.error("❌ خطأ في api/upload.js:", error);
    return res.status(500).json({
      error: `⚠️ صار خطأ أثناء رفع الملف: ${error.message}`
    });
  }
}
