/**
 * api/chat.js – Sovereign Chat Layer (النسخة المعمارية المحصنة بالكامل لتناول الملفات)
 * ✅ تم تحديثها لاستخدام office-oxide في معالجة الملفات محلياً
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document } from 'office-oxide'; // ✅ استيراد المكتبة الجديدة

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ✅ دالة معالجة الملفات محلياً باستخدام office-oxide
 * استخراج النص أو البيانات من أي ملف Office (Excel, Word, PDF, PowerPoint)
 */
function extractFileContent(filePath, fileType = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: "⚠️ الملف غير موجود على السيرفر." };
    }

    const doc = Document.open(filePath);
    let result = {
      text: '',
      markdown: '',
      metadata: {}
    };

    // استخراج المعلومات حسب نوع الملف
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.xlsx' || ext === '.xls') {
      // Excel: استخراج الجداول كـ Markdown
      result.markdown = doc.toMarkdown();
      result.text = doc.plainText();
      result.metadata = {
        sheets: doc.sheetCount(),
        rows: doc.rowCount(),
        columns: doc.columnCount()
      };
    } else if (ext === '.docx' || ext === '.doc') {
      // Word: استخراج النص
      result.text = doc.plainText();
      result.metadata = {
        paragraphs: doc.paragraphCount()
      };
    } else if (ext === '.pdf') {
      // PDF: استخراج النص
      result.text = doc.plainText();
      result.metadata = {
        pages: doc.pageCount()
      };
    } else if (ext === '.pptx' || ext === '.ppt') {
      // PowerPoint: استخراج النص
      result.text = doc.plainText();
      result.metadata = {
        slides: doc.slideCount()
      };
    } else {
      // ملفات نصية عادية
      const content = fs.readFileSync(filePath, 'utf-8');
      result.text = content.slice(0, 10000); // أول 10 آلاف حرف
    }

    doc.close();
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

    // 🛡️ الحفظ الفيزيائي للملف المرفق
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

        // ✅ معالجة الملف محلياً باستخدام office-oxide
        const fileExt = path.extname(fileName).toLowerCase();
        if (['.xlsx', '.xls', '.docx', '.doc', '.pdf', '.pptx', '.ppt'].includes(fileExt)) {
          extractedContent = extractFileContent(localFilePath);
          console.log(`📄 [chat.js] تم استخراج محتوى الملف محلياً: ${fileName}`);
        } else {
          // ملفات نصية عادية
          const content = fs.readFileSync(localFilePath, 'utf-8');
          extractedContent = { text: content.slice(0, 10000), markdown: '', metadata: {} };
        }

      } catch (err) {
        console.error("❌ خطأ في حفظ أو معالجة الملف:", err);
        extractedContent = { error: err.message };
      }
    }

    // ✅ تمرير الملف والبيانات المستخرجة إلى الـ Orchestrator
    const output = await conversationOrchestrator(sessionKey, userContent, {
      fileData,
      fileName,
      filePath: localFilePath,
      history,
      metadata,
      extractedContent // ✅ تمرير المحتوى المستخرج محلياً
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
