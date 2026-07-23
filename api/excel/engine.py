import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, Reference

def process_excel():
    try:
        input_data = json.loads(sys.stdin.read())
        action = input_data.get("action", "modify")
        file_path = input_data.get("filePath")
        plan = input_data.get("plan", {})
        
        wb = None
        ws = None

        if action == "generate":
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Alatheer Master Sheet"

            headers = plan.get("headers", ["الرقم", "العنصر", "الحالة", "التاريخ"])
            rows = plan.get("rows", [])

            ws.append(headers)
            header_row = ws[1]
            
            header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
            header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
            header_alignment = Alignment(horizontal="center", vertical="center")
            
            thin_border = Border(
                left=Side(style='thin', color='D9D9D9'),
                right=Side(style='thin', color='D9D9D9'),
                top=Side(style='thin', color='D9D9D9'),
                bottom=Side(style='thin', color='D9D9D9')
            )

            for cell in header_row:
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = header_alignment
                cell.border = thin_border

            data_font = Font(name="Arial", size=10, color="000000")
            data_alignment = Alignment(horizontal="center", vertical="center")

            for r_idx, r_data in enumerate(rows, start=2):
                ws.append(r_data)
                for c_idx in range(1, len(headers) + 1):
                    cell = ws.cell(row=r_idx, column=c_idx)
                    cell.font = data_font
                    cell.alignment = data_alignment
                    cell.border = thin_border
                    if r_idx % 2 == 0:
                        cell.fill = PatternFill(start_color="F9FBFD", end_color="F9FBFD", fill_type="solid")

            wb.save(file_path)
            print(json.dumps({"success": True, "message": "تم توليد ملف الإكسل بنجاح."}))
            return

        if not file_path:
            raise Exception("مسار الملف غير متوفر للمعالجة.")
            
        wb = openpyxl.load_workbook(file_path)
        ws = wb.active

        new_columns = plan.get("newColumns", [])
        target_column = plan.get("targetColumn")
        add_chart = plan.get("addChart", False)

        # البحث عن صف العناوين ديناميكياً
        header_row = 1
        for r in range(1, min(ws.max_row + 1, 10)):
            for c in range(1, ws.max_column + 1):
                val = str(ws.cell(row=r, column=c).value or "").strip()
                if any(k in val for k in ["رقم", "اسم", "الغياب", "اليوم", "الموظف", "نسبة الحضور"]):
                    header_row = r
                    break
            if header_row != 1:
                break

        # تحديد مكان الإدراج للأعمدة الجديدة (بجانب نسبة الحضور)
        if not new_columns:
            new_columns = ["تقييم الالتزام"]

        target_col_idx = None
        for c in range(1, ws.max_column + 1):
            h_val = str(ws.cell(row=header_row, column=c).value or "").strip()
            if "نسبة الحضور" in h_val:
                target_col_idx = c
                break

        insert_pos = (target_col_idx + 1) if target_col_idx else (ws.max_column + 1)

        # إدراج الأعمدة الجديدة بشكل آمن
        ws.insert_cols(insert_pos, amount=len(new_columns))

        # تعريف تنسيقات نظيفة وآمنة تماماً لتجنب أي unhashable StyleProxy error
        safe_header_font = Font(name="Arial", size=11, bold=True, color="000000")
        safe_header_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
        safe_alignment = Alignment(horizontal="center", vertical="center")
        safe_border = Border(
            left=Side(style='thin', color='BFBFBF'),
            right=Side(style='thin', color='BFBFBF'),
            top=Side(style='thin', color='BFBFBF'),
            bottom=Side(style='thin', color='BFBFBF')
        )
        safe_data_font = Font(name="Arial", size=10, color="000000")

        for idx, col_name in enumerate(new_columns):
            current_col = insert_pos + idx
            header_cell = ws.cell(row=header_row, column=current_col, value=col_name)
            header_cell.font = safe_header_font
            header_cell.fill = safe_header_fill
            header_cell.alignment = safe_alignment
            header_cell.border = safe_border

            # تعبئة الخلايا مع تطبيق الصيغة أو تقييم الالتزام بناءً على نسبة الحضور
            for r in range(header_row + 1, ws.max_row + 1):
                if ws.cell(row=r, column=1).value is not None:
                    cell = ws.cell(row=r, column=current_col)
                    cell.font = safe_data_font
                    cell.alignment = safe_alignment
                    cell.border = safe_border
                    
                    # إذا كان العمود هو تقييم الالتزام، نضع معادلة إكسل حقيقية أو قيمة مستنتجة
                    if "تقييم" in col_name and target_col_idx:
                        col_letter = openpyxl.utils.get_column_letter(target_col_idx)
                        cell.value = f'=IF({col_letter}{r}>=0.8,"ممتاز",IF({col_letter}{r}>=0.6,"جيد جداً","بحاجة لمتابعة"))'
                    else:
                        cell.value = "-"

        wb.save(file_path)
        print(json.dumps({"success": True, "message": "تم تعديل الملف وإضافة عمود تقييم الالتزام بنجاح مطلَق."}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    process_excel()
