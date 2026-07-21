// /api/convert/convert.js
import * as XLSX from 'xlsx';

export async function convertFileHandler(req, res) {
  try {
    const { base64, targetFormat } = req.body;

    if (!base64 || !targetFormat) {
      return res.status(400).json({ 
        success: false, 
        error: "البيانات غير مكتملة. يرجى توفير الملف والصيغة المطلوبة." 
      });
    }

    // تحويل الـ base64 إلى Buffer لمعالجة الملف
    const buffer = Buffer.from(base64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // اختيار أول ورقة عمل افتراضياً
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    let resultData = "";
    let contentType = "application/json";

    // معالجة التحويل بناءً على الصيغة المطلوبة
    if (targetFormat.toLowerCase() === 'csv') {
      resultData = XLSX.utils.sheet_to_csv(worksheet);
      contentType = "text/csv";
    } else if (targetFormat.toLowerCase() === 'json') {
      const jsonSheet = XLSX.utils.sheet_to_json(worksheet);
      resultData = JSON.stringify(jsonSheet, null, 2);
      contentType = "application/json";
    } else {
      // الصيغ الاخرى أو النصية
      resultData = XLSX.utils.sheet_to_txt(worksheet);
      contentType = "text/plain";
    }

    // إرجاع الملف المحول بصيغة base64 ليعرضه أو يحمله المستخدم مباشرة
    const convertedBase64 = Buffer.from(resultData).toString('base64');

    return res.status(200).json({
      success: true,
      message: `تم تحويل الملف بنجاح إلى صيغة ${targetFormat}`,
      format: targetFormat,
      fileBase64: convertedBase64,
      contentType: contentType
    });

  } catch (error) {
    console.error("Error in convertFileHandler:", error);
    return res.status(500).json({ 
      success: false, 
      error: "حدث خطأ أثناء معالجة وتحويل الملف: " + error.message 
    });
  }
}
