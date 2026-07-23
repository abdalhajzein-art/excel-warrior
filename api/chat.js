import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from "./agent/system.js";
import { modifyExcelHandler } from './excel/modify.js';
import { generateExcelHandler } from './excel/generate.js';
import { convertFileHandler } from './convert/convert.js';
import XLSX from 'xlsx';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// تخزين الجلسات
const sessions = {};

// ✅ دالة موحدة لتوزيع المهام على الأدوات
async function callFunction(action, parameters) {
  switch (action) {
    case 'modify':
      return await modifyExcelHandler(parameters);
    case 'generate':
      return await generateExcelHandler(parameters);
    case 'convert':
      return await convertFileHandler(parameters);
    case 'analyze':
      // تحليل الملف مباشرة دون handler
      const buffer = Buffer.from(parameters.base64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      return {
        success: true,
        message: `✅ تم التحليل بنجاح!`,
        analysis: {
          rows: data.length,
          columns: data[0] ? Object.keys(data[0]) : [],
          sample: data.slice(0, 5)
        }
      };
    default:
      throw new Error(`إجراء غير معروف: ${action}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ reply: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, excelJSON, sessionId } = body || {};

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ reply: "⚠️ خطأ: مفتاح GROQ_API_KEY غير مضاف." });
    }

    // إدارة الجلسة
    const sessionKey = sessionId || 'default';
    if (!sessions[sessionKey]) {
      sessions[sessionKey] = { 
        step: 'init', 
        pendingAction: null, 
        lastFile: null,
        history: []
      };
    }
    const session = sessions[sessionKey];

    let userContent = (message || "").trim();
    let extractedBase64 = null;
    let fileName = null;
    let fileSummary = "";
    let fileData = null;

    const hasFile = excelJSON && Array.isArray(excelJSON) && excelJSON[0] && excelJSON[0].fileBase64;

    // معالجة الملف المرفق
    if (hasFile) {
      const fileObj = excelJSON[0];
      extractedBase64 = fileObj.fileBase64;
      fileName = fileObj.fileName || 'ملف';

      try {
        const buffer = Buffer.from(extractedBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        fileData = data;
        
        fileSummary = `[ملف مرفق: ${fileName}]\n`;
        fileSummary += `عدد الصفوف: ${data.length}\n`;
        fileSummary += `الأعمدة: ${data[0] ? Object.keys(data[0]).join(', ') : 'لا يوجد'}\n`;
        fileSummary += `\nعينة من البيانات (أول 5 صفوف):\n${JSON.stringify(data.slice(0, 5), null, 2)}`;
        
        session.lastFile = {
          base64: extractedBase64,
          name: fileName,
          summary: fileSummary,
          data: data
        };

        console.log(`✅ تم تحليل وحفظ الملف: ${fileName}`);
      } catch (err) {
        console.error("Error parsing Excel:", err);
        fileSummary = `[ملف مرفق: ${fileName} - تعذّر تحليل المحتوى]`;
      }
    } else if (session.lastFile) {
      extractedBase64 = session.lastFile.base64;
      fileName = session.lastFile.name;
      fileSummary = session.lastFile.summary;
      fileData = session.lastFile.data;
      console.log(`🔄 استرجاع الملف السابق: ${fileName}`);
    }

    // إضافة الرسالة للتاريخ
    session.history.push({ 
      role: 'user', 
      content: userContent + (fileSummary ? `\n\n${fileSummary}` : "") 
    });

    // ✅ تحسين إدارة السياق: 15 رسالة مع تلخيص
    if (session.history.length > 15) {
      const recent = session.history.slice(-5);
      const old = session.history.slice(0, -5);
      const summary = old.map(m => `${m.role}: ${m.content.substring(0, 100)}...`).join('\n');
      session.history = [
        { role: 'system', content: `📋 ملخص المحادثة السابقة:\n${summary}` },
        ...recent
      ];
    }

    // ✅ التعامل مع حالة "انتظار التأكيد"
    if (session.step === 'awaiting_confirmation' && session.pendingAction) {
      const lowerMsg = userContent.toLowerCase();
      
      if (lowerMsg.includes('نعم') || lowerMsg.includes('موافق') || lowerMsg.includes('yes') || lowerMsg.includes('ok') || lowerMsg.includes('تم')) {
        const action = session.pendingAction;
        session.step = 'executing';
        
        try {
          // استدعاء الدالة الموحدة
          const result = await callFunction(action.type, {
            instruction: action.instruction,
            base64: action.base64 || extractedBase64,
            fileName: fileName,
            data: fileData,
            format: action.format || 'pdf',
            targetColumn: action.targetColumn || null,
            newColumns: action.newColumns || [],
            formulaTemplate: action.formulaTemplate || null,
            dropdownOptions: action.dropdownOptions || null
          });

          session.step = 'init';
          session.pendingAction = null;

          if (result && result.success) {
            // ✅ إذا كانت النتيجة تحتوي على ملف معدل، قم بتحديث الجلسة
            if (result.fileBase64) {
              // تحديث الملف المخزن في الجلسة
              const newFileName = result.fileName || fileName;
              const newBase64 = result.fileBase64;
              
              // تحديث الملخص
              let newSummary = `[ملف معدل: ${newFileName}]\n`;
              if (result.summary) {
                newSummary += `التعديل: ${result.summary}\n`;
              }
              if (result.details) {
                newSummary += `تفاصيل: ${JSON.stringify(result.details)}\n`;
              }
              
              session.lastFile = {
                base64: newBase64,
                name: newFileName,
                summary: newSummary,
                data: fileData // يمكن تحديث البيانات إذا لزم الأمر
              };
              
              // تحديث المتغيرات الحالية
              extractedBase64 = newBase64;
              fileName = newFileName;
              fileSummary = newSummary;
              
              console.log(`🔄 تم تحديث الملف في الجلسة: ${newFileName}`);

              return res.json({
                reply: result.message || "✅ تم التنفيذ بنجاح!",
                fileBase64: result.fileBase64,
                fileName: result.fileName || fileName,
                contentType: result.contentType
              });
            } else {
              // إذا كانت النتيجة مجرد تحليل أو رسالة
              return res.json({
                reply: result.message || "✅ تم التنفيذ بنجاح!"
              });
            }
          } else {
            return res.json({
              reply: "❌ عذراً، فشل التنفيذ: " + (result?.error || "خطأ غير معروف")
            });
          }
        } catch (err) {
          console.error("❌ خطأ في التنفيذ:", err);
          session.step = 'init';
          session.pendingAction = null;
          return res.json({ 
            reply: `❌ عذراً، حدث خطأ أثناء التنفيذ: ${err.message}`
          });
        }
      } else if (lowerMsg.includes('لا') || lowerMsg.includes('عدل') || lowerMsg.includes('تغيير')) {
        session.step = 'init';
        session.pendingAction = null;
        return res.json({
          reply: "🔄 تمام… خلينا نعدل الخطة. شو بدك نغير بالضبط؟"
        });
      } else {
        return res.json({
          reply: "❓ عذراً، ما فهمت. هل توافق على الخطة؟ جاوب بـ 'نعم' أو 'لا'."
        });
      }
    }

    // تحليل الطلب باستخدام Groq
    const messagesPayload = [
      { role: "system", content: SYSTEM_PROMPT },
      ...session.history
    ];

    const analysis = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: messagesPayload,
      temperature: 0.4,
      max_completion_tokens: 1500
    });

    const analysisText = analysis.choices[0].message.content;
    console.log("📋 تحليل Groq:", analysisText);

    let analysisResult;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      analysisResult = JSON.parse(jsonMatch ? jsonMatch[0] : '{"isClear":false,"action":"chat","response":"مرحبا! كيف فيني ساعدك؟"}');
    } catch (parseErr) {
      console.error("❌ فشل تحليل JSON:", parseErr);
      analysisResult = { 
        isClear: false, 
        action: 'chat', 
        response: 'مرحبا! كيف فيني ساعدك اليوم؟' 
      };
    }

    // حفظ رد المساعد
    session.history.push({ role: 'assistant', content: analysisResult.response });

    // معالجة النتيجة
    if (!analysisResult.isClear) {
      let reply = analysisResult.response || "🤔 **عشان أفهم طلبك بشكل أفضل:**\n\n";
      
      if (analysisResult.questions && analysisResult.questions.length > 0) {
        reply += `\n❓ **أسئلة للتوضيح:**\n`;
        analysisResult.questions.forEach((q, i) => {
          reply += `${i+1}. ${q}\n`;
        });
      }
      
      return res.json({ reply: reply });
    }

    if (analysisResult.action === 'chat') {
      return res.json({ 
        reply: analysisResult.response || "تمام! كيف فيني ساعدك اليوم؟" 
      });
    }

    // إذا كان الطلب يتطلب أداة
    if (['modify', 'generate', 'convert', 'analyze'].includes(analysisResult.action)) {
      
      // تحضير المعاملات
      const params = {
        instruction: userContent,
        base64: extractedBase64,
        fileName: fileName,
        data: fileData,
        format: analysisResult.format || 'pdf',
        targetColumn: analysisResult.targetColumn || null,
        newColumns: analysisResult.newColumns || [],
        formulaTemplate: analysisResult.formulaTemplate || null,
        dropdownOptions: analysisResult.dropdownOptions || null
      };

      session.step = 'awaiting_confirmation';
      session.pendingAction = {
        type: analysisResult.action,
        instruction: userContent,
        base64: extractedBase64,
        fileName: fileName,
        format: analysisResult.format || 'pdf',
        targetColumn: analysisResult.targetColumn || null,
        newColumns: analysisResult.newColumns || [],
        formulaTemplate: analysisResult.formulaTemplate || null,
        dropdownOptions: analysisResult.dropdownOptions || null
      };
      
      let reply = analysisResult.response || `✅ **فهمت طلبك!**\n\n`;
      reply += `📋 **الملخص:** ${analysisResult.summary}\n\n`;
      reply += `📝 **خطة التنفيذ:**\n${analysisResult.plan || 'سيتم تنفيذ الطلب بناءً على تعليماتك.'}\n\n`;
      reply += `❓ **هل تريد المتابعة بالتنفيذ؟** (جاوب بـ "نعم" أو "عدل على الخطة")`;
      
      return res.json({ reply: reply });
    }

    return res.json({ 
      reply: analysisResult.response || "تمام… كيف فيني ساعدك؟" 
    });

  } catch (error) {
    console.error("❌ خطأ في المعالجة:", error);
    return res.status(500).json({
      reply: "⚠️ خطأ: " + (error.message || "مشكلة في المعالجة")
    });
  }
                                   }
