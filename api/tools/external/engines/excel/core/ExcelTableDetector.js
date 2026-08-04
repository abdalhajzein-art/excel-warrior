/**
 * excel/core/ExcelTableDetector.js – Sovereign Table Detector
 * كشف الهيدر والبيانات داخل أي ورقة ExcelJS بطريقة سيادية موحدة.
 */

export class ExcelTableDetector {
  /**
   * يكتشف الجدول الرئيسي داخل ورقة ExcelJS:
   * - يحدد صف الهيدر
   * - يحدد أول صف بيانات
   * - يحدد آخر صف بيانات
   */
  static detectMainTable(worksheet) {
    const rowCount = worksheet.rowCount || 0;

    let headerRowNum = null;
    let dataStartRow = null;
    let dataEndRow = null;

    // 🔍 1) اكتشاف صف الهيدر: صف يحتوي على 3+ خلايا نصية
    for (let r = 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      let textCells = 0;

      row.eachCell((cell) => {
        const v = cell.value;
        if (typeof v === "string" && v.trim().length > 0) {
          textCells++;
        }
      });

      if (textCells >= 3) {
        headerRowNum = r;
        break;
      }
    }

    if (!headerRowNum) headerRowNum = 1;

    // 🔍 2) أول صف بيانات بعد الهيدر
    for (let r = headerRowNum + 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      let nonEmpty = 0;

      row.eachCell((cell) => {
        const v = cell.value;
        if (v !== null && v !== undefined && String(v).trim().length > 0) {
          nonEmpty++;
        }
      });

      if (nonEmpty > 0) {
        dataStartRow = r;
        break;
      }
    }

    if (!dataStartRow) {
      dataStartRow = headerRowNum + 1;
      dataEndRow = dataStartRow;
      return { headerRowNum, dataStartRow, dataEndRow };
    }

    // 🔍 3) آخر صف بيانات غير فارغ
    let lastDataRow = dataStartRow;

    for (let r = dataStartRow; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      let nonEmpty = 0;

      row.eachCell((cell) => {
        const v = cell.value;
        if (v !== null && v !== undefined && String(v).trim().length > 0) {
          nonEmpty++;
        }
      });

      if (nonEmpty > 0) {
        lastDataRow = r;
      }
    }

    dataEndRow = lastDataRow;

    return { headerRowNum, dataStartRow, dataEndRow };
  }

  /**
   * 🔍 يكتشف رقم عمود بناءً على نص الهيدر
   */
  static findColumnByHeader(worksheet, headerRowNum, columnName) {
    const headerRow = worksheet.getRow(headerRowNum);
    let foundCol = null;

    headerRow.eachCell((cell, colNumber) => {
      const cellVal = String(cell.value || "").trim();
      if (cellVal === String(columnName).trim()) {
        foundCol = colNumber;
      }
    });

    return foundCol;
  }
          }
