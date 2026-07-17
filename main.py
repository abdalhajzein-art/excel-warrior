from flask import Flask, request, send_file
import excel_engine
import arena_client
import os

app = Flask(__name__)

@app.route('/')
def home():
    return "Excel Warrior Ready"

@app.route('/upload', methods=['POST'])
def upload_file():
    file = request.files['excel_file']

    # نقرأ محتوى الملف كنص لإرساله لـ Arena.ai
    wb_temp = excel_engine.openpyxl.load_workbook(file)
    sheet_temp = wb_temp.active

    content = []
    for row in sheet_temp.iter_rows(values_only=True):
        content.append(str(row))

    excel_text = "\n".join(content)

    # نرسل النص لـ Arena.ai
    prompt = f"""
    هذا محتوى ملف Excel:
    {excel_text}

    المطلوب: أعطني كود Python يعدّل هذا الملف باستخدام openpyxl.
    لا تكتب شرح، فقط الكود.
    """

    instructions = arena_client.ask_arena(prompt)

    # نعيد فتح الملف الأصلي لتنفيذ التعليمات عليه
    file.stream.seek(0)
    wb = excel_engine.process_workbook(file, instructions)

    output_path = "output.xlsx"
    wb.save(output_path)

    return send_file(output_path, as_attachment=True)

app.run(host="0.0.0.0", port=8000)
