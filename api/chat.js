/**
 * api/chat.js – Sovereign Chat Layer (النسخة المعمارية المحصنة)
 * ✅ تم تحديثها لاستخدام exceljs لمعالجة ملفات Excel
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs'; // ✅ المكتبة الجديدة

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ✅ دالة معالجة الملفات محلياً باستخدام exceljs
 */
async function extractExcelContent(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: "⚠️ الملف غير موجود على السيرفر." };
    }

    // تحميل الملف باستخدام exceljs
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1); // أول ورقة عمل

    if (!worksheet) {
      return { error: "⚠️ لا توجد أوراق عمل في هذا الملف." };
    }

    // استخراج البيانات
    const data = [];
    worksheet.eachRow((row, rowNumber) => {
      const rowData = [];
      row.eachCell((cell) => {
        rowData.push(cell.value || '');
      });
      data.push(rowData);
    });

    // استخراج الصيغ (Formulas) إذا وجدت
    const formulas = [];
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        if (cell.formula) {
          formulas.push(`الخلية ${cell.address}: ${cell.formula}`);
        }
      });
    });

    return {
      text: data.map(row => row.join(' | ')).join('\n'),
      markdown: data.map(row => `| ${row.join(' | ')} |`).join('\n'),
      metadata: {
        sheets: workbook.worksheets.length,
        rows: data.length,
        columns: data[0]?.length || 0,
        hasFormulas: formulas.length > 0,
        formulas: formulas.slice(0, 20) // أول 20 صيغة
      }
    };

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

        // حفظ الملف
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
        
        // ✅ استخدام exceljs للملفات Excel
        if (['.xlsx', '.xls'].includes(fileExt)) {
          extractedContent = await extractExcelContent(localFilePath); // ✅ استخدام await
          console.log(`📄 [chat.js] تم استخراج محتوى Excel باستخدام exceljs: ${fileName}`);
        } else if (['.docx', '.doc'].includes(fileExt)) {
          // TODO: استخدام مكتبة أخرى لـ Word
          extractedContent = { text: `[ملف Word: ${fileName}]`, markdown: '', metadata: {} };
        } else if (['.pdf'].includes(fileExt)) {
          // TODO: استخدام مكتبة أخرى لـ PDF
          extractedContent = { text: `[ملف PDF: ${fileName}]`, markdown: '', metadata: {} };
        } else if (['.pptx', '.ppt'].includes(fileExt)) {
          // TODO: استخدام مكتبة أخرى لـ PowerPoint
          extractedContent = { text: `[ملف PowerPoint: ${fileName}]`, markdown: '', metadata: {} };
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

    // استدعاء الـ orchestrator
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
