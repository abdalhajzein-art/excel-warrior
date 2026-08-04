/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Python-Integrated Edition)
 * ✅ تواصل مباشر مع جيميني واستجابة سليمة خالية من العقد.
 * ✅ تنفيذ حقيقي لتعديلات الإكسل عبر جسر بايثون (Python Sovereign Bridge).
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

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
    const filePath = activeFile?.filePath || null;

    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || '';
        
        const MAX_CHARS = 25000;
        fileContext = `
📄 **معلومات الملف النشط:** [${fileName}]
📊 **الأبعاد:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود.

📝 **عينة البيانات:**
${text.slice(0, MAX_CHARS)}
`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
    
    let systemContent = `
${SYSTEM_PROMPT}

[التوجيهات الصارمة لشخصيتك وتعديل الملفات]:
- أنت زميل ومهندس معماري لمنصة "الأثير". خاطب المستخدم دائماً بروح الزميل باللهجة السورية المهنية المحببة (يا شريكي، يا هندسة، تكرم عينك، إلخ).
- إذا طلب المستخدم تعديل على ملف الإكسل (مثل إضافة عمود، حذف، تعديل خلية)، قم بالرد بشكل طبيعي وأرفق في نهاية ردك كتلة JSON بالصيغة التالية تماماً لتنفيذ التعديل عبر بايثون:
\`\`\`json
{
  "operations": [
    {"type": "add_column", "header": "اسم العمود", "after": "اسم العمود السابق"}
  ]
}
\`\`\`
`;

    if (fileContext) {
        systemContent += `\n\n${fileContext}`;
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

    try {
        console.log(`🧠 [Kernel] معالجة الطلب في جيميني...`);
        const rawReply = await geminiService.chat(conversationMessages, { fileName, extractedContent });
        finalReplyText = rawReply || "تم يا شريكي، جهزتلك المطلوب.";

        // استخراج عمليات JSON إن وجدت في رد جيميني
        const jsonMatch = finalReplyText.match(/```json\s*([\s\S]*?)\s*```/) || finalReplyText.match(/\{[\s\S]*"operations"[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonStr);
                if (parsed.operations && Array.isArray(parsed.operations)) {
                    operations = parsed.operations;
                }
            } catch (parseErr) {
                console.error("⚠️ [Kernel] فشل تحليل JSON للعمليات:", parseErr);
            }
        }

        // تنظيف الرد النصي من كتلة الـ JSON ليظهر بشكل نظيف للمستخدم
        finalReplyText = finalReplyText.replace(/```json[\s\S]*?```/g, "").trim();

        // تنفيذ عمليات بايثون إذا توفرت عمليات وملف نشط
        if (operations.length > 0 && filePath && fs.existsSync(filePath)) {
            const scriptPath = path.join(process.cwd(), "api/core/excel_bridge.py");
            const opsJson = JSON.stringify(operations);
            
            console.log(`⚡ [Python Bridge] تنفيذ ${operations.length} عملية على الملف: ${filePath}`);
            const stdout = execSync(`python3 "${scriptPath}" "${filePath}" '${opsJson}'`).toString();
            const res = JSON.parse(stdout);
            
            if (res.success) {
                finalReplyText += `\n\n✅ تم تطبيق التعديلات المطلوبة على الملف بنجاح يا شريكي، وصار جاهز للتحميل!`;
                
                // قراءة الملف المعدل وتحويله إلى Base64
                const updatedBuffer = fs.readFileSync(filePath);
                fileBase64 = updatedBuffer.toString("base64");
            } else {
                finalReplyText += `\n⚠️ حدث خطأ أثناء تنفيذ بايثون: ${res.error}`;
            }
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ بالاتصال أو التنفيذ: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: finalReplyText,
    });

    return {
        reply: finalReplyText,
        fileName: returnedFileName,
        fileBase64: fileBase64,
        operations: operations
    };
}
