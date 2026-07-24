// api/excel/fileRebuilder.js

export function rebuildFullFile(
  understood,
  cleaned,
  smartColumns,
  relations,
  keys,
  indexes,
  constraints,
  defaultValues,
  autoFilled,
  smartTables
) {
  const rebuiltSheets = [];

  understood.rawSheets.forEach((sheet) => {
    const sheetName = sheet.name;

    const relatedTables = smartTables.filter(t =>
      t.table.toLowerCase().includes(sheetName.toLowerCase())
    );

    const finalTables = relatedTables.length > 0 ? relatedTables : smartTables;

    const newSheet = {
      name: sheetName + "_rebuilt",
      tables: finalTables,
      metadata: {
        columns: smartColumns,
        relations,
        keys,
        indexes,
        constraints,
        defaults: defaultValues
      }
    };

    rebuiltSheets.push(newSheet);
  });

  return {
    rebuiltSheets,
    summary: `تم إعادة بناء ${rebuiltSheets.length} ورقة بشكل كامل`
  };
}
