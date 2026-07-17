import openpyxl

def process_workbook(file_path, instructions):
    wb = openpyxl.load_workbook(file_path)
    sheet = wb.active

    # ⚠️ تنفيذ الكود القادم من الذكاء الاصطناعي
    exec(instructions)

    return wb
