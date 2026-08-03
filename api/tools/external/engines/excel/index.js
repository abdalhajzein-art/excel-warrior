/**
 * excel/index.js – Sovereign Excel Ultimate Engine (النسخة المبسطة)
 * 🔥 الوحدات المدمجة:
 * - ExcelReader: قراءة متقدمة
 * - ExcelModifier: تعديل متقدم
 * - ExcelAnalyzer: تحليل ذكي
 * - ExcelFormatter: تنسيق تلقائي
 * - ExcelPivot: جداول محورية
 */

import { ExcelAdapter } from './core/ExcelAdapter.js';
import { ExcelReader } from './readers/ExcelReader.js';
import { ExcelModifier } from './modifiers/ExcelModifier.js';
import { ExcelAnalyzer } from './analyzers/ExcelAnalyzer.js';
import { ExcelFormatter } from './formatters/ExcelFormatter.js';
import { ExcelPivot } from './pivots/ExcelPivot.js';
import { ErrorHandler } from './utils/ErrorHandler.js';
import { FileUtils } from './utils/FileUtils.js';
import { ENGINE_TYPES } from './types/ExcelTypes.js';

/* ============================================================
   🧠 المحرك السيادي النهائي
   ============================================================ */

class ExcelUltimateEngine {
    constructor(engineType = ENGINE_TYPES.EXCELJS) {
        // ✅ المحول الأساسي
        this.adapter = new ExcelAdapter(engineType);
        
        // ✅ جميع الوحدات (بدون Searcher)
        this.reader = new ExcelReader(this.adapter);
        this.modifier = new ExcelModifier(this.adapter);
        this.analyzer = new ExcelAnalyzer(this.adapter);
        this.formatter = new ExcelFormatter(this.adapter);
        this.pivot = new ExcelPivot(this.adapter);
        
        this.engineType = engineType;
        this.initialized = false;
    }

    /* ============================================================
       ⚡ التهيئة
       ============================================================ */

    async initialize() {
        if (!this.initialized) {
            await this.adapter.initialize();
            this.initialized = true;
        }
        return this;
    }

    /* ============================================================
       📖 1. عمليات القراءة (ExcelReader)
       ============================================================ */

    async read(filePath, params = {}) {
        await this.initialize();
        return this.reader.readFull(filePath, params);
    }

    async readFast(filePath, params = {}) {
        await this.initialize();
        return this.reader.readFast(filePath, params);
    }

    async readMetadata(filePath) {
        await this.initialize();
        return this.reader.readMetadata(filePath);
    }

    async readRange(filePath, range, params = {}) {
        await this.initialize();
        return this.reader.readRange(filePath, range, params);
    }

    async readSheets(filePath, sheetNames, params = {}) {
        await this.initialize();
        return this.reader.readSheets(filePath, sheetNames, params);
    }

    /* ============================================================
       ✏️ 2. عمليات التعديل (ExcelModifier)
       ============================================================ */

    async modify(filePath, params = {}) {
        await this.initialize();
        return this.modifier.modifyWithBackup(filePath, params.operations || [], params);
    }

    async undo() {
        return this.modifier.undo();
    }

    /* ============================================================
       📊 3. عمليات التحليل (ExcelAnalyzer)
       ============================================================ */

    async analyze(filePath, params = {}) {
        await this.initialize();
        return this.analyzer.analyze(filePath, params);
    }

    /* ============================================================
       🎨 4. عمليات التنسيق التلقائي (ExcelFormatter)
       ============================================================ */

    async autoFormat(filePath, params = {}) {
        await this.initialize();
        return this.formatter.autoFormat(filePath, params);
    }

    async applyTemplate(filePath, templateName, params = {}) {
        await this.initialize();
        return this.formatter.applyTemplate(filePath, templateName, params);
    }

    /* ============================================================
       📋 5. عمليات الجداول المحورية (ExcelPivot)
       ============================================================ */

    async pivot(filePath, params = {}) {
        await this.initialize();
        return this.pivot.createPivot(filePath, params);
    }

    /* ============================================================
       🆕 6. عمليات الإنشاء (عبر Adapter)
       ============================================================ */

    async create(params = {}) {
        await this.initialize();
        return this.adapter.create(params);
    }

    /* ============================================================
       🔄 7. عمليات التحويل (عبر Adapter)
       ============================================================ */

    async convertToPdf(filePath) {
        await this.initialize();
        return this.adapter.convertToPdf(filePath);
    }

    async convertToCsv(filePath) {
        await this.initialize();
        return this.adapter.convertToCsv(filePath);
    }

    /* ============================================================
       ⚙️ 8. إدارة المحرك
       ============================================================ */

    async setEngine(engineType) {
        this.engineType = engineType;
        this.adapter = new ExcelAdapter(engineType);
        await this.adapter.initialize();
        
        this.reader = new ExcelReader(this.adapter);
        this.modifier = new ExcelModifier(this.adapter);
        this.analyzer = new ExcelAnalyzer(this.adapter);
        this.formatter = new ExcelFormatter(this.adapter);
        this.pivot = new ExcelPivot(this.adapter);
        
        this.initialized = true;
        return this;
    }

    getCurrentEngine() {
        return this.engineType;
    }

    /* ============================================================
       🧹 9. الصيانة والتنظيف
       ============================================================ */

    async cleanup() {
        await FileUtils.cleanupOldTempFiles();
    }

    async getStatus() {
        return {
            initialized: this.initialized,
            engine: this.engineType,
            modules: {
                reader: true,
                modifier: true,
                analyzer: true,
                formatter: true,
                pivot: true
            }
        };
    }
}

/* ============================================================
   🚀 إنشاء وتصدير المحرك النهائي
   ============================================================ */

const ultimateEngine = new ExcelUltimateEngine();

// ✅ التصدير الافتراضي
export default ultimateEngine;

// ✅ تصدير الكلاس
export { ExcelUltimateEngine };

/* ============================================================
   📤 تصدير جميع الوظائف الرئيسية
   ============================================================ */

// 📖 القراءة
export const excelRead = (filePath, params) => ultimateEngine.read(filePath, params);
export const excelReadFast = (filePath, params) => ultimateEngine.readFast(filePath, params);
export const excelReadMetadata = (filePath) => ultimateEngine.readMetadata(filePath);
export const excelReadRange = (filePath, range, params) => ultimateEngine.readRange(filePath, range, params);
export const excelReadSheets = (filePath, sheetNames, params) => ultimateEngine.readSheets(filePath, sheetNames, params);

// ✏️ التعديل
export const excelModify = (filePath, params) => ultimateEngine.modify(filePath, params);
export const excelUndo = () => ultimateEngine.undo();

// 📊 التحليل
export const excelAnalyze = (filePath, params) => ultimateEngine.analyze(filePath, params);

// 🎨 التنسيق التلقائي
export const excelAutoFormat = (filePath, params) => ultimateEngine.autoFormat(filePath, params);
export const excelApplyTemplate = (filePath, templateName, params) => ultimateEngine.applyTemplate(filePath, templateName, params);

// ✅ ✅ ✅ أضف هذه التصديرات الإضافية لتوافق مع external_file_bridge.js
export const excelFormat = (filePath, params) => ultimateEngine.autoFormat(filePath, params);
export const excelConditionalFormat = (filePath, params) => ultimateEngine.conditionalFormat(filePath, params);
export const excelPivot = (filePath, params) => ultimateEngine.pivot(filePath, params);

// 📋 الجداول المحورية (تصدير إضافي)
// export const excelPivot = (filePath, params) => ultimateEngine.pivot(filePath, params);  // ملاحظة: هذا مكرر، احذف السطر الزائد

// 🆕 الإنشاء
export const excelCreate = (params) => ultimateEngine.create(params);

// 🔄 التحويل
export const excelConvertToPdf = (filePath) => ultimateEngine.convertToPdf(filePath);
export const excelConvertToCsv = (filePath) => ultimateEngine.convertToCsv(filePath);

// ⚙️ الإدارة
export const excelSetEngine = (engineType) => ultimateEngine.setEngine(engineType);
export const excelGetEngine = () => ultimateEngine.getCurrentEngine();
export const excelGetStatus = () => ultimateEngine.getStatus();

// 🧹 الصيانة
export const excelCleanup = () => ultimateEngine.cleanup();
