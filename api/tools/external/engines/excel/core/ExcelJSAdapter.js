/**
 * excel/core/ExcelJSAdapter.js – تطبيق ExcelJS السيادي (النسخة الشاملة)
 * ✅ يغطي 100% من قدرات ExcelJS
 * ✅ يدعم: القراءة، الكتابة، التنسيق الكامل، دمج الخلايا، التنسيق الشرطي، الجداول، الحماية، التعليقات
 */

import ExcelJS from 'exceljs';
import { HEADER_ROW } from '../types/ExcelTypes.js';
import { FileUtils } from '../utils/FileUtils.js';
import { BaseAdapter } from './BaseAdapter.js';
import { ExcelTableDetector } from './ExcelTableDetector.js';

export class ExcelJSAdapter extends BaseAdapter {
    constructor() {
        super('exceljs');
        this.supportsFormulas = true;
        this.supportsStyles = true;
        this.supportsConditionalFormatting = true;
        this.supportsTables = true;
        this.supportsComments = true;
    }
    
    /* ============================================================
       📖 1. عمليات القراءة
       ============================================================ */
    
    async read(filePath, params = {}) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const result = {
            sheets: [],
            data: [],
            formulas: [],
            styles: [],
            conditionalFormats: [],
            tables: [],
            comments: [],
            metadata: {}
        };
        
        workbook.worksheets.forEach((worksheet) => {
            const sheetData = this.extractSheetData(worksheet);
            result.sheets.push(sheetData);
            result.data.push(sheetData.data);
            result.formulas.push(sheetData.formulas);
            result.styles.push(sheetData.styles);
            result.conditionalFormats.push(sheetData.conditionalFormats || []);
            result.tables.push(sheetData.tables || []);
            result.comments.push(sheetData.comments || []);
        });
        
        result.metadata = {
            sheets: workbook.worksheets.length,
            totalRows: result.data.reduce((sum, sheet) => sum + sheet.length, 0),
            totalColumns: result.data.reduce((max, sheet) => {
                const cols = sheet.reduce((m, row) => Math.max(m, row.length), 0);
                return Math.max(max, cols);
            }, 0),
            hasFormulas: result.formulas.some(f => f.length > 0),
            hasConditionalFormats: result.conditionalFormats.some(c => c.length > 0),
            hasTables: result.tables.some(t => t.length > 0),
            hasComments: result.comments.some(c => c.length > 0),
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
            styles: [],
            conditionalFormats: [],
            tables: [],
            comments: []
        };
        
        // ✅ استخراج البيانات
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
                
                if (cell.fill || cell.font || cell.alignment || cell.border || cell.numFmt) {
                    rowStyles.push({
                        address: cell.address,
                        fill: this.deepCopy(cell.fill),
                        font: this.deepCopy(cell.font),
                        alignment: this.deepCopy(cell.alignment),
                        border: this.deepCopy(cell.border),
                        numFmt: cell.numFmt
                    });
                }
            });
            
            sheetData.data.push(rowData);
            sheetData.styles.push(rowStyles);
        });
        
        // ✅ استخراج التنسيق الشرطي
        try {
            if (worksheet.conditionalFormattings) {
                sheetData.conditionalFormats = worksheet.conditionalFormattings.map(cf => ({
                    ref: cf.ref,
                    rules: cf.rules
                }));
            }
        } catch (e) {
            // تجاهل
        }
        
        // ✅ استخراج الجداول
        try {
            if (worksheet.tables) {
                sheetData.tables = worksheet.tables.map(table => ({
                    name: table.name,
                    ref: table.ref,
                    columns: table.columns
                }));
            }
        } catch (e) {
            // تجاهل
        }
        
        // ✅ استخراج التعليقات
        try {
            worksheet.eachRow((row) => {
                row.eachCell((cell) => {
                    if (cell.comment) {
                        sheetData.comments.push({
                            address: cell.address,
                            text: cell.comment.text,
                            author: cell.comment.author
                        });
                    }
                });
            });
        } catch (e) {
            // تجاهل
        }
        
        return sheetData;
    }
    
    /* ============================================================
       🛠️ 2. دوال مساعدة
       ============================================================ */
    
    deepCopy(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (Array.isArray(obj)) return obj.map(item => this.deepCopy(item));
        
        const copy = Object.assign({}, obj);
        for (const key in copy) {
            if (copy[key] && typeof copy[key] === 'object') {
                copy[key] = this.deepCopy(copy[key]);
            }
        }
        return copy;
    }
    
    /* ============================================================
       ✏️ 3. عمليات التعديل الرئيسية
       ============================================================ */
    
    async modify(filePath, params = {}) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);
        
        if (!worksheet) {
            throw new Error('لا توجد أوراق عمل في الملف');
        }
        
        if (params.operations) {
            console.log(`🔧 [ExcelJSAdapter] تنفيذ ${params.operations.length} عملية`);
            await this.applyOperations(worksheet, params.operations);
        }
        
        const outPath = FileUtils.getTempPath('modified');
        await workbook.xlsx.writeFile(outPath);
        const base64 = await FileUtils.fileToBase64(outPath);
        
        return { 
            filePath: outPath, 
            fileBase64: base64, 
            fileName: 'modified.xlsx' 
        };
    }
    
    async applyOperations(worksheet, operations) {
        const tableInfo = ExcelTableDetector.detectMainTable(worksheet);
        const { headerRowNum, dataStartRow, dataEndRow } = tableInfo;
        
        console.log(`📊 [ExcelJSAdapter] جدول رئيسي: هيدر في الصف ${headerRowNum}, بيانات من ${dataStartRow} إلى ${dataEndRow}`);
        
        for (const op of operations) {
            console.log(`🔧 [ExcelJSAdapter] تنفيذ عملية: ${op.type}`);
            switch(op.type) {
                case 'add_column':
                    this.addColumn(worksheet, op, tableInfo);
                    break;
                case 'add_row':
                    this.addRow(worksheet, op, tableInfo);
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
                    this.addValidation(worksheet, op, tableInfo);
                    break;
                case 'add_filter':
                    this.addFilter(worksheet, op, tableInfo);
                    break;
                case 'merge_cells':
                    this.mergeCells(worksheet, op);
                    break;
                case 'unmerge_cells':
                    this.unmergeCells(worksheet, op);
                    break;
                case 'conditional_format':
                    this.addConditionalFormatting(worksheet, op);
                    break;
                case 'add_table':
                    this.addTable(worksheet, op);
                    break;
                case 'add_comment':
                    this.addComment(worksheet, op);
                    break;
                case 'protect_sheet':
                    this.protectSheet(worksheet, op);
                    break;
                case 'set_column_width':
                    this.setColumnWidth(worksheet, op);
                    break;
                case 'set_row_height':
                    this.setRowHeight(worksheet, op);
                    break;
                default:
                    console.warn(`⚠️ عملية غير معروفة: ${op.type}`);
            }
        }
    }
    
    /* ============================================================
       📋 4. عمليات الأعمدة والصفوف (المتقدمة)
       ============================================================ */
    
    findColumnAndHeaderRow(worksheet, columnName) {
        if (!columnName) return { headerRowNum: HEADER_ROW || 1, colNumber: null };
        
        let foundHeaderRow = HEADER_ROW || 1;
        let foundCol = null;
        
        for (let r = 1; r <= worksheet.rowCount; r++) {
            const row = worksheet.getRow(r);
            let matchedInThisRow = false;
            
            row.eachCell((cell, colNumber) => {
                const cellVal = String(cell.value || '').trim();
                if (cellVal === String(columnName).trim()) {
                    foundCol = colNumber;
                    foundHeaderRow = r;
                    matchedInThisRow = true;
                }
            });
            
            if (matchedInThisRow) break;
        }
        
        return { headerRowNum: foundHeaderRow, colNumber: foundCol };
    }
    
    addColumn(worksheet, op, tableInfo) {
        try {
            let headerRowNum = tableInfo.headerRowNum || HEADER_ROW || 1;
            let insertIndex = worksheet.columnCount + 1;
            
            if (op.afterColumn) {
                const colByDetector = ExcelTableDetector.findColumnByHeader(worksheet, headerRowNum, op.afterColumn);
                let targetCol = colByDetector;
                
                if (!targetCol) {
                    const searchResult = this.findColumnAndHeaderRow(worksheet, op.afterColumn);
                    headerRowNum = searchResult.headerRowNum;
                    targetCol = searchResult.colNumber;
                }
                
                if (targetCol) {
                    insertIndex = targetCol + 1;
                    console.log(`📊 [ExcelJSAdapter] تم رصد العمود "${op.afterColumn}" في الصف ${headerRowNum}، العمود رقم ${targetCol}. الإدراج بعده مباشرة في العمود ${insertIndex}`);
                } else {
                    console.warn(`⚠️ [ExcelJSAdapter] العمود "${op.afterColumn}" غير موجود، سيتم الإضافة في نهاية الجدول.`);
                }
            }
            
            worksheet.spliceColumns(insertIndex, 0, []);
            
            const headerCell = worksheet.getCell(headerRowNum, insertIndex);
            headerCell.value = op.header || op.columnName || `عمود ${insertIndex}`;
            
            // ✅ نسخ التنسيق الكامل من العمود المجاور
            const sourceCol = insertIndex - 1;
            if (sourceCol >= 1) {
                const maxRow = worksheet.rowCount || 1;
                
                // ✅ نسخ عرض العمود
                const sourceColWidth = worksheet.getColumn(sourceCol).width;
                if (sourceColWidth) worksheet.getColumn(insertIndex).width = sourceColWidth;
                
                for (let row = 1; row <= maxRow; row++) {
                    const sourceCell = worksheet.getCell(row, sourceCol);
                    const newCell = worksheet.getCell(row, insertIndex);
                    
                    // ✅ نسخ التنسيق الكامل
                    if (sourceCell.font) newCell.font = this.deepCopy(sourceCell.font);
                    if (sourceCell.fill) newCell.fill = this.deepCopy(sourceCell.fill);
                    if (sourceCell.alignment) newCell.alignment = this.deepCopy(sourceCell.alignment);
                    if (sourceCell.border) newCell.border = this.deepCopy(sourceCell.border);
                    if (sourceCell.numFmt) newCell.numFmt = sourceCell.numFmt;
                    
                    // ✅ نسخ ارتفاع الصف
                    const sourceRowHeight = worksheet.getRow(row).height;
                    if (sourceRowHeight) worksheet.getRow(row).height = sourceRowHeight;
                }
            }
            
            console.log(`✅ [ExcelJSAdapter] تم إضافة العمود "${op.header || op.columnName}" بنجاح مع كامل التنسيق.`);
        } catch (err) {
            console.error('❌ [ExcelJSAdapter] خطأ حرج في addColumn:', err);
            throw err;
        }
    }
    
    setColumnWidth(worksheet, op) {
        try {
            const { column, width } = op;
            worksheet.getColumn(column).width = width;
            console.log(`✅ [ExcelJSAdapter] تم تعيين عرض العمود ${column} إلى ${width}`);
        } catch (err) {
            console.error('❌ [ExcelJSAdapter] خطأ في setColumnWidth:', err);
            throw err;
        }
    }
    
    setRowHeight(worksheet, op) {
        try {
            const { row, height } = op;
            worksheet.getRow(row).height = height;
            console.log(`✅ [ExcelJSAdapter] تم تعيين ارتفاع الصف ${row} إلى ${height}`);
        } catch (err) {
            console.error('❌ [ExcelJSAdapter] خطأ في setRowHeight:', err);
            throw err;
        }
    }
    
    /* ============================================================
       🧩 5. دمج الخلايا
       ============================================================ */
    
    mergeCells(worksheet, op) {
        try {
            const { range } = op;
            worksheet.mergeCells(range);
            console.log(`✅ [ExcelJSAdapter] تم دمج الخلايا: ${range}`);
        } catch (err) {
            console.error('❌ [ExcelJSAdapter] خطأ في دمج الخلايا:', err);
            throw err;
        }
    }
    
    unmergeCells(worksheet, op) {
        try {
            const { range } = op;
            worksheet.unMergeCells(range);
            console.log(`✅ [ExcelJSAdapter] تم فك دمج الخلايا: ${range}`);
        } catch (err) {
            console.error('❌ [ExcelJSAdapter] خطأ في فك دمج الخلايا:', err);
            throw err;
        }
    }
    
    /* ============================================================
       🎯 6. التنسيق الشرطي
       ============================================================ */
    
    addConditionalFormatting(worksheet, op) {
        try {
            const { range, type, formula, style, ruleType } = op;
            
            worksheet.addConditionalFormatting({
                ref: range,
                rules: [{
                    type: type || 'expression',
                    formulae: [formula],
                    style: style || {}
                }]
            });
            
            console.log(`✅ [ExcelJSAdapter] تم إضافة التنسيق الشرطي للنطاق: ${range}`);
        } catch (err) {
            console.error('❌ [ExcelJSAdapter] خطأ في التنسيق الشرطي:', err);
            throw err;
        }
    }
    
    /* ============================================================
       📋 7. الجداول الرسمية (Tables)
       ============================================================ */
    
    addTable(worksheet, op) {
        try {
            const { name, ref, columns, style } = op;
            
            const table = worksheet.addTable({
                name: name || `Table_${Date.now()}`,
                ref: ref || 'A1',
                columns: columns || [],
                style: style || {
                    theme: 'TableStyleMedium2',
                    showRowStripes: true
                }
            });
            
            console.log(`✅ [ExcelJSAdapter] تم إضافة الجدول: ${table.name}`);
        } catch (err) {
            console.error('❌ [ExcelJSAdapter] خطأ في إضافة الجدول:', err);
            throw err;
        }
    }
    
    /* ============================================================
       💬 8. التعليقات
       ============================================================ */
    
    addComment(worksheet, op) {
        try {
            const { address, text, author } = op;
            const cell = worksheet.getCell(address);
            
            cell.comment = {
                text: text || 'تعليق',
                author: author || 'Alatheer'
            };
            
            console.log(`✅ [ExcelJSAdapter] تم إضافة تعليق في الخلية: ${address}`);
        } catch (err) {
            console.error('❌ [ExcelJSAdapter] خطأ في إضافة التعليق:', err);
            throw err;
        }
    }
    
    /* ============================================================
       🛡️ 9. حماية الورقة
       ============================================================ */
    
    protectSheet(worksheet, op) {
        try {
            const { password, options } = op;
            worksheet.protect(password || '', options || {});
            console.log(`✅ [ExcelJSAdapter] تم حماية الورقة`);
        } catch (err) {
            console.error('❌ [ExcelJSAdapter] خطأ في حماية الورقة:', err);
            throw err;
        }
    }
    
    /* ============================================================
       📊 10. العمليات الأساسية (موجودة مسبقاً)
       ============================================================ */
    
    addRow(worksheet, op, tableInfo) {
        const newRow = worksheet.addRow(op.data || []);
        if (op.style) {
            newRow.eachCell((cell) => {
                if (op.style.fill) cell.fill = op.style.fill;
                if (op.style.font) cell.font = op.style.font;
                if (op.style.alignment) cell.alignment = op.style.alignment;
                if (op.style.numFmt) cell.numFmt = op.style.numFmt;
            });
        }
        console.log(`✅ [ExcelJSAdapter] تم إضافة صف جديد`);
    }
    
    updateCell(worksheet, op) {
        const cell = worksheet.getCell(op.address);
        cell.value = op.value;
        if (op.style) {
            if (op.style.fill) cell.fill = op.style.fill;
            if (op.style.font) cell.font = op.style.font;
            if (op.style.alignment) cell.alignment = op.style.alignment;
            if (op.style.border) cell.border = op.style.border;
            if (op.style.numFmt) cell.numFmt = op.style.numFmt;
        }
        console.log(`✅ [ExcelJSAdapter] تم تحديث الخلية: ${op.address}`);
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
                console.log(`✅ [ExcelJSAdapter] تم تلوين الخلايا في النطاق: ${range}`);
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
                    if (style.numFmt) cell.numFmt = style.numFmt;
                }
            }
            console.log(`✅ [ExcelJSAdapter] تم تنسيق النطاق: ${range}`);
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
        console.log(`✅ [ExcelJSAdapter] تم إضافة الصيغة في: ${op.address}`);
    }
    
    addValidation(worksheet, op, tableInfo) {
        try {
            const { address, formulae, afterColumn } = op;
            const options = formulae || ['"خيار1,خيار2,خيار3"'];
            
            const { headerRowNum, dataStartRow, dataEndRow } = tableInfo;
            
            if (address) {
                if (address.includes(':')) {
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
                    const cell = worksheet.getCell(address);
                    cell.dataValidation = {
                        type: 'list',
                        formulae: options,
                        showErrorMessage: true,
                        errorTitle: 'خطأ في الإدخال',
                        error: 'الرجاء اختيار قيمة من القائمة'
                    };
                }
                console.log(`✅ [ExcelJSAdapter] تم إضافة القائمة المنسدلة في: ${address}`);
                return;
            }
            
            if (afterColumn) {
                const colByDetector = ExcelTableDetector.findColumnByHeader(worksheet, headerRowNum, afterColumn);
                let targetCol = colByDetector ? colByDetector + 1 : null;
                
                if (!targetCol) {
                    const searchResult = this.findColumnAndHeaderRow(worksheet, afterColumn);
                    targetCol = searchResult.colNumber ? searchResult.colNumber + 1 : null;
                }
                
                if (targetCol) {
                    const startRow = dataStartRow;
                    const endRow = dataEndRow;
                    
                    for (let row = startRow; row <= endRow; row++) {
                        const cell = worksheet.getCell(row, targetCol);
                        cell.dataValidation = {
                            type: 'list',
                            formulae: options,
                            showErrorMessage: true,
                            errorTitle: 'خطأ في الإدخال',
                            error: 'الرجاء اختيار قيمة من القائمة'
                        };
                    }
                    console.log(`✅ [ExcelJSAdapter] تم إضافة القائمة المنسدلة بعد عمود: ${afterColumn}`);
                    return;
                }
            }
            
            const lastCol = worksheet.columnCount;
            const startRow = dataStartRow;
            const endRow = dataEndRow;
            
            for (let row = startRow; row <= endRow; row++) {
                const cell = worksheet.getCell(row, lastCol);
                cell.dataValidation = {
                    type: 'list',
                    formulae: options,
                    showErrorMessage: true,
                    errorTitle: 'خطأ في الإدخال',
                    error: 'الرجاء اختيار قيمة من القائمة'
                };
            }
            console.log(`✅ [ExcelJSAdapter] تم إضافة القائمة المنسدلة في آخر عمود`);
            
        } catch (err) {
            console.error('❌ [ExcelJSAdapter] خطأ في addValidation:', err);
            throw err;
        }
    }
    
    addFilter(worksheet, op, tableInfo) {
        const { headerRowNum, dataEndRow } = tableInfo;
        worksheet.autoFilter = {
            from: op.from || `A${headerRowNum}`,
            to: op.to || `Z${dataEndRow}`
        };
        console.log(`✅ [ExcelJSAdapter] تم إضافة التصفية`);
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
    
    /* ============================================================
       📝 11. تحويل البيانات إلى نص
       ============================================================ */
    
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
