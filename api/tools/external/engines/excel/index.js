/**
 * excel/index.js – Sovereign Excel Ultimate Engine (Hybrid Pipeline Edition)
 * 🔥 الوحدات المدمجة:
 * - ExcelReader, ExcelModifier, ExcelAnalyzer, ExcelFormatter, ExcelPivot
 * 🧠 المحرك الهجين (JS + Python Bridge):
 * - توزيع ذكي للمهام: الجافاسكريبت تنفذ التنسيقات والمهام السريعة، 
 *   وبايثون يتولى المهام المعقدة (القوائم المنسدلة، الإدراج الدقيق) على نفس الملف.
 */

import { ExcelAdapter } from './core/ExcelAdapter.js';
import { ExcelReader } from './readers/ExcelReader.js';
import { ExcelModifier } from './modifiers/ExcelModifier.js';
import { ExcelAnalyzer } from './analyzers/ExcelAnalyzer.js';
import { ExcelFormatter } from './formatters/ExcelFormatter.js';
import { ExcelPivot } from './pivots/ExcelPivot.js';
import { FileUtils } from './utils/FileUtils.js';
import { ENGINE_TYPES } from './types/ExcelTypes.js';

// ✅ استيراد وحدات تشغيل بايثون المدمجة
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
const execAsync = promisify(exec);

/* ============================================================
   🧠 المحرك السيادي النهائي
   ============================================================ */

class ExcelUltimateEngine {
    constructor(engineType = ENGINE_TYPES.EXCELJS) {
        this.adapter = new ExcelAdapter(engineType);
        this.reader = new ExcelReader(this.adapter);
        this.modifier = new ExcelModifier(this.adapter);
        this.analyzer = new ExcelAnalyzer(this.adapter);
        this.formatter = new ExcelFormatter(this.adapter);
        this.pivot = new ExcelPivot(this.adapter);
        this.engineType = engineType;
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            await this.adapter.initialize();
            this.initialized = true;
        }
        return this;
    }

    /* ============================================================
       📖 1. عمليات القراءة
       ============================================================ */
    async read(filePath, params = {}) { await this.initialize(); return this.reader.readFull(filePath, params); }
    async readFast(filePath, params = {}) { await this.initialize(); return this.reader.readFast(filePath, params); }
    async readMetadata(filePath) { await this.initialize(); return this.reader.readMetadata(filePath); }
    async readRange(filePath, range, params = {}) { await this.initialize(); return this.reader.readRange(filePath, range, params); }
    async readSheets(filePath, sheetNames, params = {}) { await this.initialize(); return this.reader.readSheets(filePath, sheetNames, params); }

    /* ============================================================
       ✏️ 2. عمليات التعديل (الهندسة الهجينة المتسلسلة - Hybrid Pipeline)
       ============================================================ */

    async modify(filePath, params = {}) {
        await this.initialize();
        const ops = params.operations || [];

        if (ops.length === 0) {
            return { ok: false, error: "لا توجد عمليات لتنفيذها." };
        }

        console.log(`🧠 [Ultimate Engine] تحليل المهام وتوزيعها بين الجافاسكريبت وبايثون...`);

        // 1. تصنيف المهام بناءً على قدرات المحركات
        const jsOperations = [];
        const pythonOperations = [];

        // قائمة بالعمليات التي نعرف يقيناً أن الجافاسكريبت تعجز عنها أو تخطئ فيها
        const pythonExclusiveTypes = ['add_validation', 'dropdown', 'python_custom'];

        ops.forEach(op => {
            if (pythonExclusiveTypes.includes(op.type) || (op.type === 'add_column' && op.after)) {
                pythonOperations.push(op); // مهام تحتاج بايثون حصراً
            } else {
                jsOperations.push(op); // مهام عادية للجافاسكريبت (ألوان، نصوص، إضافة صفوف...)
            }
        });

        let currentFilePath = filePath;
        let finalResult = null;

        // 2. المرحلة الأولى: تنفيذ مهام الجافاسكريبت (القائد الأساسي)
        if (jsOperations.length > 0) {
            console.log(`⚙️ [Ultimate Engine] تسليم ${jsOperations.length} مهمة لمحرك الجافاسكريبت...`);
            try {
                finalResult = await this.modifier.modifyWithBackup(currentFilePath, jsOperations, params);
                currentFilePath = finalResult.filePath; // تحديث المسار ليكون الملف المُعدّل
            } catch (jsError) {
                console.error(`⚠️ [Ultimate Engine] خطأ في مرحلة الجافاسكريبت: ${jsError.message}`);
                // شبكة الأمان: في حال فشلت JS، نعطي كل مهامها لبايثون كمنقذ
                pythonOperations.push(...jsOperations); 
            }
        }

        // 3. المرحلة الثانية: تنفيذ مهام بايثون (المساعد الاستراتيجي)
        if (pythonOperations.length > 0) {
            console.log(`🐍 [Ultimate Engine] تسليم ${pythonOperations.length} مهمة (معقدة) لمحرك بايثون...`);
            try {
                // بايثون يستلم الملف الذي انتهت منه الجافاسكريبت
                finalResult = await this.executePythonModifier(currentFilePath, pythonOperations);
            } catch (pyError) {
                console.error(`🔥 [Ultimate Engine] خطأ في مرحلة بايثون: ${pyError.message}`);
                if (!finalResult) {
                    return { ok: false, error: `فشل التعديل كلياً: ${pyError.message}` };
                }
            }
        }

        console.log(`✅ [Ultimate Engine] تم إنجاز العمل المشترك بنجاح!`);
        return finalResult;
    }

    /* ============================================================
       🐍 محرك بايثون السيادي (المدمج) - لمعالجة العقد
       ============================================================ */
    async executePythonModifier(filePath, operations) {
        try {
            // إنشاء ملف بايثون مؤقت لتنفيذ المهام
            const scriptPath = path.join(path.dirname(filePath), `temp_executor_${Date.now()}.py`);
            
            const pythonCode = `
import sys
import json
from openpyxl import load_workbook
from openpyxl.worksheet.datavalidation import DataValidation

def process_excel():
    file_path = r"${filePath.replace(/\\/g, '\\\\')}"
    ops_json = r"""${JSON.stringify(operations)}"""
    
    try:
        operations = json.loads(ops_json)
        wb = load_workbook(file_path)
        ws = wb.active # العمل على الشيت الأول افتراضياً
        
        for op in operations:
            op_type = op.get('type')
            
            # 1. إدراج عمود بعد عمود معين
            if op_type == 'add_column' and op.get('after'):
                target_header = op.get('after')
                new_header = op.get('header', 'New Column')
                
                target_col_idx = None
                for col in range(1, ws.max_column + 2):
                    cell_val = ws.cell(row=1, column=col).value
                    if cell_val == target_header:
                        target_col_idx = col
                        break
                
                if target_col_idx:
                    ws.insert_cols(target_col_idx + 1)
                    ws.cell(row=1, column=target_col_idx + 1).value = new_header
                else:
                    ws.cell(row=1, column=ws.max_column + 1).value = new_header

            # 2. إضافة قوائم منسدلة
            elif op_type in ['add_validation', 'dropdown']:
                formulae = op.get('formulae', ['"Yes,No"'])[0]
                address = op.get('address', 'A2:A1048576') 
                
                dv = DataValidation(type="list", formula1=formulae, allow_blank=True)
                ws.add_data_validation(dv)
                dv.add(address)

        # حفظ التعديلات على نفس الملف
        wb.save(file_path)
        print("SUCCESS")
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    process_excel()
`;
            
            // حفظ السكربت وتنفيذه
            fs.writeFileSync(scriptPath, pythonCode);
            const { stdout, stderr } = await execAsync(`python "${scriptPath}"`);
            
            // تنظيف السيرفر من السكربت المؤقت
            if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

            if (stdout.includes("ERROR") || stderr) {
                throw new Error(stderr || stdout);
            }

            // قراءة الملف بعد التعديل لتجهيزه للإرسال
            const fileBuffer = fs.readFileSync(filePath);
            return {
                ok: true,
                success: true,
                filePath: filePath,
                fileBase64: fileBuffer.toString('base64'),
                fileName: path.basename(filePath),
                reply: "تم تنفيذ التعديلات المعقدة بنجاح عبر محرك بايثون!"
            };

        } catch (error) {
            console.error("🔥 [Python Engine Error]:", error);
            throw error;
        }
    }

    /* ============================================================
       ⚙️ باقي الوظائف والميزات (تعمل كما هي دون تغيير)
       ============================================================ */
    async undo() { return this.modifier.undo(); }
    async analyze(filePath, params = {}) { await this.initialize(); return this.analyzer.analyze(filePath, params); }
    async autoFormat(filePath, params = {}) { await this.initialize(); return this.formatter.autoFormat(filePath, params); }
    async applyTemplate(filePath, templateName, params = {}) { await this.initialize(); return this.formatter.applyTemplate(filePath, templateName, params); }
    async pivot(filePath, params = {}) { await this.initialize(); return this.pivot.createPivot(filePath, params); }
    async conditionalFormat(filePath, params = {}) {
        await this.initialize();
        return this.formatter.conditionalFormat ? 
            await this.formatter.conditionalFormat(filePath, params) : 
            await this.modify(filePath, params);
    }
    async create(params = {}) { await this.initialize(); return this.adapter.create(params); }
    async convertToPdf(filePath) { await this.initialize(); return this.adapter.convertToPdf(filePath); }
    async convertToCsv(filePath) { await this.initialize(); return this.adapter.convertToCsv(filePath); }
    
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
    
    getCurrentEngine() { return this.engineType; }
    async cleanup() { await FileUtils.cleanupOldTempFiles(); }
    async getStatus() { return { initialized: this.initialized, engine: this.engineType, modules: { reader: true, modifier: true, analyzer: true, formatter: true, pivot: true } }; }
}

const ultimateEngine = new ExcelUltimateEngine();
export default ultimateEngine;
export { ExcelUltimateEngine };

// 📤 التصديرات الثابتة 
export const excelRead = (filePath, params) => ultimateEngine.read(filePath, params);
export const excelReadFast = (filePath, params) => ultimateEngine.readFast(filePath, params);
export const excelReadMetadata = (filePath) => ultimateEngine.readMetadata(filePath);
export const excelReadRange = (filePath, range, params) => ultimateEngine.readRange(filePath, range, params);
export const excelReadSheets = (filePath, sheetNames, params) => ultimateEngine.readSheets(filePath, sheetNames, params);
export const excelModify = (filePath, params) => ultimateEngine.modify(filePath, params);
export const excelUndo = () => ultimateEngine.undo();
export const excelAnalyze = (filePath, params) => ultimateEngine.analyze(filePath, params);
export const excelAutoFormat = (filePath, params) => ultimateEngine.autoFormat(filePath, params);
export const excelApplyTemplate = (filePath, templateName, params) => ultimateEngine.applyTemplate(filePath, templateName, params);
export const excelFormat = (filePath, params) => ultimateEngine.autoFormat(filePath, params);
export const excelConditionalFormat = (filePath, params) => ultimateEngine.conditionalFormat(filePath, params);
export const excelPivot = (filePath, params) => ultimateEngine.pivot(filePath, params);
export const excelCreate = (params) => ultimateEngine.create(params);
export const excelConvertToPdf = (filePath) => ultimateEngine.convertToPdf(filePath);
export const excelConvertToCsv = (filePath) => ultimateEngine.convertToCsv(filePath);
export const excelSetEngine = (engineType) => ultimateEngine.setEngine(engineType);
export const excelGetEngine = () => ultimateEngine.getCurrentEngine();
export const excelGetStatus = () => ultimateEngine.getStatus();
export const excelCleanup = () => ultimateEngine.cleanup();
