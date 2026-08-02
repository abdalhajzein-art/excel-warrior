/**
 * external_file_bridge.js – Sovereign Heavy Engine Bridge (Ultimate Edition)
 * ✅ الجسر السيادي الموحد لمعالجة الملفات باستخدام المحرك الشامل Excel Ultimate Engine
 * ✅ يدعم: ExcelJS + XLSX معاً، مع تكامل كامل للميتاداتا والتحليل
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

// ⚡ المحرك الشامل الجديد (ExcelJS + XLSX)
import excelEngine, { 
    excelRead, 
    excelModify, 
    excelCreate, 
    excelFormat,
    excelAnalyze,
    excelSearch,
    excelConditionalFormat,
    excelPivot,
    excelConvertToPdf,
    excelConvertToCsv
} from "./engines/excel.js";

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

/**
 * 🧠 تحليل طلب المستخدم وتحديد العمليات المناسبة
 */
function parseUserOperations(body) {
    const operations = [];
    const instruction = body.instruction || body.message || '';
    
    // ✅ إضافة عمود
    if (instruction.includes('إضافة عمود') || instruction.includes('add column')) {
        const colName = instruction.match(/['"](.*?)['"]/)?.[1] || 'عمود جديد';
        operations.push({ type: 'add_column', header: colName });
    }
    
    // ✅ تلوين خلايا
    if (instruction.includes('لون') || instruction.includes('تلوين') || instruction.includes('color')) {
        const color = instruction.match(/#[0-9A-Fa-f]{6}/)?.[0] || 'FFFFFF00';
        const range = instruction.match(/[A-Z]+\d+:[A-Z]+\d+/)?.[0] || 'A1:Z100';
        operations.push({ type: 'color_cells', range, color });
    }
    
    // ✅ إضافة فلتر
    if (instruction.includes('فلتر') || instruction.includes('filter')) {
        operations.push({ type: 'add_filter', from: 'A1', to: 'Z100' });
    }
    
    // ✅ إضافة قائمة منسدلة
    if (instruction.includes('قائمة') || instruction.includes('dropdown') || instruction.includes('منسدلة')) {
        const options = instruction.match(/\[(.*?)\]/)?.[1]?.split(',') || ['خيار1', 'خيار2', 'خيار3'];
        operations.push({ 
            type: 'add_validation', 
            address: 'B2',
            formulae: [`"${options.join(',')}"`]
        });
    }
    
    // ✅ إضافة صيغة
    if (instruction.includes('صيغة') || instruction.includes('formula')) {
        const formulaMatch = instruction.match(/=(.*?)(?:\s|$)/);
        if (formulaMatch) {
            operations.push({ 
                type: 'add_formula', 
                address: 'E2',
                formula: formulaMatch[1]
            });
        }
    }
    
    return operations;
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
    const operations = req.body.operations || null;
    const instruction = req.body.instruction || req.body.message || '';

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

    /* ============================================================
       📊 Excel – المحرك الشامل الجديد (ExcelJS + XLSX)
       ============================================================ */
    else if (ext === ".xlsx" || ext === ".xls" || ext === ".xlsm" || ext === ".csv") {
        try {
            // ✅ تجهيز المعاملات
            const params = { 
                ...req.body, 
                metadata,
                // ✅ تحليل العمليات من الطلب أو من التعليمات
                operations: operations || parseUserOperations(req.body),
                // ✅ تحليل متقدم إذا طُلب
                analyze: action === 'analyze' || req.body.analyze || false,
                // ✅ بحث إذا طُلب
                query: req.body.query || null,
                // ✅ تنسيق شرطي متقدم
                complex: req.body.complex || false,
                instructions: req.body.instructions || instruction
            };

            // ✅ تنفيذ العملية المطلوبة
            switch (action) {
                case 'read':
                case 'preview':
                case 'excel_preview':
                    result = await excelEngine.execute(filePath, 'read', params);
                    break;
                    
                case 'modify':
                case 'excel_modify':
                    result = await excelEngine.execute(filePath, 'modify', params);
                    break;
                    
                case 'create':
                    result = await excelEngine.execute(null, 'create', params);
                    break;
                    
                case 'format':
                case 'excel_format':
                    result = await excelEngine.execute(filePath, 'format', params);
                    break;
                    
                case 'analyze':
                case 'excel_analyze':
                    result = await excelEngine.execute(filePath, 'analyze', params);
                    break;
                    
                case 'search':
                    result = await excelEngine.execute(filePath, 'search', params);
                    break;
                    
                case 'conditional_format':
                    result = await excelEngine.execute(filePath, 'conditional_format', params);
                    break;
                    
                case 'pivot':
                    result = await excelEngine.execute(filePath, 'pivot', params);
                    break;
                    
                case 'convert_pdf':
                case 'to_pdf':
                    result = await excelEngine.execute(filePath, 'convert_pdf');
                    break;
                    
                case 'convert_csv':
                    result = await excelEngine.execute(filePath, 'convert_csv');
                    break;
                    
                default:
                    result = await excelEngine.execute(filePath, 'read', params);
            }

            // ✅ تسجيل التدقيق
            auditExecution({ 
                action: `excel_${action}`, 
                target: file.originalname, 
                isLocal: true,
                engine: result?.data?.metadata?.engines || ['exceljs']
            });

        } catch (err) {
            console.error("❌ [Bridge] خطأ في محرك Excel:", err);
            result = {
                ok: false,
                error: err.message || "فشل معالجة ملف Excel"
            };
        }
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
        fileName: result.fileName || "output_alatheer",
        metadata: result.data?.metadata || null
      });
    }

    /* ============================================================
       🟩 إرجاع البيانات النصية والتحليل
       ============================================================ */
    return res.status(200).json({
      reply: result?.reply || "تمت قراءة الملف بنجاح.",
      data: result?.data || null,
      metadata: result?.data?.metadata || null,
      analysis: result?.data?.analysis || null,
      statistics: result?.data?.statistics || null
    });

  } catch (err) {
    console.error("❌ خطأ حرج في external_file_bridge:", err);
    return res.status(500).json({
      error: `⚠️ خطأ أثناء معالجة الملف: ${err.message}`
    });
  }
          }
