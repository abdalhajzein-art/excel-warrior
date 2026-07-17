from flask import Flask, request, send_file
import openpyxl
import os

import ai_client
import excel_engine

app = Flask(__name__)

UPLOAD_PATH = "uploaded.xlsx"
OUTPUT_PATH = "output.xlsx"

@app.route('/')
def home():
    return open("index.html").read()

@app.route('/process', methods=['POST'])
def process():
    # 1) استلام الملف
    file = request.files['excel_file']
    file.save(UPLOAD_PATH)

    # 2) قراءة محتوى الملف كنص
    wb = openpyxl.load_workbook(UPLOAD_PATH)
    sheet = wb.active

    content = []
    for row in sheet.iter_rows(values_only=True):
        content.append(str(row))

    excel_text = "\n".join(content)

    # 3) استلام طلب المستخدم
    user_instruction = request.form['instruction']

    # 4) بناء البرومبت للذكاء الاصطناعي
    prompt = f"""
    هذا محتوى ملف Excel:
    {excel_text}

    طلب المستخدم:
    {user_instruction}

    المطلوب:
    أعطني كود Python باستخدام مكتبة openpyxl يعدّل هذا الملف حسب الطلب.
    رجّع فقط الكود بدون شرح.
    """

    # 5) إرسال الطلب للذكاء الاصطناعي
    instructions = ai_client.ask_ai(prompt)

    # 6) تنفيذ الكود على الملف
    wb = excel_engine.process_workbook(UPLOAD_PATH, instructions)
    wb.save(OUTPUT_PATH)

    # 7) إرسال الملف المعدّل للمستخدم
    return send_file(OUTPUT_PATH, as_attachment=True)

# -----------------------------
# تشغيل السيرفر على Railway
# -----------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
