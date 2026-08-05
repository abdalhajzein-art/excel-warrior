/**
 * api/core/file_fingerprint.js
 * 🧬 نظام البصمة الذكي للملفات
 * يخزن معلومات خفيفة عن الملف لتجنب استهلاك التوكنز
 */

// 1. توليد البصمة من الملف
export function generateFingerprint(filePath, previewData) {
    if (!previewData || !previewData.metadata) {
        return null;
    }

    const fingerprint = {
        sheets: previewData.metadata.sheets || [],
        rowCounts: previewData.metadata.rowCounts || {},
        columnCounts: previewData.metadata.columnCounts || {},
        features: detectFeatures(previewData),
        formatSamples: extractFormatSamples(previewData),
        keyFormulas: extractKeyFormulas(previewData),
        colorUsage: detectColorUsage(previewData),
        generatedAt: Date.now(),
        version: '2.0'
    };

    return fingerprint;
}

// 2. كشف الميزات في الملف
function detectFeatures(previewData) {
    const text = JSON.stringify(previewData).toLowerCase();
    return {
        xlookup: text.includes('xlookup'),
        sumif: text.includes('sumif'),
        countif: text.includes('countif'),
        averageif: text.includes('averageif'),
        conditionalFormatting: text.includes('conditional') || text.includes('formatting'),
        dataValidation: text.includes('validation') || text.includes('list'),
        pivotTables: text.includes('pivot'),
        charts: text.includes('chart') || text.includes('graph'),
        macros: text.includes('vba') || text.includes('macro')
    };
}

// 3. استخراج أنماط التنسيق
function extractFormatSamples(previewData) {
    const samples = {};
    if (previewData.metadata && previewData.metadata.sheets) {
        previewData.metadata.sheets.forEach(sheet => {
            samples[sheet] = {
                title: {
                    font: { name: 'Segoe UI', size: 16, bold: true, color: '1F4E78' },
                    alignment: 'center'
                },
                header: {
                    font: { name: 'Segoe UI', size: 11, bold: true, color: 'FFFFFF' },
                    fill: '1F4E78',
                    alignment: 'center'
                },
                data: {
                    font: { name: 'Segoe UI', size: 10 },
                    alignment: 'center',
                    border: 'thin'
                }
            };
        });
    }
    return samples;
}

// 4. استخراج المعادلات الرئيسية
function extractKeyFormulas(previewData) {
    const formulas = {};
    if (previewData.metadata && previewData.metadata.sheets) {
        previewData.metadata.sheets.forEach(sheet => {
            formulas[sheet] = {};
            const sheetData = previewData[sheet] || [];
            let count = 0;
            for (const row of sheetData) {
                for (const [key, value] of Object.entries(row)) {
                    if (typeof value === 'string' && value.startsWith('=') && count < 5) {
                        formulas[sheet][key] = value;
                        count++;
                    }
                }
            }
        });
    }
    return formulas;
}

// 5. كشف الألوان المستخدمة
function detectColorUsage(previewData) {
    return {
        '1F4E78': ['headers', 'titles', 'main_theme'],
        'D9E1F2': ['kpi_backgrounds', 'light_blue'],
        'E2EFDA': ['completed_projects', 'success'],
        'FCE4D6': ['in_progress_projects', 'warning'],
        'EDEDF9': ['analysis_backgrounds', 'purple_theme'],
        'FFFFFF': ['text_on_dark', 'headers_text'],
        '595959': ['secondary_text', 'kpi_labels']
    };
}

// 6. دمج بصمتين
export function mergeFingerprints(oldFingerprint, newFingerprint) {
    if (!oldFingerprint) return newFingerprint;
    if (!newFingerprint) return oldFingerprint;
    
    return {
        sheets: [...new Set([...oldFingerprint.sheets, ...newFingerprint.sheets])],
        features: { ...oldFingerprint.features, ...newFingerprint.features },
        formatSamples: { ...oldFingerprint.formatSamples, ...newFingerprint.formatSamples },
        keyFormulas: { ...oldFingerprint.keyFormulas, ...newFingerprint.keyFormulas },
        colorUsage: { ...oldFingerprint.colorUsage, ...newFingerprint.colorUsage },
        generatedAt: Date.now(),
        version: '2.0'
    };
}

// 7. تحويل البصمة لنص للـ AI
export function fingerprintToText(fingerprint) {
    if (!fingerprint) return 'لا توجد بصمة للملف.';
    
    const featureList = Object.keys(fingerprint.features)
        .filter(k => fingerprint.features[k])
        .join('، ');
    
    const colorList = Object.keys(fingerprint.colorUsage).join('، ');
    const sheetsList = fingerprint.sheets.join('، ');
    const formulaSummary = Object.keys(fingerprint.keyFormulas)
        .map(sheet => `${sheet}: ${Object.keys(fingerprint.keyFormulas[sheet]).length} معادلة`)
        .join('، ');
    
    return `
📋 **بصمة الملف الحالي:**

📄 الأوراق: ${sheetsList}

✨ الميزات الموجودة: ${featureList || 'لا توجد ميزات متقدمة'}

🎨 الألوان المستخدمة: ${colorList}

📊 عدد الصفوف: ${JSON.stringify(fingerprint.rowCounts)}

🔢 المعادلات: ${formulaSummary}

⚠️ **تعليمات التطوير:**
1. احتفظ بجميع الأوراق الموجودة (لا تحذف أي ورقة)
2. احتفظ بجميع المعادلات الموجودة (لا تحذف أي معادلة)
3. حافظ على نفس أنماط الألوان والتنسيق
4. أضف الميزات الجديدة فقط دون المساس بالميزات الموجودة
`;
}

export default {
    generateFingerprint,
    detectFeatures,
    extractFormatSamples,
    extractKeyFormulas,
    detectColorUsage,
    mergeFingerprints,
    fingerprintToText
};
