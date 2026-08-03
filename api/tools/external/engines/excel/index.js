/**
 * excel/index.js – Sovereign Excel Ultimate Engine (المدخل السيادي النهائي)
 * 🔥 يجمع كل الوحدات في واجهة واحدة موحدة وقابلة للتوسع
 * 
 * 📦 الوحدات المدمجة:
 * - ExcelReader: قراءة متقدمة (صيغ، تنسيق، ميتاداتا، نطاقات)
 * - ExcelModifier: تعديل متقدم (نسخ احتياطي، تراجع، عمليات ذكية)
 * - ExcelAnalyzer: تحليل ذكي (إحصائيات، أنماط، رؤى، تقارير)
 * - ExcelFormatter: تنسيق تلقائي (جداول، رؤوس، أرقام، تواريخ، قوالب)
 * - ExcelPivot: جداول محورية (تحليل، تجميع، تصدير)
 * - ExcelSearcher: بحث متقدم (نصوص، تعابير منتظمة، شروط، مكررات)
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
        
        // ✅ جميع الوحدات
        this.reader = new ExcelReader(this.adapter);
        this.modifier = new ExcelModifier(this.adapter);
        this.analyzer = new ExcelAnalyzer(this.adapter);
        this.formatter = new ExcelFormatter(this.adapter);
        this.pivot = new ExcelPivot(this.adapter);
        this.searcher = new ExcelSearcher(this.adapter);
        
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

    async modifyDirect(filePath, operations, params = {}) {
        await this.initialize();
        return this.modifier.modifyDirect(filePath, operations, params);
    }

    async undo() {
        return this.modifier.undo();
    }

    async getBackupInfo() {
        return this.modifier.getBackupInfo();
    }

    /* ============================================================
       📊 3. عمليات التحليل (ExcelAnalyzer)
       ============================================================ */

    async analyze(filePath, params = {}) {
        await this.initialize();
        return this.analyzer.analyze(filePath, params);
    }

    async analyzeStatistics(filePath, params = {}) {
        await this.initialize();
        return this.analyzer.calculateStatistics(await this.adapter.read(filePath, params));
    }

    async analyzePatterns(filePath, params = {}) {
        await this.initialize();
        return this.analyzer.detectPatterns(await this.adapter.read(filePath, params));
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

    async formatTable(filePath, params = {}) {
        await this.initialize();
        const data = await this.adapter.read(filePath, params);
        const operations = this.formatter.formatTable(data);
        return this.modifier.modifyWithBackup(filePath, operations, params);
    }

    async formatHeaders(filePath, params = {}) {
        await this.initialize();
        const data = await this.adapter.read(filePath, params);
        const operations = this.formatter.formatHeaders(data);
        return this.modifier.modifyWithBackup(filePath, operations, params);
    }

    /* ============================================================
       📋 5. عمليات الجداول المحورية (ExcelPivot)
       ============================================================ */

    async pivot(filePath, params = {}) {
        await this.initialize();
        return this.pivot.createPivot(filePath, params);
    }

    async pivotMultiple(filePath, params = {}) {
        await this.initialize();
        return this.pivot.createMultiplePivots(filePath, params);
    }

    async pivotToCsv(pivotPath) {
        return this.pivot.pivotToCsv(pivotPath);
    }

    async pivotToHtml(pivotPath) {
        return this.pivot.pivotToHtml(pivotPath);
    }

    async pivotGroup(pivotPath, params = {}) {
        return this.pivot.groupPivot(pivotPath, params);
    }

    async pivotAnalyze(pivotPath) {
        return this.pivot.analyzePivot(pivotPath);
    }


    /* ============================================================
       🆕 6. عمليات الإنشاء (عبر Adapter)
       ============================================================ */

    async create(params = {}) {
        await this.initialize();
        return this.adapter.create(params);
    }

    async createFromTemplate(templatePath, params = {}) {
        await this.initialize();
        // قراءة القالب ثم التعديل
        const data = await this.adapter.read(templatePath, params);
        // إنشاء ملف جديد بناءً على القالب
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
        
        // ✅ إعادة ربط الوحدات بالمحول الجديد
        this.reader = new ExcelReader(this.adapter);
        this.modifier = new ExcelModifier(this.adapter);
        this.analyzer = new ExcelAnalyzer(this.adapter);
        this.formatter = new ExcelFormatter(this.adapter);
        this.pivot = new ExcelPivot(this.adapter);
        this.searcher = new ExcelSearcher(this.adapter);
        
        this.initialized = true;
        return this;
    }

    getCurrentEngine() {
        return this.engineType;
    }

    getAvailableEngines() {
        return Object.values(ENGINE_TYPES);
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
            adapters: {
                exceljs: true,
                xlsx: true,
                python: true
            },
            modules: {
                reader: true,
                modifier: true,
                analyzer: true,
                formatter: true,
                pivot: true,
                searcher: true
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
export const excelModifyDirect = (filePath, operations, params) => ultimateEngine.modifyDirect(filePath, operations, params);
export const excelUndo = () => ultimateEngine.undo();
export const excelGetBackupInfo = () => ultimateEngine.getBackupInfo();

// 📊 التحليل
export const excelAnalyze = (filePath, params) => ultimateEngine.analyze(filePath, params);
export const excelAnalyzeStatistics = (filePath, params) => ultimateEngine.analyzeStatistics(filePath, params);
export const excelAnalyzePatterns = (filePath, params) => ultimateEngine.analyzePatterns(filePath, params);

// 🎨 التنسيق التلقائي
export const excelAutoFormat = (filePath, params) => ultimateEngine.autoFormat(filePath, params);
export const excelApplyTemplate = (filePath, templateName, params) => ultimateEngine.applyTemplate(filePath, templateName, params);
export const excelFormatTable = (filePath, params) => ultimateEngine.formatTable(filePath, params);
export const excelFormatHeaders = (filePath, params) => ultimateEngine.formatHeaders(filePath, params);

// 📋 الجداول المحورية
export const excelPivot = (filePath, params) => ultimateEngine.pivot(filePath, params);
export const excelPivotMultiple = (filePath, params) => ultimateEngine.pivotMultiple(filePath, params);
export const excelPivotToCsv = (pivotPath) => ultimateEngine.pivotToCsv(pivotPath);
export const excelPivotToHtml = (pivotPath) => ultimateEngine.pivotToHtml(pivotPath);
export const excelPivotGroup = (pivotPath, params) => ultimateEngine.pivotGroup(pivotPath, params);
export const excelPivotAnalyze = (pivotPath) => ultimateEngine.pivotAnalyze(pivotPath);

// 🆕 الإنشاء
export const excelCreate = (params) => ultimateEngine.create(params);
export const excelCreateFromTemplate = (templatePath, params) => ultimateEngine.createFromTemplate(templatePath, params);

// 🔄 التحويل
export const excelConvertToPdf = (filePath) => ultimateEngine.convertToPdf(filePath);
export const excelConvertToCsv = (filePath) => ultimateEngine.convertToCsv(filePath);

// ⚙️ الإدارة
export const excelSetEngine = (engineType) => ultimateEngine.setEngine(engineType);
export const excelGetEngine = () => ultimateEngine.getCurrentEngine();
export const excelGetEngines = () => ultimateEngine.getAvailableEngines();
export const excelGetStatus = () => ultimateEngine.getStatus();

// 🧹 الصيانة
export const excelCleanup = () => ultimateEngine.cleanup();

/* ============================================================
   📖 توثيق سريع للاستخدام
   ============================================================ */

/**
 * 📖 أمثلة على الاستخدام:
 * 
 * // قراءة ملف
 * const data = await excelRead('file.xlsx');
 * 
 * // تعديل ملف
 * const result = await excelModify('file.xlsx', {
 *     operations: [
 *         { type: 'add_column', header: 'عمود جديد', afterColumn: 'الغياب' },
 *         { type: 'add_validation', address: 'F2:F11', formulae: ['"خيار1,خيار2"'] }
 *     ]
 * });
 * 
 * // تنسيق تلقائي
 * const formatted = await excelAutoFormat('file.xlsx');
 * 
 * // تحليل البيانات
 * const analysis = await excelAnalyze('file.xlsx');
 * 
 * // جدول محوري
 * const pivot = await excelPivot('file.xlsx', {
 *     values: 'المبيعات',
 *     index: 'المنطقة',
 *     columns: 'المنتج'
 * });
 * 
 * // بحث متقدم
 * const search = await excelSearch('file.xlsx', { query: 'أحمد' });
 * 
 * // تغيير المحرك
 * await excelSetEngine('python');
 */
