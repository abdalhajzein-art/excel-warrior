/**
 * api/upload.js – Sovereign File Intake (ExcelEngine Integration Edition)
 * يستقبل الملف، يؤمّنه، ثم يمرّره مباشرة لمحرك ExcelEngine الموحد.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 🟦 استيراد محرك الإكسل الموحد
import {
  excelRead,
  excelModify,
  excelAnalyze,
  excelFormat,
  excelPivot,
  excelCreate,
  excelConvertToPdf,
  excelConvertToCsv
} from "./tools/external/engines/excel/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function uploadHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "⚠️ ما وصلني أي ملف. يرجى إرفاق الملف المطلوب مع الطلب."
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

    const fileInfo = {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: persistentPath,
      buffer: fileBuffer
    };

    // 🟦 تحديد العملية المطلوبة
    const action = req.body.action || "read";
    const params = req.body || {};

    let result;

    switch (action) {
      case "read":
      case "preview":
        result = await excelRead(fileInfo.path, params);
        break;

      case "modify":
        result = await excelModify(fileInfo.path, params);
        break;

      case "analyze":
        result = await excelAnalyze(fileInfo.path, params);
        break;

      case "format":
        result = await excelFormat(fileInfo.path, params);
        break;

      case "pivot":
        result = await excelPivot(fileInfo.path, params);
        break;

      case "create":
        result = await excelCreate(params);
        break;

      case "convert_pdf":
        result = await excelConvertToPdf(fileInfo.path);
        break;

      case "convert_csv":
        result = await excelConvertToCsv(fileInfo.path);
        break;

      default:
        result = await excelRead(fileInfo.path, params);
    }

    return res.status(200).json({
      reply: result?.reply || "تمت معالجة الملف بنجاح.",
      data: result?.data || null,
      fileBase64: result?.fileBase64 || null,
      fileName: result?.fileName || null,
      metadata: result?.metadata || null
    });

  } catch (error) {
    console.error("❌ خطأ حرج في api/upload.js:", error);
    return res.status(500).json({
      error: `⚠️ حدث خطأ غير متوقع أثناء معالجة الملف: ${error.message}`
    });
  }
      }
