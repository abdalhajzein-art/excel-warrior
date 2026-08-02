import sys
import os
import json
from openpyxl import load_workbook

def extract_metadata(file_path):
    if not os.path.exists(file_path):
        return {"error": "File not found"}

    ext = os.path.splitext(file_path)[1].lower()
    size_bytes = os.path.getsize(file_path)

    meta = {
        "file_name": os.path.basename(file_path),
        "extension": ext,
        "size_kb": round(size_bytes / 1024, 2),
        "type": "unknown",
        "details": {}
    }

    try:
        # معالجة ملفات Excel عبر openpyxl فقط
        if ext in ['.xlsx', '.xlsm']:
            meta["type"] = "excel"
            wb = load_workbook(file_path, data_only=True)
            sheets_meta = {}

            for sheet_name in wb.sheetnames:
                ws = wb[sheet_name]

                # قراءة أول 5 صفوف فقط
                sample_rows = []
                for row in ws.iter_rows(min_row=1, max_row=5, values_only=True):
                    sample_rows.append([str(v) if v is not None else "" for v in row])

                sheets_meta[sheet_name] = {
                    "total_rows": ws.max_row,
                    "total_columns": ws.max_column,
                    "sample_rows": sample_rows
                }

            meta["details"]["sheets"] = sheets_meta

        elif ext == ".csv":
            meta["type"] = "csv"
            # قراءة CSV عبر بايثون فقط بدون pandas
            import csv
            with open(file_path, newline='', encoding='utf-8') as f:
                reader = csv.reader(f)
                rows = list(reader)

            sample = rows[:5]
            meta["details"] = {
                "total_rows": len(rows),
                "total_columns": len(rows[0]) if rows else 0,
                "sample_rows": sample
            }

        elif ext == ".docx":
            meta["type"] = "word"
            import docx
            doc = docx.Document(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            meta["details"] = {
                "total_paragraphs": len(doc.paragraphs),
                "sample_text": paragraphs[:3]
            }

        elif ext == ".pdf":
            meta["type"] = "pdf"
            import PyPDF2
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                num_pages = len(reader.pages)
                first_page_text = reader.pages[0].extract_text() if num_pages > 0 else ""
                meta["details"] = {
                    "total_pages": num_pages,
                    "sample_text_page_1": first_page_text[:400]
                }

    except Exception as e:
        meta["error"] = str(e)

    return meta

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    target_path = sys.argv[1]
    result = extract_metadata(target_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))
