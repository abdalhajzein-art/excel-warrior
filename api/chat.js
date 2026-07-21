import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsRegistry, toolsDefinition } from "./tools/index.js";
import XLSX from 'xlsx';

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
    let fileDataBlock = "";

    // قراءة البيانات الحقيقية من ملف الإكسل وحقنها بشكل مباشر ومفرض على النموذج
    if (excelJSON && excelJSON[0] && excelJSON[0].fileBase64) {
      try {
        const fileObj = excelJSON[0];
        const buffer = Buffer.from(fileObj.fileBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // تحويل محتوى ورقة العمل إلى مصفوفة بيانات نصية دقيقة
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        fileDataBlock = `
=== بيانات الملف المرفق الفعلية (${fileObj.fileName || 'ملف'}) ===
${JSON.stringify(rawData, null, 2)}
=================================================
تعليمات صارمة: البيانات أعلاه هي محتوى الملف الذي أرسله المستخدم. ممنوع منعاً باتاً أن تسأل المستخدم عن محتوى الملف أو أسماء الأعمدة؛ لأن محتوى الملف بين يديك بالكامل الآن. قم بتحليله، قراءته، والإجابة على طلب المستخدم بناءً عليه فوراً وبدقة متناهية!
`;
      } catch (parseErr) {
        console.error("Error parsing Excel data in chat:", parseErr);
        fileDataBlock = `[ملاحظة: تم إرفاق ملف باسم ${excelJSON[0].fileName} ولكن حدث خطأ في استخراج محتواه: ${parseErr.message}]`;
      }
    }

    const fullPrompt = `${SYSTEM_PROMPT}\n\n${fileDataBlock}\n\nUser Request: ${userContent}`;

    let response = null;
    
    try {
      response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: fullPrompt,
        config: {
          temperature: 0.4, // حرارة منخفضة ليكون التحليل دقيقاً وصارماً
          tools: [{
            functionDeclarations: toolsDefinition.map(t => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters
            }))
          }]
        }
      });
    } catch (primaryErr) {
      console.warn("Primary model busy, switching to backup...", primaryErr.message);
      response = await ai.models.generateContent({
        model: 'gemini-1.5-pro',
        contents: fullPrompt,
        config: {
          temperature: 0.4,
          tools: [{
            functionDeclarations: toolsDefinition.map(t => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters
            }))
          }]
        }
      });
    }

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
    return res.status(500).json({ reply: "⚠️ خطأ في المعالجة السيادية الرسمية: " + (error.message || error) });
  }
}

