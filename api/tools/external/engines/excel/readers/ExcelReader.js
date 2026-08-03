/**
 * excel/readers/ExcelReader.js – القراءة السيادية المتقدمة
 * 🔥 تدعم: صيغ، تنسيق، ميتاداتا، تحليل أولي
 */

import { ErrorHandler } from '../utils/ErrorHandler.js';
import { MAX_TEXT_LENGTH } from '../types/ExcelTypes.js';

export class ExcelReader {
    constructor(adapter) {
        this.adapter = adapter;
    }
    
    /**
     * 📖 قراءة كاملة للملف
     */
    async readFull(filePath, params = {}) {
        return ErrorHandler.execute('readFull', async () => {
            const data = await this.adapter.read(filePath, params);
            
            // ✅ تحليل أولي
            const analysis = this.initialAnalysis(data);
            
            return {
                ...data,
                analysis,
                summary: this.generateSummary(data)
            };
        }, { filePath });
    }
    
    /**
     * 📊 قراءة سريعة (بدون صيغ وتنسيق)
     */
    async readFast(filePath, params = {}) {
        return ErrorHandler.execute('readFast', async () => {
            // استخدام XLSX للسرعة
            const XLSXAdapter = (await import('../core/XLSXAdapter.js')).XLSXAdapter;
            const fastAdapter = new XLSXAdapter();
            return await fastAdapter.read(filePath, params);
        }, { filePath });
    }
    
    /**
     * 🔍 قراءة ميتاداتا فقط
     */
    async readMetadata(filePath) {
        return ErrorHandler.execute('readMetadata', async () => {
            const data = await this.adapter.read(filePath);
            return {
                sheets: data.metadata.sheets,
                totalRows: data.metadata.totalRows,
                totalColumns: data.metadata.totalColumns,
                hasFormulas: data.metadata.hasFormulas,
                engines: data.metadata.engines
            };
        }, { filePath });
    }
    
    /**
     * 🎯 قراءة نطاق محدد
     */
    async readRange(filePath, range, params = {}) {
        return ErrorHandler.execute('readRange', async () => {
            const data = await this.adapter.read(filePath, params);
            // استخراج النطاق المطلوب
            return this.extractRange(data, range);
        }, { filePath, range });
    }
    
    /**
     * 📋 قراءة أوراق محددة
     */
    async readSheets(filePath, sheetNames, params = {}) {
        return ErrorHandler.execute('readSheets', async () => {
            const data = await this.adapter.read(filePath, params);
            const filteredSheets = data.sheets.filter(s => sheetNames.includes(s.name));
            return {
                ...data,
                sheets: filteredSheets,
                data: filteredSheets.map(s => s.data)
            };
        }, { filePath, sheetNames });
    }
    
    /**
     * 📈 تحليل أولي للبيانات
     */
    initialAnalysis(data) {
        const analysis = {
            dataTypes: {},
            nullCounts: {},
            uniqueCounts: {},
            suggestions: []
        };
        
        if (data.data && data.data[0] && data.data[0].length > 0) {
            const firstSheet = data.data[0];
            if (firstSheet.length > 1) {
                const headers = firstSheet[0] || [];
                
                headers.forEach((header, index) => {
                    const columnData = firstSheet.slice(1).map(row => row[index]);
                    const nonEmpty = columnData.filter(v => v !== null && v !== undefined && v !== '');
                    
                    analysis.dataTypes[header] = this.detectColumnType(columnData);
                    analysis.nullCounts[header] = columnData.length - nonEmpty.length;
                    analysis.uniqueCounts[header] = new Set(nonEmpty).size;
                    
                    // اقتراحات ذكية
                    if (analysis.nullCounts[header] > columnData.length * 0.3) {
                        analysis.suggestions.push(`🔍 العمود "${header}" به ${analysis.nullCounts[header]} خلايا فارغة (${Math.round(analysis.nullCounts[header]/columnData.length*100)}%)`);
                    }
                    
                    if (analysis.uniqueCounts[header] <= 10 && analysis.uniqueCounts[header] > 1) {
                        analysis.suggestions.push(`📋 العمود "${header}" يحتوي على ${analysis.uniqueCounts[header]} قيم فريدة (قد يكون مناسباً لقائمة منسدلة)`);
                    }
                });
            }
        }
        
        return analysis;
    }
    
    /**
     * 🔍 كشف نوع العمود
     */
    detectColumnType(data) {
        const nonEmpty = data.filter(v => v !== null && v !== undefined && v !== '');
        if (nonEmpty.length === 0) return 'empty';
        
        // تحقق من الأرقام
        const numbers = nonEmpty.map(v => parseFloat(v)).filter(v => !isNaN(v));
        if (numbers.length === nonEmpty.length) return 'number';
        
        // تحقق من التواريخ
        const dates = nonEmpty.map(v => new Date(v)).filter(v => !isNaN(v));
        if (dates.length === nonEmpty.length) return 'date';
        
        // تحقق من البوليان
        const bools = nonEmpty.map(v => ['نعم', 'لا', 'true', 'false', 'TRUE', 'FALSE'].includes(String(v)));
        if (bools.every(b => b === true)) return 'boolean';
        
        return 'text';
    }
    
    /**
     * 📊 توليد ملخص
     */
    generateSummary(data) {
        const summary = [];
        summary.push(`📊 **ملخص الملف:**`);
        summary.push(`- عدد الأوراق: ${data.metadata.sheets}`);
        summary.push(`- إجمالي الصفوف: ${data.metadata.totalRows}`);
        summary.push(`- إجمالي الأعمدة: ${data.metadata.totalColumns}`);
        summary.push(`- يحتوي على صيغ: ${data.metadata.hasFormulas ? 'نعم ✅' : 'لا ❌'}`);
        
        if (data.analysis && data.analysis.suggestions.length > 0) {
            summary.push(`\n💡 **اقتراحات:**`);
            data.analysis.suggestions.forEach(s => summary.push(`- ${s}`));
        }
        
        return summary.join('\n');
    }
    
    /**
     * 📐 استخراج نطاق محدد
     */
    extractRange(data, range) {
        // تنفيذ استخراج النطاق
        const [start, end] = range.split(':');
        const startRow = parseInt(start.match(/\d+/)[0]);
        const endRow = parseInt(end.match(/\d+/)[0]);
        const startCol = start.charCodeAt(0) - 64;
        const endCol = end.charCodeAt(0) - 64;
        
        const extracted = [];
        for (let row = startRow - 1; row < endRow; row++) {
            const rowData = [];
            for (let col = startCol - 1; col < endCol; col++) {
                rowData.push(data.data[0][row]?.[col] || '');
            }
            extracted.push(rowData);
        }
        
        return extracted;
    }
}
