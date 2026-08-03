/**
 * excel/core/XLSXAdapter.js – تطبيق XLSX (للملفات القديمة)
 */

import XLSX from 'xlsx';
import { BaseAdapter } from './BaseAdapter.js';
import { FileUtils } from '../utils/FileUtils.js';

export class XLSXAdapter extends BaseAdapter {
    constructor() {
        super('xlsx');
        this.supportsFormulas = false;
        this.supportsStyles = false;
    }
    
    async read(filePath, params = {}) {
        const workbook = XLSX.readFile(filePath);
        const result = {
            sheets: [],
            data: [],
            metadata: {}
        };
        
        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            result.sheets.push({ name: sheetName, data });
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
        
        result.text = this.dataToText(result.data);
        result.markdown = this.dataToMarkdown(result.data);
        
        return result;
    }
    
    async modify(filePath, params = {}) {
        // XLSX لا تدعم التعديل المتقدم، نمرر إلى ExcelJS
        throw new Error('XLSX لا تدعم التعديل، استخدم ExcelJS');
    }
}
