import sys
import json
import openpyxl
import pandas as pd

MAX_PREVIEW_ROWS = 15
MAX_FORMULAS = 50
MAX_CHARTS = 20

def safe_str(value):
    try:
        if value is None:
            return ""
        return str(value)
    except Exception:
        return ""

def extract_sheet_preview(wb, sheet_name, file_path, max_rows=MAX_PREVIEW_ROWS):
    ws = wb[sheet_name]

    # 1) Preview جدولي نظيف (يفضل على markdown)
    preview_rows = []
    rows_count = 0
    cols_count = ws.max_column

    try:
        df = pd.read_excel(file_path, sheet_name=sheet_name, nrows=max_rows)
        rows_count = len(df)
        cols_count = len(df.columns)
        preview_rows = [list(map(safe_str, row)) for row in df.values.tolist()]
    except Exception:
        for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=max_rows, values_only=True), start=1):
            preview_rows.append([safe_str(c) for c in row])
            rows_count = r_idx

    # 2) كشف الصيغ بشكل حقيقي
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

    # 3) كشف الدمج
    merged_cells = []
    for rng in ws.merged_cells.ranges:
        merged_cells.append({
            "range": str(rng),
            "bounds": {
                "min_row": rng.min_row,
                "max_row": rng.max_row,
                "min_col": rng.min_col,
                "max_col": rng.max_col,
            }
        })

    # 4) كشف القوائم المنسدلة (Data Validation)
    data_validations = []
    if hasattr(ws, "data_validations") and ws.data_validations is not None:
        try:
            for dv in ws.data_validations.dataValidation:
                data_validations.append({
                    "type": dv.type,
                    "sqref": str(dv.sqref),
                    "formula1": safe_str(getattr(dv, "formula1", None)),
                    "formula2": safe_str(getattr(dv, "formula2", None)),
                })
        except Exception:
            pass

    # 5) كشف التنسيقات الشرطية (Conditional Formatting)
    conditional_formats = []
    if hasattr(ws, "conditional_formatting") and ws.conditional_formatting is not None:
        try:
            for cf in ws.conditional_formatting:
                conditional_formats.append({
                    "sqref": str(cf.sqref),
                    "type": cf.__class__.__name__,
                })
        except Exception:
            pass

    # 6) كشف المخططات (Charts) بدون كسر JSON
    charts = []
    if hasattr(ws, "_charts") and ws._charts:
        for chart in ws._charts[:MAX_CHARTS]:
            title_text = None
            try:
                if getattr(chart, "title", None):
                    # بعض العناوين تكون RichText أو Object، نحاول نجيب النص فقط
                    if hasattr(chart.title, "tx") and hasattr(chart.title.tx, "rich"):
                        # نحاول نقرأ أول جزء نصي
                        runs = chart.title.tx.rich.paragraphs[0].runs
                        if runs:
                            title_text = safe_str(runs[0].text)
                    else:
                        title_text = safe_str(chart.title)
            except Exception:
                title_text = None

            charts.append({
                "type": chart.__class__.__name__,
                "title": title_text,
            })

    # 7) كشف الجداول (Tables)
    tables = []
    if hasattr(ws, "tables"):
        try:
            for tbl in ws.tables.values():
                tables.append({
                    "name": tbl.displayName,
                    "ref": str(tbl.ref),
                })
        except Exception:
            pass

    return {
        "sheet": sheet_name,
        "rows": rows_count,
        "columns": cols_count,
        "preview_rows": preview_rows,
        "formulas": formulas,
        "merged": merged_cells,
        "data_validations": data_validations,
        "conditional_formats": conditional_formats,
        "charts": charts,
        "tables": tables,
    }


def main():
    try:
        file_path = sys.argv[1]
    except IndexError:
        print(json.dumps({"error": "لم يتم تمرير مسار ملف إكسل إلى السكربت."}, ensure_ascii=False))
        return

    try:
        wb = openpyxl.load_workbook(file_path, data_only=False)
        sheet_names = wb.sheetnames

        sheets_preview = []
        for sheet in sheet_names:
            sheets_preview.append(extract_sheet_preview(wb, sheet, file_path))

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
