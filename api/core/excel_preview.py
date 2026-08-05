import sys
import json
import pandas as pd
import openpyxl

def extract_sheet_preview(wb, sheet_name, max_rows=10):
    ws = wb[sheet_name]

    # قراءة أول 10 صفوف عبر pandas (أسرع)
    try:
        df = pd.read_excel(sys.argv[1], sheet_name=sheet_name, nrows=max_rows)
        preview_text = df.to_markdown(index=False)
        rows = len(df)
        columns = len(df.columns)
    except Exception:
        # fallback عبر openpyxl
        rows = 0
        columns = ws.max_column
        preview_rows = []
        for r in ws.iter_rows(min_row=1, max_row=max_rows, values_only=True):
            preview_rows.append(list(r))
        preview_text = "\n".join(str(r) for r in preview_rows)

    # كشف الصيغ
    formulas = []
    for row in ws.iter_rows():
        for cell in row:
            if isinstance(cell.value, str) and cell.value.startswith("="):
                formulas.append({
                    "cell": cell.coordinate,
                    "formula": cell.value
                })

    # كشف الدمج
    merged_cells = [str(rng) for rng in ws.merged_cells.ranges]

    # كشف المخططات (Charts)
    charts = []
    if hasattr(ws, "_charts"):
        for chart in ws._charts:
            charts.append({
                "type": chart.__class__.__name__,
                "title": getattr(chart, "title", None),
            })

    return {
        "sheet": sheet_name,
        "rows": rows,
        "columns": columns,
        "preview": preview_text,
        "formulas": formulas[:20],       # نرجّع أول 20 صيغة فقط
        "merged": merged_cells,
        "charts": charts
    }


try:
    file_path = sys.argv[1]
    wb = openpyxl.load_workbook(file_path, data_only=False)

    sheet_names = wb.sheetnames
    sheets_preview = []

    for sheet in sheet_names:
        sheets_preview.append(extract_sheet_preview(wb, sheet))

    output = {
        "file": file_path,
        "sheets_count": len(sheet_names),
        "sheets": sheet_names,
        "previews": sheets_preview
    }

    print(json.dumps(output, ensure_ascii=False))

except Exception as e:
    print(json.dumps({"error": str(e)}, ensure_ascii=False))
