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
    // 1) تجهيز السياق
    // =========================
    let userContent = (message || "").trim();
    let extractedBase64 = null;
    let fileName = null;
    let fileSummary = "";
    let fileData = null;

    const hasText = userContent.length > 0;
    const hasFile = excelJSON && Array.isArray(excelJSON) && excelJSON[0] && excelJSON[0].fileBase64;

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
        
        fileSummary = `📁 **الملف المرفق:** ${fileName}\n`;
        fileSummary += `📊 **عدد الصفوف:** ${data.length}\n`;
        fileSummary += `📑 **الأعمدة:** ${data[0] ? Object.keys(data[0]).join(', ') : 'لا يوجد'}\n`;
        fileSummary += `\n📌 **عينة من البيانات (أول 5 صفوف):**\n${JSON.stringify(data.slice(0, 5), null, 2)}`;
      } catch (err) {
        fileSummary = `📁 **الملف المرفق:** ${fileName} (تعذّر تحليل المحتوى)`;
      }
    }

    // =========================
    // 2) إدارة الجلسة
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
    
    session.history.push({ role: 'user', content: userContent, hasFile: !!hasFile });

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
          if (action.type === 'modify') {
            result = await modifyExcelHandler({
              body: {
                base64: action.base64,
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
                base64: action.base64,
                targetFormat: action.format || 'pdf',
                sourceFormat: 'excel'
              }
            });
          } else if (action.type === 'analyze') {
            const buffer = Buffer.from(action.base64, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            
            const summary = {
              fileName: action.fileName || 'ملف',
              sheetName: sheetName,
              rowCount: data.length,
              columns: data[0] ? Object.keys(data[0]) : [],
              sample: data.slice(0, 5),
              stats: {}
            };
            
            if (data.length > 0 && data[0]) {
              Object.keys(data[0]).forEach(col => {
                const values = data.map(row => row[col]).filter(v => typeof v === 'number');
                if (values.length > 0) {
                  summary.stats[col] = {
                    min: Math.min(...values),
                    max: Math.max(...values),
                    avg: values.reduce((a, b) => a + b, 0) / values.length
                  };
                }
              });
            }
            
            let reply = `📊 **تحليل الملف:**\n\n`;
            reply += `📁 **اسم الملف:** ${summary.fileName}\n`;
            reply += `📋 **اسم الورقة:** ${summary.sheetName}\n`;
            reply += `📏 **عدد الصفوف:** ${summary.rowCount}\n`;
            reply += `📑 **الأعمدة:** ${summary.columns.join(', ')}\n\n`;
            
            if (Object.keys(summary.stats).length > 0) {
              reply += `📈 **إحصائيات الأعمدة الرقمية:**\n`;
              Object.entries(summary.stats).forEach(([col, stats]) => {
                reply += `  • **${col}:** min=${stats.min}, max=${stats.max}, avg=${stats.avg.toFixed(2)}\n`;
              });
              reply += '\n';
            }
            
            reply += `📌 **عينة من البيانات (أول 5 صفوف):**\n`;
            reply += JSON.stringify(summary.sample, null, 2);
            
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
            reply: result.message || "✅ تم التنفيذ بنجاح!",
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
          reply: "🔄 تمام… خلينا نعدل الخطة. شو بدك تغيير بالضبط؟"
        });
      } else {
        return res.json({
          reply: "❓ عذراً، ما فهمت. هل توافق على الخطة؟ جاوب بـ 'نعم' أو 'لا' أو 'عدل'."
        });
      }
    }

    // =========================
    // 4) تحليل الطلب (كشريك حوار)
    // =========================
    const analysis = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `أنت "الأثير"، شريك تقني خبير ومحاور ذكي.

📌 **أسلوبك:**
- تحدث باللهجة السورية البيضاء، ودود ومحترف.
- اقرأ الملف المرفق (إن وجد) وافهم محتواه.
- ناقش المستخدم لفهم احتياجاته بدقة.
- اقترح حلولاً واسأل عن التفاصيل.
- لا تنفذ أي شيء قبل الاتفاق.

⚡ **قواعد مهمة:**
- إذا الطلب غير واضح، اسأل عن التفاصيل.
- إذا الطلب واضح، اعرض خطة واطلب التأكيد.
- استخدم معلومات الملف في تحليلك.
- كن شريكاً، ليس مجرد منفذ.

أجب بصيغة JSON:
{
  "isClear": true/false,
  "action": "modify|generate|convert|analyze|chat",
  "summary": "ملخص الطلب",
  "plan": "خطة التنفيذ (إذا كان واضحاً)",
  "questions": ["سؤال1", "سؤال2"],
  "response": "ردك الطبيعي للمستخدم (باللهجة السورية)"
}`
        },
        {
          role: "user",
          content: `الطلب: ${userContent || "مرحبا"}\n\n${fileSummary || "لا يوجد ملف مرفق."}`
        }
      ],
      temperature: 0.4,
      max_completion_tokens: 800
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
        base64: extractedBase64,
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
