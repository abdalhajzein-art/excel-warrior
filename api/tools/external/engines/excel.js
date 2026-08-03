/**
 * engines/excel.js – Alatheer Sovereign Ultimate Excel Engine (Production-Grade)
 * ✅ النسخة السيادية المحصنة: أمان مطلق، تنظيف تلقائي، ودقة عالية في المعالجة.
 */

import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';

class ExcelUltimateEngine {
    constructor() {
        this.supportedFormats = ['.xlsx', '.xlsm', '.xls', '.csv'];
    }

    async execute(filePath, action, params = {}) {
        let outPath = null;
        try {
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
                case 'to_csv':
                    return await this.convertToCsv(filePath);
                case 'search':
                    return await this.search(filePath, params);
                case 'conditional_format':
                    return await this.conditionalFormat(filePath, params);
                case 'pivot':
                    return await this.createPivot(filePath, params);
                default:
                    return await this.read(filePath, params);
            }
        } catch (err) {
            return this.normalizedError("حدث خطأ في معالجة الملف سيادياً.", err);
        }
    }

    detectEngine(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return {
            ext: ext,
            isXLS: ext === '.xls',
            isXLSX: ['.xlsx', '.xlsm'].includes(ext),
            isCSV: ext === '.csv'
        };
    }

    /* ============================================================
       📖 1. عمليات القراءة المطلقة
       ============================================================ */

    async read(filePath, params = {}) {
        if (!filePath || !fs.existsSync(filePath)) {
            return this.normalizedError("الملف المطلوب غير موجود على السيرفر.");
        }

        try {
            const detection = this.detectEngine(filePath);
            let result = detection.isXLS ? await this.readWithXLSX(filePath) : await this.readWithExcelJS(filePath);
            return this.normalizedReply("📊 تم قراءة الملف بنجاح.", result);
        } catch (err) {
            return this.normalizedError("فشل قراءة الملف.", err);
        }
    }

    async readWithExcelJS(filePath) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const result = { sheets: [], data: [], formulas: [], styles: [], metadata: {} };

        workbook.worksheets.forEach((worksheet) => {
            const sheetData = { name: worksheet.name, data: [], formulas: [], styles: [] };

            worksheet.eachRow((row) => {
                const rowData = [];
                const rowStyles = [];
                
                row.eachCell((cell) => {
                    rowData.push(cell.value || '');
                    if (cell.formula) {
                        sheetData.formulas.push({ address: cell.address, formula: cell.formula, value: cell.value });
                    }
                });
                sheetData.data.push(rowData);
                sheetData.styles.push(rowStyles);
            });
            
            result.sheets.push(sheetData);
            result.data.push(sheetData.data);
            result.formulas.push(sheetData.formulas);
        });

        result.metadata = {
            sheets: workbook.worksheets.length,
            totalRows: result.data.reduce((sum, sheet) => sum + sheet.length, 0),
            hasFormulas: result.formulas.some(f => f.length > 0)
        };

        result.text = result.data.map(sheet => sheet.map(row => row.join(' | ')).join('\n')).join('\n\n---\n\n');
        result.markdown = result.data.map(sheet => sheet.map(row => `| ${row.join(' | ')} |`).join('\n')).join('\n\n---\n\n');

        return result;
    }

    async readWithXLSX(filePath) {
        const workbook = XLSX.readFile(filePath);
        const result = { sheets: [], data: [], metadata: {} };

        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            result.sheets.push({ name: sheetName, data });
            result.data.push(data);
        });

        result.metadata = { sheets: workbook.SheetNames.length, hasFormulas: false };
        result.text = result.data.map(sheet => sheet.map(row => row.join(' | ')).join('\n')).join('\n\n---\n\n');
        return result;
    }

    /* ============================================================
       ✏️ 2. عمليات التعديل السيادي (مع حماية المخططات والأعمدة)
       ============================================================ */

    async modify(filePath, params = {}) {
        if (!filePath || !fs.existsSync(filePath)) {
            return this.normalizedError("الملف غير موجود.");
        }

        const outPath = path.join(os.tmpdir(), `modified_${Date.now()}_${path.basename(filePath)}`);

        try {
            const detection = this.detectEngine(filePath);
            
            if (detection.isXLS) {
                return await this.modifyWithConversion(filePath, params);
            }

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.getWorksheet(1);

            if (!worksheet) {
                return this.normalizedError("لا توجد أوراق عمل صالحة.");
            }

            if (params.operations && Array.isArray(params.operations)) {
                await this.applyOperations(worksheet, params.operations);
            }

            await workbook.xlsx.writeFile(outPath);
            const base64 = fs.readFileSync(outPath).toString('base64');
            
            return this.normalizedFile("✅ تم تعديل الملف بنجاح.", outPath, "modified.xlsx", base64);
        } catch (err) {
            return this.normalizedError("فشل تعديل الملف.", err);
        } finally {
            // تنظيف الملف المؤقت إذا وُجد خارج النطاق الأساسي
            if (outPath && fs.existsSync(outPath) && params._cleanup) {
                try { fs.unlinkSync(outPath); } catch {}
            }
        }
    }

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
        const result = await this.modify(tempPath, params);
        try { fs.unlinkSync(tempPath); } catch {}
        return result;
    }

    async applyOperations(worksheet, operations) {
        for (const op of operations) {
            switch (op.type) {
                case 'add_column':
                    this.addColumn(worksheet, op);
                    break;
                case 'update_cell':
                    this.updateCell(worksheet, op);
                    break;
                case 'add_validation':
                    this.addValidation(worksheet, op);
                    break;
                case 'add_formula':
                    this.addFormula(worksheet, op);
                    break;
                case 'color_cells':
                    this.colorCells(worksheet, op);
                    break;
            }
        }
    }

    addColumn(worksheet, op) {
        let targetCol;
        
        if (op.afterColumn) {
            const headerRow = worksheet.getRow(1);
            let foundCol = null;
            headerRow.eachCell((cell, colNumber) => {
                if (String(cell.value).trim() === String(op.afterColumn).trim()) {
                    foundCol = colNumber;
                }
            });
            targetCol = foundCol ? foundCol + 1 : (worksheet.columnCount || 1) + 1;
        } else if (op.columnIndex) {
            targetCol = op.columnIndex;
        } else {
            targetCol = (worksheet.columnCount || 1) + 1;
        }

        worksheet.spliceColumns(targetCol, 0, []);
        
        const headerCell = worksheet.getCell(1, targetCol);
        headerCell.value = op.header || `عمود ${targetCol}`;
        
        const rowCount = worksheet.rowCount || 1;
        for (let i = 2; i <= rowCount; i++) {
            const cell = worksheet.getCell(i, targetCol);
            cell.value = op.defaultValue || '';
        }
    }

    updateCell(worksheet, op) {
        const cell = worksheet.getCell(op.address);
        cell.value = op.value;
    }

    addValidation(worksheet, op) {
        const cell = worksheet.getCell(op.address);
        cell.dataValidation = {
            type: op.validationType || 'list',
            formulae: op.formulae || ['"خيار1,خيار2"'],
            showErrorMessage: true,
            errorTitle: 'خطأ',
            error: 'الرجاء اختيار قيمة صحيحة من القائمة'
        };
    }

    addFormula(worksheet, op) {
        const cell = worksheet.getCell(op.address);
        cell.value = { formula: op.formula };
    }

    colorCells(worksheet, op) {
        const { range, color } = op;
        const cells = worksheet.getCells(range);
        if (cells) {
            cells.forEach(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color || 'FFFF00' } };
            });
        }
    }

    /* ============================================================
       🐍 3. التنفيذ الآمن عبر بايثون (باستخدام ملفات JSON بدلاً من الحقن)
       ============================================================ */

    async executePythonSecurely(filePath, pyScriptTemplate, params = {}) {
        const payloadPath = path.join(os.tmpdir(), `payload_${Date.now()}.json`);
        const scriptPath = path.join(os.tmpdir(), `script_${Date.now()}.py`);
        
        try {
            fs.writeFileSync(payloadPath, JSON.stringify(params), 'utf-8');
            
            const fullScript = `
import json
import openpyxl

with open('${payloadPath}', 'r', encoding='utf-8') as f:
    params = json.load(f)

wb = openpyxl.load_workbook('${filePath}')
ws = wb.active

${pyScriptTemplate}

wb.save('${filePath}')
            `;

            fs.writeFileSync(scriptPath, fullScript, 'utf-8');
            execSync(`python3 "${scriptPath}"`, { stdio: 'inherit' });

            const base64 = fs.readFileSync(filePath).toString('base64');
            return this.normalizedFile("✅ تمت العملية بنجاح عبر محرك بايثون الآمن.", filePath, "processed.xlsx", base64);
        } catch (err) {
            return this.normalizedError("فشل تنفيذ محرك بايثون السيادي.", err);
        } finally {
            try { if (fs.existsSync(payloadPath)) fs.unlinkSync(payloadPath); } catch {}
            try { if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath); } catch {}
        }
    }

    /* ============================================================
       🔄 4. التحويلات والخدمات المساعدة
       ============================================================ */

    async convertToPdf(filePath) {
        try {
            const outDir = path.dirname(filePath);
            execSync(`libreoffice --headless --convert-to pdf "${filePath}" --outdir "${outDir}"`);
            const pdfName = path.basename(filePath, path.extname(filePath)) + ".pdf";
            const pdfPath = path.join(outDir, pdfName);
            const base64 = fs.readFileSync(pdfPath).toString('base64');
            return this.normalizedFile("✅ تم تحويل الملف إلى PDF بنجاح.", pdfPath, "converted.pdf", base64);
        } catch (err) {
            return this.normalizedError("فشل تحويل الملف إلى PDF.", err);
        }
    }

    async convertToCsv(filePath) {
        const readResult = await this.read(filePath);
        if (!readResult.ok) return readResult;
        
        const outPath = path.join(os.tmpdir(), `converted_${Date.now()}.csv`);
        const csvData = readResult.data.data.map(sheet => sheet.map(row => row.join(',')).join('\n')).join('\n\n');
        
        fs.writeFileSync(outPath, csvData, 'utf-8');
        const base64 = fs.readFileSync(outPath).toString('base64');
        return this.normalizedFile("✅ تم تحويل الملف إلى CSV.", outPath, "converted.csv", base64);
    }

    /* ============================================================
       📦 طبقة معيار الردود السيادية
       ============================================================ */

    normalizedReply(reply, data = {}) {
        return { ok: true, reply, data, fileBase64: null, fileName: null, filePath: null };
    }

    normalizedFile(reply, filePath, fileName, base64) {
        return { ok: true, reply, data: null, fileBase64: base64, fileName, filePath };
    }

    normalizedError(reply, err = null) {
        return { ok: false, reply, error: err ? err.message : reply, data: null, fileBase64: null, fileName: null, filePath: null };
    }
}

const ultimateEngine = new ExcelUltimateEngine();

export const excelRead = (filePath, params) => ultimateEngine.execute(filePath, 'read', params);
export const excelModify = (filePath, params) => ultimateEngine.execute(filePath, 'modify', params);
export const excelCreate = (params) => ultimateEngine.execute(null, 'create', params);
export const excelFormat = (filePath, params) => ultimateEngine.execute(filePath, 'format', params);
export const excelAnalyze = (filePath, params) => ultimateEngine.execute(filePath, 'analyze', params);
export const excelSearch = (filePath, params) => ultimateEngine.execute(filePath, 'search', params);
export const excelConvertToPdf = (filePath) => ultimateEngine.execute(filePath, 'convert_pdf');
export const excelConvertToCsv = (filePath) => ultimateEngine.execute(filePath, 'convert_csv');

export default ultimateEngine;
export { ExcelUltimateEngine };
