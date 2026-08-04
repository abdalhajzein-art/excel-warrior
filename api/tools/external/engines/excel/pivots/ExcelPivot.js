/**
 * excel/pivots/ExcelPivot.js – Sovereign JS Pivot Engine
 * إنشاء جداول محورية داخل ExcelJS بدون Python.
 */

import ExcelJS from "exceljs";
import { FileUtils } from "../utils/FileUtils.js";

export class ExcelPivot {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /* ============================================================
     📊 إنشاء جدول محوري داخل الإكسل
     ============================================================ */
  async createPivot(filePath, params = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const ws = workbook.getWorksheet(1);
    if (!ws) throw new Error("لا توجد ورقة عمل في الملف.");

    const rows = ws.getSheetValues().slice(2); // تجاهل الصف الأول الفارغ من ExcelJS
    const headers = ws.getRow(1).values.slice(1);

    const indexCol = params.index || headers[0];
    const valuesCol = params.values || headers[1];
    const columnsCol = params.columns || null;
    const agg = params.aggfunc || "sum";

    const indexIdx = headers.indexOf(indexCol);
    const valuesIdx = headers.indexOf(valuesCol);
    const columnsIdx = columnsCol ? headers.indexOf(columnsCol) : null;

    const pivot = {};

    rows.forEach((row) => {
      if (!row) return;

      const indexKey = row[indexIdx];
      const value = parseFloat(row[valuesIdx]) || 0;
      const colKey = columnsIdx !== null ? row[columnsIdx] : "value";

      pivot[indexKey] = pivot[indexKey] || {};
      pivot[indexKey][colKey] = pivot[indexKey][colKey] || [];

      pivot[indexKey][colKey].push(value);
    });

    const aggregated = {};
    for (const indexKey in pivot) {
      aggregated[indexKey] = {};
      for (const colKey in pivot[indexKey]) {
        const arr = pivot[indexKey][colKey];
        if (agg === "sum") aggregated[indexKey][colKey] = arr.reduce((a, b) => a + b, 0);
        if (agg === "mean") aggregated[indexKey][colKey] = arr.reduce((a, b) => a + b, 0) / arr.length;
        if (agg === "count") aggregated[indexKey][colKey] = arr.length;
      }
    }

    const pivotSheet = workbook.addWorksheet("Pivot");

    const pivotHeaders = ["Index", ...(columnsIdx !== null ? [...new Set(rows.map(r => r[columnsIdx]))] : ["Value"])];
    pivotSheet.addRow(pivotHeaders);

    for (const indexKey in aggregated) {
      const row = [indexKey];
      pivotHeaders.slice(1).forEach((col) => {
        row.push(aggregated[indexKey][col] || 0);
      });
      pivotSheet.addRow(row);
    }

    const outPath = FileUtils.getTempPath("pivot");
    await workbook.xlsx.writeFile(outPath);

    return {
      ok: true,
      reply: "تم إنشاء الجدول المحوري بنجاح داخل الإكسل.",
      filePath: outPath,
      fileBase64: await FileUtils.fileToBase64(outPath),
      fileName: "pivot.xlsx",
      pivot: aggregated,
      summary: this.generatePivotSummary(aggregated)
    };
  }

  /* ============================================================
     📊 ملخص الجدول المحوري
     ============================================================ */
  generatePivotSummary(pivot) {
    const rows = Object.keys(pivot).length;
    const cols = rows ? Object.keys(pivot[Object.keys(pivot)[0]]).length : 0;

    return [
      "📊 **ملخص الجدول المحوري:**",
      `- عدد الصفوف: ${rows}`,
      `- عدد الأعمدة: ${cols}`,
      `- تم إنشاء Pivot داخل الإكسل بدون Python`
    ].join("\n");
  }
                                                                     }
