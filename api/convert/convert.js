import { Workbook } from 'xml-xlsx-lite';

export async function convertFileHandler(req, res) {
  try {
    const { base64, targetFormat } = req.body || {};

    if (!base64 || !targetFormat) {
      return { 
        success: false, 
        error: "البيانات غير مكتملة. يرجى توفير الملف والصيغة المطلوبة." 
      };
    }

    // ✅ قراءة الملف باستخدام xml-xlsx-lite
    const buffer = Buffer.from(base64, 'base64');
    const workbook = new Workbook();
    await workbook.loadFromBuffer(buffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return { success: false, error: "لا يوجد ورقة عمل في الملف." };
    }

    // ✅ قراءة البيانات
    const rowCount = worksheet.getRowCount();
    const colCount = worksheet.getColumnCount();
    
    // ✅ بناء مصفوفة البيانات
    const data = [];
    for (let i = 1; i <= rowCount; i++) {
      const row = [];
      for (let j = 1; j <= colCount; j++) {
        const cell = worksheet.getCell(i, j);
        row.push(cell.value !== undefined ? cell.value : '');
      }
      data.push(row);
    }

    let resultData = "";
    let contentType = "application/json";
    let fileExtension = "json";
    const format = targetFormat.toLowerCase();

    // ============================================================
    // 1️⃣ تحويل إلى CSV
    // ============================================================
    if (format === 'csv') {
      // معالجة القيم التي تحتوي على فواصل
      resultData = data.map(row => 
        row.map(cell => {
          const str = String(cell);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      ).join('\n');
      contentType = "text/csv";
      fileExtension = "csv";
    }

    // ============================================================
    // 2️⃣ تحويل إلى JSON (كائنات)
    // ============================================================
    else if (format === 'json') {
      if (data.length > 1) {
        const headers = data[0];
        const jsonData = [];
        for (let i = 1; i < data.length; i++) {
          const obj = {};
          for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = data[i][j] !== undefined ? data[i][j] : '';
          }
          jsonData.push(obj);
        }
        resultData = JSON.stringify(jsonData, null, 2);
      } else {
        resultData = JSON.stringify([], null, 2);
      }
      contentType = "application/json";
      fileExtension = "json";
    }

    // ============================================================
    // 3️⃣ تحويل إلى JSON (مصفوفة مصفوفات) - الخيار الثاني
    // ============================================================
    else if (format === 'json-raw' || format === 'json_array') {
      resultData = JSON.stringify(data, null, 2);
      contentType = "application/json";
      fileExtension = "json";
    }

    // ============================================================
    // 4️⃣ تحويل إلى TXT (جدول نصي)
    // ============================================================
    else if (format === 'txt' || format === 'text') {
      // نحدد عرض كل عمود
      const colWidths = [];
      for (let j = 0; j < colCount; j++) {
        let maxWidth = 0;
        for (let i = 0; i < rowCount; i++) {
          const cell = data[i]?.[j] !== undefined ? String(data[i][j]) : '';
          maxWidth = Math.max(maxWidth, cell.length);
        }
        colWidths.push(Math.min(maxWidth + 2, 20)); // حد أقصى 20
      }

      // بناء الجدول النصي
      const rows = data.map(row => {
        return row.map((cell, j) => {
          const str = String(cell || '');
          return str.padEnd(colWidths[j]);
        }).join('| ');
      }).join('\n');

      // إضافة خط فاصل
      const separator = colWidths.map(w => '-'.repeat(w)).join('|-');
      resultData = rows.split('\n').map((row, i) => {
        if (i === 1) {
          return row + '\n' + separator;
        }
        return row;
      }).join('\n');

      contentType = "text/plain";
      fileExtension = "txt";
    }

    // ============================================================
    // 5️⃣ تحويل إلى HTML (جدول)
    // ============================================================
    else if (format === 'html') {
      let html = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <table>
`;
      data.forEach((row, rowIndex) => {
        html += '    <tr>\n';
        row.forEach(cell => {
          const tag = rowIndex === 0 ? 'th' : 'td';
          html += `      <${tag}>${cell !== undefined ? cell : ''}</${tag}>\n`;
        });
        html += '    </tr>\n';
      });
      html += `  </table>\n</body>\n</html>`;
      contentType = "text/html";
      fileExtension = "html";
    }

    // ============================================================
    // 6️⃣ تحويل إلى Markdown
    // ============================================================
    else if (format === 'md' || format === 'markdown') {
      let md = '';
      data.forEach((row, rowIndex) => {
        md += '| ' + row.map(cell => cell !== undefined ? cell : '').join(' | ') + ' |\n';
        if (rowIndex === 0) {
          md += '|' + row.map(() => ' --- ').join('|') + '|\n';
        }
      });
      contentType = "text/markdown";
      fileExtension = "md";
    }

    // ============================================================
    // 7️⃣ تحويل إلى XML
    // ============================================================
    else if (format === 'xml') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';
      if (data.length > 1) {
        const headers = data[0];
        for (let i = 1; i < data.length; i++) {
          xml += '  <row>\n';
          for (let j = 0; j < headers.length; j++) {
            xml += `    <${headers[j]}>${data[i][j] !== undefined ? data[i][j] : ''}</${headers[j]}>\n`;
          }
          xml += '  </row>\n';
        }
      }
      xml += '</data>';
      contentType = "application/xml";
      fileExtension = "xml";
    }

    // ============================================================
    // 8️⃣ تحويل إلى SQL (INSERT)
    // ============================================================
    else if (format === 'sql') {
      let sql = '';
      if (data.length > 1) {
        const headers = data[0];
        const tableName = 'table1';
        sql += `INSERT INTO ${tableName} (${headers.join(', ')}) VALUES\n`;
        const values = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const rowValues = row.map(cell => {
            if (cell === undefined || cell === '') return 'NULL';
            return `'${String(cell).replace(/'/g, "''")}'`;
          });
          values.push(`(${rowValues.join(', ')})`);
        }
        sql += values.join(',\n');
        sql += ';';
      }
      contentType = "text/plain";
      fileExtension = "sql";
    }

    // ============================================================
    // 9️⃣ صيغة غير مدعومة
    // ============================================================
    else {
      return {
        success: false,
        error: `❌ الصيغة "${targetFormat}" غير مدعومة. الصيغ المدعومة: csv, json, json-raw, txt, html, md, xml, sql`
      };
    }

    // ✅ إرجاع الملف المحول
    const convertedBase64 = Buffer.from(resultData, 'utf8').toString('base64');

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
