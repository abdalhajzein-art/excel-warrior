import XLSX from 'xlsx';

export async function modifyExcelHandler(req, res) {
  try {
    // ✅ استقبال البيانات بشكل صحيح
    const body = req.body || req || {};
    const { base64, instruction } = body;

    console.log(`📝 modifyExcelHandler: base64 موجود؟ ${!!base64}`);
    console.log(`📝 instruction: ${instruction}`);

    if (!base64) {
      console.error("❌ base64 مفقود");
      return {
        success: false,
        error: "لا يوجد ملف Excel مرفق."
      };
    }

    // ✅ تحويل Base64 إلى Buffer
    const buffer = Buffer.from(base64, 'base64');
    console.log(`📦 حجم الملف: ${buffer.length} bytes`);

    // ✅ قراءة ملف Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // ✅ تحويل البيانات إلى JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`📊 عدد الصفوف: ${jsonData.length}`);

    // ✅ تنفيذ التعديل المطلوب
    let modifiedData = [...jsonData];
    
    // إذا كانت التعليمات تطلب إضافة عمود
    const instructionLower = (instruction || "").toLowerCase();
    if (instructionLower.includes('سبب الغياب') || instructionLower.includes('عمود')) {
      // ✅ إضافة عمود جديد بعد عمود الغياب (العمود J في مثالنا)
      // نبحث عن موقع عمود الغياب
      const headerRow = modifiedData[0];
      const colIndex = headerRow.findIndex(col => 
        col && col.toString().includes('غياب')
      );
      
      if (colIndex !== -1) {
        // إضافة عمود جديد بعد عمود الغياب
        modifiedData = modifiedData.map((row, index) => {
          const newRow = [...row];
          if (index === 0) {
            // صف العناوين
            newRow.splice(colIndex + 1, 0, 'سبب الغياب');
          } else {
            // باقي الصفوف (فارغة حالياً)
            newRow.splice(colIndex + 1, 0, '');
          }
          return newRow;
        });
        console.log(`✅ تم إضافة عمود "سبب الغياب" بعد عمود الغياب`);
      } else {
        console.warn(`⚠️ لم يتم العثور على عمود "غياب"`);
        // نضيف العمود في النهاية
        modifiedData = modifiedData.map((row, index) => {
          const newRow = [...row];
          if (index === 0) {
            newRow.push('سبب الغياب');
          } else {
            newRow.push('');
          }
          return newRow;
        });
      }
    }

    // ✅ تحويل البيانات إلى ملف Excel جديد
    const newWorksheet = XLSX.utils.aoa_to_sheet(modifiedData);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);

    const outputBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      success: true,
      message: "✅ تم تعديل ملف Excel بنجاح",
      fileBase64: outputBuffer.toString('base64'),
      fileName: `modified_${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

  } catch (error) {
    console.error("❌ Error in modifyExcelHandler:", error);
    return {
      success: false,
      error: "حدث خطأ أثناء تعديل الملف: " + error.message
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
    const result = await modifyExcelHandler(body);

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      return res.status(200).send(Buffer.from(result.fileBase64, 'base64'));
    }

    return res.status(400).json({ error: result.error || "فشل تعديل الملف" });

  } catch (err) {
    console.error("Error in modify route:", err);
    return res.status(500).json({ error: "خطأ في التعديل: " + err.message });
  }
  }
