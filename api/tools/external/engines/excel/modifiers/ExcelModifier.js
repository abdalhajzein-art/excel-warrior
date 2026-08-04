/**
 * api/tools/external/engines/excel/modifiers/ExcelModifier.js
 * Sovereign Excel Modifier (Enterprise Edition - Alatheer AI Suite)
 * معدِّل سيادي خالي من الحالة (Stateless)، يدعم التزامن (Concurrency)، والتراجع التلقائي (Auto-Rollback).
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { FileUtils } from "../utils/FileUtils.js";
import { ExcelTableDetector } from "../core/ExcelTableDetector.js";

export class ExcelModifier {
  constructor(adapter) {
    this.adapter = adapter; // المحرك السيادي المحقون (ExcelJSAdapter أو غيره)
  }

  /* ============================================================
     ✏️ تعديل متزامن مع نظام المعاملات والتراجع التلقائي
     ============================================================ */
  async modifyWithBackup(filePath, operations, params = {}) {
    const resolvedPath = this.resolveFilePath(filePath);
    const transactionId = crypto.randomUUID(); // توليد هوية فريدة لهذه العملية

    // 🔐 إنشاء نسخة احتياطية سيادية مرتبطة بالمعاملة الحالية
    const backupPath = await this.createBackup(resolvedPath, transactionId);

    try {
      // 📖 قراءة سياقية قبل التعديل
      const core = await this.adapter.read(resolvedPath, params);
      const mainSheet = core.data?.[0] || { data: [] };

      // 🧩 استخراج الميتاداتا والسياق
      const tableInfo = ExcelTableDetector.detectMainTable(mainSheet) || {};
      const headers = (mainSheet.data?.[0] || []).map(v => String(v || "").trim());

      const context = {
        core,
        sheet: mainSheet,
        table: tableInfo,
        headers,
        transactionId
      };

      // 🧠 إثراء العمليات وتأمين المراسي الديناميكية
      const enrichedOperations = this.enrichOperations(operations || [], context);

      // 🧱 ترتيب صارم للعمليات لتجنب انهيار المعادلات
      const sortedOperations = this.orderOperations(enrichedOperations);

      // 🚀 تنفيذ التعديل عبر محرك الكتابة
      const result = await this.adapter.modify(resolvedPath, {
        operations: sortedOperations,
        transactionId,
        ...params
      });

      return {
        ...result,
        transactionId,
        backupPath, // نعيد المسار للمنسق (Orchestrator) ليديره في الجلسة
        operationsApplied: sortedOperations.length,
        contextUsed: {
          table: tableInfo,
          headers
        }
      };
    } catch (error) {
      // 🛡️ التراجع التلقائي (Auto-Rollback) في حال فشل أي عملية برمجية
      console.error(`❌ [ExcelModifier] فشل في المعاملة ${transactionId}. جاري استعادة الملف الأصلي...`);
      await this.undo(backupPath, resolvedPath);
      throw new Error(`تعذر تطبيق التعديلات وتم التراجع بأمان للحفاظ على الملف. السبب: ${error.message}`);
    }
  }

  /* ============================================================
     📁 حل مسار الملف سيادياً (يدعم بيئات Railway)
     ============================================================ */
  resolveFilePath(filePath) {
    if (!filePath) throw new Error("مسار الملف غير مدخل أو فارغ.");
    if (fs.existsSync(filePath)) return filePath;

    const fileName = path.basename(filePath);
    const searchDirs = [
      path.resolve(process.cwd(), "persistent_uploads"), // Railway Volume
      path.resolve(process.cwd(), "uploads"),
      process.cwd()
    ];

    for (const dir of searchDirs) {
      const candidate = path.resolve(dir, fileName);
      if (fs.existsSync(candidate)) {
        console.log(`📁 [ExcelModifier] تم تأمين الملف في: ${candidate}`);
        return candidate;
      }
    }

    throw new Error(`الملف غير موجود على القرص أو التخزين المستدام: ${filePath}`);
  }

  /* ============================================================
     🔐 إنشاء نسخة احتياطية آمنة (Concurrency Safe)
     ============================================================ */
  async createBackup(filePath, transactionId) {
    // نستخدم Transaction ID لضمان عدم تداخل التعديلات المتزامنة
    const backupFileName = `backup_${transactionId}_${path.basename(filePath)}`;
    const backupPath = path.resolve(FileUtils.getTempDir(), backupFileName);
    
    const data = await FileUtils.readFile(filePath);
    await FileUtils.writeFile(backupPath, data);
    
    return backupPath;
  }

  /* ============================================================
     ↩️ تراجع واستعادة (Rollback)
     ============================================================ */
  async undo(backupPath, targetFilePath) {
    if (!backupPath || !fs.existsSync(backupPath)) {
      throw new Error("لا توجد نسخة احتياطية متاحة لإجراء التراجع.");
    }

    if (!targetFilePath) throw new Error("يجب تحديد مسار الملف الهدف للاستعادة.");

    const target = this.resolveFilePath(targetFilePath);
    const backupData = await FileUtils.readFile(backupPath);
    
    // استعادة الملف
    await FileUtils.writeFile(target, backupData);

    return {
      success: true,
      message: "تم استعادة النسخة السابقة بنجاح وحماية البيانات."
    };
  }

  /* ============================================================
     🧠 إثراء العمليات (Dynamic Anchors & Context)
     ============================================================ */
  enrichOperations(operations, context) {
    const { table, headers } = context;
    const enriched = [];

    for (const op of operations) {
      const copy = { ...op };

      // 1. تحديد النطاق الديناميكي للجداول
      if (copy.type === "format_table" && !copy.range && table?.range) {
        copy.range = table.range;
      }

      // 2. ضمان الإضافة بعد آخر صف بيانات حقيقي
      if (copy.type === "add_row" && !copy.rowIndex && table?.dataEndRow) {
        copy.rowIndex = table.dataEndRow + 1;
      }

      // 3. تأمين المراسي الديناميكية لتجنب إزاحة الأعمدة (Index Shifting)
      if (copy.type === "add_column" && copy.afterHeader && headers?.length) {
        const targetHeader = String(copy.afterHeader).trim().toLowerCase();
        const headerExists = headers.some(h => h.toLowerCase() === targetHeader);
        
        if (headerExists) {
          // نحتفظ بالاسم كمرجع ديناميكي للمحرك السفلي لتحديد الموقع وقت التنفيذ
          copy.after = copy.afterHeader; 
        }
      }

      enriched.push(copy);
    }

    return enriched;
  }

  /* ============================================================
     🧱 ترتيب العمليات (Domino Effect Prevention)
     ============================================================ */
  orderOperations(operations) {
    const priority = {
      // 1. تغيير الهيكل (الأولوية القصوى لتثبيت الإحداثيات الجديدة)
      add_column: 1,
      delete_column: 1,
      add_row: 2,
      delete_row: 2,

      // 2. تعبئة البيانات وتعديلها
      update_cell: 3,
      add_formula: 4, // المعادلات تأتي بعد الهيكل لضمان صحة المراجع

      // 3. التنسيق والقيود (تعمل على الهيكل النهائي)
      add_validation: 5,
      add_style: 5,
      format_table: 6,
      
      // 4. التحليلات
      pivot: 7
    };

    return [...operations].sort(
      (a, b) => (priority[a.type] || 99) - (priority[b.type] || 99)
    );
  }
}

export default ExcelModifier;
