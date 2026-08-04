/**
 * api/chat.js – Sovereign Chat Layer (Direct Gemini Engine Edition)
 * ✅ تواصل مباشر مع جيميني ومعالجة مريحة مع دعم المعاينة الفورية لبيانات الإكسل.
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

        // 1. التعامل مع الملفات المرفوعة وتخزينها بأمان + استخراج المعاينة الحقيقية عبر بايثون
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

            // استخراج معاينة حقيقية لبيانات الإكسل لتراها الذاكرة والـ Kernel بوضوح
            try {
                const pyScript = `
import pandas as pd, json, sys
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
                const stdout = execFileSync('python3', ['-c', pyScript, sovereignFilePath], { encoding: 'utf8' });
                const previewData = JSON.parse(stdout);
                
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
                    throw new Error(previewData.error);
                }
            } catch (err) {
                console.warn("⚠️ تعذر استخراج معاينة الإكسل تلقائياً عبر بايثون:", err.message);
                extractedContent = {
                    text: `[تم استلام الملف بنجاح وجاهز للمراجعة: ${fileName}]`,
                    metadata: { fileName }
                };
            }
        }

        // 2. إعداد السياق وتسليمه للموجه
        const orchestratorInput = {
            fileData, fileName, filePath: sovereignFilePath, history, metadata, extractedContent, operations
        };

        const output = await conversationOrchestrator(sessionKey, userContent, orchestratorInput);

        let reply = output?.reply || output?.message || "تكرم عينك يا شريكي، أنجزت لك المطلوب.";
        let fileBase64 = output?.fileBase64 || null;
        let returnedFileName = output?.fileName || fileName || "modified_file.xlsx";

        // إذا كان هناك ملف تم تعديله محلياً أو عبر سكريبت نظيف، نقرأه ونعيده بواجهة نظيفة
        if (sovereignFilePath && fs.existsSync(sovereignFilePath) && !fileBase64) {
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
