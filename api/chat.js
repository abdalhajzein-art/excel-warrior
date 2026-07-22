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
    let fileDataContext = "";

    // قراءة محتوى الملف المرفق وحقنه صراحةً للنموذج
    if (excelJSON && excelJSON[0] && excelJSON[0].fileBase64) {
      try {
        const fileObj = excelJSON[0];
        const buffer = Buffer.from(fileObj.fileBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        fileDataContext = `\n[محتوى الملف المرفق (${fileObj.fileName || 'ملف'}) بالكامل:\n${JSON.stringify(rawData, null, 2)}\n]\n`;
      } catch (parseErr) {
        console.error("Error parsing Excel in chat:", parseErr);
      }
    }

    const finalPrompt = `${SYSTEM_PROMPT}\n\n${fileDataContext}\n\nطلب المستخدم الحالي: ${userContent}`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: finalPrompt,
        config: {
          temperature: 0.3,
          tools: [{
            functionDeclarations: toolsDefinition.map(t => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters
            }))
          }]
        }
      });
    } catch (err) {
      response = await ai.models.generateContent({
        model: 'gemini-1.5-pro',
        contents: finalPrompt,
        config: {
          temperature: 0.3,
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
          // حقن الملف تلقائياً للأداة إذا كان مطلوباً
          if (!toolArgs.base64 && excelJSON && excelJSON[0] && excelJSON[0].fileBase64) {
            toolArgs.base64 = excelJSON[0].fileBase64;
          }

          // معالجة وتصحيح بارامترات التعديل في حال طلب إضافة عمود معين
          if (toolName === 'excel_modify' && !toolArgs.editMap) {
            toolArgs.editMap = {
              operation: "add_column",
              new_column: "سبب الغياب",
              position: { after: "الغياب" }
            };
          }

          if (toolName.includes('generate') && (!toolArgs.instruction && !toolArgs.prompt && !toolArgs.title)) {
            toolArgs.instruction = userContent || "ملف إكسل جديد";
            toolArgs.content = userContent;
            toolArgs.prompt = userContent;
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

          // إذا كانت النتيجة Buffer (ملف إكسل معدل وجاهز للتحميل)
          if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
            return res.status(200).json({
              reply: "✅ أبشر، تم تعديل ملف الإكسل وإضافة العمود المطلوب بنجاح:",
              fileBase64: Buffer.from(toolResult).toString('base64'),
              fileName: 'modified_attendance.xlsx',
              contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
          }

          if (toolResult && toolResult.fileBase64) {
            return res.status(200).json({
              reply: toolResult.message || "✨ أبشر، تم تنفيذ العملية بنجاح:",
              fileBase64: toolResult.fileBase64,
              fileName: toolResult.fileName || 'alatheer_output.xlsx',
              contentType: toolResult.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
          }

          return res.status(200).json({ reply: "✅ تم تنفيذ الأداة بنجاح." });

        } catch (toolErr) {
          console.error("Tool execution error:", toolErr);
          return res.status(200).json({ reply: "⚠️ حدث خطأ أثناء تنفيذ التعديل: " + toolErr.message });
        }
      }
    }

    const replyText = response.text || "تم الاستلام بنجاح.";
    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Error in Chat API:", error);
    return res.status(500).json({ reply: "⚠️ خطأ في المعالجة التقنية: " + (error.message || error) });
  }
}
