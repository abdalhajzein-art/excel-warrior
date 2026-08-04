/**
 * api/tools/external/engines/excel/pivots/ExcelPivot.js
 * Sovereign JS Pivot Engine (In-Memory Analytical Grid - Alatheer AI Suite)
 * محرك جداول محورية سيادي، يعمل داخل الذاكرة، ويحترم نمط الـ Adapter والرادار.
 */

import { ExcelTableDetector } from "../core/ExcelTableDetector.js";
import crypto from "crypto";

export class ExcelPivot {
  constructor(adapter) {
    this.adapter = adapter; // الاعتماد الحصري على المحرك السيادي المحقون
  }

  /* ============================================================
     📊 بناء الجدول المحوري (Sovereign In-Memory Pivot)
     ============================================================ */
  async createPivot(filePath, params = {}) {
    // 1. قراءة البيانات عبر الكشاف/المحرك
    const core = await this.adapter.read(filePath, params);
    
    const sourceSheetName = params.sourceSheet || (core.data[0] && core.data[0].name);
    if (!sourceSheetName) throw new Error("لم يتم العثور على أوراق عمل للتحليل.");

    const sheet = core.data.find(s => s.name === sourceSheetName);
    if (!sheet) throw new Error(`ورقة العمل ${sourceSheetName} غير موجودة.`);

    // 2. استخدام الرادار لتحديد النطاق الحقيقي للبيانات
    const tableInfo = ExcelTableDetector.detectMainTable(sheet);
    if (!tableInfo) throw new Error("تعذر العثور على جدول بيانات صالح لعمل Pivot.");

    const headerRowIdx = tableInfo.headerRowNum - 1;
    const headers = sheet.data[headerRowIdx].map(h => String(h || "").trim());
    const dataRows = sheet.data.slice(tableInfo.dataStartRow - 1, tableInfo.dataEndRow);

    // 3. تحليل المعاملات (Parameters)
    const indexCol = params.index || headers[0]; // محور الصفوف
    const valuesCol = params.values || headers[1]; // القيم المراد حسابها
    const columnsCol = params.columns || null; // محور الأعمدة (اختياري)
    const agg = (params.aggfunc || "sum").toLowerCase(); // دالة التجميع (sum, mean, count, max, min)

    const indexIdx = headers.indexOf(indexCol);
    const valuesIdx = headers.indexOf(valuesCol);
    const columnsIdx = columnsCol ? headers.indexOf(columnsCol) : null;

    if (indexIdx === -1 || valuesIdx === -1) {
      throw new Error(`الأعمدة المطلوبة غير موجودة في الجدول: ${indexCol} أو ${valuesCol}`);
    }

    // 4. بناء شبكة البيانات في الذاكرة (In-Memory Grid)
    const { pivotMap, colKeysSet } = this.buildPivotMap(dataRows, indexIdx, valuesIdx, columnsIdx);

    // 5. تجميع البيانات (Aggregation)
    const aggregated = this.aggregatePivot(pivotMap, agg);

    // 6. تحويل النتيجة إلى مصفوفة ثنائية الأبعاد (Matrix) جاهزة للكتابة
    const pivotMatrix = this.buildPivotMatrix(aggregated, colKeysSet, indexCol, columnsCol, valuesCol);

    // 7. صياغة عمليات التعديل للـ Adapter (للحفاظ على تدفق واحد للكتابة)
    const pivotSheetName = `Pivot_${crypto.randomBytes(2).toString("hex")}`;
    const operations = [
      { type: "add_sheet", sheetName: pivotSheetName },
      // نفترض أن محركنا يدعم إضافة مصفوفة كاملة أو نقوم بتحويلها لصفوف
      ...pivotMatrix.map((row, idx) => ({
        type: "add_row",
        sheet: pivotSheetName,
        rowIndex: idx + 1,
        rowData: row
      })),
      // تنسيق الجدول المحوري ليكون أنيقاً
      { type: "format_table", sheet: pivotSheetName, range: `A1:${this.getColLetter(pivotMatrix[0].length - 1)}${pivotMatrix.length}` }
    ];

    const result = await this.adapter.modify(filePath, { operations });

    return {
      ...result,
      ok: true,
      reply: `تم بناء الجدول المحوري [${agg.toUpperCase()}] بنجاح في ورقة جديدة (${pivotSheetName}).`,
      pivotSheetName,
      summary: this.generatePivotSummary(pivotMatrix, indexCol, valuesCol, columnsCol, agg)
    };
  }

  /* ============================================================
     🧠 خوارزميات الـ Pivot الفرعية (Memory Optimization)
     ============================================================ */
  buildPivotMap(dataRows, indexIdx, valuesIdx, columnsIdx) {
    const pivotMap = {};
    const colKeysSet = new Set();

    dataRows.forEach((row) => {
      const indexKey = String(row[indexIdx] || "N/A").trim();
      const rawValue = row[valuesIdx];
      const value = parseFloat(rawValue) || 0;
      
      const colKey = columnsIdx !== null ? String(row[columnsIdx] || "N/A").trim() : "Total";
      colKeysSet.add(colKey);

      if (!pivotMap[indexKey]) pivotMap[indexKey] = {};
      if (!pivotMap[indexKey][colKey]) pivotMap[indexKey][colKey] = [];

      pivotMap[indexKey][colKey].push(value);
    });

    return { pivotMap, colKeysSet: Array.from(colKeysSet).sort() };
  }

  aggregatePivot(pivotMap, agg) {
    const aggregated = {};
    for (const indexKey in pivotMap) {
      aggregated[indexKey] = {};
      for (const colKey in pivotMap[indexKey]) {
        const arr = pivotMap[indexKey][colKey];
        if (!arr.length) continue;

        switch (agg) {
          case "sum": aggregated[indexKey][colKey] = arr.reduce((a, b) => a + b, 0); break;
          case "mean": aggregated[indexKey][colKey] = arr.reduce((a, b) => a + b, 0) / arr.length; break;
          case "count": aggregated[indexKey][colKey] = arr.length; break;
          case "max": aggregated[indexKey][colKey] = Math.max(...arr); break;
          case "min": aggregated[indexKey][colKey] = Math.min(...arr); break;
          default: aggregated[indexKey][colKey] = arr.reduce((a, b) => a + b, 0);
        }
      }
    }
    return aggregated;
  }

  buildPivotMatrix(aggregated, colKeysArr, indexCol, columnsCol, valuesCol) {
    const matrix = [];
    
    // بناء الهيدر
    const headerRow = [indexCol];
    colKeysArr.forEach(col => {
      headerRow.push(columnsCol ? `${col}` : `Sum of ${valuesCol}`);
    });
    matrix.push(headerRow);

    // تعبئة البيانات
    for (const indexKey in aggregated) {
      const row = [indexKey];
      colKeysArr.forEach((colKey) => {
        // نضع 0 إذا كانت الخلية فارغة لتجنب الثغرات البصرية
        row.push(aggregated[indexKey][colKey] !== undefined ? aggregated[indexKey][colKey] : 0);
      });
      matrix.push(row);
    }

    return matrix;
  }

  getColLetter(index) {
    let temp, letter = '';
    let col = index + 1;
    while (col > 0) {
      temp = (col - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      col = (col - temp - 1) / 26;
    }
    return letter;
  }

  /* ============================================================
     📊 ملخص العملية للـ Agent
     ============================================================ */
  generatePivotSummary(matrix, indexCol, valuesCol, columnsCol, agg) {
    return [
      "📊 **ملخص الجدول المحوري (Sovereign Pivot):**",
      `- المحور (Index): ${indexCol}`,
      `- القيم (Values): ${valuesCol} [${agg.toUpperCase()}]`,
      columnsCol ? `- التصنيف (Columns): ${columnsCol}` : `- تصنيف الأعمدة: لا يوجد`,
      `- إجمالي صفوف النتيجة: ${matrix.length - 1}`,
      `- إجمالي أعمدة النتيجة: ${matrix[0].length}`
    ].join("\n");
  }
}

export default ExcelPivot;
