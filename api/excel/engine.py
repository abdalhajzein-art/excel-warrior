import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def process_excel():
    try:
        input_data = json.loads(sys.stdin.read())
        action = input_data.get("action", "modify")
        file_path = input_data.get("filePath")
        plan = input_data.get("plan", {})
        
        # 🚀 1. التعامل مع إجراء التوليد من الصفر (Generation)
        if action == "generate":
            if not file_path:
                raise Exception("مسار حفظ الملف الجديد غير متوفر.")
                
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = plan.get("sheetName", "تقرير_رئيسي")
            
            # استخراج الأعمدة والبيانات المقترحة من خطة Groq الذكية
            columns = plan.get("columns", ["رقم", "البيان", "التاريخ", "القيمة"])
            rows_data = plan.get("rows", [
                [1, "بيان تجريبي 1", "2026-07-01", 1000],
                [2, "بيان تجريبي 2", "2026-07-02", 1500],
                [3, "بيان تجريبي 3", "2026-07-03", 2000]
            ])
            
            # تنسيقات احترافية موحدة (أزرق فخم)
            header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
            header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
            alignment_center = Alignment(horizontal="center", vertical="center")
            border_thin = Border(
                left=Side(style='thin', color='BFBFBF'), right=Side(style='thin', color='BFBFBF'),
                top=Side(style='thin', color='BFBFBF'), bottom=Side(style='thin', color='BFBFBF')
            )
            data_font = Font(name="Arial", size=10, color="000000")

            # كتابة الترويسة
            for c_idx, col_name in enumerate(columns, 1):
                cell = ws.cell(row=1, column=c_idx, value=col_name)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = alignment_center
                cell.border = border_thin

            # كتابة الصفوف والبيانات
            for r_idx, row_values in enumerate(rows_data, 2):
                for c_idx, val in enumerate(row_values, 1):
                    cell = ws.cell(row=r_idx, column=c_idx, value=val)
                    cell.font = data_font
                    cell.alignment = alignment_center
                    cell.border = border_thin

            wb.save(file_path)
            print(json.dumps({
                "success": True, 
                "message": "تم توليد ملف الإكسل الجديد من الصفر بتنسيق سيادي احترافي بنجاح تام."
            }))
            return

        # 🔄 2. التعامل مع إجراء التعديل (Modify) - الكود السابق المحدث
        if not file_path:
            raise Exception("مسار الملف غير متوفر للمعالجة في المحرك العالمي.")
            
        wb = openpyxl.load_workbook(file_path)
        
        target_sheet_name = plan.get("sheetName", None)
        if target_sheet_name and target_sheet_name in wb.sheetnames:
            ws = wb[target_sheet_name]
        else:
            ws = wb.active

        new_columns = plan.get("newColumns", [])
        target_column_name = plan.get("targetColumn", "")
        custom_formula = plan.get("formulaTemplate", "")

        header_row = 1
        for r in range(1, min(ws.max_row + 1, 10)):
            non_empty_cells = sum(1 for c in range(1, ws.max_column + 1) if ws.cell(row=r, column=c).value is not None)
            if non_empty_cells >= 2:
                header_row = r
                break

        target_col_idx = None
        if target_column_name:
            target_lower = str(target_column_name).strip().lower()
            for c in range(1, ws.max_column + 1):
                val = str(ws.cell(row=header_row, column=c).value or "").strip().lower()
                if target_lower in val or val in target_lower:
                    target_col_idx = c
                    break

        insert_pos = (target_col_idx + 1) if target_col_idx else (ws.max_column + 1)

        if new_columns:
            ws.insert_cols(insert_pos, amount=len(new_columns))

            safe_header_font = Font(name="Arial", size=11, bold=True, color="000000")
            safe_header_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
            safe_alignment = Alignment(horizontal="center", vertical="center")
            safe_border = Border(
                left=Side(style='thin', color='BFBFBF'), right=Side(style='thin', color='BFBFBF'),
                top=Side(style='thin', color='BFBFBF'), bottom=Side(style='thin', color='BFBFBF')
            )
            safe_data_font = Font(name="Arial", size=10, color="000000")

            for idx, col_name in enumerate(new_columns):
                current_col = insert_pos + idx
                header_cell = ws.cell(row=header_row, column=current_col, value=col_name)
                header_cell.font = safe_header_font
                header_cell.fill = safe_header_fill
                header_cell.alignment = safe_alignment
                header_cell.border = safe_border

                for r in range(header_row + 1, ws.max_row + 1):
                    if ws.cell(row=r, column=1).value is not None:
                        cell = ws.cell(row=r, column=current_col)
                        cell.font = safe_data_font
                        cell.alignment = safe_alignment
                        cell.border = safe_border
                        
                        if custom_formula:
                            formatted_formula = custom_formula.replace("{row}", str(r))
                            if target_col_idx:
                                target_letter = get_column_letter(target_col_idx)
                                formatted_formula = formatted_formula.replace("{target_col}", target_letter)
                            cell.value = formatted_formula
                        else:
                            if target_col_idx:
                                target_letter = get_column_letter(target_col_idx)
                                cell.value = f'=IF({target_letter}{r}="مطلوب صيانة","عاجل","عادي")'
                            else:
                                cell.value = "-"

        wb.save(file_path)
        print(json.dumps({
            "success": True, 
            "message": "تم إدراج الأعمدة وتطبيق المعادلات الديناميكية عالمياً بنجاح تام."
        }))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    process_excel()
