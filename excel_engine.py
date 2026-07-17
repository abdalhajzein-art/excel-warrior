import openpyxl

def process_workbook(file, instructions=None):
    """
    محرك Excel Warrior
    - يفتح ملف Excel
    - ينفّذ تعليمات Arena.ai إذا موجودة
    - يرجّع الملف جاهز للحفظ
    """

    wb = openpyxl.load_workbook(file)
    sheet = wb.active

    # تنفيذ تعليمات Arena.ai إذا موجودة
    if instructions:
        exec(instructions)

    return wb
