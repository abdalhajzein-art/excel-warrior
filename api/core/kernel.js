/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Python-Excel Edition)
 * ✅ الاعتماد على Python (openpyxl) للتنفيذ
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
        let pythonCode = `
import openpyxl
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
import json
import sys

try:
    wb = openpyxl.load_workbook('${filePath}')
    ws = wb.active
    
    # البحث عن صف العناوين
    header_row = 1
    for row in range(1, 4):
        if ws.cell(row=row, column=1).value:
            header_row = row
            break
    
    # البحث عن أسماء الأعمدة
    headers = {}
    for col in range(1, ws.max_column + 1):
        val = ws.cell(row=header_row, column=col).value
        if val:
            headers[str(val).strip()] = col
`;

        for (const op of operations) {
            switch (op.type) {
                case 'add_column':
                    const after = op.after || '';
                    pythonCode += `
    target_col = ws.max_column + 1
    if "${after}" in headers:
        target_col = headers["${after}"] + 1
    ws.insert_cols(target_col)
    ws.cell(row=header_row, column=target_col, value="${op.header || 'عمود جديد'}")
`;
                    break;
                case 'add_validation':
                    pythonCode += `
    dv = DataValidation(type="list", formula1='"${op.formulae || 'خيار1,خيار2,خيار3"}"', allow_blank=True)
    ws.add_data_validation(dv)
    ${op.address ? `dv.add('${op.address}')` : ''}
`;
                    break;
                case 'autofit_columns':
                    pythonCode += `
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = (max_length + 2)
        ws.column_dimensions[column].width = min(adjusted_width, 50)
`;
                    break;
                default:
                    pythonCode += `    # عملية غير مدعومة: ${op.type}\n`;
            }
        }

        pythonCode += `
    wb.save('${filePath}')
    print(json.dumps({"success": True, "message": "تم التنفيذ بنجاح"}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

        const tempPyPath = path.join('/tmp', `python_${Date.now()}.py`);
        fs.writeFileSync(tempPyPath, pythonCode);

        const { stdout, stderr } = await execAsync(`python3 "${tempPyPath}"`);
        
        try { fs.unlinkSync(tempPyPath); } catch(e) {}
        
        if (stderr && !stderr.includes('Warning')) {
            console.error('❌ Python Error:', stderr);
            return { success: false, error: stderr };
        }
        
        try {
            return JSON.parse(stdout);
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
            
            if (executionResult.success) {
                finalReplyText += `\n\n✅ تم التنفيذ بنجاح يا شريكي، والملف جاهز للتحميل!`;

                const updatedBuffer = fs.readFileSync(filePath);
                fileBase64 = updatedBuffer.toString("base64");
            } else {
                finalReplyText += `\n\n❌ **فشل التنفيذ:** ${executionResult.error}`;
                console.error("❌ [Execution Error]:", executionResult.error);
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
