import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, Reference
from openpyxl.formatting.rule import CellIsRule

def process_excel():
    try:
        input_data = json.loads(sys.stdin.read())
        action = input_data.get("action", "modify") # modify, generate, format
        file_path = input_data.get("filePath")
        plan = input_data.get("plan", {})
        
        wb = None
        if action == "generate":
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Alatheer Sheet"
        else:
            if not file_path:
                raise Exception("مسار الملف غير متوفر للمعالجة.")
            wb = openpyxl.load_workbook(file_path)
            ws = wb.active

        # 1. معالجة التوليد (Generate) إذا كان الطلب من الصفر
        if action == "generate":
            headers = plan.get("headers", ["رقم الموظف", "اسم الموظف", "القسم", "الحالة"])
            rows = plan.get("rows", [[1, "عبدالغني", "الهندسة", "حاضر"], [2, "أحمد", "المبيعات", "غائب"]])
            
            # كتابة العناوين بتنسيق ملكي (أسود وذهبي أو أزرق فاخر)
            ws.append(headers)
            header_row = ws[1]
            for cell in header_row:
                cell.font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
                cell.fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
                cell.alignment = Alignment(horizontal="center", vertical="center")
            
            # كتابة البيانات
            for r_data in rows:
                ws.append(r_data)
                
            wb.save(file_path)
            print(json.dumps({"success": True, "message": "تم توليد ملف الإكسل من الصفر باحترافية مطلقة."}))
            return

        # 2. معالجة التعديل (Modify / Insert Columns / Styling)
        new_columns = plan.get("newColumns", [])
        target_column = plan.get("targetColumn")
        conditional_rules = plan.get("conditionalRules", []) # قواعد التنسيق الشرطي
        add_chart = plan.get("addChart", False)

        # البحث عن صف العناوين ديناميكياً
        header_row = 1
        for r in range(1, min(ws.max_row + 1, 10)):
            for c in range(1, ws.max_column + 1):
                val = str(ws.cell(row=r, column=c).value or "").strip()
                if any(k in val for k in ["رقم", "اسم", "الغياب", "اليوم", "الموظف"]):
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

        # 3. دعم المخططات (Charts) المتقدمة إذا طُلبت
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
        print(json.dumps({"success": True, "message": "تم معالجة وإتقان ملف الإكسل عبر ملكوت الأثير بنجاح."}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    process_excel()
