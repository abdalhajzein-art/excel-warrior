/**
 * api/upload.js – Sovereign File Intake + Heavy Processing Bridge
 * يستقبل الملف ويمرّره مباشرة إلى الجسر السيادي لمعالجة الملفات.
 */

import externalBridge from "./tools/external/external_file_bridge.js";

export default async function uploadHandler(req, res) {
  try {
    // التحقق من وجود ملف
    if (!req.file) {
      return res.status(400).json({
        error: "⚠️ لم يتم رفع أي ملف."
      });
    }

    // تمرير الطلب بالكامل إلى الجسر السيادي
    return await externalBridge(req, res);

  } catch (error) {
    console.error("❌ خطأ في api/upload.js:", error);
    return res.status(500).json({
      error: `⚠️ خطأ أثناء رفع الملف: ${error.message}`
    });
  }
}