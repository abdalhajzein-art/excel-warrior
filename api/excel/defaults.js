// api/excel/defaults.js

export function detectDefaultValues(understood, smartColumns, constraints) {
  const defaults = [];

  understood.tables.forEach((table) => {
    const tableName = table.name;
    const columns = smartColumns.find(t => t.table === tableName)?.columns || [];
    const tableConstraints = constraints.find(c => c.table === tableName)?.constraints || [];

    const tableDefaults = [];

    columns.forEach((col) => {
      const colName = col.column;
      const values = table.rows.map(r => r[col.index]).filter(v => v !== "" && v !== null);

      let defaultValue = null;

      // 1) إذا في DEFAULT من طبقة القيود
      const constraintDefault = tableConstraints.find(c => c.column === colName && c.type === "DEFAULT");
      if (constraintDefault) {
        defaultValue = constraintDefault.value;
      }

      // 2) إذا العمود نصي → القيمة الأكثر تكرارًا
      if (!defaultValue && col.type === "text") {
        defaultValue = findMostCommon(values);
      }

      // 3) إذا العمود رقمي → المتوسط
      if (!defaultValue && col.type === "number") {
        const nums = values.filter(v => typeof v === "number");
        if (nums.length > 0) {
          defaultValue = average(nums);
        }
      }

      // 4) إذا العمود تاريخ → أحدث تاريخ
      if (!defaultValue && col.type === "date") {
        const dates = values.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
        if (dates.length > 0) {
          defaultValue = new Date(Math.max(...dates)).toISOString().split("T")[0];
        }
      }

      // 5) إذا العمود مرتبط بعلاقة → القيمة الأكثر تكرارًا
      if (!defaultValue) {
        const mostCommon = findMostCommon(values);
        if (mostCommon) defaultValue = mostCommon;
      }

      tableDefaults.push({
        column: colName,
        defaultValue,
        reason: defaultValue ? "Detected automatically" : "No default value detected"
      });
    });

    defaults.push({
      table: tableName,
      defaults: tableDefaults
    });
  });

  return defaults;
}

function findMostCommon(values) {
  const freq = {};
  values.forEach(v => freq[v] = (freq[v] || 0) + 1);
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
}

function average(nums) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
