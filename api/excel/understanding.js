// api/excel/understanding.js

export function understandExcel(sheets) {
  const result = {
    tables: [],
    teaching: [],
    summary: [],
    dashboard: [],
    rawSheets: sheets
  };

  sheets.forEach((sheet) => {
    const { name, header, rows, teachingRows, summaryRows } = sheet;

    // اكتشاف الجداول
    const table = {
      name,
      columns: header.filter(h => h && h.toString().trim() !== ""),
      rows: [],
    };

    // تنظيف الصفوف
    rows.forEach((row) => {
      const cleanRow = row.map((cell) => {
        if (cell === null || cell === undefined) return "";
        if (typeof cell === "string") return cell.trim();
        return cell;
      });

      // تجاهل الصفوف الفارغة
      const isEmpty = cleanRow.every(c => c === "" || c === null);
      if (!isEmpty) table.rows.push(cleanRow);
    });

    // إضافة الجدول
    if (table.columns.length > 0 && table.rows.length > 0) {
      result.tables.push(table);
    }

    // صفوف تعليمية
    if (teachingRows && teachingRows.length > 0) {
      result.teaching.push({
        sheet: name,
        rows: teachingRows
      });
    }

    // صفوف ملخص
    if (summaryRows && summaryRows.length > 0) {
      result.summary.push({
        sheet: name,
        rows: summaryRows
      });
    }

    // Dashboard (أي ورقة فيها أكثر من جدول أو خلايا غير متناسقة)
    if (header.length === 0 || rows.length === 0) {
      result.dashboard.push({
        sheet: name,
        note: "ورقة تحتوي على عناصر غير جدولية أو Dashboard"
      });
    }
  });

  return result;
        }
