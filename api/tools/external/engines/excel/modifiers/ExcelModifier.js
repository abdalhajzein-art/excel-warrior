/**
 * excel/modifiers/ExcelModifier.js – Sovereign Excel Modifier
 * تعديل سيادي متقدم مع نسخ احتياطي وتراجع، متوافق مع ExcelAdapter/ExcelJSAdapter.
 */

import fs from "fs";
import path from "path";
import { FileUtils } from "../utils/FileUtils.js";

export class ExcelModifier {
  constructor(adapter) {
    this.adapter = adapter;
    this.backupPath = null;
  }

  // ✏️ تعديل مع نسخة احتياطية
  async modifyWithBackup(filePath, operations, params = {}) {
    const resolvedPath = this.resolveFilePath(filePath);

    this.backupPath = await this.createBackup(resolvedPath);

    const sortedOperations = this.orderOperations(operations || []);

    const result = await this.adapter.modify(resolvedPath, {
      operations: sortedOperations,
      ...params
    });

    return {
      ...result,
      backupPath: this.backupPath
    };
  }

  // 🔍 حل مسار الملف
  resolveFilePath(filePath) {
    if (!filePath) {
      throw new Error("مسار الملف غير مدخل أو فارغ.");
    }

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

  // 💾 إنشاء نسخة احتياطية
  async createBackup(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`تعذر إنشاء نسخة احتياطية، الملف غير موجود: ${filePath}`);
    }
    const backupPath = FileUtils.getTempPath("backup");
    const data = await FileUtils.readFile(filePath);
    await FileUtils.writeFile(backupPath, data);
    return backupPath;
  }

  // ↩️ تراجع عن آخر تعديل
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

  // 🎯 ترتيب العمليات حسب الأولوية
  orderOperations(operations) {
    const priority = {
      add_column: 1,
      add_row: 1,
      add_validation: 2,
      add_formula: 2,
      update_cell: 3,
      format_range: 4,
      color_cells: 4,
      highlight: 4,
      add_filter: 5
    };

    return [...operations].sort(
      (a, b) => (priority[a.type] || 99) - (priority[b.type] || 99)
    );
  }
}

export default ExcelModifier;
