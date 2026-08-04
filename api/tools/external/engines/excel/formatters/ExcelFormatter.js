/**
 * excel/formatters/ExcelFormatter.js – Sovereign Unified Excel Formatter
 * تنسيق تلقائي سيادي متقدم متوافق مع ExcelEngine الموحد.
 */

export class ExcelFormatter {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /* ============================================================
     🎨 تنسيق تلقائي كامل
     ============================================================ */
  async autoFormat(filePath, params = {}) {
    const core = await this.adapter.read(filePath, params);

    const operations = [
      ...this.formatTable(core),
      ...this.formatHeaders(core),
      ...this.formatByType(core),
      ...this.formatNumbers(core),
      ...this.formatDates(core),
      ...this.autoConditionalFormat(core),
      {
        type: "add_filter",
        from: "A1",
        to: `Z${core.metadata.totalRows + 1}`
      }
    ];

    const result = await this.adapter.modify(filePath, { operations });

    return {
      ...result,
      summary: this.generateFormatSummary(operations),
      operationsApplied: operations.length
    };
  }

  /* ============================================================
     📋 تنسيق الجدول
     ============================================================ */
  formatTable(core) {
    const ops = [];
    const rows = core.metadata.totalRows || 10;
    const cols = core.metadata.totalColumns || 10;
    const lastCol = String.fromCharCode(64 + cols);

    ops.push({
      type: "format_range",
      range: `A1:${lastCol}${rows + 1}`,
      style: {
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" }
        }
      }
    });

    for (let r = 2; r <= rows + 1; r += 2) {
      ops.push({
        type: "format_range",
        range: `A${r}:${lastCol}${r}`,
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F5F5" }
          }
        }
      });
    }

    return ops;
  }

  /* ============================================================
     📋 تنسيق الرؤوس
     ============================================================ */
  formatHeaders(core) {
    const cols = core.metadata.totalColumns || 10;
    const lastCol = String.fromCharCode(64 + cols);

    return [
      {
        type: "format_range",
        range: `A1:${lastCol}1`,
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4F81BD" }
          },
          font: {
            bold: true,
            color: { argb: "FFFFFFFF" },
            size: 12
          },
          alignment: {
            horizontal: "center",
            vertical: "middle"
          }
        }
      }
    ];
  }

  /* ============================================================
     📋 تنسيق حسب نوع البيانات
     ============================================================ */
  formatByType(core) {
    const ops = [];
    const sheets = core.data || [];
    if (!sheets.length) return ops;

    const sheet = sheets[0].data || [];
    if (sheet.length < 2) return ops;

    const headers = sheet[0];
    const rows = sheet.slice(1);

    headers.forEach((header, index) => {
      const col = index + 1;
      const colLetter = String.fromCharCode(64 + col);
      const colData = rows.map(r => r[index]).filter(v => v !== null && v !== undefined);

      const type = this.detectColumnType(colData);

      const alignment =
        type === "number"
          ? "right"
          : type === "date"
          ? "center"
          : "left";

      ops.push({
        type: "format_range",
        range: `${colLetter}2:${colLetter}${rows.length + 1}`,
        style: { alignment: { horizontal: alignment } }
      });
    });

    return ops;
  }

  /* ============================================================
     📋 تنسيق الأرقام
     ============================================================ */
  formatNumbers(core) {
    const ops = [];
    const sheets = core.data || [];
    if (!sheets.length) return ops;

    const sheet = sheets[0].data || [];
    if (sheet.length < 2) return ops;

    const headers = sheet[0];
    const rows = sheet.slice(1);

    headers.forEach((header, index) => {
      const col = index + 1;
      const colLetter = String.fromCharCode(64 + col);
      const colData = rows.map(r => r[index]).filter(v => v !== null && v !== undefined);

      const numeric = colData.map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (numeric.length === colData.length) {
        ops.push({
          type: "format_range",
          range: `${colLetter}2:${colLetter}${rows.length + 1}`,
          style: { alignment: { horizontal: "right" } }
        });
      }
    });

    return ops;
  }

  /* ============================================================
     📋 تنسيق التواريخ
     ============================================================ */
  formatDates(core) {
    const ops = [];
    const sheets = core.data || [];
    if (!sheets.length) return ops;

    const sheet = sheets[0].data || [];
    if (sheet.length < 2) return ops;

    const headers = sheet[0];
    const rows = sheet.slice(1);

    headers.forEach((header, index) => {
      const col = index + 1;
      const colLetter = String.fromCharCode(64 + col);
      const colData = rows.map(r => r[index]).filter(v => v !== null && v !== undefined);

      const dates = colData.map(v => new Date(v)).filter(v => !isNaN(v));
      if (dates.length === colData.length) {
        ops.push({
          type: "format_range",
          range: `${colLetter}2:${colLetter}${rows.length + 1}`,
          style: { alignment: { horizontal: "center" } }
        });
      }
    });

    return ops;
  }

  /* ============================================================
     🎯 تنسيق شرطي تلقائي
     ============================================================ */
  autoConditionalFormat(core) {
    const ops = [];
    const sheets = core.data || [];
    if (!sheets.length) return ops;

    const sheet = sheets[0].data || [];
    if (sheet.length < 2) return ops;

    const headers = sheet[0];
    const rows = sheet.slice(1);

    headers.forEach((header, index) => {
      const col = index + 1;
      const colLetter = String.fromCharCode(64 + col);
      const colData = rows.map(r => r[index]).filter(v => v !== null && v !== undefined);

      const numeric = colData.map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (!numeric.length) return;

      const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;

      ops.push({
        type: "color_cells",
        range: `${colLetter}2:${colLetter}${rows.length + 1}`,
        color: "FF00FF00",
        condition: `> ${avg}`
      });

      ops.push({
        type: "color_cells",
        range: `${colLetter}2:${colLetter}${rows.length + 1}`,
        color: "FFFF0000",
        condition: `< ${avg}`
      });
    });

    return ops;
  }

  /* ============================================================
     🔍 كشف نوع العمود
     ============================================================ */
  detectColumnType(data) {
    const nonEmpty = data.filter(v => v !== null && v !== undefined && v !== "");
    if (!nonEmpty.length) return "empty";

    const numbers = nonEmpty.map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (numbers.length === nonEmpty.length) return "number";

    const dates = nonEmpty.map(v => new Date(v)).filter(v => !isNaN(v));
    if (dates.length === nonEmpty.length) return "date";

    return "text";
  }

  /* ============================================================
     📊 ملخص التنسيق
     ============================================================ */
  generateFormatSummary(operations) {
    const counts = {};
    operations.forEach(op => {
      counts[op.type] = (counts[op.type] || 0) + 1;
    });

    const summary = ["🎨 **ملخص التنسيق التلقائي:**"];
    for (const [type, count] of Object.entries(counts)) {
      summary.push(`- ${type}: ${count}`);
    }

    return summary.join("\n");
  }
        }
