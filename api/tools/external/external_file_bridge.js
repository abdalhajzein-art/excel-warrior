/**
 * external_file_bridge.js – Sovereign Heavy Engine Bridge (Final Clean Edition)
 * الجسر السيادي الموحد لمعالجة الملفات والربط المباشر مع محركات الـ Engines بنظام آمن بالكامل
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

// مرصد التدقيق السيادي
import { auditExecution } from "../../core/execution_monitor.js";

// محركات النظام
import libreConvert from "./engines/libre.js";
import pdfEngine from "./engines/pdf.js";
import wordEngine from "./engines/docx.js";
import imageEngine from "./engines/image.js";

// ⚡ محرك Excel السيادي الجديد (Openpyxl Only)
import excelEngine from "./engines/excel.js";

// ⚠ CSV فقط عبر محرك pandas (اختياري)
import pandasEngine from "./engines/pandas.js";

/**
 * 🔍 دالة استخراج الـ Metadata لأي ملف برمجياً
 */
export function extractFileMetadata(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: "الملف غير موجود على السيرفر" };
    }

    const scriptPath = path.join(process.cwd(), "api/tools/external/engines/metadata_extractor.py");
    const stdout = execSync(`python3 "${scriptPath}" "${filePath}"`, { 
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    });

    return JSON.parse(stdout);
  } catch (err) {
    console.error("❌ [Metadata Extraction Error]:", err.message);
    return { error: "فشل استخراج بيانات الملف الهيكلية", details: err.message };
  }
}

export default async function externalBridge(req, res, fileInfo = null) {
  try {
    // ✅ استقبال الملف من `upload.js` مع الميتاداتا
    const file = fileInfo || req.file;
    if (!file) {
      return res.status(400).json({ error: "⚠️ لم يتم رفع أي ملف." });
    }

    const action = req.body.action || "read";
    const metadata = file.metadata || null;

    // 🛡️ حفظ الملف مؤقتاً (إذا لم يكن محفوظاً بالفعل)
    let filePath = file.path;
    if (!filePath || !fs.existsSync(filePath)) {
      const tmpDir = os.tmpdir();
      const fileName = `${Date.now()}_${file.originalname || "file"}`;
      filePath = path.join(tmpDir, fileName);

      if (file.buffer) {
        fs.writeFileSync(filePath, file.buffer);
      } else {
        throw new Error("لم يتم العثور على بيانات الملف.");
      }
    }

    // ✅ التحقق من وجود الملف وحجمه
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`📊 [Bridge] حجم الملف المستلم: ${stats.size} bytes`);
      if (stats.size < 10) {
        console.warn(`⚠️ [Bridge] الملف صغير جداً (${stats.size} bytes)، قد يكون تالفاً.`);
        return res.status(400).json({
          error: `⚠️ الملف تالف أو فارغ (الحجم: ${stats.size} bytes). يرجى إعادة رفع الملف.`
        });
      }
    } else {
      console.error(`❌ [Bridge] الملف غير موجود: ${filePath}`);
      return res.status(400).json({ error: "⚠️ الملف غير موجود على السيرفر." });
    }

    const ext = path.extname(file.originalname || filePath).toLowerCase();
    let result = null;

    /* ============================================================
       🌐 استخراج Metadata (إذا كان مطلوباً)
       ============================================================ */
    if (action === "extract_metadata") {
      result = {
        reply: "تم استخراج هيكلية البيانات بنجاح.",
        data: extractFileMetadata(filePath)
      };
      auditExecution({ action: `metadata_${ext}`, target: file.originalname, isLocal: true });
      return res.status(200).json(result);
    }

    /* ============================================================
       🟥 التوجيه الذكي للمحركات
       ============================================================ */

    // 📄 PDF
    if (ext === ".pdf") {
      if (action === "preview") {
        const full = await pdfEngine.pdfRead(filePath);
        const text = (full.data?.text || full.data || "").toString();
        const previewText = text.split("\n").slice(0, 40).join("\n");
        result = { reply: "📄 لمحة عن محتوى ملف PDF:", data: { preview: previewText } };
      } else if (action === "read") {
        result = await pdfEngine.pdfRead(filePath);
      } else if (action === "create") {
        result = await pdfEngine.pdfCreate(req.body.text || "");
      } else {
        result = await pdfEngine.pdfRead(filePath);
      }
      auditExecution({ action: `pdf_${action}`, target: file.originalname, isLocal: true });
    }

    // 📝 DOCX
    else if (ext === ".docx") {
      if (action === "preview" || action === "read") {
        const txt = await libreConvert(filePath, "txt");
        const text = (txt.data?.text || txt.data || txt || "").toString();
        const previewText = text.split("\n").slice(0, 30).join("\n");
        result = { reply: "📝 محتوى المستند:", data: { preview: previewText } };
      } else if (action === "create") {
        result = await wordEngine.wordCreate(req.body.text || "");
      } else {
        result = await libreConvert(filePath, "txt");
      }
      auditExecution({ action: `docx_${action}`, target: file.originalname, isLocal: true });
    }

    // 📊 Excel عبر محرك Openpyxl السيادي (مع دعم الميتاداتا)
    else if (ext === ".xlsx" || ext === ".xls") {
      const params = { ...req.body, metadata };
      result = await excelEngine(filePath, action, params);
      auditExecution({ action: `excel_${action}`, target: file.originalname, isLocal: true });
    }

    // 📄 CSV فقط عبر pandasEngine (اختياري)
    else if (ext === ".csv") {
      const params = { ...req.body, metadata };
      result = await pandasEngine(filePath, action, params);
      auditExecution({ action: `csv_${action}`, target: file.originalname, isLocal: true });
    }

    // 🖼 صور
    else if ([".png", ".jpg", ".jpeg", ".webp", ".tiff", ".avif"].includes(ext)) {
      if (action === "convert") {
        const target = req.body.target || "png";
        result = await imageEngine.imageConvert(filePath, target);
      } else {
        result = { reply: "📷 صورة مرفوعة بنجاح.", data: null };
      }
      auditExecution({ action: `image_${action}`, target: file.originalname, isLocal: true });
    }

    // 🟪 fallback
    else {
      result = await pdfEngine.pdfRead(filePath);
      auditExecution({ action: `fallback_${action}`, target: file.originalname, isLocal: true });
    }

    /* ============================================================
       ⚠️ فلترة الأخطاء
       ============================================================ */
    if (result && result.ok === false) {
      console.error("❌ فشل المحرك الداخلي:", result.error);
      return res.status(500).json({
        error: result.error || result.reply || "حدث خطأ أثناء معالجة الملف."
      });
    }

    /* ============================================================
       🟦 إرجاع الملفات الناتجة
       ============================================================ */
    if (result?.fileBase64) {
      return res.status(200).json({
        reply: result.reply || "تمت معالجة وتوليد الملف بنجاح.",
        fileBase64: result.fileBase64,
        fileName: result.fileName || "output_alatheer"
      });
    }

    /* ============================================================
       🟩 إرجاع البيانات النصية
       ============================================================ */
    return res.status(200).json({
      reply: result?.reply || "تمت قراءة الملف بنجاح.",
      data: result?.data || null
    });

  } catch (err) {
    console.error("❌ خطأ حرج في external_file_bridge:", err);
    return res.status(500).json({
      error: `⚠️ خطأ أثناء معالجة الملف: ${err.message}`
    });
  }
        }
