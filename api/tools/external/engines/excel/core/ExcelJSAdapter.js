/**
 * excel/core/ExcelJSAdapter.js – تطبيق ExcelJS
 */

import ExcelJS from 'exceljs';
import { HEADER_ROW } from '../types/ExcelTypes.js';
import { FileUtils } from '../utils/FileUtils.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { BaseAdapter } from './BaseAdapter.js';

export class ExcelJSAdapter extends BaseAdapter {
    constructor() {
        super('exceljs');
        this.supportsFormulas = true;
        this.supportsStyles = true;
    }
    
    async read(filePath, params = {}) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const result = {
            sheets: [],
            data: [],
            formulas: [],
            styles: [],
            metadata: {}
        };
        
        workbook.worksheets.forEach((worksheet) => {
            const sheetData = this.extractSheetData(worksheet);
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
        
        result.text = this.dataToText(result.data);
        result.markdown = this.dataToMarkdown(result.data);
        
        return result;
    }
    
    extractSheetData(worksheet) {
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
                        fill: this.deepCopy(cell.fill),
                        font: this.deepCopy(cell.font),
                        alignment: this.deepCopy(cell.alignment),
                        border: this.deepCopy(cell.border)
                    });
                }
            });
            
            sheetData.data.push(rowData);
            sheetData.styles.push(rowStyles);
        });
        
        return sheetData;
    }
    
    deepCopy(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (Array.isArray(obj)) return obj.map(item => this.deepCopy(item));
        
        // نسخ آمن باستخدام Object.assign
        const copy = Object.assign({}, obj);
        for (const key in copy) {
            if (copy[key] && typeof copy[key] === 'object') {
                copy[key] = this.deepCopy(copy[key]);
            }
        }
        return copy;
    }
    
    async modify(filePath, params = {}) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);
        
        if (!worksheet) {
            throw new Error('لا توجد أوراق عمل');
        }
        
        if (params.operations) {
            await this.applyOperations(worksheet, params.operations);
        }
        
        const outPath = FileUtils.getTempPath('modified');
        await workbook.xlsx.writeFile(outPath);
        const base64 = await FileUtils.fileToBase64(outPath);
        
        return { outPath, base64 };
    }
    
    async applyOperations(worksheet, operations) {
        for (const op of operations) {
            switch(op.type) {
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
                default:
                    console.warn(`⚠️ عملية غير معروفة: ${op.type}`);
            }
        }
    }
    
    addColumn(worksheet, op) {
        let insertIndex = worksheet.columnCount + 1;
        
        if (op.afterColumn) {
            const headerRow = worksheet.getRow(HEADER_ROW);
            let foundCol = null;
            
            headerRow.eachCell((cell, colNumber) => {
                if (String(cell.value || '').trim() === String(op.afterColumn).trim()) {
                    foundCol = colNumber;
                }
            });
            
            if (foundCol) {
                insertIndex = foundCol + 1;
            }
        }
        
        worksheet.insertColumns(insertIndex, 1);
        
        const headerCell = worksheet.getCell(HEADER_ROW, insertIndex);
        headerCell.value = op.header || `عمود ${insertIndex}`;
        
        // نسخ التنسيق من العمود المجاور
        const sourceCol = insertIndex - 1;
        if (sourceCol >= 1) {
            for (let row = 1; row <= worksheet.rowCount; row++) {
                const sourceCell = worksheet.getCell(row, sourceCol);
                const newCell = worksheet.getCell(row, insertIndex);
                
                if (sourceCell.font) {
                    newCell.font = this.deepCopy(sourceCell.font);
                }
                if (sourceCell.fill) {
                    newCell.fill = this.deepCopy(sourceCell.fill);
                }
                if (sourceCell.alignment) {
                    newCell.alignment = this.deepCopy(sourceCell.alignment);
                }
                if (sourceCell.border) {
                    newCell.border = this.deepCopy(sourceCell.border);
                }
            }
        }
    }
    
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
    
    updateCell(worksheet, op) {
        const cell = worksheet.getCell(op.address);
        cell.value = op.value;
        if (op.style) {
            if (op.style.fill) cell.fill = op.style.fill;
            if (op.style.font) cell.font = op.style.font;
            if (op.style.alignment) cell.alignment = op.style.alignment;
        }
    }
    
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
    
    addFormula(worksheet, op) {
        const cell = worksheet.getCell(op.address);
        cell.value = { formula: op.formula };
        if (op.style) {
            if (op.style.fill) cell.fill = op.style.fill;
            if (op.style.font) cell.font = op.style.font;
        }
    }
    
    addValidation(worksheet, op) {
        const { address, formulae } = op;
        const options = formulae || ['"إجازة مرضية,عذر رسمي,غياب بدون إذن,ظرف طارئ"'];
        
        if (address && address.includes(':')) {
            const [start, end] = address.split(':');
            const startRow = parseInt(start.match(/\d+/)[0]);
            const endRow = parseInt(end.match(/\d+/)[0]);
            const startCol = start.charCodeAt(0) - 64;
            const endCol = end.charCodeAt(0) - 64;
            
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    const cell = worksheet.getCell(row, col);
                    cell.dataValidation = {
                        type: 'list',
                        formulae: options,
                        showErrorMessage: true,
                        errorTitle: 'خطأ في الإدخال',
                        error: 'الرجاء اختيار قيمة من القائمة'
                    };
                }
            }
        } else {
            const cell = worksheet.getCell(address || 'A1');
            cell.dataValidation = {
                type: 'list',
                formulae: options,
                showErrorMessage: true,
                errorTitle: 'خطأ في الإدخال',
                error: 'الرجاء اختيار قيمة من القائمة'
            };
        }
    }
    
    addFilter(worksheet, op) {
        worksheet.autoFilter = {
            from: op.from || 'A1',
            to: op.to || 'Z100'
        };
    }
    
    evaluateCondition(value, condition) {
        if (!condition) return true;
        try {
            const parts = condition.split(' ');
            if (parts.length !== 2) return false;
            const [operator, threshold] = parts;
            const numValue = parseFloat(value);
            const numThreshold = parseFloat(threshold);
            
            if (isNaN(numValue) || isNaN(numThreshold)) {
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
    
    dataToText(data) {
        return data.map(sheet => 
            sheet.map(row => row.join(' | ')).join('\n')
        ).join('\n\n---\n\n');
    }
    
    dataToMarkdown(data) {
        return data.map(sheet =>
            sheet.map(row => `| ${row.join(' | ')} |`).join('\n')
        ).join('\n\n---\n\n');
    }
}
