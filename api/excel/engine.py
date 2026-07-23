import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def find_header_row_and_column(ws, target_name):
    """
    بحث ذكي ومعياري وديناميكي عن صف العناوين ورقم العمود المستهدف 
    بغض النظر عن لغة الملف، شكله، أو محتواه.
    """
    if not target_name:
        return 1, None, None

    best_row = 1
    best_col = None
    target_lower = str(target_name).strip().lower()

    # فحص أول 10 أسطر للبحث عن الترويسة أو العمود المطابق
    for r in range(1, min(ws.max_row + 1, 12)):
        for c in range(1, ws.max_column + 1):
            val = str(ws.cell(row=r, column=c).value or "").strip().lower()
            if val:
                # مطابقة تامة أو جزئية ذكية
                if target_lower in val or val in target_lower:
                    best_row = r
                    best_col = c
                    return best_row, best_col, ws.cell(row=r, column=c).value

    return 1, None, None

def process_excel():
    try:
        input_data = json.loads(sys.stdin.read())
        action = input_data.get("action", "modify")
        file_path = input_data.get("filePath")
        plan = input_data.get("plan", {})
        
        if not file_path:
            raise Exception("مسار الملف غير متوفر للمعالجة في المحرك العالمي.")
            
        wb = openpyxl.load_workbook(file_path)
        ws = wb.active

        # استخراج المعطيات من خطة الذكاء الاصطناعي (Groq Plan)
        new_columns = plan.get("newColumns", [])
        target_column_name = plan.get("targetColumn", "")
        operation_type = plan.get("operationType", "insert_column") # insert_column, modify_cells, summary
        custom_formula = plan.get("formulaTemplate", "")

        # 1. العثور على صف العناوين ديناميكياً
        header_row = 1
        for r in range(1, min(ws.max_row + 1, 10)):
            non_empty_cells = sum(1 for c in range(1, ws.max_column + 1) if ws.cell(row=r, column=c).value is not None)
            if non_empty_cells >= 2: # غالباً صف الترويسة يحتوي على خليتين أو أكثر مملوءتين
                header_row = r
                break

        # 2. تحديد العمود المستهدف إن وجد بناءً على طلب المستخدم أو الخطة
        target_col_idx = None
        if target_column_name:
            _, target_col_idx, _ = find_header_row_and_column(ws, target_column_name)

        # إذا لم يتم تحديد عمود مستهدف بدقة، نجعله بجانب آخر عمود أو بعد العمود الأخير للجدول
        insert_pos = (target_col_idx + 1) if target_col_idx else (ws.max_column + 1)

        # 3. تنفيذ العمليات بناءً على ذكاء الخطة
        if new_columns:
            ws.insert_cols(insert_pos, amount=len(new_columns))

            # تنسيقات آمنة ومتناسقة عالمياً
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

                # تعبئة الصفوف بالبيانات أو المعادلات الذكية
                for r in range(header_row + 1, ws.max_row + 1):
                    # التأكد من أن الصف ليس فارغاً تماماً
                    if any(ws.cell(row=r, column=c).value is not None for c in range(1, ws.max_column + 1)):
                        cell = ws.cell(row=r, column=current_col)
                        cell.font = safe_data_font
                        cell.alignment = safe_alignment
                        cell.border = safe_border
                        
                        # إذا كانت الخطة تحتوي على قالب معادلة، نقوم بتطبيقها مع استبدال رقم الصف تلقائياً
                        if custom_formula:
                            # استبدال متغيرات مثل {row} أو المرجع برقم الصف الحالي
                            formatted_formula = custom_formula.replace("{row}", str(r))
                            if target_col_idx:
                                target_letter = get_column_letter(target_col_idx)
                                formatted_formula = formatted_formula.replace("{target_col}", target_letter)
                            cell.value = formatted_formula
                        else:
                            # قيمة افتراضية ذكية وآمنة
                            cell.value = "-"

        wb.save(file_path)
        print(json.dumps({
            "success": True, 
            "message": "تم تنفيذ التعديل العالمي على ملف الإكسل بنجاح تام وعبر المحرك السيادي."
        }))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    process_excel()

