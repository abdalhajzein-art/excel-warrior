/**
 * excel/modifiers/ExcelModifier.js – التعديل السيادي المتقدم (محدث بحماية ضد ضياع الملفات)
 * 🔥 يدعم: عمليات متعددة، تراجع حقيقي، نسخ احتياطي، تنفيذ ذكي مرتب بالأولويات
 */

import fs from 'fs';
import path from 'path';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { FileUtils } from '../utils/FileUtils.js';
import { OPERATION_TYPES } from '../types/ExcelTypes.js';

export class ExcelModifier {
    constructor(adapter) {
        this.adapter = adapter;
        this.backupPath = null;
    }
    
    /**
     * ✏️ تعديل الملف مع إنشاء نسخة احتياطية آمنة
     */
    async modifyWithBackup(filePath, operations, params = {}) {
        return ErrorHandler.execute('modifyWithBackup', async () => {
            // ✅ تحقق سيادي من وجود الملف قبل أي عملية
            const resolvedPath = this.resolveFilePath(filePath);
            
            // ✅ إنشاء نسخة احتياطية أولاً قبل أي لمس للملف
            this.backupPath = await this.createBackup(resolvedPath);
            
            // ✅ ترتيب العمليات حسَب الأولوية لضمان سلامة الصيغ والصفوف
            const sortedOperations = this.orderOperations(operations || []);
            
            const result = await this.adapter.modify(resolvedPath, { operations: sortedOperations, ...params });
            
            return {
                ...result,
                backupPath: this.backupPath
            };
        }, { filePath, operations });
    }
    
    /**
     * 🔍 حل وتصحيح مسار الملف (دعم المسارات النسبية والمطلقة ومجلدات الرفع)
     */
    resolveFilePath(filePath) {
        if (!filePath) {
            throw new Error('[Alatheer Sovereign Error] مسار الملف غير مدخل أو فارغ.');
        }
        
        // إذا كان المسار مطلقاً وموجوداً
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        
        // محاولة البحث في مجلد الرفع المحلي إذا كان المرور مجرد اسم ملف
        const uploadsPath = path.resolve('/app/uploads', path.basename(filePath));
        if (fs.existsSync(uploadsPath)) {
            return uploadsPath;
        }
        
        // إذا لم يوجد نهائياً (غالباً بسبب إعادة تشغيل الحاوية أو انقطاع الجلسة)
        throw new Error(`[Alatheer Sovereign Error] الملف المستهدف غير موجود على القرص: ${filePath}. قد يكون قد تم مسح الملف أو إعادة تشغيل الحاوية. يرجى إعادة رفع الملف لاستئناف العمليات.`);
    }

    /**
     * 💾 إنشاء نسخة احتياطية آمنة
     */
    async createBackup(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`[Alatheer Sovereign Error] تعذر إنشاء نسخة احتياطية، الملف غير موجود: ${filePath}`);
        }
        const backupPath = FileUtils.getTempPath('backup');
        const data = await FileUtils.readFile(filePath);
        await FileUtils.writeFile(backupPath, data);
        return backupPath;
    }
    
    /**
     * ↩️ التراجع الحقيقي عن آخر تعديل واستعادة الملف
     */
    async undo(targetFilePath) {
        if (!this.backupPath || !fs.existsSync(this.backupPath)) {
            throw new Error('لا توجد نسخة احتياطية متاحة للتراجع.');
        }
        
        const resolvedTarget = targetFilePath ? this.resolveFilePath(targetFilePath) : this.backupPath;
        
        // ✅ استعادة النسخة الاحتياطية وكتابتها في الملف المستهدف
        const backupData = await FileUtils.readFile(this.backupPath);
        await FileUtils.writeFile(resolvedTarget, backupData);
        
        return { 
            success: true, 
            message: "تم التراجع عن التعديل واستعادة النسخة السابقة بنجاح." 
        };
    }
    
    /**
     * 🎯 تنفيذ عمليات متعددة بذكاء وعلى حسب الأولوية البرمجية
     */
    async applySmartOperations(worksheet, operations) {
        const orderedOps = this.orderOperations(operations);
        
        for (const op of orderedOps) {
            await this.applyOperation(worksheet, op);
        }
    }
    
    /**
     * 📊 مصفوفة ترتيب أولويات تنفيذ العمليات
     * (الهيكلية -> البيانات -> التنسيق والتلوين -> الفلاتر)
     */
    orderOperations(operations) {
        const priority = {
            'add_column': 1,
            'add_row': 1,
            'add_validation': 2,
            'add_formula': 2,
            'update_cell': 3,
            'format_range': 4,
            'color_cells': 4,
            'highlight': 4,
            'add_filter': 5
        };
        
        return [...operations].sort((a, b) => (priority[a.type] || 99) - (priority[b.type] || 99));
    }
    
    /**
     * 🛠️ توجيه وتنفيد عملية فردية عبر Adapter
     */
    async applyOperation(worksheet, op) {
        switch(op.type) {
            case OPERATION_TYPES.ADD_COLUMN:
            case 'add_column':
                this.addColumnSmart(worksheet, op);
                break;
            case OPERATION_TYPES.ADD_ROW:
            case 'add_row':
                this.addRowSmart(worksheet, op);
                break;
            case OPERATION_TYPES.UPDATE_CELL:
            case 'update_cell':
                this.updateCellSmart(worksheet, op);
                break;
            case OPERATION_TYPES.COLOR_CELLS:
            case 'color_cells':
            case 'highlight':
                this.colorCellsSmart(worksheet, op);
                break;
            case OPERATION_TYPES.FORMAT_RANGE:
            case 'format_range':
                this.formatRangeSmart(worksheet, op);
                break;
            case OPERATION_TYPES.ADD_FORMULA:
            case 'add_formula':
                this.addFormulaSmart(worksheet, op);
                break;
            case OPERATION_TYPES.ADD_VALIDATION:
            case 'dropdown':
                this.addValidationSmart(worksheet, op);
                break;
            case OPERATION_TYPES.ADD_FILTER:
            case 'add_filter':
                this.addFilterSmart(worksheet, op);
                break;
            default:
                console.warn(`⚠️ [ExcelModifier] نوع عملية غير معروف أو يتم التوجيه للبايثون: ${op.type}`);
        }
    }
    
    addColumnSmart(worksheet, op) { if (this.adapter.addColumn) this.adapter.addColumn(worksheet, op); }
    addRowSmart(worksheet, op) { if (this.adapter.addRow) this.adapter.addRow(worksheet, op); }
    updateCellSmart(worksheet, op) { if (this.adapter.updateCell) this.adapter.updateCell(worksheet, op); }
    colorCellsSmart(worksheet, op) { if (this.adapter.colorCells) this.adapter.colorCells(worksheet, op); }
    formatRangeSmart(worksheet, op) { if (this.adapter.formatRange) this.adapter.formatRange(worksheet, op); }
    addFormulaSmart(worksheet, op) { if (this.adapter.addFormula) this.adapter.addFormula(worksheet, op); }
    addValidationSmart(worksheet, op) { if (this.adapter.addValidation) this.adapter.addValidation(worksheet, op); }
    addFilterSmart(worksheet, op) { if (this.adapter.addFilter) this.adapter.addFilter(worksheet, op); }
}

export default ExcelModifier;

