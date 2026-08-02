/**
 * api/chat.js – Sovereign Chat Layer (النسخة المعمارية المحصنة بالكامل لتناول الملفات)
 * ✅ تم تحديثها لاستخدام office-oxide مع Fallback إلى openpyxl
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ✅ دالة معالجة الملفات محلياً مع Fallback (بدون await import)
 */
function extractFileContent(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: "⚠️ الملف غير موجود على السيرفر." };
    }

    let result = {
      text: '',
      markdown: '',
      metadata: {}
    };

    // ✅ المحاولة الأولى: استخدام office-oxide (مع require)
    try {
      // استيراد المكتبة باستخدام require (يعمل في أي دالة)
      const { Document } = require('office-oxide');
      const doc = Document.open(filePath);
      
      const ext = path.extname(filePath).toLowerCase();
      if (['.xlsx', '.xls'].includes(ext)) {
        result.markdown = doc.toMarkdown();
        result.text = doc.plainText();
        result.metadata = {
          sheets: doc.sheetCount ? doc.sheetCount() : 1,
          rows: doc.rowCount ? doc.rowCount() : 0,
          columns: doc.columnCount ? doc.columnCount() : 0
        };
      } else if (['.docx', '.doc'].includes(ext)) {
        result.text = doc.plainText();
        result.metadata = { paragraphs: doc.paragraphCount ? doc.paragraphCount() : 0 };
      } else if (ext === '.pdf') {
        result.text = doc.plainText();
        result.metadata = { pages: doc.pageCount ? doc.pageCount() : 0 };
      } else if (['.pptx', '.ppt'].includes(ext)) {
        result.text = doc.plainText();
        result.metadata = { slides: doc.slideCount ? doc.slideCount() : 0 };
      } else {
        const content = fs.readFileSync(filePath, 'utf-8');
        result.text = content.slice(0, 10000);
      }
      
      doc.close();
      console.log(`✅ [chat.js] تم استخراج المحتوى باستخدام office-oxide`);

    } catch (officeError) {
      console.warn(`⚠️ [chat.js] office-oxide فشل: ${officeError.message}`);
      console.log(`🔄 [chat.js] استخدام Fallback إلى openpyxl...`);

      // ✅ Fallback: استخدام openpyxl عبر Python
      const ext = path.extname(filePath).toLowerCase();
      
      if (['.xlsx', '.xls'].includes(ext)) {
        const pythonScript = `
import json
from openpyxl import load_workbook

file_path = "${filePath}"
try:
    wb = load_workbook(file_path, data_only=True)
    ws = wb.active
    data = []
    for row in ws.iter_rows(values_only=True):
        data.append([str(cell) if cell is not None else "" for cell in row])
    print(json.dumps({"ok": True, "data": data, "rows": len(data), "cols": len(data[0]) if data else 0}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
`;
        const scriptPath = path.join('/tmp', `fallback_${Date.now()}.py`);
        fs.writeFileSync(scriptPath, pythonScript, 'utf8');
        
        try {
          const output = execSync(`python3 "${scriptPath}"`, { encoding: 'utf-8', timeout: 30000 });
          fs.unlinkSync(scriptPath);
          const parsed = JSON.parse(output.trim());
          
          if (parsed.ok) {
            result.text = parsed.data.map(row => row.join(' | ')).join('\n');
            result.metadata = {
              rows: parsed.rows,
              columns: parsed.cols,
              fallback: 'openpyxl'
            };
            console.log(`✅ [chat.js] تم استخراج المحتوى باستخدام openpyxl (fallback)`);
          } else {
            throw new Error(parsed.error);
          }
        } catch (pyError) {
          console.error(`❌ [chat.js] فشل openpyxl: ${pyError.message}`);
          const content = fs.readFileSync(filePath, 'utf-8');
          result.text = content.slice(0, 10000);
          result.metadata = { fallback: 'raw_text' };
        }
      } else {
        const content = fs.readFileSync(filePath, 'utf-8');
        result.text = content.slice(0, 10000);
        result.metadata = { fallback: 'raw_text' };
      }
    }

    return result;

  } catch (error) {
    console.error("❌ خطأ في استخراج محتوى الملف:", error);
    return { error: error.message };
  }
}

export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : (req.body || {});

    const userContent = (body.message || body.prompt || "").trim();
    const sessionKey = body.sessionId || "default";

    const fileData = body.fileData || null;
    const fileName = body.fileName || null;
    const history = body.history || [];
    const metadata = body.metadata || null;

    if (!userContent && !fileData) {
      return res.status(400).json({
        reply: "⚠️ الرجاء إرسال رسالة أو ملف."
      });
    }

    let localFilePath = null;
    let extractedContent = null;

    if (fileData && fileName) {
      try {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        localFilePath = path.join(uploadDir, fileName);

        if (typeof fileData === 'string') {
          const cleanBase64 = fileData.replace(/^data:.*;base64,/, '');
          fs.writeFileSync(localFilePath, Buffer.from(cleanBase64, 'base64'));
        } else if (Buffer.isBuffer(fileData)) {
          fs.writeFileSync(localFilePath, fileData);
        } else if (typeof fileData === 'object' && fileData !== null) {
          const values = Object.values(fileData);
          fs.writeFileSync(localFilePath, Buffer.from(values));
        }

        const fileExt = path.extname(fileName).toLowerCase();
        if (['.xlsx', '.xls', '.docx', '.doc', '.pdf', '.pptx', '.ppt'].includes(fileExt)) {
          extractedContent = extractFileContent(localFilePath);
          console.log(`📄 [chat.js] تم استخراج محتوى الملف: ${fileName}`);
        } else {
          const content = fs.readFileSync(localFilePath, 'utf-8');
          extractedContent = { text: content.slice(0, 10000), markdown: '', metadata: {} };
        }

      } catch (err) {
        console.error("❌ خطأ في حفظ أو معالجة الملف:", err);
        extractedContent = { error: err.message };
      }
    }

    const output = await conversationOrchestrator(sessionKey, userContent, {
      fileData,
      fileName,
      filePath: localFilePath,
      history,
      metadata,
      extractedContent
    });

    let reply = "تم إنجاز طلبك بنجاح!";
    let fileBase64 = null;
    let returnedFileName = null;

    if (typeof output === "string") {
      reply = output;
    } else if (output && typeof output === "object") {
      reply = output.reply || output.message || "تم إنجاز طلبك بنجاح!";
      fileBase64 = output.fileBase64 || null;
      returnedFileName = output.fileName || null;
    }

    if (returnedFileName) {
      const realFileUrl = encodeURI(`/uploads/${returnedFileName}`);
      if (!reply.includes(returnedFileName)) {
        reply += `\n\n📥 **[تحميل الملف المحدث مباشرة](${realFileUrl})**`;
      }
    }

    return res.status(200).json({
      reply,
      fileBase64,
      fileName: returnedFileName
    });

  } catch (error) {
    console.error("❌ خطأ في api/chat.js:", error);
    return res.status(500).json({
      reply: `⚠️ خطأ داخلي أثناء المعالجة: ${error.message}`
    });
  }
                 }
