/**
 * external_file_bridge.js – Sovereign Heavy Engine Bridge (Audited & Secured Edition)
 * الجسر السيادي الموحد لمعالجة الملفات والربط المباشر مع محركات Python/Pandas ومحطات التدقيق المحلية
 */

import fs from "fs";
import path from "path";
import os from "os";

// مرصد التدقيق السيادي
import { auditExecution } from "../../core/execution_monitor.js";

// المحركات السيادية
import excelEngine from "./engines/excel.js";
import { pdfRead, pdfConvert, pdfCreate } from "../pdf.js";
import { wordCreate } from "../word.js";
import { pptCreate } from "../ppt.js";
import { imageConvert } from "../image.js";
import libreConvert from "./engines/libre.js";

export default async function externalBridge(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "⚠️ لم يتم رفع أي ملف." });
    }

    const action = req.body.action || "read";

    // 🛡️ حفظ الملف مؤقتًا
    const tmpDir = os.tmpdir();
    const fileName = `${Date.now()}_${req.file.originalname}`;
    const filePath = path.join(tmpDir, fileName);

    if (req.file.buffer) {
      fs.writeFileSync(filePath, req.file.buffer);
    } else if (req.file.path) {
      fs.copyFileSync(req.file.path, filePath);
    } else {
      throw new Error("لم يتم العثور على بيانات الملف (لا buffer ولا path).");
    }

    const ext = path.extname(fileName).toLowerCase();
    let result = null;

    /* ============================================================
       🟥 اختيار المحرك المناسب حسب الامتداد وتفعيل التدقيق المحلي
       ============================================================ */

    // 📄 PDF
    if (ext === ".pdf") {
      if (action === "preview") {
        const full = await pdfRead(filePath);
        const text = (full.data?.text || full.data || "").toString();
        const previewText = text.split("\n").slice(0, 40).join("\n");
        result = {
          reply: "📄 لمحة عن محتوى ملف PDF:",
          data: { preview: previewText }
        };
      } else if (action === "read") {
        result = await pdfRead(filePath);
      } else if (action === "convert") {
        result = await pdfConvert(filePath, req.body.target || "pdf");
      } else if (action === "create") {
        result = await pdfCreate(req.body.text || "");
      }
      auditExecution({ action: `pdf_${action}`, target: req.file.originalname, isLocal: true });
    }

    // 📝 DOCX
    else if (ext === ".docx") {
      if (action === "preview") {
        const txt = await libreConvert(filePath, "txt");
        const text = (txt.data?.text || txt.data || txt || "").toString();
        const previewText = text.split("\n").slice(0, 30).join("\n");
        result = {
          reply: "📝 لمحة عن محتوى ملف Word:",
          data: { preview: previewText }
        };
      } else if (action === "read") {
        result = await libreConvert(filePath, "txt");
      } else if (action === "convert") {
        result = await libreConvert(filePath, req.body.target || "pdf");
      } else if (action === "create") {
        result = await wordCreate(req.body.text || "");
      }
      auditExecution({ action: `docx_${action}`, target: req.file.originalname, isLocal: true });
    }

    // 📊 Excel (محرك Pandas & Openpyxl السيادي المطلق)
    else if (ext === ".xlsx" || ext === ".xls") {
      result = await excelEngine(filePath, action, req.body);
      
      // تسجيل التدقيق السيادي للمعالجة المحلية للإكسل (0 توكنز مضمونة)
      auditExecution({
        action: `excel_${action}`,
        target: req.file.originalname,
        isLocal: true
      });
    }

    // 🖼 صور
    else if ([".png", ".jpg", ".jpeg", ".webp", ".tiff", ".avif"].includes(ext)) {
      if (action === "preview") {
        result = {
          reply: "🖼 هذا ملف صورة – معاينة أولية.",
          data: { preview: "صورة مرفوعة بنجاح." }
        };
      } else if (action === "convert") {
        const target = req.body.target || "png";
        result = await imageConvert(filePath, target);
      } else {
        result = { reply: "📷 صورة مرفوعة.", data: null };
      }
      auditExecution({ action: `image_${action}`, target: req.file.originalname, isLocal: true });
    }

    // 🎞 PPT
    else if (ext === ".pptx") {
      if (action === "create") {
        result = await pptCreate(req.body.text || "");
      } else {
        result = {
          reply: "🎞 ملف عروض تقديمية.",
          data: { preview: "Preview غير مفعّل بعد للـ PPT." }
        };
      }
      auditExecution({ action: `ppt_${action}`, target: req.file.originalname, isLocal: true });
    }

    // 🟪 fallback عام
    else {
      if (action === "preview") {
        const full = await pdfRead(filePath);
        const text = (full.data?.text || full.data || "").toString();
        const previewText = text.split("\n").slice(0, 40).join("\n");
        result = {
          reply: "📄 لمحة عامة عن الملف:",
          data: { preview: previewText }
        };
      } else {
        result = await pdfRead(filePath);
      }
      auditExecution({ action: `fallback_${action}`, target: req.file.originalname, isLocal: true });
    }

    /* ============================================================
       🟦 إرجاع الملفات الناتجة (إن وجدت)
       ============================================================ */
    if (result?.fileBase64) {
      return res.status(200).json({
        reply: result.reply || "تمت معالجة الملف بنجاح.",
        fileBase64: result.fileBase64,
        fileName: result.fileName || "output"
      });
    }

    /* ============================================================
       🟩 إرجاع البيانات النصية أو الهيكلية الآمنة
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

