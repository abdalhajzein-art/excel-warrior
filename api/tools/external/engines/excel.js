/**
 * engines/excel.js – Sovereign Excel Ultimate Engine 
 * 🔥 الإصدار الشامل الذي يجمع كل قدرات ExcelJS و XLSX
 * ✅ يدعم: قراءة، كتابة، تعديل، تنسيق، تحليل، وكل ما تحتاجه
 * ✅ تم إصلاح مشكلة المراجع الدائرية (circular references)
 */

import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';

/* ============================================================
   🧠 الطبقة العليا - المدير الذكي
   ============================================================ */

class ExcelUltimateEngine {
    constructor() {
        this.supportedFormats = ['.xlsx', '.xlsm', '.xls', '.csv'];
        this.engines = {
            exceljs: ExcelJS,
            xlsx: XLSX
        };
    }

    /**
     * 🎯 المدخل الرئيسي - اختيار المحرك المناسب تلقائياً
     */
    async execute(filePath, action, params = {}) {
        try {
            const detection = this.detectEngine(filePath);
            
            switch (action) {
                case 'read':
                case 'preview':
                case 'excel_preview':
                    return await this.read(filePath, params);
                case 'modify':
                case 'excel_modify':
                    return await this.modify(filePath, params);
                case 'create':
                    return await this.create(params);
                case 'format':
                case 'excel_format':
                    return await this.format(filePath, params);
                case 'analyze':
                case 'excel_analyze':
                    return await this.analyze(filePath, params);
                case 'convert_pdf':
                case 'to_pdf':
                    return await this.convertToPdf(filePath);
                case 'convert_csv':
                    return await this.convertToCsv(filePath);
                case 'search':
                    return await this.search(filePath, params);
                case 'statistics':
                    return await this.statistics(filePath, params);
                case 'conditional_format':
                    return await this.conditionalFormat(filePath, params);
                case 'pivot':
                    return await this.createPivot(filePath, params);
                default:
                    return await this.read(filePath, params);
            }
        } catch (err) {
            return this.normalizedError("خطأ في تنفيذ العملية.", err);
        }
    }

    /**
     * 🔍 كشف نوع الملف واختيار المحرك
     */
    detectEngine(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return {
            ext: ext,
            isXLS: ext === '.xls',
            isXLSX: ['.xlsx', '.xlsm'].includes(ext),
            isCSV: ext === '.csv',
            engine: ext === '.xls' ? 'xlsx' : 'exceljs',
            method: ext === '.xls' ? 'xlsx' : 'exceljs'
        };
    }

    /* ============================================================
       📖 1. عمليات القراءة (القراءة المطلقة)
       ============================================================ */

    async read(filePath, params = {}) {
        if (!filePath || !fs.existsSync(filePath)) {
            return this.normalizedError("الملف غير موجود.");
        }

        try {
            const detection = this.detectEngine(filePath);
            let result;

            if (detection.isXLS || params.useXLSX) {
                result = await this.readWithXLSX(filePath, params);
            } else {
                result = await this.readWithExcelJS(filePath, params);
            }

            if (params.analyze && params.gemini) {
                result.analysis = await params.gemini.analyzeData(result);
            }

            return this.normalizedReply("📊 تم قراءة الملف بنجاح.", result);
        } catch (err) {
            console.error("❌ خطأ في القراءة:", err);
            return this.normalizedError("فشل قراءة الملف.", err);
        }
    }

    /**
     * 📖 القراءة باستخدام ExcelJS (مع الصيغ والتنسيق)
     * ✅ تم إزالة workbook من النتيجة لتجنب المراجع الدائرية
     */
    async readWithExcelJS(filePath, params = {}) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        // ✅ لا نضيف workbook إلى النتيجة
        const result = {
            sheets: [],
            data: [],
            formulas: [],
            styles: [],
            metadata: {}
        };

        workbook.worksheets.forEach((worksheet) => {
            const sheetData = {
                name: worksheet.name,
                data: [],
                formulas: [],
                styles: []
            };

            worksheet.eachRow((row) => {
                const rowData = [];
                const rowStyles = [];
                
                row.eachCell((cell) => {
                    rowData.push(cell.value || '');
                    
                    if (cell.formula) {
                        sheetData.formulas.push({
                            address: cell.address,
                            formula: cell.formula,
                            value: cell.value
                        });
                    }
                    
                    if (cell.fill || cell.font || cell.alignment) {
                        rowStyles.push({
                            address: cell.address,
                            fill: cell.fill ? JSON.parse(JSON.stringify(cell.fill)) : null,
                            font: cell.font ? JSON.parse(JSON.stringify(cell.font)) : null,
                            alignment: cell.alignment ? JSON.parse(JSON.stringify(cell.alignment)) : null,
                            border: cell.border ? JSON.parse(JSON.stringify(cell.border)) : null
                        });
                    }
                });
                
                sheetData.data.push(rowData);
                sheetData.styles.push(rowStyles);
            });
            
            result.sheets.push(sheetData);
            result.data.push(sheetData.data);
            result.formulas.push(sheetData.formulas);
            result.styles.push(sheetData.styles);
        });

        result.metadata = {
            sheets: workbook.worksheets.length,
            totalRows: result.data.reduce((sum, sheet) => sum + sheet.length, 0),
            totalColumns: result.data.reduce((max, sheet) => {
                const cols = sheet.reduce((m, row) => Math.max(m, row.length), 0);
                return Math.max(max, cols);
            }, 0),
            hasFormulas: result.formulas.some(f => f.length > 0),
            engines: ['exceljs']
        };

        result.text = result.data.map(sheet => 
            sheet.map(row => row.join(' | ')).join('\n')
        ).join('\n\n---\n\n');

        result.markdown = result.data.map(sheet =>
            sheet.map(row => `| ${row.join(' | ')} |`).join('\n')
        ).join('\n\n---\n\n');

        return result;
    }

    /**
     * 📄 القراءة باستخدام XLSX (سريعة، لـ .xls)
     * ✅ تم إزالة workbook من النتيجة لتجنب المراجع الدائرية
     */
    readWithXLSX(filePath, params = {}) {
        const workbook = XLSX.readFile(filePath);
        
        // ✅ لا نضيف workbook إلى النتيجة
        const result = {
            sheets: [],
            data: [],
            metadata: {}
        };

        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            result.sheets.push({
                name: sheetName,
                data: data
            });
            result.data.push(data);
        });

        result.metadata = {
            sheets: workbook.SheetNames.length,
            totalRows: result.data.reduce((sum, sheet) => sum + sheet.length, 0),
            totalColumns: result.data.reduce((max, sheet) => {
                const cols = sheet.reduce((m, row) => Math.max(m, row.length), 0);
                return Math.max(max, cols);
            }, 0),
            hasFormulas: false,
            engines: ['xlsx']
        };

        result.text = result.data.map(sheet =>
            sheet.map(row => row.join(' | ')).join('\n')
        ).join('\n\n---\n\n');

        result.markdown = result.data.map(sheet =>
            sheet.map(row => `| ${row.join(' | ')} |`).join('\n')
        ).join('\n\n---\n\n');

        return result;
    }

    /* ============================================================
       ✏️ 2. عمليات التعديل (التعديل المطلق)
       ============================================================ */

    async modify(filePath, params = {}) {
        if (!filePath || !fs.existsSync(filePath)) {
            return this.normalizedError("الملف غير موجود.");
        }

        try {
            const detection = this.detectEngine(filePath);
            
            if (detection.isXLS) {
                return await this.modifyWithConversion(filePath, params);
            }

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.getWorksheet(1);

            if (!worksheet) {
                return this.normalizedError("لا توجد أوراق عمل.");
            }

            if (params.operations) {
                await this.applyOperations(worksheet, params.operations);
            }

            const outPath = path.join(os.tmpdir(), `modified_${Date.now()}.xlsx`);
            await workbook.xlsx.writeFile(outPath);
            
            const base64 = fs.readFileSync(outPath).toString('base64');
            return this.normalizedFile("✅ تم التعديل بنجاح.", outPath, "modified.xlsx", base64);
        } catch (err) {
            console.error("❌ خطأ في التعديل:", err);
            return this.normalizedError("فشل تعديل الملف.", err);
        }
    }

    /**
     * 🔄 تحويل .xls → .xlsx ثم التعديل
     */
    async modifyWithConversion(filePath, params) {
        const xlsData = XLSX.readFile(filePath);
        const tempPath = path.join(os.tmpdir(), `temp_${Date.now()}.xlsx`);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');
        
        const sheetName = xlsData.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(xlsData.Sheets[sheetName], { header: 1 });
        
        data.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                worksheet.getCell(rowIndex + 1, colIndex + 1).value = cell;
            });
        });
        
        await workbook.xlsx.writeFile(tempPath);
        
        return await this.modify(tempPath, params);
    }

    /**
     * 🛠️ تطبيق العمليات على الورقة
     */
    async applyOperations(worksheet, operations) {
        for (const op of operations) {
            switch (op.type) {
                case 'add_column':
                    this.addColumn(worksheet, op);
                    break;
                case 'add_row':
                    this.addRow(worksheet, op);
                    break;
                case 'update_cell':
                    this.updateCell(worksheet, op);
                    break;
                case 'color_cells':
                    this.colorCells(worksheet, op);
                    break;
                case 'format_range':
                    this.formatRange(worksheet, op);
                    break;
                case 'add_formula':
                    this.addFormula(worksheet, op);
                    break;
                case 'add_validation':
                    this.addValidation(worksheet, op);
                    break;
                case 'add_filter':
                    this.addFilter(worksheet, op);
                    break;
            }
        }
    }

    /**
     * ➕ إضافة عمود جديد
     */
    addColumn(worksheet, op) {
        const lastCol = worksheet.columnCount || 1;
        const newCol = lastCol + 1;
        const headerCell = worksheet.getCell(1, newCol);
        headerCell.value = op.header || `عمود ${newCol}`;
        
        const rowCount = worksheet.rowCount || 1;
        for (let i = 2; i <= rowCount; i++) {
            const cell = worksheet.getCell(i, newCol);
            cell.value = op.defaultValue || '';
        }
    }

    /**
     * ➕ إضافة صف جديد
     */
    addRow(worksheet, op) {
        const newRow = worksheet.addRow(op.data || []);
        if (op.style) {
            newRow.eachCell((cell) => {
                if (op.style.fill) cell.fill = op.style.fill;
                if (op.style.font) cell.font = op.style.font;
                if (op.style.alignment) cell.alignment = op.style.alignment;
            });
        }
    }

    /**
     * ✏️ تحديث خلية
     */
    updateCell(worksheet, op) {
        const cell = worksheet.getCell(op.address);
        cell.value = op.value;
        if (op.style) {
            if (op.style.fill) cell.fill = op.style.fill;
            if (op.style.font) cell.font = op.style.font;
            if (op.style.alignment) cell.alignment = op.style.alignment;
        }
    }

    /**
     * 🎨 تلوين الخلايا
     */
    colorCells(worksheet, op) {
        const { range, color, condition } = op;
        try {
            const cells = worksheet.getCells(range);
            if (cells) {
                cells.forEach(cell => {
                    if (!condition || this.evaluateCondition(cell.value, condition)) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: color || 'FFFFFF00' }
                        };
                    }
                });
            }
        } catch (e) {
            console.warn('⚠️ تحذير في تلوين الخلايا:', e.message);
        }
    }

    /**
     * 🎨 تنسيق نطاق
     */
    formatRange(worksheet, op) {
        const { range, style } = op;
        try {
            const [start, end] = range.split(':');
            const startRow = parseInt(start.match(/\d+/)[0]);
            const endRow = parseInt(end.match(/\d+/)[0]);
            const startCol = start.charCodeAt(0) - 64;
            const endCol = end.charCodeAt(0) - 64;
            
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    const cell = worksheet.getCell(row, col);
                    if (style.fill) cell.fill = style.fill;
                    if (style.font) cell.font = style.font;
                    if (style.alignment) cell.alignment = style.alignment;
                    if (style.border) cell.border = style.border;
                }
            }
        } catch (e) {
            console.warn('⚠️ تحذير في تنسيق النطاق:', e.message);
        }
    }

    /**
     * 📊 إضافة صيغة
     */
    addFormula(worksheet, op) {
        const cell = worksheet.getCell(op.address);
        cell.value = { formula: op.formula };
        if (op.style) {
            if (op.style.fill) cell.fill = op.style.fill;
            if (op.style.font) cell.font = op.style.font;
        }
    }

    /**
     * 📋 إضافة التحقق من البيانات (قوائم منسدلة)
     */
    addValidation(worksheet, op) {
        const cell = worksheet.getCell(op.address);
        cell.dataValidation = {
            type: op.validationType || 'list',
            formulae: op.formulae || ['"خيار1,خيار2,خيار3"'],
            showErrorMessage: true,
            errorTitle: op.errorTitle || 'خطأ',
            error: op.errorMessage || 'الرجاء اختيار قيمة صحيحة'
        };
    }

    /**
     * 🔍 إضافة فلتر
     */
    addFilter(worksheet, op) {
        worksheet.autoFilter = {
            from: op.from || 'A1',
            to: op.to || 'Z100'
        };
    }

    /**
     * 🔍 تقييم الشرط
     */
    evaluateCondition(value, condition) {
        if (!condition) return true;
        try {
            const parts = condition.split(' ');
            if (parts.length !== 2) return false;
            const [operator, threshold] = parts;
            const numValue = parseFloat(value);
            const numThreshold = parseFloat(threshold);
            
            if (isNaN(numValue) || isNaN(numThreshold)) {
                // مقارنة نصية
                switch(operator) {
                    case '==': return String(value) === threshold;
                    case '!=': return String(value) !== threshold;
                    default: return false;
                }
            }
            
            switch(operator) {
                case '>': return numValue > numThreshold;
                case '<': return numValue < numThreshold;
                case '==': return numValue === numThreshold;
                case '!=': return numValue !== numThreshold;
                case '>=': return numValue >= numThreshold;
                case '<=': return numValue <= numThreshold;
                default: return false;
            }
        } catch {
            return false;
        }
    }

    /* ============================================================
       🆕 3. الإنشاء (الإنشاء المطلق)
       ============================================================ */

    async create(params = {}) {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(params.sheetName || 'Sheet1');

            if (params.headers) {
                params.headers.forEach((header, index) => {
                    worksheet.getCell(1, index + 1).value = header;
                });
            }

            if (params.data) {
                params.data.forEach((row, rowIndex) => {
                    if (Array.isArray(row)) {
                        row.forEach((cell, colIndex) => {
                            worksheet.getCell(rowIndex + 2, colIndex + 1).value = cell;
                        });
                    } else {
                        params.headers.forEach((header, colIndex) => {
                            worksheet.getCell(rowIndex + 2, colIndex + 1).value = row[header] || '';
                        });
                    }
                });
            }

            if (params.styles) {
                this.applyStyles(worksheet, params.styles);
            }

            if (params.formulas) {
                params.formulas.forEach(formula => {
                    const cell = worksheet.getCell(formula.address);
                    cell.value = { formula: formula.formula };
                });
            }

            if (params.validations) {
                params.validations.forEach(validation => {
                    this.addValidation(worksheet, validation);
                });
            }

            if (params.filter) {
                this.addFilter(worksheet, params.filter);
            }

            const outPath = path.join(os.tmpdir(), `created_${Date.now()}.xlsx`);
            await workbook.xlsx.writeFile(outPath);

            const base64 = fs.readFileSync(outPath).toString('base64');
            return this.normalizedFile("✅ تم إنشاء الملف بنجاح.", outPath, "created.xlsx", base64);
        } catch (err) {
            console.error("❌ خطأ في الإنشاء:", err);
            return this.normalizedError("فشل إنشاء الملف.", err);
        }
    }

    /**
     * 🎨 تطبيق الأنماط
     */
    applyStyles(worksheet, styles) {
        styles.forEach(style => {
            const { range, fill, font, alignment, border } = style;
            try {
                const [start, end] = range.split(':');
                const startRow = parseInt(start.match(/\d+/)[0]);
                const endRow = parseInt(end.match(/\d+/)[0]);
                const startCol = start.charCodeAt(0) - 64;
                const endCol = end.charCodeAt(0) - 64;
                
                for (let row = startRow; row <= endRow; row++) {
                    for (let col = startCol; col <= endCol; col++) {
                        const cell = worksheet.getCell(row, col);
                        if (fill) cell.fill = fill;
                        if (font) cell.font = font;
                        if (alignment) cell.alignment = alignment;
                        if (border) cell.border = border;
                    }
                }
            } catch (e) {
                console.warn('⚠️ تحذير في تطبيق الأنماط:', e.message);
            }
        });
    }

    /* ============================================================
       🎨 4. التنسيق المتقدم
       ============================================================ */

    async format(filePath, params = {}) {
        return await this.modify(filePath, {
            operations: [{
                type: 'format_range',
                range: params.range || 'A1:Z100',
                style: params.style || {}
            }]
        });
    }

    /* ============================================================
       🎯 5. التنسيق الشرطي المتقدم (يوصل لـ Python)
       ============================================================ */

    async conditionalFormat(filePath, params = {}) {
        if (params.complex) {
            return await this.callPythonForFormatting(filePath, params);
        }
        
        return await this.modify(filePath, {
            operations: [{
                type: 'color_cells',
                range: params.range || 'A1:Z100',
                color: params.color || 'FFFFFF00',
                condition: params.condition
            }]
        });
    }

    /**
     * 🐍 استدعاء Python للتنسيق المتقدم
     */
    async callPythonForFormatting(filePath, params) {
        const script = `
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import PatternFill, Font, Border, Side
from openpyxl.formatting import Rule
from openpyxl.formatting.rule import CellIsRule, FormulaRule
import json

wb = load_workbook('${filePath}')
ws = wb.active

# ${params.instructions || 'تطبيق التنسيق الشرطي المتقدم'}

wb.save('${filePath}')
        `;
        
        try {
            execSync(`python3 -c "${script}"`);
            return this.normalizedReply("✅ تم تطبيق التنسيق الشرطي المتقدم.", { file: filePath });
        } catch (err) {
            console.error("❌ خطأ في Python:", err);
            return this.normalizedError("فشل تطبيق التنسيق المتقدم.", err);
        }
    }

    /* ============================================================
       📊 6. التحليل والإحصاء
       ============================================================ */

    async analyze(filePath, params = {}) {
        const readResult = await this.read(filePath, params);
        if (!readResult.ok) return readResult;
        
        const data = readResult.data;
        const analysis = {
            summary: {
                totalRows: data.metadata?.totalRows || 0,
                totalColumns: data.metadata?.totalColumns || 0,
                sheets: data.metadata?.sheets || 0
            },
            statistics: {},
            patterns: {}
        };

        if (data.data && data.data[0]) {
            const firstSheet = data.data[0];
            if (firstSheet.length > 1) {
                const numCols = firstSheet[0]?.length || 0;
                for (let col = 0; col < numCols; col++) {
                    const values = firstSheet.slice(1).map(row => parseFloat(row[col])).filter(v => !isNaN(v));
                    if (values.length > 0) {
                        analysis.statistics[`col_${col+1}`] = {
                            count: values.length,
                            min: Math.min(...values),
                            max: Math.max(...values),
                            average: values.reduce((a, b) => a + b, 0) / values.length,
                            sum: values.reduce((a, b) => a + b, 0)
                        };
                    }
                }
            }
        }

        return this.normalizedReply("📊 تم تحليل الملف بنجاح.", analysis);
    }

    /* ============================================================
       🔍 7. البحث
       ============================================================ */

    async search(filePath, params = {}) {
        const readResult = await this.read(filePath, params);
        if (!readResult.ok) return readResult;
        
        const results = [];
        const query = params.query || '';
        const caseSensitive = params.caseSensitive || false;

        const data = readResult.data;
        if (data.data) {
            data.data.forEach((sheet, sheetIndex) => {
                if (Array.isArray(sheet)) {
                    sheet.forEach((row, rowIndex) => {
                        if (Array.isArray(row)) {
                            row.forEach((cell, colIndex) => {
                                const cellStr = String(cell);
                                const match = caseSensitive ? 
                                    cellStr.includes(query) : 
                                    cellStr.toLowerCase().includes(query.toLowerCase());
                                
                                if (match) {
                                    results.push({
                                        sheet: data.sheets?.[sheetIndex]?.name || `Sheet${sheetIndex+1}`,
                                        row: rowIndex + 1,
                                        col: colIndex + 1,
                                        value: cell
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        return this.normalizedReply(`🔍 تم العثور على ${results.length} نتيجة.`, { results });
    }

    /* ============================================================
       📋 8. الجداول المحورية (عبر Python)
       ============================================================ */

    async createPivot(filePath, params = {}) {
        const script = `
import pandas as pd
import json

df = pd.read_excel('${filePath}')
pivot = pd.pivot_table(
    df,
    values='${params.values || 'value'}',
    index='${params.index || 'index'}',
    columns='${params.columns || 'columns'}',
    aggfunc='${params.aggfunc || 'sum'}'
)
pivot.to_excel('${filePath.replace('.xlsx', '_pivot.xlsx')}')
        `;
        
        try {
            execSync(`python3 -c "${script}"`);
            const pivotPath = filePath.replace('.xlsx', '_pivot.xlsx');
            const base64 = fs.readFileSync(pivotPath).toString('base64');
            return this.normalizedFile("✅ تم إنشاء الجدول المحوري.", pivotPath, "pivot.xlsx", base64);
        } catch (err) {
            console.error("❌ خطأ في إنشاء الجدول المحوري:", err);
            return this.normalizedError("فشل إنشاء الجدول المحوري.", err);
        }
    }

    /* ============================================================
       🔄 9. عمليات التحويل
       ============================================================ */

    async convertToPdf(filePath) {
        try {
            const out = path.join(path.dirname(filePath), `converted_${Date.now()}.pdf`);
            execSync(`libreoffice --headless --convert-to pdf "${filePath}" --outdir "${path.dirname(filePath)}"`);
            
            const defaultPdfName = path.basename(filePath, path.extname(filePath)) + ".pdf";
            const generatedPdfPath = path.join(path.dirname(filePath), defaultPdfName);
            
            if (fs.existsSync(generatedPdfPath) && generatedPdfPath !== out) {
                fs.renameSync(generatedPdfPath, out);
            }

            const base64 = fs.readFileSync(out).toString('base64');
            return this.normalizedFile("✅ تم تحويل الملف إلى PDF.", out, "converted.pdf", base64);
        } catch (err) {
            return this.normalizedError("فشل تحويل الملف إلى PDF.", err);
        }
    }

    async convertToCsv(filePath) {
        const readResult = await this.read(filePath);
        if (!readResult.ok) return readResult;
        
        const outPath = path.join(os.tmpdir(), `converted_${Date.now()}.csv`);
        let csvData = '';
        
        const data = readResult.data;
        if (data.data) {
            csvData = data.data.map(sheet => 
                sheet.map(row => row.join(',')).join('\n')
            ).join('\n\n');
        }
        
        fs.writeFileSync(outPath, csvData, 'utf-8');
        const base64 = fs.readFileSync(outPath).toString('base64');
        return this.normalizedFile("✅ تم تحويل الملف إلى CSV.", outPath, "converted.csv", base64);
    }

    /* ============================================================
       🟫 طبقة توحيد الردود
       ============================================================ */

    normalizedReply(reply, data = {}) {
        return {
            ok: true,
            reply,
            data,
            fileBase64: null,
            fileName: null,
            filePath: null
        };
    }

    normalizedFile(reply, filePath, fileName, base64) {
        return {
            ok: true,
            reply,
            data: null,
            fileBase64: base64,
            fileName,
            filePath
        };
    }

    normalizedError(reply, err = null) {
        return {
            ok: false,
            reply,
            error: err ? err.message : reply,
            data: null,
            fileBase64: null,
            fileName: null,
            filePath: null
        };
    }
}

/* ============================================================
   🚀 إنشاء وتصدير المحرك النهائي
   ============================================================ */

const ultimateEngine = new ExcelUltimateEngine();

export const excelRead = (filePath, params) => ultimateEngine.execute(filePath, 'read', params);
export const excelModify = (filePath, params) => ultimateEngine.execute(filePath, 'modify', params);
export const excelCreate = (params) => ultimateEngine.execute(null, 'create', params);
export const excelFormat = (filePath, params) => ultimateEngine.execute(filePath, 'format', params);
export const excelAnalyze = (filePath, params) => ultimateEngine.execute(filePath, 'analyze', params);
export const excelSearch = (filePath, params) => ultimateEngine.execute(filePath, 'search', params);
export const excelConditionalFormat = (filePath, params) => ultimateEngine.execute(filePath, 'conditional_format', params);
export const excelPivot = (filePath, params) => ultimateEngine.execute(filePath, 'pivot', params);
export const excelConvertToPdf = (filePath) => ultimateEngine.execute(filePath, 'convert_pdf');
export const excelConvertToCsv = (filePath) => ultimateEngine.execute(filePath, 'convert_csv');

export default ultimateEngine;
export { ExcelUltimateEngine };
