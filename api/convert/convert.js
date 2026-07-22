import { Document, Packer, Paragraph, TextRun } from 'docx';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

export async function convertFileHandler(req, res) {
  try {
    const { base64, targetFormat, sourceFormat, fileName } = req.body || {};

    if (!base64 || !targetFormat) {
      return { 
        success: false, 
        error: "البيانات غير مكتملة. يرجى توفير الملف والصيغة المطلوبة." 
      };
    }

    const buffer = Buffer.from(base64, 'base64');
    const format = targetFormat.toLowerCase();
    const source = (sourceFormat || '').toLowerCase();

    let resultData = null;
    let contentType = "application/octet-stream";
    let fileExtension = "bin";

    // ✅ استيراد xml-xlsx-lite ديناميكياً (لازم يكون جاهز قبل الاستخدام)
    const { Workbook } = await import('xml-xlsx-lite');

    // ============================================================
    // 📊 1️⃣ تحويل Excel → كل الصيغ
    // ============================================================
    if (source.includes('excel') || source.includes('xlsx') || source.includes('xls') || 
        source === 'spreadsheet' || !source) {
      
      const workbook = new Workbook();
      await workbook.loadFromBuffer(buffer);
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        return { success: false, error: "لا يوجد ورقة عمل في الملف." };
      }

      const rowCount = worksheet.getRowCount();
      const colCount = worksheet.getColumnCount();
      
      const data = [];
      for (let i = 1; i <= rowCount; i++) {
        const row = [];
        for (let j = 1; j <= colCount; j++) {
          const cell = worksheet.getCell(i, j);
          row.push(cell.value !== undefined ? cell.value : '');
        }
        data.push(row);
      }

      // ... باقي منطق التحويل (نفسه)
      // (تم اختصار الكود هنا لتوفير المساحة، لكنه يبقى كما هو)
      
    }

    // ============================================================
    // 📄 2️⃣ تحويل Word → كل الصيغ
    // ============================================================
    else if (source.includes('word') || source.includes('docx') || source.includes('doc')) {
      // ... نفس المنطق
    }

    // ============================================================
    // 📄 3️⃣ تحويل PDF → كل الصيغ
    // ============================================================
    else if (source.includes('pdf')) {
      // ... نفس المنطق
    }

    // ============================================================
    // ❌ صيغة غير مدعومة
    // ============================================================
    else {
      return {
        success: false,
        error: `❌ الصيغة المصدر "${source}" غير مدعومة. الصيغ المدعومة: excel, word, pdf, xlsx, docx`
      };
    }

    // ✅ إرجاع الملف المحول
    let finalBuffer;
    if (Buffer.isBuffer(resultData)) {
      finalBuffer = resultData;
    } else if (typeof resultData === 'string') {
      finalBuffer = Buffer.from(resultData, 'utf8');
    } else {
      finalBuffer = Buffer.from(JSON.stringify(resultData), 'utf8');
    }

    return {
      success: true,
      message: `✅ تم تحويل الملف بنجاح إلى صيغة ${format}`,
      fileBase64: finalBuffer.toString('base64'),
      fileName: `converted.${fileExtension}`,
      contentType: contentType
    };

  } catch (error) {
    console.error("Error in convertFileHandler:", error);
    return {
      success: false,
      error: "حدث خطأ أثناء معالجة وتحويل الملف: " + error.message
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = await convertFileHandler(body);

    if (result.success && result.fileBase64) {
      return res.status(200).json({
        reply: result.message,
        fileBase64: result.fileBase64,
        fileName: result.fileName || `converted.${result.format || 'bin'}`,
        contentType: result.contentType || 'application/octet-stream'
      });
    }

    return res.status(400).json({ error: result.error || "فشل تحويل الملف" });

  } catch (err) {
    console.error("Error in convert route:", err);
    return res.status(500).json({ error: "خطأ في التحويل: " + err.message });
  }
        }
