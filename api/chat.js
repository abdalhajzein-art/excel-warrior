/**
 * api/chat.js – Sovereign Chat Layer (Direct Gemini Engine Edition)
 * ✅ تواصل مباشر مع جيميني ومعالجة مريحة مع دعم المعاينة الفورية لبيانات الإكسل.
 * ✅ دعم headless-excel لتنفيذ عمليات التعديل المتقدمة.
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
 * ✅ تنفيذ عمليات على ملف Excel عبر headless-excel
 */
async function executeWithHeadlessExcel(filePath, operations) {
    try {
        // بناء كود Python لتنفيذ العمليات
        let pythonCode = `
import headless_excel
from headless_excel import ExcelEngine
import json

engine = ExcelEngine('${filePath}')
`;
        // إضافة العمليات
        for (const op of operations) {
            switch (op.type) {
                case 'add_column':
                    const after = op.after || '';
                    pythonCode += `engine.add_column('${op.header}', after='${after}')\n`;
                    break;
                case 'add_validation':
                    pythonCode += `engine.add_validation('${op.address}', '${op.formulae || "خيار1,خيار2,خيار3"}')\n`;
                    break;
                case 'sync':
                    pythonCode += `engine.sync()\n`;
                    break;
                case 'add_row':
                    pythonCode += `engine.add_row(${JSON.stringify(op.data || [])})\n`;
                    break;
                case 'merge_cells':
                    pythonCode += `engine.merge_cells('${op.range}')\n`;
                    break;
                case 'set_column_width':
                    pythonCode += `engine.set_column_width('${op.column}', ${op.width})\n`;
                    break;
                default:
                    console.warn(`⚠️ عملية غير مدعومة في headless-excel: ${op.type}`);
            }
        }
        pythonCode += `engine.save()\n`;

        // كتابة الكود في ملف مؤقت
        const tempPyPath = path.join('/tmp', `headless_${Date.now()}.py`);
        fs.writeFileSync(tempPyPath, pythonCode);

        // تنفيذ الكود
        const { stdout, stderr } = await execAsync(`python3 "${tempPyPath}"`);
        
        // تنظيف
        fs.unlinkSync(tempPyPath);
        
        if (stderr && !stderr.includes('Warning')) {
            console.error('❌ Headless Excel Error:', stderr);
            return { success: false, error: stderr };
        }
        
        return { success: true, output: stdout };
    } catch (error) {
        console.error('❌ Headless Excel Exception:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ✅ استخراج معاينة الملف عبر Python (pandas)
 */
function extractPreview(filePath) {
    try {
        const pyScript = `
import pandas as pd
import json
import sys

try:
    df = pd.read_excel(sys.argv[1])
    print(json.dumps({
        "rows": len(df),
        "columns": len(df.columns),
        "sheets": 1,
        "text": df.head(30).to_markdown(index=False)
    }, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
        const stdout = execFileSync('python3', ['-c', pyScript, filePath], { 
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024 // 10MB
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

            // استخراج معاينة
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
                extractedContent = {
                    text: `[تم استلام الملف بنجاح وجاهز للمراجعة: ${fileName}]`,
                    metadata: { fileName }
                };
            }

            // ✅ تنفيذ العمليات عبر headless-excel إذا وجدت
            if (operations && operations.length > 0) {
                console.log(`🔧 [chat.js] تنفيذ ${operations.length} عملية عبر headless-excel`);
                const result = await executeWithHeadlessExcel(sovereignFilePath, operations);
                if (result.success) {
                    modifiedResult = { success: true };
                    console.log(`✅ [chat.js] تم تنفيذ العمليات بنجاح عبر headless-excel`);
                    
                    // إعادة قراءة الملف بعد التعديل
                    const modifiedBuffer = fs.readFileSync(sovereignFilePath);
                    finalFileBase64 = modifiedBuffer.toString('base64');
                    finalFileName = `modified_${Date.now()}-${fileName}`;
                } else {
                    console.error(`❌ [chat.js] فشل تنفيذ العمليات عبر headless-excel:`, result.error);
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

        // إذا كان هناك ملف تم تعديله محلياً ولم يتم تحويله إلى Base64 بعد
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
