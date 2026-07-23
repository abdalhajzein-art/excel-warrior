import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, Reference

def process_excel():
    try:
        input_data = json.loads(sys.stdin.read())
        action = input_data.get("action", "modify") # modify, generate
        file_path = input_data.get("filePath")
        plan = input_data.get("plan", {})
        
        wb = None
        ws = None

        # ==========================================
        # 1. قسم التوليد (Generate from Scratch)
        # ==========================================
        if action == "generate":
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Alatheer Master Sheet"

            headers = plan.get("headers", ["الرقم", "العنصر", "الحالة", "التاريخ"])
            rows = plan.get("rows", [])

            # كتابة وعنوان الترويسة بتنسيق فاخر (خلفية داكنة، خط أبيض عريض)
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

            # كتابة صفوف البيانات مع تنسيق نظيف
            data_font = Font(name="Arial", size=10, color="000000")
            data_alignment = Alignment(horizontal="center", vertical="center")

            for r_idx, r_data in enumerate(rows, start=2):
                ws.append(r_data)
                for c_idx in range(1, len(headers) + 1):
                    cell = ws.cell(row=r_idx, column=c_idx)
                    cell.font = data_font
                    cell.alignment = data_alignment
                    cell.border = thin_border
                    # تلوين صففي تبادلي خفيف (Zebra Striping) لجمالية البصر
                    if r_idx % 2 == 0:
                        cell.fill = PatternFill(start_color="F9FBFD", end_color="F9FBFD", fill_type="solid")

            # ضبط عرض الأعمدة أوتوماتيكياً لتبدو احترافية
            for col in ws.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = openpyxl.utils.get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = max(max_len + 5, 15)

            wb.save(file_path)
            print(json.dumps({"success": True, "message": "تم توليد ملف الإكسل من الصفر باحترافية مطلقة."}))
            return

        # ==========================================
        # 2. قسم التعديل والإضافة (Modify / Insert Columns)
        # ==========================================
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
                if any(k in val for k in ["رقم", "اسم", "الغياب", "اليوم", "الموظف", "الرقم"]):
                    header_row = r
                    break
            if header_row != 1:
                break

        # تحديد مكان الإدراج للأعمدة الجديدة
        if new_columns:
            target_col_idx = None
            for c in range(1, ws.max_column + 1):
                h_val = str(ws.cell(row=header_row, column=c).value or "").strip()
                if target_column and target_column in h_val:
                    target_col_idx = c
                    break
                elif not target_column and ("الغياب" in h_val or h_val == "غياب"):
                    target_col_idx = c
                    break

            insert_pos = (target_col_idx + 1) if target_col_idx else (ws.max_column + 1)

            # سحب قالب التنسيق من العمود المجاور لضمان تطابق الألوان والخطوط حرفياً
            sample_col = target_col_idx if target_col_idx else (insert_pos - 1)
            ref_header = ws.cell(row=header_row, column=sample_col)
            ref_data = ws.cell(row=header_row + 1, column=sample_col)

            ws.insert_cols(insert_pos, amount=len(new_columns))

            for idx, col_name in enumerate(new_columns):
                current_col = insert_pos + idx
                header_cell = ws.cell(row=header_row, column=current_col, value=col_name)
                
                # نسخ التنسيق البصري لرأس العمود
                if ref_header.font: header_cell.font = Font(name=ref_header.font.name, size=ref_header.font.size, bold=True, color=ref_header.font.color)
                if ref_header.fill: header_cell.fill = PatternFill(fill_type=ref_header.fill.fill_type, start_color=ref_header.fill.start_color, end_color=ref_header.fill.end_color)
                if ref_header.alignment: header_cell.alignment = Alignment(horizontal=ref_header.alignment.horizontal, vertical=ref_header.alignment.vertical)
                if ref_header.border: header_cell.border = ref_header.border

                # تعبئة الصفوف وتطبيق التنسيق القياسي
                for r in range(header_row + 1, ws.max_row + 1):
                    if ws.cell(row=r, column=1).value is not None:
                        cell = ws.cell(row=r, column=current_col)
                        cell.value = "مرض" if "سبب" in col_name else ("بدون ملاحظات" if "ملاحظات" in col_name else "-")
                        if ref_data.font: cell.font = ref_data.font
                        if ref_data.alignment: cell.alignment = ref_data.alignment
                        if ref_data.border: cell.border = ref_data.border

        # 3. دعم المخططات (Charts) إذا طُلبت
        if add_chart and ws.max_row > 1:
            chart = BarChart()
            chart.title = "المخطط التحليلي - الأثير AI"
            chart.style = 10
            data = Reference(ws, min_col=ws.max_column, min_row=header_row, max_row=ws.max_row)
            cats = Reference(ws, min_col=2, min_row=header_row + 1, max_row=ws.max_row)
            chart.add_data(data, titles_from_data=True)
            chart.set_categories(cats)
            ws.add_chart(chart, f"O{header_row}")

        wb.save(file_path)
        print(json.dumps({"success": True, "message": "تمت معالجة الملف وتعديله بنجاح مطلَق."}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    process_excel()
