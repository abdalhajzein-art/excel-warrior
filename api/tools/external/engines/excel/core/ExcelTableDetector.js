/**
 * api/tools/external/engines/excel/core/ExcelTableDetector.js
 * Sovereign Table Detector (Advanced Edition - Alatheer AI Suite)
 * رادار ذكي جداً، يتخطى الشعارات، يحلل كثافة البيانات، ويكشف الجداول الحقيقية.
 */

export class ExcelTableDetector {

  /* ============================================================
     🎯 كشف الجدول الرئيسي – العقل الراداري
     ============================================================ */
  static detectMainTable(sheet) {
    const data = sheet.data || [];
    if (!data.length) return null;

    const merges = sheet.merges || [];
    const sheetProps = sheet.sheetProps || {};
    const autoFilter = sheetProps?.autoFilter || null;

    // 1) إذا كان الملف يحتوي على AutoFilter رسمي، نستخرج أبعاده مباشرة
    if (autoFilter) {
      const range = autoFilter.ref || autoFilter;
      return this.parseRangeToTable(range, data);
    }

    // 2) الكشف الذكي بناءً على "كثافة البيانات"
    const headerRowNum = this.detectHeaderRow(data);
    const dataStartRow = this.detectDataStartRow(data, headerRowNum);
    const dataEndRow = this.detectDataEndRow(data, dataStartRow);

    return {
      headerRowNum,
      dataStartRow,
      dataEndRow,
      range: this.buildRange(headerRowNum, dataStartRow, dataEndRow, data)
    };
  }

  /* ============================================================
     🔍 كشف صف الهيدر - يعتمد على الكثافة وتنوع النصوص
     ============================================================ */
  static detectHeaderRow(data) {
    for (let r = 0; r < Math.min(data.length, 20); r++) { // نبحث في أول 20 صف كحد أقصى
      const row = data[r];
      const nonEmptyCells = row.filter(v => String(v || "").trim() !== "");
      
      // كثافة البيانات: يجب أن يحتوي الصف على أكثر من قيمة واحدة ليعتبر هيدر للجدول
      // وتنوع النصوص: نتأكد أنها ليست مجرد أرقام
      const uniqueValues = new Set(nonEmptyCells);
      const hasText = nonEmptyCells.some(v => isNaN(v));

      if (nonEmptyCells.length >= 2 && uniqueValues.size >= 2 && hasText) {
        return r + 1; // إرجاع الرقم بناءً على Index-1 الخاص بـ Excel
      }
    }
    return 1; // Fallback
  }

  /* ============================================================
     🔍 كشف بداية البيانات الفعلية
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
     🔍 كشف نهاية البيانات
     ============================================================ */
  static detectDataEndRow(data, dataStartRow) {
    let lastDataRow = dataStartRow;
    for (let r = dataStartRow - 1; r < data.length; r++) {
      const row = data[r];
      const nonEmpty = row.filter(v => String(v || "").trim() !== "");
      if (nonEmpty.length > 0) {
        lastDataRow = r + 1;
      } else {
        // إذا وجدنا 3 صفوف متتالية فارغة، نعتبر أن الجدول قد انتهى
        if (r + 2 < data.length && this.isEmptyRow(data[r+1]) && this.isEmptyRow(data[r+2])) {
          break;
        }
      }
    }
    return lastDataRow;
  }

  static isEmptyRow(row) {
    if (!row) return true;
    return row.filter(v => String(v || "").trim() !== "").length === 0;
  }

  /* ============================================================
     📐 بناء النطاق وإرجاع التفاصيل
     ============================================================ */
  static buildRange(headerRowNum, dataStartRow, dataEndRow, data) {
    const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
    const startCol = "A";
    const endCol = this.numberToColumn(maxCols);
    return `${startCol}${headerRowNum}:${endCol}${dataEndRow}`;
  }

  /* ============================================================
     🛠️ تحويل رقم عمود إلى حرف (1 -> A, 27 -> AA)
     ============================================================ */
  static numberToColumn(n) {
    let col = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      col = String.fromCharCode(65 + rem) + col;
      n = Math.floor((n - 1) / 26);
    }
    return col || "A";
  }

  /* ============================================================
     📐 تحليل النطاق الجاهز (AutoFilter) إلى تفاصيل
     ============================================================ */
  static parseRangeToTable(rangeStr, data) {
    try {
      const [start, end] = rangeStr.split(":");
      const headerRowNum = parseInt(start.match(/\d+/)[0], 10);
      let dataEndRow = end ? parseInt(end.match(/\d+/)[0], 10) : headerRowNum;
      
      // التأكد من أن نهاية البيانات تتوافق مع طول المصفوفة الفعلي
      if (dataEndRow > data.length) dataEndRow = data.length;

      return {
        headerRowNum: headerRowNum,
        dataStartRow: headerRowNum + 1,
        dataEndRow: dataEndRow,
        range: rangeStr
      };
    } catch (e) {
      return { range: rangeStr }; // Fallback
    }
  }

  /* ============================================================
     🔍 البحث عن عمود بناءً على اسم الهيدر
     ============================================================ */
  static findColumnByHeader(sheet, columnName) {
    const data = sheet.data || [];
    if (!data.length) return null;

    const tableInfo = this.detectMainTable(sheet);
    if (!tableInfo) return null;

    const headerRowIndex = tableInfo.headerRowNum - 1; // تحويل إلى Index-0
    const headerRow = data[headerRowIndex] || [];

    for (let c = 0; c < headerRow.length; c++) {
      if (String(headerRow[c] || "").trim().toLowerCase() === String(columnName).trim().toLowerCase()) {
        return c + 1; // إرجاع بناءً على Index-1
      }
    }
    return null;
  }
}
