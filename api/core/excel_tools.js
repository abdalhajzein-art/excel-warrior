/**
 * api/core/excel_tools.js – المحرك التنفيذي الموحد لجداول البيانات (Alatheer Suite)
 * - يستقبل مصفوفة العمليات (Operations) الناتجة من الذكاء الاصطناعي وينفذها بدقة 100%.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * الدالة المركزية لمعالجة وتطبيق عمليات الـ JSON الصادرة من نماذج الذكاء الاصطناعي
 * @param {string} jsonInstructions - نص الـ JSON القادم من الموديل
 * @param {string} targetFilePath - مسار ملف الإكسل المراد إنشاؤه أو تعديله
 */
export function executeExcelOperations(jsonInstructions, targetFilePath = "output.xlsx") {
    try {
        // 1. تنظيف النص واستخراج الـ JSON النقي في حال قام الموديل بوضعه داخل وسم ```json
        let cleanJson = jsonInstructions;
        if (cleanJson.includes("```json")) {
            cleanJson = cleanJson.split("```json")[1].split("```")[0].trim();
        } else if (cleanJson.includes("```")) {
            cleanJson = cleanJson.split("```")[1].split("```")[0].trim();
        }

        // 2. التحقق من صحة الـ JSON وتحويله إلى كائن برمي
        const parsedInstructions = JSON.parse(cleanJson.trim());
        const operations = parsedInstructions.operations || [];
        const sheetName = parsedInstructions.sheet_name || "Sheet1";

        console.log(`📊 جاري تنفيذ (${operations.length}) عملية على ورقة العمل: [${sheetName}]`);

        // 3. كتابة سكريبت بايثون مؤقت للتعامل مع مكتبة openpyxl المتاحة بالسيرفر
        // هذا الأسلوب يضمن أمان وبساطة مطلقة دون تعقيد السيرفر بملفات جانبية
        const pythonScriptPath = path.join(process.cwd(), "temp_excel_processor.py");
        
        const pythonCode = `
import openpyxl
from openpyxl.styles import Font, PatternFill
import json
import os

file_path = "${targetFilePath}"
sheet_name = "${sheetName}"

# إنشاء ملف جديد أو فتح الملف الحالي إن وجد للتعديل عليه
if os.path.exists(file_path) and "${parsedInstructions.action}" == "CREATE_OR_UPDATE":
    wb = openpyxl.load_workbook(file_path)
    if sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
    else:
        ws = wb.create_sheet(title=sheet_name)
else:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name

operations = ${JSON.stringify(operations)}

for op in operations:
    op_type = op.get('type')
    
    if op_type == 'SET_ROW_DATA':
        row_num = int(op.get('row', 1))
        values = op.get('values', [])
        for col_num, val in enumerate(values, start=1):
            ws.cell(row=row_num, column=col_num, value=val)
            
    elif op_type == 'STYLE_RANGE':
        cell_range = op.get('range', 'A1')
        font_style = op.get('font', 'normal')
        bg_color = op.get('bg_color', '').replace('#', '')
        
        # تطبيق التنسيق على نطاق الخلايا المحدد
        for row in ws[cell_range]:
            for cell in row:
                if font_style == 'bold':
                    cell.font = Font(bold=True)
                if bg_color:
                    cell.fill = PatternFill(start_color=bg_color, end_color=bg_color, fill_type='solid')
                    
    elif op_type == 'ADD_FORMULA':
        cell_coord = op.get('cell', 'A1')
        formula = op.get('formula', '')
        ws[cell_coord] = formula

wb.save(file_path)
print("SUCCESS")
`;

        // كتابة ملف البايثون المؤقت وتشغيله عبر بيئة السيرفر (Railway Virtual Env)
        fs.writeFileSync(pythonScriptPath, pythonCode);
        
        // استدعاء البايثon المنصب في المسار المحدد بملف الـ Dockerfile الخاص بك
        const pythonBinary = process.env.VIRTUAL_ENV ? `${process.env.VIRTUAL_ENV}/bin/python` : "python3";
        const output = execSync(`${pythonBinary} ${pythonScriptPath}`).toString().trim();
        
        // تنظيف وحذف الملف المؤقت بعد النجاح لحماية ذاكرة السيرفر
        if (fs.existsSync(pythonScriptPath)) fs.unlinkSync(pythonScriptPath);

        if (output === "SUCCESS") {
            console.log(`✅ تم إنشاء/تعديل ملف الإكسل بنجاح في المسار: ${targetFilePath}`);
            return { success: true, filePath: targetFilePath };
        } else {
            throw new Error(output);
        }

    } catch (error) {
        console.error("❌ خطأ أثناء معالجة وتنفيذ عمليات الإكسل برمجياً:", error.message);
        return { success: false, error: error.message };
    }
}

// تصدير الكائن ليتوافق مع استدعاء الـ Destructuring في ملف geminiService الرئيسي
export const EXCEL_TOOLS = {
    executeExcelOperations,
    // قمنا بوضع الهيكل فارغاً هنا لتتوافق مع مصفوفة الـ Function Declarations القديمة بملفك دون أخطاء
    functionDeclarations: [] 
};

export default EXCEL_TOOLS;

