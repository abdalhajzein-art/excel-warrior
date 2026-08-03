/**
 * excel/pivots/ExcelPivot.js – الجداول المحورية السيادية المتقدمة
 * 🔥 يدعم: جداول محورية متعددة، تحليل، تجميع، فلترة، رسوم بيانية
 */

import { ErrorHandler } from '../utils/ErrorHandler.js';
import { FileUtils } from '../utils/FileUtils.js';
import path from 'path';
import os from 'os';

export class ExcelPivot {
    constructor(adapter) {
        this.adapter = adapter;
    }

    /**
     * 📊 إنشاء جدول محوري (عبر Python pandas)
     */
    async createPivot(filePath, params = {}) {
        return ErrorHandler.execute('createPivot', async () => {
            const script = `
import pandas as pd
import json

# قراءة الملف
df = pd.read_excel(r'${filePath}', sheet_name=0)

# إنشاء الجدول المحوري
pivot = pd.pivot_table(
    df,
    values='${params.values || 'value'}',
    index='${params.index || 'index'}',
    columns='${params.columns || 'columns'}',
    aggfunc='${params.aggfunc || 'sum'}',
    fill_value=${params.fillValue !== undefined ? params.fillValue : 0}
)

# حفظ النتيجة
pivot.to_excel(r'${filePath.replace('.xlsx', '_pivot.xlsx')}')
print("PIVOT_CREATED")
            `;

            const scriptPath = FileUtils.getTempPath('pivot_script', '.py');
            try {
                fs.writeFileSync(scriptPath, script, 'utf-8');
                await FileUtils.executePython(scriptPath);
                
                const pivotPath = filePath.replace('.xlsx', '_pivot.xlsx');
                const base64 = await FileUtils.fileToBase64(pivotPath);
                const analysis = await this.analyzePivot(pivotPath);
                
                return {
                    success: true,
                    filePath: pivotPath,
                    fileBase64: base64,
                    fileName: path.basename(pivotPath),
                    analysis: analysis,
                    summary: this.generatePivotSummary(analysis)
                };
            } finally {
                await FileUtils.deleteFile(scriptPath);
            }
        }, { filePath, params });
    }

    /**
     * 📊 إنشاء جداول محورية متعددة
     */
    async createMultiplePivots(filePath, params = {}) {
        return ErrorHandler.execute('createMultiplePivots', async () => {
            const pivots = params.pivots || [];
            const results = [];

            for (const pivotConfig of pivots) {
                const result = await this.createPivot(filePath, pivotConfig);
                results.push({
                    config: pivotConfig,
                    result: result
                });
            }

            return {
                success: true,
                results,
                total: results.length,
                summary: `✅ تم إنشاء ${results.length} جداول محورية`
            };
        }, { filePath, pivots: params.pivots });
    }

    /**
     * 📊 تحليل الجدول المحوري
     */
    async analyzePivot(pivotPath) {
        if (!fs.existsSync(pivotPath)) {
            return { error: 'الجدول المحوري غير موجود' };
        }

        const script = `
import pandas as pd
import json

# قراءة الجدول المحوري
df = pd.read_excel(r'${pivotPath}', sheet_name=0)

# تحليل البيانات
analysis = {
    'shape': df.shape,
    'columns': df.columns.tolist(),
    'index': df.index.tolist(),
    'values': df.values.tolist(),
    'summary': {
        'rows': len(df),
        'cols': len(df.columns),
        'total_cells': len(df) * len(df.columns)
    },
    'statistics': {
        'min': df.min().to_dict(),
        'max': df.max().to_dict(),
        'mean': df.mean().to_dict(),
        'sum': df.sum().to_dict()
    }
}

print(json.dumps(analysis, ensure_ascii=False))
        `;

        const scriptPath = FileUtils.getTempPath('analyze_pivot', '.py');
        try {
            fs.writeFileSync(scriptPath, script, 'utf-8');
            const result = await FileUtils.executePython(scriptPath);
            return JSON.parse(result);
        } finally {
            await FileUtils.deleteFile(scriptPath);
        }
    }

    /**
     * 📊 توليد ملخص الجدول المحوري
     */
    generatePivotSummary(analysis) {
        if (!analysis || analysis.error) {
            return '⚠️ لا يمكن تحليل الجدول المحوري';
        }

        const summary = [
            '📊 **ملخص الجدول المحوري:**',
            `- عدد الصفوف: ${analysis.shape?.[0] || 0}`,
            `- عدد الأعمدة: ${analysis.shape?.[1] || 0}`,
            `- إجمالي الخلايا: ${analysis.summary?.total_cells || 0}`
        ];

        if (analysis.statistics) {
            summary.push('\n📈 **الإحصائيات:**');
            for (const [col, stats] of Object.entries(analysis.statistics)) {
                if (stats && typeof stats === 'object') {
                    const sum = stats.sum || 0;
                    const mean = stats.mean || 0;
                    summary.push(`- ${col}: المتوسط ${mean.toFixed(2)}, المجموع ${sum.toFixed(2)}`);
                }
            }
        }

        return summary.join('\n');
    }

    /**
     * 📊 تصدير الجدول المحوري إلى CSV
     */
    async pivotToCsv(pivotPath) {
        const script = `
import pandas as pd
df = pd.read_excel(r'${pivotPath}', sheet_name=0)
df.to_csv(r'${pivotPath.replace('.xlsx', '.csv')}', index=True)
print("CSV_EXPORTED")
        `;

        const scriptPath = FileUtils.getTempPath('pivot_to_csv', '.py');
        try {
            fs.writeFileSync(scriptPath, script, 'utf-8');
            await FileUtils.executePython(scriptPath);
            const csvPath = pivotPath.replace('.xlsx', '.csv');
            const base64 = await FileUtils.fileToBase64(csvPath);
            return {
                success: true,
                filePath: csvPath,
                fileBase64: base64,
                fileName: path.basename(csvPath)
            };
        } finally {
            await FileUtils.deleteFile(scriptPath);
        }
    }

    /**
     * 📊 تصدير الجدول المحوري إلى HTML
     */
    async pivotToHtml(pivotPath) {
        const script = `
import pandas as pd
df = pd.read_excel(r'${pivotPath}', sheet_name=0)
html = df.to_html(classes='pivot-table', border=0)
with open(r'${pivotPath.replace('.xlsx', '.html')}', 'w', encoding='utf-8') as f:
    f.write(html)
print("HTML_EXPORTED")
        `;

        const scriptPath = FileUtils.getTempPath('pivot_to_html', '.py');
        try {
            fs.writeFileSync(scriptPath, script, 'utf-8');
            await FileUtils.executePython(scriptPath);
            const htmlPath = pivotPath.replace('.xlsx', '.html');
            const base64 = await FileUtils.fileToBase64(htmlPath);
            return {
                success: true,
                filePath: htmlPath,
                fileBase64: base64,
                fileName: path.basename(htmlPath)
            };
        } finally {
            await FileUtils.deleteFile(scriptPath);
        }
    }

    /**
     * 🔄 تجميع الجدول المحوري
     */
    async groupPivot(pivotPath, params = {}) {
        const { groupBy, groupLabels, aggregatedColumn } = params;
        
        const script = `
import pandas as pd
import json

df = pd.read_excel(r'${pivotPath}', sheet_name=0)

# تجميع البيانات
if '${groupBy}' in df.columns:
    grouped = df.groupby('${groupBy}')
    result = grouped['${aggregatedColumn || df.columns[1]}'].agg(['sum', 'mean', 'count'])
    result.to_excel(r'${pivotPath.replace('.xlsx', '_grouped.xlsx')}')
    print(json.dumps(result.to_dict()))
        `;

        const scriptPath = FileUtils.getTempPath('group_pivot', '.py');
        try {
            fs.writeFileSync(scriptPath, script, 'utf-8');
            const result = await FileUtils.executePython(scriptPath);
            const groupedPath = pivotPath.replace('.xlsx', '_grouped.xlsx');
            const base64 = await FileUtils.fileToBase64(groupedPath);
            
            return {
                success: true,
                filePath: groupedPath,
                fileBase64: base64,
                fileName: path.basename(groupedPath),
                data: JSON.parse(result)
            };
        } finally {
            await FileUtils.deleteFile(scriptPath);
        }
    }
}
