/**
 * excel/core/ExcelTableDetector.js – Sovereign Table Detector (Advanced Edition)
 * كشف الجداول والهيدر والبيانات بشكل عام فوق ExcelJS و SheetJS.
 */

export class ExcelTableDetector {

  /* ============================================================
     🎯 كشف الجدول الرئيسي – عام 100٪
     ============================================================ */
  static detectMainTable(sheet) {
    const data = sheet.data || [];
    if (!data.length) return null;

    const merges = sheet.merges || [];
    const sheetProps = sheet.sheetProps || {};
    const autoFilter = sheetProps?.autoFilter || null;

    // 1) إذا في AutoFilter → هذا جدول حقيقي
    if (autoFilter) {
      const range = autoFilter.ref || autoFilter;
      return this.fromRange(range);
    }

    // 2) إذا في merges فوق الصف الأول → الهيدر مو بالضرورة الصف 1
    const headerRowNum = this.detectHeaderRow(data, merges);

    // 3) كشف بداية البيانات
    const dataStartRow = this.detectDataStartRow(data, headerRowNum);

    // 4) كشف نهاية البيانات
    const dataEndRow = this.detectDataEndRow(data, dataStartRow);

    return {
      headerRowNum,
      dataStartRow,
      dataEndRow,
      range: this.buildRange(headerRowNum, dataStartRow, dataEndRow, data)
    };
  }

  /* ============================================================
     🔍 كشف صف الهيدر – عام
     ============================================================ */
  static detectHeaderRow(data, merges) {
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      const nonEmpty = row.filter(v => String(v || "").trim() !== "");

      // هيدر حقيقي = تنوع + نصوص + بدون أرقام فقط
      const diversity = new Set(nonEmpty).size;

      if (nonEmpty.length >= 2 && diversity >= 2) {
        return r + 1; // ExcelJS rows start at 1
      }
    }

    return 1; // fallback
  }

  /* ============================================================
     🔍 كشف بداية البيانات – عام
     ============================================================ */
  static detectDataStartRow(data, headerRowNum) {
    for (let r = headerRowNum; r < data.length; r++) {
      const row = data[r];
      const nonEmpty = row.filter(v => String(v || "").trim() !== "");
      if (nonEmpty.length > 0) return r + 1;
    }
    return headerRowNum + 1;
  }

  /* ============================================================
     🔍 كشف نهاية البيانات – عام
     ============================================================ */
  static detectDataEndRow(data, dataStartRow) {
    let last = dataStartRow;
    for (let r = dataStartRow - 1; r < data.length; r++) {
      const row = data[r];
      const nonEmpty = row.filter(v => String(v || "").trim() !== "");
      if (nonEmpty.length > 0) last = r + 1;
    }
    return last;
  }

  /* ============================================================
     📐 بناء نطاق الجدول
     ============================================================ */
  static buildRange(headerRowNum, dataStartRow, dataEndRow, data) {
    const maxCols = data.reduce((m, r) => Math.max(m, r.length), 0);

    const startCol = "A";
    const endCol = this.numberToColumn(maxCols);

    return `${startCol}${headerRowNum}:${endCol}${dataEndRow}`;
  }

  /* ============================================================
     🔠 تحويل رقم عمود إلى حرف (A → Z → AA → AB)
     ============================================================ */
  static numberToColumn(n) {
    let col = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      col = String.fromCharCode(65 + rem) + col;
      n = Math.floor((n - 1) / 26);
    }
    return col;
  }

  /* ============================================================
     🔍 كشف عمود عبر الهيدر – عام
     ============================================================ */
  static findColumnByHeader(sheet, columnName) {
    const data = sheet.data || [];
    if (!data.length) return null;

    const headerRow = data[0];
    for (let c = 0; c < headerRow.length; c++) {
      if (String(headerRow[c] || "").trim() === String(columnName).trim()) {
        return c + 1; // ExcelJS columns start at 1
      }
    }
    return null;
  }

  /* ============================================================
     📐 استخراج نطاق من AutoFilter أو TableParts
     ============================================================ */
  static fromRange(range) {
    return { range };
  }
      }
