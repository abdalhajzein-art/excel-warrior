/**
 * excel/modifiers/ExcelModifier.js – Sovereign Excel Modifier (Sovereign Edition)
 * معدِّل سيادي واعي للسياق، متوافق 100٪ مع ExcelAdapter السيادي و ExcelJSAdapter.
 */

import fs from "fs";
import path from "path";
import { FileUtils } from "../utils/FileUtils.js";
import { ExcelTableDetector } from "../core/ExcelTableDetector.js";

export class ExcelModifier {
  constructor(adapter) {
    this.adapter = adapter;      // يفضّل يكون ExcelAdapter السيادي
    this.backupPath = null;
  }

  /* ============================================================
     ✏️ تعديل مع نسخة احتياطية + وعي سياقي
     ============================================================ */
  async modifyWithBackup(filePath, operations, params = {}) {
    const resolvedPath = this.resolveFilePath(filePath);

    // 🔐 إنشاء نسخة احتياطية سيادية
    this.backupPath = await this.createBackup(resolvedPath);

    // 📖 قراءة سياقية قبل التعديل (من خلال الـ adapter السيادي)
    const core = await this.adapter.read(resolvedPath, params);
    const mainSheet = core.data?.[0] || { data: [] };

    // 🧩 كشف الجدول الرئيسي (هيدر + بيانات + نطاق)
    const tableInfo = ExcelTableDetector.detectMainTable(mainSheet) || {};
    const headers = (mainSheet.data?.[0] || []).map(v => String(v || "").trim());

    const context = {
      core,
      sheet: mainSheet,
      table: tableInfo,
      headers
    };

    // 🧠 إثراء العمليات لتكون واعية للسياق
    const enrichedOperations = this.enrichOperations(operations || [], context);

    // 🧱 ترتيب العمليات حسب الأولوية السيادية
    const sortedOperations = this.orderOperations(enrichedOperations);

    // 🚀 تنفيذ التعديل عبر محرك الكتابة (ExcelJSAdapter عبر ExcelAdapter)
    const result = await this.adapter.modify(resolvedPath, {
      operations: sortedOperations,
      ...params
    });

    return {
      ...result,
      backupPath: this.backupPath,
      operationsApplied: sortedOperations.length,
      contextUsed: {
        table: tableInfo,
        headers
      }
    };
  }

  /* ============================================================
     📁 حل مسار الملف سيادياً
     ============================================================ */
  resolveFilePath(filePath) {
    if (!filePath) throw new Error("مسار الملف غير مدخل أو فارغ.");

    if (fs.existsSync(filePath)) return filePath;

    const fileName = path.basename(filePath);
    const searchDirs = [
      path.resolve(process.cwd(), "persistent_uploads"),
      path.resolve(process.cwd(), "uploads"),
      process.cwd()
    ];

    for (const dir of searchDirs) {
      const candidate = path.resolve(dir, fileName);
      if (fs.existsSync(candidate)) {
        console.log(`📁 [ExcelModifier] تم العثور على الملف في: ${candidate}`);
        return candidate;
      }
    }

    throw new Error(`الملف غير موجود على القرص: ${filePath}`);
  }

  /* ============================================================
     🔐 نسخة احتياطية سيادية
     ============================================================ */
  async createBackup(filePath) {
    const backupPath = FileUtils.getTempPath("backup");
    const data = await FileUtils.readFile(filePath);
    await FileUtils.writeFile(backupPath, data);
    return backupPath;
  }

  /* ============================================================
     ↩️ تراجع باستخدام النسخة الاحتياطية
     ============================================================ */
  async undo(targetFilePath) {
    if (!this.backupPath || !fs.existsSync(this.backupPath)) {
      throw new Error("لا توجد نسخة احتياطية متاحة للتراجع.");
    }

    const target = targetFilePath
      ? this.resolveFilePath(targetFilePath)
      : this.backupPath;

    const backupData = await FileUtils.readFile(this.backupPath);
    await FileUtils.writeFile(target, backupData);

    return {
      success: true,
      message: "تم التراجع عن التعديل واستعادة النسخة السابقة بنجاح."
    };
  }

  /* ============================================================
     🧠 إثراء العمليات بالسياق (هيدر + جدول + نطاق)
     ============================================================ */
  enrichOperations(operations, context) {
    const { table, headers } = context;
    const enriched = [];

    for (const op of operations) {
      const copy = { ...op };

      // 📐 إذا في format_table بدون نطاق → استخدم نطاق الجدول السيادي
      if (copy.type === "format_table" && !copy.range && table?.range) {
        copy.range = table.range;
      }

      // 🧩 إذا في add_row بدون موقع → أضف بعد آخر صف بيانات
      if (copy.type === "add_row" && !copy.rowIndex && table?.dataEndRow) {
        copy.rowIndex = table.dataEndRow + 1;
      }

      // 🧩 إذا في add_column مع afterHeader → حوّلها إلى after (اسم الهيدر)
      if (copy.type === "add_column" && copy.afterHeader && headers?.length) {
        const idx = headers.indexOf(String(copy.afterHeader).trim());
        if (idx !== -1) {
          copy.after = headers[idx];
        }
      }

      enriched.push(copy);
    }

    return enriched;
  }

  /* ============================================================
     🧱 ترتيب العمليات حسب الأولوية السيادية
     ============================================================ */
  orderOperations(operations) {
    const priority = {
      add_column: 1,
      delete_column: 1,

      add_row: 2,

      add_validation: 3,
      add_style: 3,

      add_formula: 4,

      update_cell: 5,

      format_table: 6,

      pivot: 7
    };

    return [...operations].sort(
      (a, b) => (priority[a.type] || 99) - (priority[b.type] || 99)
    );
  }
}

export default ExcelModifier;
