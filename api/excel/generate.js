import { Workbook } from 'xml-xlsx-lite';
import Groq from 'groq-sdk';

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
  },
  "charts": [
    {
      "type": "column|line|pie|bar",
      "dataRange": "A1:B10",
      "title": "عنوان المخطط"
    }
  ],
  "pivotTables": [
    {
      "sourceRange": "A1:D100",
      "rows": ["اسم_عمود_للصفوف"],
      "cols": ["اسم_عمود_للأعمدة"],
      "values": [{ "name": "اسم_عمود_القيم", "agg": "sum|count|average", "displayName": "اسم_العرض" }]
    }
  ],
  "conditionalFormats": [
    {
      "range": "A1:A10",
      "type": "cellValue",
      "operator": "greaterThan",
      "value": 100,
      "format": { "fill": { "color": "FF0000" } }
    }
  ]
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
  },
  "charts": [
    {
      "type": "column",
      "dataRange": "A4:B13",
      "title": "عدد الحضور لكل موظف"
    }
  ],
  "pivotTables": [
    {
      "sourceRange": "A1:M13",
      "rows": ["القسم"],
      "cols": ["اليوم 1"],
      "values": [{ "name": "نسبة الحضور", "agg": "average", "displayName": "متوسط نسبة الحضور" }]
    }
  ]
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
    // 📊 إنشاء الملف بناءً على الهيكل من Groq
    // ============================================================
    const workbook = new Workbook();
    const sheetName = structure.sheetName || 'Sheet1';
    const worksheet = workbook.addWorksheet(sheetName);

    // ✅ إضافة العناوين
    structure.headers.forEach((header, index) => {
      worksheet.getCell(1, index + 1).value = header;
    });

    // ✅ إضافة الصفوف
    if (structure.rows && structure.rows.length > 0) {
      structure.rows.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
          worksheet.getCell(rowIndex + 2, colIndex + 1).value = value;
        });
      });
    }

    // ✅ إضافة الصيغ (Formulas)
    if (structure.formulas) {
      Object.entries(structure.formulas).forEach(([cell, formula]) => {
        try {
          worksheet.getCell(cell).value = { formula: formula };
        } catch (e) {
          console.warn(`⚠️ فشل إضافة الصيغة في ${cell}: ${e.message}`);
        }
      });
    }

    // ✅ إضافة المخططات (Charts)
    if (structure.charts && structure.charts.length > 0) {
      structure.charts.forEach((chart, index) => {
        try {
          const chartSheet = workbook.addWorksheet(`مخطط ${index + 1}`);
          workbook.addChart({
            type: chart.type || 'column',
            dataSheet: worksheet.name,
            dataRange: chart.dataRange || 'A1:B10',
            targetSheet: chartSheet.name,
            anchorCell: 'A1',
            title: chart.title || 'مخطط البيانات'
          });
        } catch (e) {
          console.warn(`⚠️ فشل إضافة المخطط ${index + 1}: ${e.message}`);
        }
      });
    }

    // ✅ إضافة الجداول المحورية (Pivot Tables)
    if (structure.pivotTables && structure.pivotTables.length > 0) {
      structure.pivotTables.forEach((pivot, index) => {
        try {
          const pivotSheet = workbook.addWorksheet(`جدول محوري ${index + 1}`);
          workbook.addPivotTable({
            sourceSheet: worksheet.name,
            sourceRange: pivot.sourceRange || 'A1:Z100',
            targetSheet: pivotSheet.name,
            anchorCell: 'A3',
            layout: {
              rows: pivot.rows ? pivot.rows.map(name => ({ name })) : [{ name: 'الصفوف' }],
              cols: pivot.cols ? pivot.cols.map(name => ({ name })) : [{ name: 'الأعمدة' }],
              values: pivot.values || [{ name: 'القيم', agg: 'sum', displayName: 'الإجمالي' }]
            }
          });
        } catch (e) {
          console.warn(`⚠️ فشل إضافة الجدول المحوري ${index + 1}: ${e.message}`);
        }
      });
    }

    // ✅ إضافة التنسيق الشرطي (Conditional Formatting)
    if (structure.conditionalFormats && structure.conditionalFormats.length > 0) {
      structure.conditionalFormats.forEach((cf) => {
        try {
          const range = worksheet.getRange(cf.range);
          // تطبيق التنسيق الشرطي (يعتمد على المكتبة)
          // xml-xlsx-lite يدعم التنسيق الشرطي عبر واجهة مشابهة
          if (cf.type === 'cellValue') {
            range.conditionalFormat({
              type: 'cellValue',
              operator: cf.operator || 'greaterThan',
              value: cf.value || 0,
              format: cf.format || { fill: { color: 'FF0000' } }
            });
          }
        } catch (e) {
          console.warn(`⚠️ فشل إضافة التنسيق الشرطي: ${e.message}`);
        }
      });
    }

    // ============================================================
    // 💾 حفظ الملف
    // ============================================================
    const outputBuffer = await workbook.writeToBuffer();

    return {
      success: true,
      message: `✅ تم توليد الملف بنجاح بناءً على طلبك: "${instruction}"`,
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
