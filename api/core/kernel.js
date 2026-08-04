/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Python-Excel Edition)
 * ✅ الاعتماد على Python (openpyxl) للتنفيذ
 * ✅ إصلاح مشكلة Template Literal و StyleProxy
 * ✅ إصلاح مشكلة autofit_columns مع MergedCells
 * ✅ إصلاح مشكلة add_validation بدون target_col
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

/**
 * ✅ تنفيذ العمليات عبر Python (openpyxl)
 */
async function executeWithPython(filePath, operations) {
    try {
        const pythonLines = [
            'import openpyxl',
            'from openpyxl.utils import get_column_letter',
            'from openpyxl.worksheet.datavalidation import DataValidation',
            'import json',
            'import sys',
            '',
            'try:',
            `    wb = openpyxl.load_workbook('${filePath}')`,
            '    ws = wb.active',
            '',
            '    # البحث عن صف العناوين',
            '    header_row = 1',
            '    for row in range(1, min(4, ws.max_row + 1)):',
            '        if ws.cell(row=row, column=1).value:',
            '            header_row = row',
            '            break',
            '',
            '    # البحث عن أسماء الأعمدة',
            '    headers = {}',
            '    for col in range(1, ws.max_column + 1):',
            '        val = ws.cell(row=header_row, column=col).value',
            '        if val:',
            '            headers[str(val).strip()] = col',
            ''
        ];

        let lastAddedCol = null;

        for (const op of operations) {
            switch (op.type) {
                case 'add_column': {
                    const after = op.after || '';
                    const header = op.header || 'عمود جديد';
                    pythonLines.push(`    # إضافة عمود جديد بعد عمود "${after}"`);
                    pythonLines.push(`    target_col = ws.max_column + 1`);
                    pythonLines.push(`    if "${after}" in headers:`);
                    pythonLines.push(`        target_col = headers["${after}"] + 1`);
                    pythonLines.push(`    ws.insert_cols(target_col)`);
                    pythonLines.push(`    ws.cell(row=header_row, column=target_col, value="${header}")`);
                    pythonLines.push(`    # نسخ التنسيق من العمود المجاور (بدون StyleProxy)`);
                    pythonLines.push(`    source_col = target_col - 1 if target_col > 1 else target_col + 1`);
                    pythonLines.push(`    if source_col <= ws.max_column:`);
                    pythonLines.push(`        for row in range(header_row + 1, ws.max_row + 1):`);
                    pythonLines.push(`            source_cell = ws.cell(row=row, column=source_col)`);
                    pythonLines.push(`            target_cell = ws.cell(row=row, column=target_col)`);
                    pythonLines.push(`            # نسخ خصائص التنسيق بشكل فردي لتجنب StyleProxy`);
                    pythonLines.push(`            if source_cell.font:`);
                    pythonLines.push(`                f = source_cell.font`);
                    pythonLines.push(`                target_cell.font = openpyxl.styles.Font(`);
                    pythonLines.push(`                    name=f.name, size=f.size, bold=f.bold, italic=f.italic, color=f.color`);
                    pythonLines.push(`                )`);
                    pythonLines.push(`            if source_cell.fill:`);
                    pythonLines.push(`                target_cell.fill = openpyxl.styles.PatternFill(`);
                    pythonLines.push(`                    fill_type=source_cell.fill.fill_type,`);
                    pythonLines.push(`                    start_color=source_cell.fill.start_color,`);
                    pythonLines.push(`                    end_color=source_cell.fill.end_color`);
                    pythonLines.push(`                )`);
                    pythonLines.push(`            if source_cell.alignment:`);
                    pythonLines.push(`                target_cell.alignment = openpyxl.styles.Alignment(`);
                    pythonLines.push(`                    horizontal=source_cell.alignment.horizontal,`);
                    pythonLines.push(`                    vertical=source_cell.alignment.vertical,`);
                    pythonLines.push(`                    wrap_text=source_cell.alignment.wrap_text`);
                    pythonLines.push(`                )`);
                    pythonLines.push(`            if source_cell.border:`);
                    pythonLines.push(`                target_cell.border = openpyxl.styles.Border(`);
                    pythonLines.push(`                    left=source_cell.border.left,`);
                    pythonLines.push(`                    right=source_cell.border.right,`);
                    pythonLines.push(`                    top=source_cell.border.top,`);
                    pythonLines.push(`                    bottom=source_cell.border.bottom`);
                    pythonLines.push(`                )`);
                    pythonLines.push(`            if source_cell.number_format:`);
                    pythonLines.push(`                target_cell.number_format = source_cell.number_format`);
                    pythonLines.push(`    last_added_col = target_col`);
                    lastAddedCol = true;
                    break;
                }
                case 'add_validation': {
                    const formulae = op.formulae || 'مرضي,إجازة طارئة,بدون إذن,مهمة عمل';
                    const address = op.address || '';
                    pythonLines.push(`    # إضافة قائمة منسدلة`);
                    pythonLines.push(`    dv = DataValidation(type="list", formula1="${formulae}", allow_blank=True)`);
                    pythonLines.push(`    ws.add_data_validation(dv)`);
                    if (address) {
                        pythonLines.push(`    dv.add('${address}')`);
                    } else if (lastAddedCol) {
                        pythonLines.push(`    col_letter = get_column_letter(last_added_col)`);
                        pythonLines.push(`    dv.add(f"{col_letter}{header_row + 1}:{col_letter}{ws.max_row}")`);
                    } else {
                        pythonLines.push(`    col_letter = get_column_letter(ws.max_column)`);
                        pythonLines.push(`    dv.add(f"{col_letter}{header_row + 1}:{col_letter}{ws.max_row}")`);
                    }
                    break;
                }
                case 'autofit_columns': {
                    pythonLines.push(`    # ضبط عرض الأعمدة تلقائياً (مع دعم MergedCells)`);
                    pythonLines.push(`    for col in ws.columns:`);
                    pythonLines.push(`        if not col:`);
                    pythonLines.push(`            continue`);
                    pythonLines.push(`        max_length = 0`);
                    pythonLines.push(`        for cell in col:`);
                    pythonLines.push(`            try:`);
                    pythonLines.push(`                if cell.value and len(str(cell.value)) > max_length:`);
                    pythonLines.push(`                    max_length = len(str(cell.value))`);
                    pythonLines.push(`            except:`);
                    pythonLines.push(`                pass`);
                    pythonLines.push(`        if max_length > 0:`);
                    pythonLines.push(`            adjusted_width = min(max_length + 2, 50)`);
                    pythonLines.push(`            ws.column_dimensions[get_column_letter(col[0].column)].width = adjusted_width`);
                    break;
                }
                default:
                    pythonLines.push(`    # عملية غير مدعومة: ${op.type}`);
            }
        }

        pythonLines.push(`    wb.save('${filePath}')`);
        pythonLines.push(`    print(json.dumps({"success": True, "message": "تم التنفيذ بنجاح"}))`);
        pythonLines.push(`except Exception as e:`);
        pythonLines.push(`    print(json.dumps({"success": False, "error": str(e)}))`);

        const pythonCode = pythonLines.join('\n');

        const tempPyPath = path.join('/tmp', `python_${Date.now()}.py`);
        fs.writeFileSync(tempPyPath, pythonCode);

        const { stdout, stderr } = await execAsync(`python3 "${tempPyPath}"`);
        
        try { fs.unlinkSync(tempPyPath); } catch(e) {}
        
        if (stderr && !stderr.includes('Warning') && !stderr.includes('DeprecationWarning')) {
            console.error('❌ Python Error:', stderr);
            return { success: false, error: stderr };
        }
        
        try {
            const result = JSON.parse(stdout);
            return result;
        } catch {
            return { success: true, output: stdout };
        }
    } catch (error) {
        console.error('❌ Python Exception:', error);
        return { success: false, error: error.message };
    }
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return {
            reply: "هلا والله يا شريكي... آمرني، شو عنا شغل اليوم؟",
            fileBase64: null,
            fileName: null,
            operations: []
        };
    }

    const activeFile = ctx.activeFile || null;
    const extractedContent = ctx.extractedContent || activeFile?.extractedContent || null;
    const fileName = ctx.fileName || activeFile?.fileName || "الملف النشط";
    const filePath = ctx.filePath || activeFile?.filePath || null;

    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || "";
        const MAX_CHARS = 25000;

        fileContext = `
📄 **معلومات الملف النشط:** [${fileName}]
📊 **الأبعاد:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود.

📝 **عينة البيانات:**
${text.slice(0, MAX_CHARS)}
`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];

    let systemContent = SYSTEM_PROMPT;

    if (fileContext) {
        systemContent += `\n\n[سياق الملف الحالي للرجوع إليه]:\n${fileContext}`;
    }

    const conversationMessages = [
        { role: "system", content: systemContent },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
    ];

    let finalReplyText = "";
    let operations = [];
    let fileBase64 = null;
    let returnedFileName = fileName;
    let executionResult = null;

    try {
        console.log(`🧠 [Kernel] معالجة الطلب في جيميني...`);

        const rawReply = await geminiService.chat(conversationMessages, {
            fileName,
            extractedContent,
            systemInstruction: systemContent
        });

        finalReplyText = rawReply || "تم يا شريكي.";

        const jsonMatch =
            finalReplyText.match(/```json\s*([\s\S]*?)\s*```/) ||
            finalReplyText.match(/\{[\s\S]*"operations"[\s\S]*\}/);

        if (jsonMatch) {
            try {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonStr);

                if (parsed.operations && Array.isArray(parsed.operations)) {
                    operations = parsed.operations;
                }
            } catch (parseErr) {
                console.error("⚠️ [Kernel] فشل تحليل JSON:", parseErr);
            }
        }

        finalReplyText = finalReplyText.replace(/```json[\s\S]*?```/g, "").trim();

        if (operations.length > 0 && filePath && fs.existsSync(filePath)) {
            console.log(`⚡ [Kernel] تنفيذ ${operations.length} عملية عبر Python...`);
            
            executionResult = await executeWithPython(filePath, operations);
            
            if (executionResult && executionResult.success) {
                finalReplyText += `\n\n✅ تم التنفيذ بنجاح يا شريكي، والملف جاهز للتحميل!`;

                const updatedBuffer = fs.readFileSync(filePath);
                fileBase64 = updatedBuffer.toString("base64");
            } else {
                const errorMsg = executionResult?.error || 'فشل التنفيذ بدون تفاصيل';
                finalReplyText += `\n\n❌ **فشل التنفيذ:** ${errorMsg}`;
                console.error("❌ [Execution Error]:", errorMsg);
            }
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ بالاتصال: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: finalReplyText,
    });

    return {
        reply: finalReplyText,
        fileName: returnedFileName,
        fileBase64,
        operations,
        execution: executionResult
    };
            }
