/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Headless-Excel Edition)
 * ✅ الاعتماد فقط على headless-excel للتنفيذ
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
 * ✅ تنفيذ العمليات عبر headless-excel فقط
 */
async function executeWithHeadlessExcel(filePath, operations) {
    try {
        // بناء كود Python لتنفيذ العمليات
        let pythonCode = `
import headless_excel
from headless_excel import ExcelEngine
import json
import sys

try:
    engine = ExcelEngine('${filePath}')
`;

        // إضافة العمليات
        for (const op of operations) {
            switch (op.type) {
                case 'add_column':
                    const after = op.after || op.afterColumn || '';
                    pythonCode += `    engine.add_column('${op.header}', after='${after}')\n`;
                    break;
                case 'add_validation':
                    pythonCode += `    engine.add_validation('${op.address}', '${op.formulae || "خيار1,خيار2,خيار3"}')\n`;
                    break;
                case 'sync':
                    pythonCode += `    engine.sync()\n`;
                    break;
                case 'add_row':
                    pythonCode += `    engine.add_row(${JSON.stringify(op.data || [])})\n`;
                    break;
                case 'merge_cells':
                    pythonCode += `    engine.merge_cells('${op.range}')\n`;
                    break;
                case 'set_column_width':
                    pythonCode += `    engine.set_column_width('${op.column}', ${op.width})\n`;
                    break;
                case 'add_chart':
                    pythonCode += `    engine.add_chart('${op.chart_type || 'bar'}', '${op.title || 'Chart'}', '${op.position || 'E2'}')\n`;
                    break;
                case 'apply_theme':
                    pythonCode += `    engine.apply_theme('${op.theme || 'etheer_gold'}')\n`;
                    break;
                default:
                    console.warn(`⚠️ عملية غير مدعومة في headless-excel: ${op.type}`);
            }
        }

        pythonCode += `
    engine.save()
    print(json.dumps({"success": True, "message": "تم التنفيذ بنجاح"}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

        // كتابة الكود في ملف مؤقت
        const tempPyPath = path.join('/tmp', `headless_${Date.now()}.py`);
        fs.writeFileSync(tempPyPath, pythonCode);

        // تنفيذ الكود
        const { stdout, stderr } = await execAsync(`python3 "${tempPyPath}"`);
        
        // تنظيف
        try { fs.unlinkSync(tempPyPath); } catch(e) {}
        
        if (stderr && !stderr.includes('Warning')) {
            console.error('❌ Headless Excel Error:', stderr);
            return { success: false, error: stderr };
        }
        
        try {
            return JSON.parse(stdout);
        } catch {
            return { success: true, output: stdout };
        }
    } catch (error) {
        console.error('❌ Headless Excel Exception:', error);
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

    // بناء سياق الملف
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

        // استخراج JSON من رد الوكيل
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

        /* ============================================================
           ⚙️ تنفيذ العمليات عبر headless-excel فقط
           ============================================================ */
        if (operations.length > 0 && filePath && fs.existsSync(filePath)) {
            console.log(`⚡ [Kernel] تنفيذ ${operations.length} عملية عبر headless-excel...`);
            
            executionResult = await executeWithHeadlessExcel(filePath, operations);
            
            if (executionResult.success) {
                finalReplyText += `\n\n✅ تم التنفيذ بنجاح يا شريكي، والملف جاهز للتحميل!`;

                const updatedBuffer = fs.readFileSync(filePath);
                fileBase64 = updatedBuffer.toString("base64");
            } else {
                finalReplyText += `\n\n❌ **فشل التنفيذ عبر headless-excel:** ${executionResult.error}`;
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
