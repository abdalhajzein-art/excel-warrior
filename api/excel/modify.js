// api/excel/modify.js
import ExcelJS from "exceljs";

function normalizeArabic(text) {
  if (!text) return "";
  return text
    .toString()
    .replace(/[أإآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[^ء-ي0-9 ]/g, "")
    .trim();
}

function findClosestHeader(userWord, headers) {
  const normalizedUser = normalizeArabic(userWord);
  let bestMatch = null;
  let bestScore = 0;

  headers.forEach(h => {
    const normalizedHeader = normalizeArabic(h);
    let score = 0;

    if (normalizedHeader === normalizedUser) score += 5;
    if (normalizedHeader.includes(normalizedUser)) score += 3;
    if (normalizedUser.includes(normalizedHeader)) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = h;
    }
  });

  return bestMatch;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { base64, editMap } = body || {};

    if (!base64) {
      return res.status(400).json({ error: "لا يوجد ملف Excel مرفوع." });
    }

    const buffer = Buffer.from(base64, "base64");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    const headers = sheet.getRow(1).values.slice(1);

    if (editMap && editMap.operation === "add_column") {
      const newColumnName = editMap.new_column?.name || editMap.new_column;
      const userReference = editMap.position?.after;

      const matchedHeader = findClosestHeader(userReference, headers);

      if (!matchedHeader) {
        return res.status(400).json({
          error: `لم يتم العثور على عمود مطابق لـ "${userReference}".`
        });
      }

      const insertIndex = headers.indexOf(matchedHeader) + 2;
      sheet.spliceColumns(insertIndex, 0, [newColumnName]);

      if (editMap.new_column?.style) {
        const col = sheet.getColumn(insertIndex);
        col.eachCell((cell) => {
          if (editMap.new_column.style.backgroundColor) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: editMap.new_column.style.backgroundColor.replace("#", "") }
            };
          }
          if (editMap.new_column.style.fontWeight === "bold") {
            cell.font = { bold: true };
          }
        });
      }
    }

    const outputBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=modified.xlsx");

    return res.status(200).send(Buffer.from(outputBuffer));

  } catch (error) {
    console.error("خطأ أثناء تعديل الملف:", error);
    return res.status(500).json({ error: "خطأ أثناء تعديل الملف: " + error.message });
  }
}

export async function modifyExcelHandler(payload) {
  return { status: "success", message: "تم تعديل الإكسل بنجاح" };
}
