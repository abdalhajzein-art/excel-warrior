import sys
import json
import openpyxl

MAX_PREVIEW_ROWS = 15
MAX_FORMULAS = 50

def safe_str(value):
    try:
        return "" if value is None else str(value)
    except:
        return ""

def extract_sheet_preview(wb, sheet_name, max_rows=MAX_PREVIEW_ROWS):
    ws = wb[sheet_name]

    # Preview بسيط
    preview_rows = []
    rows_count = 0
    cols_count = ws.max_column

    for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=max_rows, values_only=True), start=1):
        preview_rows.append([safe_str(c) for c in row])
        rows_count = r_idx

    # كشف الصيغ فقط
    formulas = []
    for row in ws.iter_rows():
        for cell in row:
            if isinstance(cell.value, str) and cell.value.startswith("="):
                formulas.append({
                    "cell": cell.coordinate,
                    "formula": cell.value
                })
                if len(formulas) >= MAX_FORMULAS:
                    break
        if len(formulas) >= MAX_FORMULAS:
            break

    # كشف الدمج فقط
    merged_cells = [str(rng) for rng in ws.merged_cells.ranges]

    return {
        "sheet": sheet_name,
        "rows": rows_count,
        "columns": cols_count,
        "preview_rows": preview_rows,
        "formulas": formulas,
        "merged": merged_cells
    }

def main():
    try:
        file_path = sys.argv[1]
    except IndexError:
        print(json.dumps({"error": "لم يتم تمرير مسار ملف إكسل."}, ensure_ascii=False))
        return

    try:
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

if __name__ == "__main__":
    main()
