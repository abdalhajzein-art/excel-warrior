import * as XLSX from 'xlsx';

export async function convertFileHandler(req, res) {
  try {
    const { base64, targetFormat } = req.body || {};

    if (!base64 || !targetFormat) {
      return { 
        success: false, 
        error: "البيانات غير مكتملة. يرجى توفير الملف والصيغة المطلوبة." 
      };
    }

    // ✅ تحويل الـ base64 إلى Buffer
    const buffer = Buffer.from(base64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // ✅ اختيار أول ورقة عمل
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    let resultData = "";
    let contentType = "application/json";
    let fileExtension = "json";

    // ✅ معالجة التحويل بناءً على الصيغة المطلوبة
    const format = targetFormat.toLowerCase();
    
    if (format === 'csv') {
      resultData = XLSX.utils.sheet_to_csv(worksheet);
      contentType = "text/csv";
      fileExtension = "csv";
    } else if (format === 'json') {
      const jsonSheet = XLSX.utils.sheet_to_json(worksheet);
      resultData = JSON.stringify(jsonSheet, null, 2);
      contentType = "application/json";
      fileExtension = "json";
    } else if (format === 'txt' || format === 'text') {
      resultData = XLSX.utils.sheet_to_txt(worksheet);
      contentType = "text/plain";
      fileExtension = "txt";
    } else if (format === 'html') {
      // تحويل إلى HTML (جدول)
      const htmlRows = XLSX.utils.sheet_to_html(worksheet);
      resultData = htmlRows;
      contentType = "text/html";
      fileExtension = "html";
    } else {
      // صيغة غير مدعومة
      return {
        success: false,
        error: `الصيغة "${targetFormat}" غير مدعومة. الصيغ المدعومة: csv, json, txt, html`
      };
    }

    // ✅ إرجاع الملف المحول بصيغة base64
    const convertedBase64 = Buffer.from(resultData).toString('base64');

    return {
      success: true,
      message: `✅ تم تحويل الملف بنجاح إلى صيغة ${format}`,
      format: format,
      fileBase64: convertedBase64,
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
    const result = await convertFileHandler({ body });

    if (result.success && result.fileBase64) {
      return res.status(200).json({
        reply: result.message,
        fileBase64: result.fileBase64,
        fileName: result.fileName || `converted.${result.format || 'json'}`,
        contentType: result.contentType || 'application/json'
      });
    }

    return res.status(400).json({ error: result.error || "فشل تحويل الملف" });

  } catch (err) {
    console.error("Error in convert route:", err);
    return res.status(500).json({ error: "خطأ في التحويل: " + err.message });
  }
                                                           }
