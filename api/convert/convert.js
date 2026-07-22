import { Document, Packer, Paragraph, TextRun } from 'docx';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import XLSX from 'xlsx';

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

    // ============================================================
    // 📊 1️⃣ تحويل Excel → كل الصيغ
    // ============================================================
    if (source.includes('excel') || source.includes('xlsx') || source.includes('xls') || 
        source === 'spreadsheet' || !source) {
      
      // ✅ قراءة الملف باستخدام xlsx
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // ═══════════════════════════════════════════════
      // Excel → CSV
      if (format === 'csv') {
        resultData = data.map(row => 
          row.map(cell => {
            const str = String(cell || '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        ).join('\n');
        contentType = "text/csv";
        fileExtension = "csv";
      }

      // Excel → JSON
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

      // Excel → HTML
      else if (format === 'html') {
        let html = `<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="UTF-8"><title>تحويل من Excel</title>
<style>
  table { border-collapse: collapse; width: 100%; font-family: Arial; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
  th { background-color: #4CAF50; color: white; }
</style>
</head><body><table>\n`;
        data.forEach((row, rowIndex) => {
          html += '  <tr>\n';
          row.forEach(cell => {
            const tag = rowIndex === 0 ? 'th' : 'td';
            html += `    <${tag}>${cell !== undefined ? cell : ''}</${tag}>\n`;
          });
          html += '  </tr>\n';
        });
        html += '</table></body></html>';
        resultData = html;
        contentType = "text/html";
        fileExtension = "html";
      }

      // Excel → TXT
      else if (format === 'txt' || format === 'text') {
        resultData = data.map(row => row.join('\t')).join('\n');
        contentType = "text/plain";
        fileExtension = "txt";
      }

      // Excel → XML
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
        resultData = xml;
        contentType = "application/xml";
        fileExtension = "xml";
      }

      // Excel → SQL
      else if (format === 'sql') {
        let sql = '';
        if (data.length > 1) {
          const headers = data[0];
          const tableName = 'converted_table';
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
        resultData = sql;
        contentType = "text/plain";
        fileExtension = "sql";
      }

      // Excel → Word (DOCX)
      else if (format === 'docx' || format === 'word') {
        const doc = new Document({
          sections: [{
            properties: {},
            children: data.map(row => {
              return new Paragraph({
                children: row.map(cell => {
                  return new TextRun({
                    text: String(cell !== undefined ? cell : ''),
                    size: 24,
                  });
                }),
                spacing: { line: 300 },
              });
            }),
          }],
        });
        const docBuffer = await Packer.toBuffer(doc);
        resultData = docBuffer;
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        fileExtension = "docx";
      }

      // Excel → PDF
      else if (format === 'pdf') {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);
        const { height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        let y = height - 30;
        data.forEach((row) => {
          const text = row.join(' | ');
          if (text.length > 0) {
            page.drawText(text, {
              x: 30,
              y: y,
              size: 10,
              font: font,
            });
            y -= 15;
          }
        });
        const pdfBytes = await pdfDoc.save();
        resultData = Buffer.from(pdfBytes);
        contentType = "application/pdf";
        fileExtension = "pdf";
      }

      // Excel → Image (PNG)
      else if (format === 'png' || format === 'image') {
        const text = data.map(row => row.join(' | ')).join('\n');
        const imageBuffer = await sharp(Buffer.from(text))
          .resize(800, 600, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
          .png()
          .toBuffer();
        resultData = imageBuffer;
        contentType = "image/png";
        fileExtension = "png";
      }
    }

    // ============================================================
    // 📄 2️⃣ تحويل Word → كل الصيغ
    // ============================================================
    else if (source.includes('word') || source.includes('docx') || source.includes('doc')) {
      if (format === 'txt' || format === 'text') {
        const text = "نص مستخرج من ملف Word... (تطوير مستقبلي)";
        resultData = text;
        contentType = "text/plain";
        fileExtension = "txt";
      } else if (format === 'pdf') {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);
        const { height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawText("نص من Word إلى PDF...", { x: 30, y: height - 30, size: 12, font: font });
        const pdfBytes = await pdfDoc.save();
        resultData = Buffer.from(pdfBytes);
        contentType = "application/pdf";
        fileExtension = "pdf";
      } else if (format === 'json') {
        resultData = JSON.stringify({ message: "Word to JSON (تطوير مستقبلي)" }, null, 2);
        contentType = "application/json";
        fileExtension = "json";
      } else {
        return {
          success: false,
          error: `❌ التحويل من Word إلى "${format}" غير مدعوم حالياً.`
        };
      }
    }

    // ============================================================
    // 📄 3️⃣ تحويل PDF → كل الصيغ
    // ============================================================
    else if (source.includes('pdf')) {
      const pdfDoc = await PDFDocument.load(buffer);
      const pageCount = pdfDoc.getPageCount();

      if (format === 'txt' || format === 'text') {
        resultData = `عدد الصفحات: ${pageCount}\nنص مستخرج من PDF... (تطوير مستقبلي)`;
        contentType = "text/plain";
        fileExtension = "txt";
      } else if (format === 'json') {
        resultData = JSON.stringify({ pages: pageCount, message: "PDF to JSON (تطوير مستقبلي)" }, null, 2);
        contentType = "application/json";
        fileExtension = "json";
      } else if (format === 'excel' || format === 'xlsx') {
        const data = [
          ['مستخرج من PDF'],
          ['عدد الصفحات', pageCount]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        resultData = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        fileExtension = "xlsx";
      } else {
        return {
          success: false,
          error: `❌ التحويل من PDF إلى "${format}" غير مدعوم حالياً.`
        };
      }
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
