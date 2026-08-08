/**
 * api/core/excel_processor.js - واجهة استدعاء معالج Excel (Aspose.Cells)
 * هذا الملف يسمح لـ Node.js باستدعاء ملف excel_processor.py
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);
const PYTHON_EXEC = process.env.NODE_ENV === "production" ? "/opt/venv/bin/python" : "python3";

// ============================================================
// 🧠 الوظيفة الأساسية لاستدعاء معالج Python
// ============================================================

async function callExcelProcessor(operation, filePath, params = {}) {
    const scriptPath = path.join(__dirname, 'excel_processor.py');
    
    // تحقق من وجود الملف
    if (!fs.existsSync(scriptPath)) {
        console.error('❌ [ExcelProcessor] الملف غير موجود:', scriptPath);
        return { success: false, error: 'ملف المعالج غير موجود' };
    }

    // تحقق من وجود ملف Excel
    if (filePath && !fs.existsSync(filePath)) {
        return { success: false, error: 'ملف Excel غير موجود' };
    }

    const payload = {
        operation: operation,
        file_path: filePath,
        params: params
    };

    try {
        console.log(`🔄 [ExcelProcessor] تنفيذ: ${operation} على ${path.basename(filePath || 'ملف جديد')}`);
        
        const { stdout, stderr } = await execFileAsync(
            PYTHON_EXEC,
            [scriptPath, JSON.stringify(payload)],
            { 
                maxBuffer: 50 * 1024 * 1024,  // 50MB للتعامل مع الملفات الكبيرة
                timeout: 30000  // 30 ثانية كحد أقصى
            }
        );

        if (stderr) {
            console.warn('⚠️ [ExcelProcessor] stderr:', stderr);
        }

        const result = JSON.parse(stdout);
        
        if (result.success) {
            console.log(`✅ [ExcelProcessor] نجاح: ${result.message || 'تم التنفيذ'}`);
        } else {
            console.error(`❌ [ExcelProcessor] فشل: ${result.error}`);
        }
        
        return result;

    } catch (error) {
        console.error('❌ [ExcelProcessor] استثناء:', error.message);
        
        if (error.code === 'ETIMEDOUT') {
            return { success: false, error: 'انتهى وقت التنفيذ (30 ثانية)' };
        }
        
        return { 
            success: false, 
            error: error.message,
            stderr: error.stderr || null
        };
    }
}

// ============================================================
// 📁 العمليات المتاحة (واجهة سهلة الاستخدام)
// ============================================================

export const ExcelProcessor = {
    // 📁 إدارة المصنفات
    createWorkbook: (outputPath, sheetName = 'ورقة1') => 
        callExcelProcessor('create_workbook', null, { output_path: outputPath, sheet_name: sheetName }),
    
    getInfo: (filePath) => 
        callExcelProcessor('get_info', filePath),
    
    // 📋 إدارة الأوراق
    addSheet: (filePath, sheetName) => 
        callExcelProcessor('add_sheet', filePath, { sheet_name: sheetName }),
    
    deleteSheet: (filePath, sheetName) => 
        callExcelProcessor('delete_sheet', filePath, { sheet_name: sheetName }),
    
    renameSheet: (filePath, oldName, newName) => 
        callExcelProcessor('rename_sheet', filePath, { old_name: oldName, new_name: newName }),
    
    // 📊 إدارة الأعمدة
    addColumn: (filePath, targetColumn, newColumn, sheetName = null) => 
        callExcelProcessor('add_column', filePath, { 
            target_column: targetColumn, 
            new_column: newColumn,
            sheet_name: sheetName 
        }),
    
    deleteColumn: (filePath, columnName, sheetName = null) => 
        callExcelProcessor('delete_column', filePath, { 
            column_name: columnName,
            sheet_name: sheetName 
        }),
    
    renameColumn: (filePath, oldName, newName, sheetName = null) => 
        callExcelProcessor('rename_column', filePath, { 
            old_name: oldName, 
            new_name: newName,
            sheet_name: sheetName 
        }),
    
    addColumnWithDropdown: (filePath, targetColumn, newColumn, dropdownValues, sheetName = null) => 
        callExcelProcessor('add_column_with_dropdown', filePath, { 
            target_column: targetColumn, 
            new_column: newColumn,
            dropdown_values: dropdownValues,
            sheet_name: sheetName 
        }),
    
    // 🔢 إدارة البيانات
    getCell: (filePath, sheetName, row, col) => 
        callExcelProcessor('get_cell', filePath, { 
            sheet_name: sheetName, 
            row: row, 
            col: col 
        }),
    
    setCell: (filePath, sheetName, row, col, value) => 
        callExcelProcessor('set_cell', filePath, { 
            sheet_name: sheetName, 
            row: row, 
            col: col, 
            value: value 
        }),
    
    getAllData: (filePath, sheetName = null) => 
        callExcelProcessor('get_all_data', filePath, { sheet_name: sheetName }),
    
    // 🎨 التنسيقات
    formatCell: (filePath, sheetName, row, col, styleOptions) => 
        callExcelProcessor('format_cell', filePath, { 
            sheet_name: sheetName, 
            row: row, 
            col: col, 
            style_options: styleOptions 
        }),
    
    // 📊 الرسوم البيانية
    addChart: (filePath, chartType, dataRange, position, sheetName = null) => 
        callExcelProcessor('add_chart', filePath, { 
            chart_type: chartType, 
            data_range: dataRange, 
            position: position,
            sheet_name: sheetName 
        }),
    
    // 🔍 التصفية والفرز
    applyFilter: (filePath, columnName, filterValues, sheetName = null) => 
        callExcelProcessor('apply_filter', filePath, { 
            column_name: columnName, 
            filter_values: filterValues,
            sheet_name: sheetName 
        }),
    
    sortData: (filePath, sortColumn, ascending = true, sheetName = null) => 
        callExcelProcessor('sort_data', filePath, { 
            sort_column: sortColumn, 
            ascending: ascending,
            sheet_name: sheetName 
        }),
    
    // 📤 التصدير
    exportToCSV: (filePath, outputPath, sheetName = null) => 
        callExcelProcessor('export_csv', filePath, { 
            output_path: outputPath,
            sheet_name: sheetName 
        }),
    
    exportToJSON: (filePath, outputPath, sheetName = null) => 
        callExcelProcessor('export_json', filePath, { 
            output_path: outputPath,
            sheet_name: sheetName 
        }),
    
    exportToMarkdown: (filePath, outputPath, sheetName = null) => 
        callExcelProcessor('export_markdown', filePath, { 
            output_path: outputPath,
            sheet_name: sheetName 
        }),
};

// ============================================================
// 🚀 تصدير افتراضي (للاستخدام المباشر)
// ============================================================

export default ExcelProcessor;
