/**
 * excel/modifiers/ExcelModifier.js – Sovereign Excel Modifier (Advanced Edition)
 * متوافق 100٪ مع ExcelJSAdapter السيادي و Kernel السيادي
 */

import fs from "fs";
import path from "path";
import { FileUtils } from "../utils/FileUtils.js";

export class ExcelModifier {
  constructor(adapter) {
    this.adapter = adapter;
    this.backupPath = null;
  }

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

  async createBackup(filePath) {
    const backupPath = FileUtils.getTempPath("backup");
    const data = await FileUtils.readFile(filePath);
    await FileUtils.writeFile(backupPath, data);
    return backupPath;
  }

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
