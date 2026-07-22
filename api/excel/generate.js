import Groq from 'groq-sdk';
import ExcelJS from 'exceljs';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generateExcelHandler(req, res) {
  try {
    const body = req.body || req || {};
    const { instruction } = body || {};

    console.log(`📝 generateExcelHandler: instruction: ${instruction}`);

    if (!instruction) {
      return { success: false, error: "يرجى توفير تعليمات لتوليد الملف." };
    }

    // ============================================================
    // 🧠 استخدام Groq لتحليل الطلب وتوليد هيكل الملف
    // ============================================================
    const groqResponse = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `أنت خبير في تصميم جداول Excel. بناءً على طلب المستخدم، قم بإنشاء هيكل للجدول المطلوب.

⚠️ **تعليمات مهمة:**
- أجب فقط بـ JSON صالح، بدون أي نصوص إضافية.
- استخدم هذا التنسيق بالضبط:
{
  "sheetName": "اسم الورقة",
  "headers": ["عمود1", "عمود2", ...],
  "rows": [
    ["قيمة1", "قيمة2", ...],
    ...
  ],
  "formulas": {
    "خلية_مثال": "=SUM(A1:A10)"
  }
}

📌 **مثال لطلب "ولّد لي جدول حضور وغياب بـ 10 موظفين":**
{
  "sheetName": "حضور وغياب",
  "headers": ["رقم الموظف", "اسم الموظف", "القسم", "اليوم 1", "اليوم 2", "اليوم 3", "اليوم 4", "اليوم 5", "الحضور", "الغياب", "التأخير", "إجازة", "نسبة الحضور"],
  "rows": [
    ["EMP-001", "أحمد علي", "المبيعات", "حضور", "حضور", "تأخير", "حضور", "حضور", 4, 0, 1, 0, 0.8],
    ["EMP-002", "سارة محمد", "الموارد البشرية", "حضور", "غياب", "حضور", "حضور", "إجازة", 3, 1, 0, 1, 0.6]
  ],
  "formulas": {
    "I4": "=COUNTIF(D4:H4,\"حضور\")",
    "M4": "=IF(COUNTA(D4:H4)=0,0,I4/COUNTA(D4:H4))"
  }
}`
        },
        {
          role: "user",
          content: `طلب التوليد: ${instruction}`
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 2000
    });

    const structureText = groqResponse.choices[0].message.content;
    console.log(`📋 Groq Response: ${structureText}`);

    // ✅ استخراج JSON من الرد
    let structure;
    try {
      const jsonMatch = structureText.match(/\{[\s\S]*\}/);
      structure = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    } catch (parseErr) {
      console.error("❌ فشل تحليل JSON من Groq:", parseErr);
      return {
        success: false,
        error: "فشل فهم الطلب. يرجى إعادة الصياغة بشكل أوضح."
      };
    }

    if (!structure.headers || structure.headers.length === 0) {
      return {
        success: false,
        error: "لم يتم تحديد أعمدة للجدول. يرجى طلب محدد."
      };
    }

    // ============================================================
    // 📊 توليد الملف باستخدام exceljs (مع الألوان)
    // ============================================================
    console.log('📊 استخدام exceljs للتوليد مع الألوان');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(structure.sheetName || 'Sheet1');

    // ✅ إضافة العناوين مع ألوان
    const headerRow = worksheet.getRow(1);
    structure.headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      // ✅ تنسيق العنوان: خلفية زرقاء، خط أبيض، عريض
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2E75B6' } // أزرق
      };
      cell.font = {
        color: { argb: 'FFFFFFFF' }, // أبيض
        bold: true,
        size: 12
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // ✅ إضافة الصفوف مع تنسيق متناوب (Zebra Striping)
    if (structure.rows && structure.rows.length > 0) {
      structure.rows.forEach((row, rowIndex) => {
        const excelRow = worksheet.getRow(rowIndex + 2);
        row.forEach((value, colIndex) => {
          const cell = excelRow.getCell(colIndex + 1);
          cell.value = value;
          
          // ✅ تنسيق متناوب: صفوف زوجية لونها فاتح
          if (rowIndex % 2 === 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF2F2F2' } // رمادي فاتح
            };
          } else {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' } // أبيض
            };
          }
          
          // ✅ محاذاة النص
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };
          
          // ✅ حدود للخلايا
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
    }

    // ✅ تطبيق الصيغ (إذا وجدت)
    if (structure.formulas) {
      Object.entries(structure.formulas).forEach(([cellRef, formula]) => {
        try {
          const cell = worksheet.getCell(cellRef);
          cell.value = { formula: formula };
        } catch (e) {
          console.warn(`⚠️ فشل إضافة الصيغة في ${cellRef}: ${e.message}`);
        }
      });
    }

    // ✅ ضبط عرض الأعمدة تلقائياً
    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const cellValue = cell.value ? cell.value.toString() : '';
        if (cellValue.length > maxLength) {
          maxLength = cellValue.length;
        }
      });
      column.width = Math.min(maxLength + 2, 30);
    });

    // ✅ حفظ الملف
    const outputBuffer = await workbook.xlsx.writeBuffer();

    return {
      success: true,
      message: `✅ تم توليد الملف بنجاح مع تنسيق احترافي`,
      fileBase64: outputBuffer.toString('base64'),
      fileName: `generated_${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

  } catch (error) {
    console.error("❌ Error in generateExcelHandler:", error);
    return {
      success: false,
      error: "حدث خطأ أثناء توليد الملف: " + error.message
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
    const result = await generateExcelHandler(body);

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", result.contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      return res.status(200).send(Buffer.from(result.fileBase64, 'base64'));
    }

    return res.status(400).json({ error: result.error || "فشل توليد الملف" });

  } catch (err) {
    console.error("Error in generate route:", err);
    return res.status(500).json({ error: "خطأ في التوليد: " + err.message });
  }
}
