// api/excel/constraints.js

export function detectConstraints(understood, smartColumns, keys) {
  const constraints = [];

  understood.tables.forEach((table) => {
    const tableName = table.name;
    const columns = smartColumns.find(t => t.table === tableName)?.columns || [];
    const tableKeys = keys.find(k => k.table === tableName);

    const tableConstraints = [];

    columns.forEach((col) => {
      const name = col.column.toLowerCase();

      // NOT NULL
      if (col.totalValues > 0 && col.textValues === 0 && col.numericValues === 0) {
        tableConstraints.push({
          column: col.column,
          type: "NOT NULL",
          reason: "Column has no empty values"
        });
      }

      // UNIQUE
      const values = table.rows.map(r => r[col.index]).filter(v => v !== "" && v !== null);
      const uniqueCount = new Set(values).size;
      if (uniqueCount === values.length && values.length > 0) {
        tableConstraints.push({
          column: col.column,
          type: "UNIQUE",
          reason: "All values are unique"
        });
      }

      // CHECK (numeric > 0)
      if (col.type === "number") {
        const negatives = values.filter(v => v < 0);
        if (negatives.length === 0) {
          tableConstraints.push({
            column: col.column,
            type: "CHECK",
            rule: "value > 0",
            reason: "No negative numbers detected"
          });
        }
      }

      // DEFAULT (text columns)
      if (col.type === "text") {
        const mostCommon = findMostCommon(values);
        if (mostCommon) {
          tableConstraints.push({
            column: col.column,
            type: "DEFAULT",
            value: mostCommon,
            reason: "Most common value detected"
          });
        }
      }

      // AUTO_INCREMENT
      if (tableKeys?.primaryKey === col.column) {
        const isSequential = checkSequential(values);
        if (isSequential) {
          tableConstraints.push({
            column: col.column,
            type: "AUTO_INCREMENT",
            reason: "Primary key appears sequential"
          });
        }
      }
    });

    constraints.push({
      table: tableName,
      constraints: tableConstraints
    });
  });

  return constraints;
}

function findMostCommon(values) {
  const freq = {};
  values.forEach(v => freq[v] = (freq[v] || 0) + 1);
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
}

function checkSequential(values) {
  const nums = values.filter(v => typeof v === "number").sort((a, b) => a - b);
  if (nums.length < 2) return false;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) return false;
  }
  return true;
                                        }
