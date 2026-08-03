/**
 * excel/formatters/ExcelFormatter.js – التنسيق التلقائي السيادي المتقدم
 * 🔥 يدعم: تنسيق تلقائي للجداول، أنماط مدمجة، تنسيق شرطي تلقائي، تنسيق حسب النوع
 */

import { ErrorHandler } from '../utils/ErrorHandler.js';
import { HEADER_ROW } from '../types/ExcelTypes.js';

export class ExcelFormatter {
    constructor(adapter) {
        this.adapter = adapter;
    }

    /**
     * 🎨 تنسيق تلقائي كامل
     */
    async autoFormat(filePath, params = {}) {
        return ErrorHandler.execute('autoFormat', async () => {
            const data = await this.adapter.read(filePath, params);
            const operations = [];
            
            // ✅ 1. تنسيق الجدول كاملاً
            operations.push(...this.formatTable(data));
            
            // ✅ 2. تنسيق الرؤوس
            operations.push(...this.formatHeaders(data));
            
            // ✅ 3. تنسيق حسب نوع البيانات
            operations.push(...this.formatByType(data));
            
            // ✅ 4. تنسيق الأرقام
            operations.push(...this.formatNumbers(data));
            
            // ✅ 5. تنسيق التواريخ
            operations.push(...this.formatDates(data));
            
            // ✅ 6. تنسيق شرطي تلقائي
            operations.push(...this.autoConditionalFormat(data));
            
            // ✅ 7. إضافة فلاتر
            operations.push({ type: 'add_filter', from: 'A1', to: `Z${data.metadata.totalRows + 1}` });
            
            // ✅ تنفيذ التنسيق
            const result = await this.adapter.modify(filePath, { operations });
            
            return {
                ...result,
                summary: this.generateFormatSummary(operations),
                operationsApplied: operations.length
            };
        }, { filePath });
    }

    /**
     * 📋 تنسيق الجدول
     */
    formatTable(data) {
        const operations = [];
        const totalRows = data.metadata.totalRows || 10;
        const totalCols = data.metadata.totalColumns || 10;
        const lastCol = String.fromCharCode(64 + totalCols);
        
        // ✅ حدود الجدول
        operations.push({
            type: 'format_range',
            range: `A1:${lastCol}${totalRows + 1}`,
            style: {
                border: {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                }
            }
        });
        
        // ✅ تنسيق الصفوف المتناوبة
        for (let row = 2; row <= totalRows + 1; row += 2) {
            operations.push({
                type: 'format_range',
                range: `A${row}:${lastCol}${row}`,
                style: {
                    fill: {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF5F5F5' } // رمادي فاتح
                    }
                }
            });
        }
        
        return operations;
    }

    /**
     * 📋 تنسيق الرؤوس
     */
    formatHeaders(data) {
        const operations = [];
        const totalCols = data.metadata.totalColumns || 10;
        const lastCol = String.fromCharCode(64 + totalCols);
        
        // ✅ تنسيق الرؤوس (الصف الأول)
        operations.push({
            type: 'format_range',
            range: `A1:${lastCol}1`,
            style: {
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4F81BD' } // أزرق داكن
                },
                font: {
                    bold: true,
                    color: { argb: 'FFFFFFFF' },
                    size: 12
                },
                alignment: {
                    horizontal: 'center',
                    vertical: 'middle'
                }
            }
        });
        
        return operations;
    }

    /**
     * 📋 تنسيق حسب نوع البيانات
     */
    formatByType(data) {
        const operations = [];
        if (!data.data || !data.data[0]) return operations;
        
        const firstSheet = data.data[0];
        if (firstSheet.length < 2) return operations;
        
        const headers = firstSheet[0] || [];
        const dataRows = firstSheet.slice(1);
        
        headers.forEach((header, index) => {
            const col = index + 1;
            const colLetter = String.fromCharCode(64 + col);
            const colData = dataRows.map(row => row[index]).filter(v => v !== null && v !== undefined);
            
            // ✅ كشف نوع البيانات
            const type = this.detectColumnType(colData);
            
            switch(type) {
                case 'number':
                    // ✅ محاذاة للأرقام: يمين
                    operations.push({
                        type: 'format_range',
                        range: `${colLetter}2:${colLetter}${dataRows.length + 1}`,
                        style: {
                            alignment: { horizontal: 'right' }
                        }
                    });
                    break;
                    
                case 'date':
                    // ✅ محاذاة للتواريخ: وسط
                    operations.push({
                        type: 'format_range',
                        range: `${colLetter}2:${colLetter}${dataRows.length + 1}`,
                        style: {
                            alignment: { horizontal: 'center' }
                        }
                    });
                    break;
                    
                case 'text':
                    // ✅ محاذاة للنصوص: يسار
                    operations.push({
                        type: 'format_range',
                        range: `${colLetter}2:${colLetter}${dataRows.length + 1}`,
                        style: {
                            alignment: { horizontal: 'left' }
                        }
                    });
                    break;
            }
        });
        
        return operations;
    }

    /**
     * 📋 تنسيق الأرقام
     */
    formatNumbers(data) {
        const operations = [];
        if (!data.data || !data.data[0]) return operations;
        
        const firstSheet = data.data[0];
        if (firstSheet.length < 2) return operations;
        
        const headers = firstSheet[0] || [];
        const dataRows = firstSheet.slice(1);
        
        headers.forEach((header, index) => {
            const col = index + 1;
            const colLetter = String.fromCharCode(64 + col);
            const colData = dataRows.map(row => row[index]).filter(v => v !== null && v !== undefined);
            
            // ✅ كشف الأعمدة الرقمية
            const numericValues = colData.map(v => parseFloat(v)).filter(v => !isNaN(v));
            if (numericValues.length === colData.length) {
                // ✅ تنسيق الأرقام بفاصلات
                // ملاحظة: ExcelJS لا يدعم تنسيق الأرقام مباشرة،
                // نضيف تلميحاً للتنسيق في المستقبل
                operations.push({
                    type: 'format_range',
                    range: `${colLetter}2:${colLetter}${dataRows.length + 1}`,
                    style: {
                        alignment: { horizontal: 'right' }
                    }
                });
            }
        });
        
        return operations;
    }

    /**
     * 📋 تنسيق التواريخ
     */
    formatDates(data) {
        const operations = [];
        if (!data.data || !data.data[0]) return operations;
        
        const firstSheet = data.data[0];
        if (firstSheet.length < 2) return operations;
        
        const headers = firstSheet[0] || [];
        const dataRows = firstSheet.slice(1);
        
        headers.forEach((header, index) => {
            const col = index + 1;
            const colLetter = String.fromCharCode(64 + col);
            const colData = dataRows.map(row => row[index]).filter(v => v !== null && v !== undefined);
            
            // ✅ كشف التواريخ
            const dates = colData.map(v => new Date(v)).filter(v => !isNaN(v));
            if (dates.length === colData.length) {
                operations.push({
                    type: 'format_range',
                    range: `${colLetter}2:${colLetter}${dataRows.length + 1}`,
                    style: {
                        alignment: { horizontal: 'center' }
                    }
                });
            }
        });
        
        return operations;
    }

    /**
     * 🎯 تنسيق شرطي تلقائي
     */
    autoConditionalFormat(data) {
        const operations = [];
        if (!data.data || !data.data[0]) return operations;
        
        const firstSheet = data.data[0];
        if (firstSheet.length < 2) return operations;
        
        const headers = firstSheet[0] || [];
        const dataRows = firstSheet.slice(1);
        
        headers.forEach((header, index) => {
            const col = index + 1;
            const colLetter = String.fromCharCode(64 + col);
            const colData = dataRows.map(row => row[index]).filter(v => v !== null && v !== undefined);
            
            // ✅ كشف الأعمدة الرقمية للتنسيق الشرطي
            const numericValues = colData.map(v => parseFloat(v)).filter(v => !isNaN(v));
            if (numericValues.length === colData.length && numericValues.length > 0) {
                const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
                
                // ✅ تلوين القيم الأعلى من المتوسط
                operations.push({
                    type: 'color_cells',
                    range: `${colLetter}2:${colLetter}${dataRows.length + 1}`,
                    color: 'FF00FF00', // أخضر
                    condition: `> ${avg}`
                });
                
                // ✅ تلوين القيم الأقل من المتوسط
                operations.push({
                    type: 'color_cells',
                    range: `${colLetter}2:${colLetter}${dataRows.length + 1}`,
                    color: 'FFFF0000', // أحمر
                    condition: `< ${avg}`
                });
            }
        });
        
        return operations;
    }

    /**
     * 🎨 تطبيق قالب تنسيق مدمج
     */
    async applyTemplate(filePath, templateName, params = {}) {
        return ErrorHandler.execute('applyTemplate', async () => {
            const templates = this.getTemplates();
            const template = templates[templateName];
            
            if (!template) {
                throw new Error(`القالب "${templateName}" غير موجود`);
            }
            
            const operations = template(params);
            const result = await this.adapter.modify(filePath, { operations });
            
            return {
                ...result,
                template: templateName,
                summary: `✅ تم تطبيق قالب "${templateName}"`
            };
        }, { filePath, templateName });
    }

    /**
     * 📚 القوالب المدمجة
     */
    getTemplates() {
        return {
            // 🏢 قالب تقرير رسمي
            'report': (params) => {
                const totalCols = params.totalCols || 10;
                const lastCol = String.fromCharCode(64 + totalCols);
                return [
                    {
                        type: 'format_range',
                        range: `A1:${lastCol}1`,
                        style: {
                            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } },
                            font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
                        }
                    },
                    {
                        type: 'format_range',
                        range: `A2:${lastCol}${params.totalRows || 100}`,
                        style: {
                            font: { size: 11 }
                        }
                    }
                ];
            },
            
            // 📊 قالب تحليل بيانات
            'analysis': (params) => {
                const totalCols = params.totalCols || 10;
                const lastCol = String.fromCharCode(64 + totalCols);
                return [
                    {
                        type: 'format_range',
                        range: `A1:${lastCol}1`,
                        style: {
                            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3498DB' } },
                            font: { bold: true, color: { argb: 'FFFFFFFF' } }
                        }
                    },
                    {
                        type: 'format_range',
                        range: `A1:${lastCol}${params.totalRows || 100}`,
                        style: {
                            border: {
                                top: { style: 'thin' },
                                bottom: { style: 'thin' },
                                left: { style: 'thin' },
                                right: { style: 'thin' }
                            }
                        }
                    }
                ];
            },
            
            // 🎨 قالب لوحة تحكم
            'dashboard': (params) => {
                const totalCols = params.totalCols || 10;
                const lastCol = String.fromCharCode(64 + totalCols);
                return [
                    {
                        type: 'format_range',
                        range: `A1:${lastCol}1`,
                        style: {
                            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE67E22' } },
                            font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 }
                        }
                    },
                    {
                        type: 'format_range',
                        range: `A2:${lastCol}${params.totalRows || 100}`,
                        style: {
                            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } }
                        }
                    }
                ];
            }
        };
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
        
        return 'text';
    }

    /**
     * 📊 توليد ملخص التنسيق
     */
    generateFormatSummary(operations) {
        const counts = {};
        operations.forEach(op => {
            counts[op.type] = (counts[op.type] || 0) + 1;
        });
        
        const summary = ['🎨 **ملخص التنسيق التلقائي:**'];
        for (const [type, count] of Object.entries(counts)) {
            const typeNames = {
                'format_range': 'نطاقات تم تنسيقها',
                'color_cells': 'خلايا تم تلوينها',
                'add_filter': 'فلاتر مضافة',
                'add_formula': 'صيغ مضافة'
            };
            summary.push(`- ${typeNames[type] || type}: ${count}`);
        }
        
        return summary.join('\n');
    }
}
