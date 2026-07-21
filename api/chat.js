import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsRegistry, toolsDefinition } from "./tools/index.js";
import XLSX from 'xlsx'; // مكتبة قراءة ملفات الإكسل

const ai = new GoogleGenAI({});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ reply: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, excelJSON } = body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ reply: "⚠️ خطأ: مفتاح GEMINI_API_KEY غير مضاف في متغيرات البيئة." });
    }

    let userContent = message || "مساعدة بخصوص الملف المرفق";
    let fileContentPreview = "";

    // معالجة الملف المرفق وقراءة محتواه الداخلي بشكل سيادي
    if (excelJSON && excelJSON[0]) {
      const fileObj = excelJSON[0];
      const fileName = fileObj.fileName || 'ملف';
      
      if (fileObj.fileBase64) {
        try {
          const buffer = Buffer.from(fileObj.fileBase64, 'base64');
          
          if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
            // قراءة ملفات الإكسل وجداول البيانات عبر مكتبة XLSX
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // تحويل ورقة العمل إلى مصفوفة كائنات / نص JSON مصغر ليقرأه الذكاء الاصطناعي
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            fileContentPreview = `\n[محتوى الملف المرفق (${fileName}) الداخلي:\n${JSON.stringify(jsonData.slice(0, 100), null, 2)}\n(ملاحظة: تم عرض أول 100 صف كعينة تحليلية)]`;
          } else {
            // للملفات النصية أو الـ JSON المباشرة
            const textContent = buffer.toString('utf8');
            fileContentPreview = `\n[محتوى الملف النصي المرفق (${fileName}):\n${textContent.substring(0, 5000)}\n]`;
          }
        } catch (parseErr) {
          console.error("Error parsing attached file content:", parseErr);
          fileContentPreview = `\n[معلومات الملف المرفق: اسم الملف: ${fileName} (تعذر استخراج محتواه النصي مباشرة، يرجى الاستعانة بالأدوات)]`;
        }
      } else if (Array.isArray(fileObj) || fileObj.content) {
        // لو كانت البيانات مرسلة كنص JSON مُحلل مسبقاً
        fileContentPreview = `\n[محتوى البيانات المرفقة:\n${JSON.stringify(fileObj).substring(0, 5000)}\n]`;
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `${SYSTEM_PROMPT}\n${fileContentPreview}\n\nUser Request: ${userContent}`,
      config: {
        temperature: 0.5,
        tools: [{
          functionDeclarations: toolsDefinition.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          }))
        }]
      }
    });

    const candidate = response.candidates?.[0];
    const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall) || [];

    if (functionCalls.length > 0) {
      const { name: toolName, args: toolArgs } = functionCalls[0].functionCall;

      if (toolsRegistry[toolName]) {
        try {
          if (!toolArgs.base64 && excelJSON && excelJSON[0] && excelJSON[0].fileBase64) {
            toolArgs.base64 = excelJSON[0].fileBase64;
          }

          let toolResult = null;
          const mockReq = { body: toolArgs };
          const mockRes = {
            status: (code) => ({
              json: (resultData) => {
                toolResult = resultData;
                return resultData;
              }
            }),
            setHeader: () => {},
            send: (data) => { toolResult = data; }
          };

          const handlerFn = toolsRegistry[toolName].handler;
          const directResult = await handlerFn(mockReq, mockRes);
          
          if (directResult && (directResult.fileBase64 || directResult.success)) {
            toolResult = directResult;
          }

          if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
            const isWord = toolName.includes('word');
            return res.status(200).json({
              reply: "✅ أبشر، تم تنفيذ الطلب وتوليد المستند بنجاح:",
              fileBase64: Buffer.from(toolResult).toString('base64'),
              fileName: isWord ? 'document.docx' : 'spreadsheet.xlsx'
            });
          }

          if (toolResult && toolResult.fileBase64) {
            return res.status(200).json({
              reply: toolResult.message || "✨ أبشر، تم تنفيذ العملية بنجاح:",
              fileBase64: toolResult.fileBase64,
              fileName: toolResult.fileName || 'alatheer_output.dat',
              contentType: toolResult.contentType || 'application/octet-stream'
            });
          }

          return res.status(200).json({ reply: "✅ تم تنفيذ الأداة بنجاح." });

        } catch (toolErr) {
          console.error("Tool execution error in chat:", toolErr);
          return res.status(200).json({ reply: "⚠️ حدث خطأ أثناء تنفيذ الأداة البرمجية: " + toolErr.message });
        }
      }
    }

    const replyText = response.text || "تم الاستلام بنجاح.";
    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Error in Official Gemini SDK Chat API:", error);
    return res.status(500).json({ reply: "⚠️ خطأ في المعالجة التقنية الرسمية مع جوجل: " + error.message });
  }
}

