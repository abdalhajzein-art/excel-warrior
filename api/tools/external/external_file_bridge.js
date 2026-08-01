/**
 * external_file_bridge.js – Sovereign Heavy Engine Bridge (Copilot‑Style Preview Edition)
 * الجسر السيادي الموحد لمعالجة الملفات عبر المحركات المحلية + عرض ذكي للمحتوى
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
       🟥 اختيار المحرك المناسب حسب الامتداد + دعم preview
       ============================================================ */

    // 📄 PDF
    if (ext === ".pdf") {
      if (action === "preview") {
        // عرض ذكي: أول صفحة / أول جزء نصّي
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
    }

    // 📝 DOCX / Word
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
    }

    // 📊 Excel
    else if (ext === ".xlsx" || ext === ".xls") {
      if (action === "preview") {
        const full = await excelRead(filePath);
        const rows = full.data?.rows || full.data || [];
        const previewRows = Array.isArray(rows) ? rows.slice(0, 10) : rows;
        result = {
          reply: "📊 لمحة عن محتوى ملف Excel (أول 10 صفوف):",
          data: { preview: previewRows }
        };
      } else if (action === "read") {
        result = await excelRead(filePath);
      } else if (action === "modify") {
        const fn = (row) => row;
        result = await excelModify(filePath, fn);
      } else if (action === "create") {
        result = await excelCreate(req.body.text || "");
      }
    }

    // 🖼 صور
    else if ([".png", ".jpg", ".jpeg", ".webp", ".tiff", ".avif"].includes(ext)) {
      if (action === "preview") {
        // ممكن لاحقًا نضيف OCR، حالياً نرجّع وصف بسيط
        result = {
          reply: "🖼 هذا ملف صورة – حالياً العرض عبارة عن معاينة بسيطة بدون OCR.",
          data: { preview: "صورة مرفوعة، يمكن لاحقًا إضافة OCR أو تحليل محتوى." }
        };
      } else if (action === "convert") {
        const target = req.body.target || "png";
        result = await imageConvert(filePath, target);
      } else {
        result = { reply: "📷 هذا ملف صورة – ما في استخراج نص منه حالياً.", data: null };
      }
    }

    // 🎞 PPT (مبدئيًا إنشاء فقط)
    else if (ext === ".pptx") {
      if (action === "create") {
        result = await pptCreate(req.body.text || "");
      } else if (action === "preview") {
        result = {
          reply: "🎞 ملف عروض تقديمية – يمكن لاحقًا إضافة معاينة للشرائح.",
          data: { preview: "Preview للـ PPT غير مفعّل بعد." }
        };
      } else {
        result = {
          reply: "🎞 ملف عروض تقديمية – المعالجة الحالية محدودة بالإنشاء فقط.",
          data: null
        };
      }
    }

    // 🟪 fallback عام
    else {
      if (action === "preview") {
        const full = await pdfRead(filePath);
        const text = (full.data?.text || full.data || "").toString();
        const previewText = text.split("\n").slice(0, 40).join("\n");
        result = {
          reply: "📄 لمحة عامة عن الملف (تمت معالجته كـ PDF):",
          data: { preview: previewText }
        };
      } else {
        result = await pdfRead(filePath);
      }
    }

    /* ============================================================
       🟦 إذا المحرك رجّع ملف (مثلاً تحويل أو إنشاء)
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
