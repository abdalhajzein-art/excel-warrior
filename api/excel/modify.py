import sys
import json
import openpyxl

def modify_excel():
    try:
        # قراءة المدخلات الممررة من Node.js عبر الـ stdin أو ملف مؤقت
        input_data = json.loads(sys.stdin.read())
        file_path = input_data.get("filePath")
        new_columns = input_data.get("newColumns", [])
        target_column = input_data.get("targetColumn")

        # فتح ملف الإكسل باستخدام openpyxl الحصينة
        wb = openpyxl.load_workbook(file_path)
        ws = wb.active

        # البحث عن صف العناوين ديناميكياً
        header_row = 1
        for r in range(1, min(ws.max_row + 1, 10)):
            for c in range(1, ws.max_column + 1):
                val = str(ws.cell(row=r, column=c).value or "").strip()
                if "رقم الموظف" in val or "اسم الموظف" in val or "الغياب" in val or "اليوم" in val:
                    header_row = r
                    break
            if header_row != 1:
                break

        # تحديد مكان الإدراج
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

        # إدراج الأعمدة الجديدة عبر openpyxl (تقوم بتحديث الإحداثيات والصيغ أوتوماتيكياً)
        num_cols = len(new_columns)
        ws.insert_cols(insert_pos, amount=num_cols)

        # تعبئة العناوين الجديدة والبيانات التجريبية
        for idx, col_name in enumerate(new_columns):
            current_col = insert_pos + idx
            # عنوان العمود
            header_cell = ws.cell(row=header_row, column=current_col, value=col_name)
            
            # تعبئة الصفوف تحت العنوان
            for r in range(header_row + 1, ws.max_row + 1):
                if ws.cell(row=r, column=1).value is not None:
                    cell = ws.cell(row=r, column=current_col)
                    if "سبب" in col_name:
                        cell.value = "مرض"
                    elif "ملاحظات" in col_name:
                        cell.value = "بدون ملاحظات"
                    else:
                        cell.value = "-"

        # حفظ الملف المعدل
        wb.save(file_path)
        print(json.dumps({"success": True, "message": "تم تعديل الملف بنجاح عبر Python openpyxl"}))

    except Exception as e:
        print(json.dumps({"success": false, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    modify_excel()

