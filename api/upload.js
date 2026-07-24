import ExcelJS from "exceljs";

export const config = {
  api: {
    bodyParser: true
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { filename, data } = req.body;

    if (!data) {
      return res.status(400).json({ error: "لا يوجد بيانات ملف" });
    }

    // تحويل Base64 إلى Buffer
    const buffer = Buffer.from(data, "base64");

    // قراءة الملف عبر ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheetsJSON = [];

    workbook.worksheets.forEach((sheet) => {
      const rows = [];
      const header = [];
      const types = [];
      const formulas = [];
      const teachingRows = [];
      const summaryRows = [];

      sheet.eachRow((row, rowNumber) => {
        const rowValues = row.values.slice(1);

        // صفوف تعليمية
        if (rowValues.some(v => typeof v === "string" && v.includes("حدّث"))) {
          teachingRows.push(rowValues);
          return;
        }

        // رؤوس الأعمدة
        if (rowNumber === 1) {
          header.push(...rowValues);
          return;
        }

        // صفوف ملخص
        if (rowValues.some(v => typeof v === "string" && v.includes("إجمالي"))) {
          summaryRows.push(rowValues);
          return;
        }

        // صفوف البيانات
        rows.push(rowValues);

        // اكتشاف أنواع الأعمدة
        rowValues.forEach((cell, idx) => {
          if (!types[idx]) {
            if (typeof cell === "number") types[idx] = "number";
            else if (typeof cell === "string") types[idx] = "text";
            else types[idx] = "unknown";
          }
        });

        // اكتشاف الصيغ
        row.eachCell((cell, colNumber) => {
          if (cell.formula) {
            formulas[colNumber - 1] = cell.formula;
          }
        });
      });

      // اكتشاف الأعمدة الرقمية
      const numericColumns = types
        .map((t, i) => (t === "number" ? i : null))
        .filter(i => i !== null);

      const charts = [];

      if (numericColumns.length >= 2) {
        charts.push({
          title: "مخطط ذكي تلقائي",
          type: "column",
          sheet: sheet.name,
          dataRange: `A1:${String.fromCharCode(65 + numericColumns[numericColumns.length - 1])}${rows.length + 2}`,
          categoryRange: `A2:A${rows.length + 2}`,
          description: "مخطط تلقائي مبني على الأعمدة الرقمية المكتشفة"
        });
      }

      sheetsJSON.push({
        name: sheet.name,
        header,
        rows,
        types,
        formulas,
        teachingRows,
        summaryRows,
        charts
      });
    });

    // الشكل الجديد المتوافق مع chat.js
    return res.status(200).json([
      {
        fileBase64: data,
        fileName: filename,
        sheets: sheetsJSON
      }
    ]);

  } catch (err) {
    return res.status(500).json({
      error: "فشل قراءة الملف: " + err.message
    });
  }
                                                                                                 }
