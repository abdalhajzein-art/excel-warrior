/**
 * external_file_bridge.js – Sovereign Heavy Engine Bridge (Final Edition)
 * الجسر السيادي الموحد لمعالجة الملفات عبر المحركات المحلية
 */

import fs from "fs";
import path from "path";
import os from "os";

// المحركات السيادية
import { excelRead, excelModify, excelCreate } from "../excel.js";
import { pdfRead, pdfConvert, pdfCreate } from "../pdf.js";
import { wordCreate } from "../word.js";
import { pptCreate } from "../ppt.js";
import { imageConvert } from "../image.js";

// LibreOffice
import libreConvert from "./engines/libre.js";

export default async function externalBridge(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "⚠️ لم يتم رفع أي ملف." });
    }

    const action = req.body.action || "read";

    // حفظ الملف مؤقتًا
    const tmpDir = os.tmpdir();
    const fileName = `${Date.now()}_${req.file.originalname}`;
    const filePath = path.join(tmpDir, fileName);

    fs.writeFileSync(filePath, req.file.buffer);

    const ext = path.extname(fileName).toLowerCase();
    let result = null;

    /* ============================================================
       🟥 اختيار المحرك المناسب حسب الامتداد
       ============================================================ */
    if (ext === ".pdf") {
      if (action === "read") result = await pdfRead(filePath);
      else if (action === "convert") result = await pdfConvert(filePath, req.body.target || "pdf");
      else if (action === "create") result = await pdfCreate(req.body.text || "");
    }

    else if (ext === ".docx") {
      if (action === "read") result = await libreConvert(filePath, "txt");
      else if (action === "convert") result = await libreConvert(filePath, req.body.target || "pdf");
      else if (action === "create") result = await wordCreate(req.body.text || "");
    }

    else if (ext === ".xlsx" || ext === ".xls") {
      if (action === "read") result = await excelRead(filePath);
      else if (action === "modify") {
        const fn = (row) => row;
        result = await excelModify(filePath, fn);
      }
      else if (action === "create") result = await excelCreate(req.body.text || "");
    }

    else if ([".png", ".jpg", ".jpeg", ".webp", ".tiff", ".avif"].includes(ext)) {
      if (action === "convert") {
        const target = req.body.target || "png";
        result = await imageConvert(filePath, target);
      } else {
        result = { reply: "📷 هذا ملف صورة – ما في استخراج نص منه حالياً.", data: null };
      }
    }

    else {
      // fallback عام
      result = await pdfRead(filePath);
    }

    /* ============================================================
       🟦 إذا المحرك رجّع ملف
       ============================================================ */
    if (result?.fileBase64) {
      return res.status(200).json({
        reply: result.reply || "تمت معالجة الملف بنجاح.",
        fileBase64: result.fileBase64,
        fileName: result.fileName || "output"
      });
    }

    /* ============================================================
       🟩 إذا المحرك رجّع نص أو بيانات
       ============================================================ */
    return res.status(200).json({
      reply: result.reply || "تمت معالجة الملف بنجاح.",
      data: result.data || null
    });

  } catch (err) {
    console.error("❌ خطأ في external_file_bridge:", err);
    return res.status(500).json({
      error: `⚠️ خطأ أثناء معالجة الملف: ${err.message}`
    });
  }
}
