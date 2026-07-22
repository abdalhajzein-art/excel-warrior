import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from "./agent/system.js";
import { modifyExcelHandler } from './excel/modify.js';
import { generateExcelHandler } from './excel/generate.js';
import { convertFileHandler } from './convert/convert.js';
import XLSX from 'xlsx';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ✅ تخزين الجلسات (للمحادثات المستمرة)
const sessions = {};

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

    // =========================
    // 1) إدارة الجلسة أولاً لضمان استمرارية السياق
    // =========================
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

    // =========================
    // 2) استقبال الملف أو استرجاعه من الذاكرة
    // =========================
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
        
        // ✅ حفظ الملف في ذاكرة الجلسة لضمان عدم ضياعه
        session.lastFile = {
          base64: extractedBase64,
          name: fileName,
          summary: fileSummary,
          data: data
        };

        console.log(`✅ تم تحليل وحفظ الملف في الجلسة: ${fileName}, عدد الصفوف: ${data.length}`);
      } catch (err) {
        console.error("Error parsing Excel:", err);
        fileSummary = `[ملف مرفق: ${fileName} - تعذّر تحليل المحتوى]`;
      }
    } else if (session.lastFile) {
      // استرجاع الملف القديم من الجلسة إذا لم يتم إرفاقه في هذه الرسالة
      extractedBase64 = session.lastFile.base64;
      fileName = session.lastFile.name;
      fileSummary = session.lastFile.summary;
      fileData = session.lastFile.data;
      console.ولغ ?? console.log(`🔄 تم استرجاع الملف السابق من الجلسة: ${fileName}`);
    } else {
      console.log("ℹ️ لا يوجد ملف مرفق في الطلب ولا في ذاكرة الجلسة");
    }

    // إضافة الرسالة الحالية لسجل التاريخ
    session.history.push({ 
      role: 'user', 
      content: userContent + (fileSummary ? `\n\n${fileSummary}` : "") 
    });

    // الحفاظ على أحدث 10 رسائل فقط لعدم تجاوز الحد الأقصى للتوكنز
    if (session.history.length > 10) {
      session.history = session.history.slice(-10);
    }

    // =========================
    // 3) إذا كانت الجلسة في حالة "انتظار تأكيد"
    // =========================
    if (session.step === 'awaiting_confirmation' && session.pendingAction) {
      const lowerMsg = userContent.toLowerCase();
      
      if (lowerMsg.includes('نعم') || lowerMsg.includes('موافق') || lowerMsg.includes('yes') || lowerMsg.includes('ok') || lowerMsg.includes('تم')) {
        const action = session.pendingAction;
        session.step = 'executing';
        
        let result;
        try {
          // التأكد من تمرير الـ base64 المخزن حتى لو لم يُرفق ملف جديد
          const activeBase64 = action.base64 || extractedBase64;

          if (action.type === 'modify') {
            result = await modifyExcelHandler({
              body: {
                base64: activeBase64,
                instruction: action.instruction
              }
            });
          } else if (action.type === 'generate') {
            result = await generateExcelHandler({
              body: { instruction: action.instruction }
            });
          } else if (action.type === 'convert') {
            result = await convertFileHandler({
              body: {
                base64: activeBase64,
                targetFormat: action.format || 'pdf',
                sourceFormat: 'excel'
              }
            });
          } else if (action.type === 'analyze') {
            const buffer = Buffer.from(activeBase64, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            
            let reply = `📊 **تحليل الملف المحدث:**\n\n`;
            reply += `📁 **اسم الملف:** ${action.fileName || fileName}\n`;
            reply += `📏 **عدد الصفوف:** ${data.length}\n`;
            
            session.step = 'init';
            session.pendingAction = null;
            return res.json({ reply: reply });
          }
        } catch (err) {
          console.error("❌ خطأ في التنفيذ:", err);
          session.step = 'init';
          session.pendingAction = null;
          return res.json({ 
            reply: `❌ عذراً، حدث خطأ أثناء التنفيذ: ${err.message}`
          });
        }
        
        session.step = 'init';
        session.pendingAction = null;
        
        if (result && result.success && result.fileBase64) {
          return res.json({
            reply: result.message || "✅ تم التنفيذ بنجاح وتعديل الملف!",
            fileBase64: result.fileBase64,
            fileName: result.fileName,
            contentType: result.contentType
          });
        } else {
          return res.json({
            reply: "❌ عذراً، فشل التنفيذ: " + (result?.error || "خطأ غير معروف")
          });
        }
      } else if (lowerMsg.includes('لا') || lowerMsg.includes('عدل') || lowerMsg.includes('تغيير') || lowerMsg.includes('ليس')) {
        session.step = 'init';
        session.pendingAction = null;
        return res.json({
          reply: "🔄 تمام… خلينا نعدل الخطة. شو بدك نغير بالضبط؟"
        });
      } else {
        return res.json({
          reply: "❓ عذراً، ما فهمت. هل توافق على الخطة؟ جاوب بـ 'نعم' أو 'لا' أو 'عدل'."
        });
      }
    }

    // =========================
    // 4) تحليل الطلب مع تمرير كامل الـ History لـ Groq
    // =========================
    const messagesPayload = [
      {
        role: "system",
        content: `أنت "الأثير"، شريك تقني خبير ومحاور ذكي.

📌 **أسلوبك:**
- تحدث باللهجة السورية البيضاء، ودود ومحترف.
- اقرأ الملف المرفق (إن وجد في السياق) وافهم محتواه.
- ناقش المستخدم لفهم احتياجاته بدقة.
- اقترح حلولاً واسأل عن التفاصيل.
- لا تنفذ أي شيء قبل الاتفاق.

⚡ **قواعد مهمة:**
- إذا الطلب غير واضح، اسأل عن التفاصيل.
- إذا الطلب واضح، اعرض خطة واطلب التأكيد.
- استخدم معلومات الملف في تحليلك وسياق المحادثة السابقة.
- كن شريكاً، ليس مجرد منفذ.

أجب بصيغة JSON حصراً:
{
  "isClear": true/false,
  "action": "modify|generate|convert|analyze|chat",
  "summary": "ملخص الطلب",
  "plan": "خطة التنفيذ (إذا كان واضحاً)",
  "questions": ["سؤال1", "سؤال2"],
  "response": "ردك الطبيعي للمستخدم (باللهجة السورية)"
}`
      },
      ...session.history // ✅ إرسال الذاكرة كاملة لكي لا ينسى النموذج شيئاً
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

    // إضافة رد النموذج لسجل التاريخ
    session.history.push({ role: 'assistant', content: analysisResult.response });

    // =========================
    // 5) معالجة النتيجة
    // =========================
    
    if (!analysisResult.isClear) {
      let reply = analysisResult.response || "🤔 **عشان أفهم طلبك بشكل أفضل:**\n\n";
      
      if (analysisResult.questions && analysisResult.questions.length > 0) {
        reply += `\n❓ **أسئلة للتوضيح:**\n`;
        analysisResult.questions.forEach((q, i) => {
          reply += `${i+1}. ${q}\n`;
        });
      }
      
      if (analysisResult.summary) {
        reply += `\n📋 **فهمي المبدئي:** ${analysisResult.summary}`;
      }
      
      return res.json({ reply: reply });
    }

    if (analysisResult.action === 'chat') {
      return res.json({ 
        reply: analysisResult.response || "تمام! كيف فيني ساعدك اليوم؟" 
      });
    }

    if (analysisResult.action === 'modify' || analysisResult.action === 'generate' || 
        analysisResult.action === 'convert' || analysisResult.action === 'analyze') {
      
      session.step = 'awaiting_confirmation';
      session.pendingAction = {
        type: analysisResult.action,
        instruction: userContent,
        base64: extractedBase64, // تخزين الـ base64 الحالي للمهمة
        fileName: fileName,
        format: 'pdf'
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

