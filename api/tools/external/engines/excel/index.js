/**
 * excel/index.js – المدخل السيادي النهائي
 * 🔥 يجمع كل الوحدات في واجهة واحدة موحدة
 */

import { ExcelAdapter } from './core/ExcelAdapter.js';
import { ExcelReader } from './readers/ExcelReader.js';
import { ExcelModifier } from './modifiers/ExcelModifier.js';
import { ExcelAnalyzer } from './analyzers/ExcelAnalyzer.js';
import { ErrorHandler } from './utils/ErrorHandler.js';
import { FileUtils } from './utils/FileUtils.js';
import { ENGINE_TYPES } from './types/ExcelTypes.js';

class ExcelUltimateEngine {
    constructor(engineType = ENGINE_TYPES.EXCELJS) {
        this.adapter = new ExcelAdapter(engineType);
        this.reader = new ExcelReader(this.adapter);
        this.modifier = new ExcelModifier(this.adapter);
        this.analyzer = new ExcelAnalyzer(this.adapter);
        this.engineType = engineType;
    }
    
    async initialize() {
        await this.adapter.initialize();
        return this;
    }
    
    // 📖 عمليات القراءة
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
    
    // ✏️ عمليات التعديل
    async modify(filePath, params = {}) {
        await this.initialize();
        return this.modifier.modifyWithBackup(filePath, params.operations || [], params);
    }
    
    async undo() {
        return this.modifier.undo();
    }
    
    // 📊 عمليات التحليل
    async analyze(filePath, params = {}) {
        await this.initialize();
        return this.analyzer.analyze(filePath, params);
    }
    
    // 🆕 عمليات الإنشاء
    async create(params = {}) {
        await this.initialize();
        return this.adapter.create(params);
    }
    
    // 🔄 تغيير المحرك
    async setEngine(engineType) {
        this.engineType = engineType;
        this.adapter = new ExcelAdapter(engineType);
        await this.adapter.initialize();
        this.reader = new ExcelReader(this.adapter);
        this.modifier = new ExcelModifier(this.adapter);
        this.analyzer = new ExcelAnalyzer(this.adapter);
    }
    
    // 🧹 تنظيف
    async cleanup() {
        await FileUtils.cleanupOldTempFiles();
    }
}

// ✅ تصدير نسخة واحدة
const ultimateEngine = new ExcelUltimateEngine();

// ✅ تصدير الوظائف الرئيسية
export const excelRead = (filePath, params) => ultimateEngine.read(filePath, params);
export const excelReadFast = (filePath, params) => ultimateEngine.readFast(filePath, params);
export const excelReadMetadata = (filePath) => ultimateEngine.readMetadata(filePath);
export const excelReadRange = (filePath, range, params) => ultimateEngine.readRange(filePath, range, params);
export const excelModify = (filePath, params) => ultimateEngine.modify(filePath, params);
export const excelUndo = () => ultimateEngine.undo();
export const excelAnalyze = (filePath, params) => ultimateEngine.analyze(filePath, params);
export const excelCreate = (params) => ultimateEngine.create(params);
export const excelSetEngine = (engineType) => ultimateEngine.setEngine(engineType);
export const excelCleanup = () => ultimateEngine.cleanup();

export default ultimateEngine;
export { ExcelUltimateEngine };
