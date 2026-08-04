/**
 * api/chat.js – Sovereign Chat Layer (Direct Gemini Engine Edition)
 * ✅ تواصل مباشر مع جيميني ومعالجة مريحة مع دعم المعاينة الفورية لبيانات الإكسل.
 * ✅ دعم openpyxl لتنفيذ عمليات التعديل المتقدمة.
 * ✅ تحسين سرعة المعاينة (قراءة أول 10 صفوف فقط).
 * ✅ إصلاح مشكلة Template Literal في كود Python.
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, execFileSync } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

/**
 * ✅ تنفيذ عمليات على ملف Excel عبر Python (openpyxl)
 * تم إصلاح مشكلة Template Literal
 */
async function executeWithPython(filePath, operations) {
    try {
        // ✅ بناء كود Python باستخدام مصفوفة لتجنب مشاكل Template Literal
        const pythonLines = [
            'import openpyxl',
            'from openpyxl.utils import get_column_letter',
            'from openpyxl.worksheet.datavalidation import DataValidation',
            'import json',
            'import sys',
            '',
            'try:',
            `    wb = openpyxl.load_workbook('${filePath}')`,
            '    ws = wb.active',
            '',
            '    # البحث عن صف العناوين',
            '    header_row = 1',
            '    for row in range(1, 4):',
            '        if ws.cell(row=row, column=1).value:',
            '            header_row = row',
            '            break',
            '',
            '    # البحث عن أسماء الأعمدة',
            '    headers = {}',
            '    for col in range(1, ws.max_column + 1):',
            '        val = ws.cell(row=header_row, column=col).value',
            '        if val:',
            '            headers[str(val).strip()] = col',
            ''
        ];

        // إضافة العمليات
        for (const op of operations) {
            switch (op.type) {
                case 'add_column': {
                    const after = op.after || '';
                    const header = op.header || 'عمود جديد';
                    pythonLines.push(`    # إضافة عمود جديد بعد عمود "${after}"`);
                    pythonLines.push(`    target_col = ws.max_column + 1`);
                    pythonLines.push(`    if "${after}" in headers:`);
                    pythonLines.push(`        target_col = headers["${after}"] + 1`);
                    pythonLines.push(`    ws.insert_cols(target_col)`);
                    pythonLines.push(`    ws.cell(row=header_row, column=target_col, value="${header}")`);
                    pythonLines.push(`    # نسخ التنسيق من العمود المجاور`);
                    pythonLines.push(`    source_col = target_col - 1 if target_col > 1 else target_col + 1`);
                    pythonLines.push(`    if source_col <= ws.max_column:`);
                    pythonLines.push(`        for row in range(header_row + 1, ws.max_row + 1):`);
                    pythonLines.push(`            source_cell = ws.cell(row=row, column=source_col)`);
                    pythonLines.push(`            target_cell = ws.cell(row=row, column=target_col)`);
                    pythonLines.push(`            if source_cell.font:`);
                    pythonLines.push(`                target_cell.font = source_cell.font`);
                    pythonLines.push(`            if source_cell.fill:`);
                    pythonLines.push(`                target_cell.fill = source_cell.fill`);
                    pythonLines.push(`            if source_cell.alignment:`);
                    pythonLines.push(`                target_cell.alignment = source_cell.alignment`);
                    pythonLines.push(`            if source_cell.border:`);
                    pythonLines.push(`                target_cell.border = source_cell.border`);
                    pythonLines.push(`            if source_cell.number_format:`);
                    pythonLines.push(`                target_cell.number_format = source_cell.number_format`);
                    break;
                }
                case 'add_validation': {
                    const formulae = op.formulae || 'خيار1,خيار2,خيار3';
                    const address = op.address || '';
                    pythonLines.push(`    # إضافة قائمة منسدلة`);
                    pythonLines.push(`    dv = DataValidation(type="list", formula1="${formulae}", allow_blank=True)`);
                    pythonLines.push(`    ws.add_data_validation(dv)`);
                    if (address) {
                        pythonLines.push(`    dv.add('${address}')`);
                    }
                    break;
                }
                case 'autofit_columns':
                    pythonLines.push(`    # ضبط عرض الأعمدة تلقائياً`);
                    pythonLines.push(`    for col in ws.columns:`);
                    pythonLines.push(`        max_length = 0`);
                    pythonLines.push(`        column = col[0].column_letter`);
                    pythonLines.push(`        for cell in col:`);
                    pythonLines.push(`            try:`);
                    pythonLines.push(`                if len(str(cell.value)) > max_length:`);
                    pythonLines.push(`                    max_length = len(str(cell.value))`);
                    pythonLines.push(`            except:`);
                    pythonLines.push(`                pass`);
                    pythonLines.push(`        adjusted_width = (max_length + 2)`);
                    pythonLines.push(`        ws.column_dimensions[column].width = min(adjusted_width, 50)`);
                    break;
                default:
                    pythonLines.push(`    # عملية غير مدعومة: ${op.type}`);
            }
        }

        pythonLines.push(`    wb.save('${filePath}')`);
        pythonLines.push(`    print(json.dumps({"success": True, "message": "تم التنفيذ بنجاح"}))`);
        pythonLines.push(`except Exception as e:`);
        pythonLines.push(`    print(json.dumps({"success": False, "error": str(e)}))`);

        const pythonCode = pythonLines.join('\n');

        // كتابة الكود في ملف مؤقت
        const tempPyPath = path.join('/tmp', `python_${Date.now()}.py`);
        fs.writeFileSync(tempPyPath, pythonCode);

        // تنفيذ الكود
        const { stdout, stderr } = await execAsync(`python3 "${tempPyPath}"`);
        
        // تنظيف
        try { fs.unlinkSync(tempPyPath); } catch(e) {}
        
        if (stderr && !stderr.includes('Warning') && !stderr.includes('DeprecationWarning')) {
            console.error('❌ Python Error:', stderr);
            return { success: false, error: stderr };
        }
        
        try {
            return JSON.parse(stdout);
        } catch {
            return { success: true, output: stdout };
        }
    } catch (error) {
        console.error('❌ Python Exception:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ✅ استخراج معاينة الملف عبر Python (pandas) - محسّن للسرعة
 */
function extractPreview(filePath) {
    try {
        const pyScript = `
import pandas as pd
import json
import sys

try:
    df = pd.read_excel(sys.argv[1], nrows=10)
    print(json.dumps({
        "rows": len(df),
        "columns": len(df.columns),
        "sheets": 1,
        "text": df.to_markdown(index=False)
    }, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
        const stdout = execFileSync('python3', ['-c', pyScript, filePath], { 
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
        });
        return JSON.parse(stdout);
    } catch (error) {
        console.warn("⚠️ تعذر استخراج المعاينة:", error.message);
        return { error: error.message };
    }
}

export default async function handler(req, res) {
    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
        const userContent = (body.message || body.prompt || "").trim();
        const sessionKey = body.sessionId || "default_session";
        const { fileData, fileName, history, metadata, operations } = body;

        if (!userContent && !fileData) {
            return res.status(400).json({ reply: "⚠️ الرجاء إرسال رسالة أو ملف لنتمكن من خدمتك يا شريكي." });
        }

        let sovereignFilePath = null;
        let extractedContent = null;
        let modifiedResult = null;
        let finalFileBase64 = null;
        let finalFileName = fileName;

        // 1. التعامل مع الملفات المرفوعة وتخزينها بأمان
        if (fileData && fileName) {
            const persistentDir = path.join(__dirname, '../persistent_uploads');
            if (!fs.existsSync(persistentDir)) fs.mkdirSync(persistentDir, { recursive: true });

            const uniqueFileName = `${Date.now()}-${fileName}`;
            sovereignFilePath = path.join(persistentDir, uniqueFileName);

            let buffer = null;
            if (typeof fileData === 'string') {
                let cleanBase64 = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
                cleanBase64 = cleanBase64.replace(/\s/g, '');
                buffer = Buffer.from(cleanBase64, 'base64');
            } else if (Buffer.isBuffer(fileData)) {
                buffer = fileData;
            }

            if (buffer && buffer.length > 0) {
                fs.writeFileSync(sovereignFilePath, buffer);
                console.log(`🛡️ [الأثير Intake] تم حفظ الملف بنجاح: ${sovereignFilePath}`);
            }

            // استخراج معاينة سريعة
            const previewData = extractPreview(sovereignFilePath);
            if (!previewData.error) {
                extractedContent = {
                    text: previewData.text,
                    metadata: { 
                        fileName, 
                        rows: previewData.rows, 
                        columns: previewData.columns,
                        sheets: previewData.sheets || 1 
                    }
                };
                console.log(`📊 [الأثير Preview] تم استخراج معاينة الملف بنجاح (${previewData.rows} صف).`);
            } else {
                console.warn(`⚠️ [الأثير Preview] فشلت المعاينة: ${previewData.error}`);
                extractedContent = {
                    text: `[تم استلام الملف بنجاح وجاهز للمراجعة: ${fileName}]`,
                    metadata: { fileName }
                };
            }

            // ✅ تنفيذ العمليات عبر Python (openpyxl) إذا وجدت
            if (operations && operations.length > 0) {
                console.log(`🔧 [chat.js] تنفيذ ${operations.length} عملية عبر Python (openpyxl)`);
                const result = await executeWithPython(sovereignFilePath, operations);
                if (result.success) {
                    modifiedResult = { success: true };
                    console.log(`✅ [chat.js] تم تنفيذ العمليات بنجاح عبر Python`);
                    
                    const modifiedBuffer = fs.readFileSync(sovereignFilePath);
                    finalFileBase64 = modifiedBuffer.toString('base64');
                    finalFileName = `modified_${Date.now()}-${fileName}`;
                } else {
                    console.error(`❌ [chat.js] فشل تنفيذ العمليات عبر Python:`, result.error);
                }
            }
        }

        // 2. إعداد السياق وتسليمه للموجه
        const orchestratorInput = {
            fileData, 
            fileName, 
            filePath: sovereignFilePath, 
            history, 
            metadata, 
            extractedContent, 
            operations
        };

        const output = await conversationOrchestrator(sessionKey, userContent, orchestratorInput);

        let reply = output?.reply || output?.message || "تكرم عينك يا شريكي، أنجزت لك المطلوب.";
        let fileBase64 = finalFileBase64 || output?.fileBase64 || null;
        let returnedFileName = finalFileName || output?.fileName || fileName || "modified_file.xlsx";

        if (sovereignFilePath && fs.existsSync(sovereignFilePath) && !fileBase64 && modifiedResult?.success) {
            try {
                const fileBuffer = fs.readFileSync(sovereignFilePath);
                fileBase64 = fileBuffer.toString('base64');
            } catch (err) {
                console.warn("⚠️ لم يتم قراءة الملف كـ Base64:", err.message);
            }
        }

        if (fileBase64 && returnedFileName) {
            const realFileUrl = encodeURI(`/persistent_uploads/${path.basename(returnedFileName)}`);
            if (!reply.includes("تحميل")) {
                reply += `\n\n📥 **[اضغط هنا لتحميل ملفك يا هندسة](${realFileUrl})**`;
            }
        }

        return res.status(200).json({
            reply,
            fileBase64,
            fileName: returnedFileName,
            metadata: extractedContent?.metadata || null
        });

    } catch (error) {
        console.error("❌ [Chat Layer Error]:", error);
        return res.status(500).json({
            reply: `⚠️ معليش يا شريكي، صار خطأ تقني: ${error.message}`
        });
    }
                                     }
