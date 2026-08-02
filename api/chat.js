/**
 * api/chat.js – Sovereign Chat Layer (النسخة المعمارية المحصنة)
 * ✅ تم تحديثها لاستخدام exceljs لمعالجة ملفات Excel
 * ✅ تحسين معالجة حفظ الملفات
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

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

    // ✅ التحقق من حجم الملف
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { error: "⚠️ الملف فارغ (0 بايت)." };
    }

    console.log(`📊 [extractExcelContent] حجم الملف: ${stats.size} bytes`);

    // تحميل الملف باستخدام exceljs
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);

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
        formulas: formulas.slice(0, 20)
      }
    };

  } catch (error) {
    console.error("❌ خطأ في استخراج محتوى الملف:", error);
    return { error: `فشل قراءة الملف: ${error.message}` };
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
        
        // ✅ إنشاء اسم ملف فريد لتجنب التعارض
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${fileName}`;
        localFilePath = path.join(uploadDir, uniqueFileName);

        let buffer = null;

        // ✅ تحسين معالجة البيانات الواردة
        if (typeof fileData === 'string') {
          // ✅ التعامل مع Base64
          const cleanBase64 = fileData.replace(/^data:.*;base64,/, '');
          buffer = Buffer.from(cleanBase64, 'base64');
        } else if (Buffer.isBuffer(fileData)) {
          buffer = fileData;
        } else if (typeof fileData === 'object' && fileData !== null) {
          // ✅ إذا كانت البيانات كائن (مثل ArrayBuffer)
          if (fileData.data && Buffer.isBuffer(fileData.data)) {
            buffer = fileData.data;
          } else {
            // محاولة تحويل الكائن إلى Buffer
            const jsonStr = JSON.stringify(fileData);
            buffer = Buffer.from(jsonStr);
          }
        } else if (Array.isArray(fileData)) {
          // ✅ إذا كانت البيانات مصفوفة (مثل Uint8Array)
          buffer = Buffer.from(fileData);
        }

        if (!buffer || buffer.length === 0) {
          throw new Error("البيانات المستلمة فارغة أو غير صالحة");
        }

        console.log(`📊 [chat.js] حفظ ملف: ${fileName}, الحجم: ${buffer.length} bytes`);

        // ✅ حفظ الملف
        fs.writeFileSync(localFilePath, buffer);

        // ✅ التحقق من أن الملف تم حفظه بشكل صحيح
        const savedStats = fs.statSync(localFilePath);
        if (savedStats.size === 0) {
          throw new Error("الملف المحفوظ فارغ (0 بايت)");
        }

        if (savedStats.size !== buffer.length) {
          console.warn(`⚠️ تحذير: حجم الملف المحفوظ (${savedStats.size}) يختلف عن الحجم الأصلي (${buffer.length})`);
        }

        const fileExt = path.extname(fileName).toLowerCase();
        
        // ✅ استخدام exceljs للملفات Excel
        if (['.xlsx', '.xls'].includes(fileExt)) {
          extractedContent = await extractExcelContent(localFilePath);
          if (extractedContent.error) {
            console.error(`❌ [chat.js] فشل استخراج محتوى Excel: ${extractedContent.error}`);
          } else {
            console.log(`📄 [chat.js] تم استخراج محتوى Excel باستخدام exceljs: ${fileName}`);
          }
        } else if (['.docx', '.doc'].includes(fileExt)) {
          extractedContent = { text: `[ملف Word: ${fileName}]`, markdown: '', metadata: {} };
        } else if (['.pdf'].includes(fileExt)) {
          extractedContent = { text: `[ملف PDF: ${fileName}]`, markdown: '', metadata: {} };
        } else if (['.pptx', '.ppt'].includes(fileExt)) {
          extractedContent = { text: `[ملف PowerPoint: ${fileName}]`, markdown: '', metadata: {} };
        } else {
          // ملفات نصية عادية
          const content = fs.readFileSync(localFilePath, 'utf-8');
          extractedContent = { text: content.slice(0, 10000), markdown: '', metadata: {} };
        }

      } catch (err) {
        console.error("❌ خطأ في حفظ أو معالجة الملف:", err);
        extractedContent = { error: `فشل معالجة الملف: ${err.message}` };
        
        // ✅ تنظيف الملف التالف
        if (localFilePath && fs.existsSync(localFilePath)) {
          try {
            fs.unlinkSync(localFilePath);
            console.log(`🗑️ تم حذف الملف التالف: ${localFilePath}`);
          } catch (cleanupErr) {
            console.error(`⚠️ فشل حذف الملف التالف: ${cleanupErr.message}`);
          }
        }
      }
    }

    // ✅ إذا فشل استخراج المحتوى، نرسل رسالة خطأ للمستخدم
    if (extractedContent && extractedContent.error) {
      return res.status(400).json({
        reply: `⚠️ ${extractedContent.error}`
      });
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
