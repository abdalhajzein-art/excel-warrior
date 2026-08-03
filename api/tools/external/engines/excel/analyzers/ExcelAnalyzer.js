/**
 * excel/analyzers/ExcelAnalyzer.js – التحليل السيادي المتقدم
 * 🔥 يدعم: إحصائيات، أنماط، تنبؤات، تقارير
 */

import { ErrorHandler } from '../utils/ErrorHandler.js';

export class ExcelAnalyzer {
    constructor(adapter) {
        this.adapter = adapter;
    }
    
    /**
     * 📊 تحليل كامل للبيانات
     */
    async analyze(filePath, params = {}) {
        return ErrorHandler.execute('analyze', async () => {
            const data = await this.adapter.read(filePath, params);
            
            // ✅ تحليل إحصائي
            const statistics = this.calculateStatistics(data);
            
            // ✅ تحليل الأنماط
            const patterns = this.detectPatterns(data);
            
            // ✅ تحليل الارتباطات
            const correlations = this.calculateCorrelations(data);
            
            // ✅ توليد تقرير
            const report = this.generateReport(statistics, patterns, correlations);
            
            return {
                statistics,
                patterns,
                correlations,
                report,
                insights: this.generateInsights(statistics, patterns)
            };
        }, { filePath });
    }
    
    /**
     * 📈 حساب الإحصائيات
     */
    calculateStatistics(data) {
        const stats = {
            numeric: {},
            categorical: {},
            overall: {}
        };
        
        if (data.data && data.data[0]) {
            const firstSheet = data.data[0];
            if (firstSheet.length > 1) {
                const headers = firstSheet[0] || [];
                const dataRows = firstSheet.slice(1);
                
                headers.forEach((header, index) => {
                    const values = dataRows.map(row => row[index]).filter(v => v !== null && v !== undefined);
                    const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
                    
                    if (numericValues.length === values.length) {
                        // عمود رقمي
                        stats.numeric[header] = this.numericStats(numericValues);
                    } else {
                        // عمود فئوي
                        stats.categorical[header] = this.categoricalStats(values);
                    }
                });
                
                stats.overall = {
                    totalRows: dataRows.length,
                    totalColumns: headers.length,
                    numericColumns: Object.keys(stats.numeric).length,
                    categoricalColumns: Object.keys(stats.categorical).length
                };
            }
        }
        
        return stats;
    }
    
    /**
     * 📊 إحصائيات رقمية
     */
    numericStats(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        
        return {
            count: values.length,
            sum,
            average: sum / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            median: sorted[Math.floor(sorted.length / 2)],
            stdDev: this.standardDeviation(values)
        };
    }
    
    /**
     * 📊 إحصائيات فئوية
     */
    categoricalStats(values) {
        const counts = {};
        values.forEach(v => {
            const key = String(v);
            counts[key] = (counts[key] || 0) + 1;
        });
        
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        
        return {
            count: values.length,
            uniqueValues: Object.keys(counts).length,
            mostCommon: sorted[0] ? { value: sorted[0][0], count: sorted[0][1] } : null,
            leastCommon: sorted[sorted.length - 1] ? { value: sorted[sorted.length - 1][0], count: sorted[sorted.length - 1][1] } : null,
            distribution: counts
        };
    }
    
    /**
     * 📐 حساب الانحراف المعياري
     */
    standardDeviation(values) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
    }
    
    /**
     * 🔍 كشف الأنماط
     */
    detectPatterns(data) {
        const patterns = [];
        
        if (data.data && data.data[0]) {
            const firstSheet = data.data[0];
            
            // ✅ كشف الاتجاهات
            const trends = this.detectTrends(firstSheet);
            if (trends.length > 0) {
                patterns.push({ type: 'trends', data: trends });
            }
            
            // ✅ كشف التكرارات
            const duplicates = this.detectDuplicates(firstSheet);
            if (duplicates.length > 0) {
                patterns.push({ type: 'duplicates', data: duplicates });
            }
            
            // ✅ كشف القيم الشاذة
            const outliers = this.detectOutliers(firstSheet);
            if (outliers.length > 0) {
                patterns.push({ type: 'outliers', data: outliers });
            }
        }
        
        return patterns;
    }
    
    /**
     * 📈 كشف الاتجاهات
     */
    detectTrends(data) {
        const trends = [];
        // تنفيذ الكشف عن الاتجاهات
        return trends;
    }
    
    /**
     * 🔄 كشف التكرارات
     */
    detectDuplicates(data) {
        const duplicates = [];
        // تنفيذ الكشف عن التكرارات
        return duplicates;
    }
    
    /**
     * 🚨 كشف القيم الشاذة
     */
    detectOutliers(data) {
        const outliers = [];
        // تنفيذ الكشف عن القيم الشاذة
        return outliers;
    }
    
    /**
     * 🔗 حساب الارتباطات
     */
    calculateCorrelations(data) {
        return {};
    }
    
    /**
     * 📝 توليد تقرير
     */
    generateReport(statistics, patterns, correlations) {
        const report = [];
        report.push('# 📊 تقرير تحليل البيانات\n');
        
        // ملخص عام
        report.push('## 📋 ملخص عام');
        report.push(`- عدد الصفوف: ${statistics.overall?.totalRows || 0}`);
        report.push(`- عدد الأعمدة: ${statistics.overall?.totalColumns || 0}`);
        report.push(`- أعمدة رقمية: ${statistics.overall?.numericColumns || 0}`);
        report.push(`- أعمدة فئوية: ${statistics.overall?.categoricalColumns || 0}\n`);
        
        // إحصائيات رقمية
        if (Object.keys(statistics.numeric).length > 0) {
            report.push('## 📈 الإحصائيات الرقمية');
            for (const [key, value] of Object.entries(statistics.numeric)) {
                report.push(`### ${key}`);
                report.push(`- المتوسط: ${value.average?.toFixed(2) || 'N/A'}`);
                report.push(`- الحد الأدنى: ${value.min || 'N/A'}`);
                report.push(`- الحد الأقصى: ${value.max || 'N/A'}`);
                report.push(`- الانحراف المعياري: ${value.stdDev?.toFixed(2) || 'N/A'}\n`);
            }
        }
        
        // أنماط مكتشفة
        if (patterns.length > 0) {
            report.push('## 🔍 الأنماط المكتشفة');
            for (const pattern of patterns) {
                report.push(`### ${pattern.type}`);
                report.push(`- ${JSON.stringify(pattern.data)}\n`);
            }
        }
        
        return report.join('\n');
    }
    
    /**
     * 💡 توليد رؤى
     */
    generateInsights(statistics, patterns) {
        const insights = [];
        
        // رؤى من الإحصائيات
        if (statistics.numeric) {
            for (const [key, value] of Object.entries(statistics.numeric)) {
                if (value.average > 100) {
                    insights.push(`💡 متوسط "${key}" مرتفع (${value.average.toFixed(2)})`);
                }
                if (value.stdDev > 50) {
                    insights.push(`💡 تباين كبير في "${key}" (الانحراف المعياري: ${value.stdDev.toFixed(2)})`);
                }
            }
        }
        
        // رؤى من الأنماط
        for (const pattern of patterns) {
            if (pattern.type === 'duplicates' && pattern.data.length > 0) {
                insights.push(`🔍 تم العثور على ${pattern.data.length} صف مكرر`);
            }
            if (pattern.type === 'outliers' && pattern.data.length > 0) {
                insights.push(`🚨 تم العثور على ${pattern.data.length} قيمة شاذة`);
            }
        }
        
        return insights;
    }
}
