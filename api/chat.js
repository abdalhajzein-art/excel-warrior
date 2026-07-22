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

    let userContent = message || "تحليل أو معالجة ملف مرفق إن وجد.";
    let extractedBase64 = null;
    let fileMimeType = null;
    let fileName = null;

    // استقبال الملف من الفرونت (كـ Base64)
    if (excelJSON && Array.isArray(excelJSON) && excelJSON[0] && excelJSON[0].fileBase64) {
      const fileObj = excelJSON[0];
      extractedBase64 = fileObj.fileBase64;
      fileMimeType = fileObj.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileName = fileObj.fileName || 'ملف';

      // تحليل إكسل اختياري (ممكن تستخدمه لاحقًا لو حبيت)
      try {
        const buffer = Buffer.from(extractedBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // إذا حابب تضيف مقتطف نصي، خليه بسيط:
        userContent += `\n\n[الملف المرفق يحتوي على ${rawData.length} صفوف تقريبًا في الشيت الأولى (${firstSheetName}).]`;
      } catch (parseErr) {
        console.error("Error parsing Excel in chat:", parseErr);
      }
    }

    // بناء الرسالة للذكاء بشكل محترف وعام
    const contents = [
      {
        role: "system",
        parts: [
          { text: SYSTEM_PROMPT }
        ]
      },
      {
        role: "user",
        parts: [
          {
            text: `تعامل مع الطلب التالي كمنصة ذكاء عام قادرة على فهم النص والملفات المرفقة.\n\nطلب المستخدم:\n${userContent}`
          },
          ...(extractedBase64 ? [{
            fileData: {
              mimeType: fileMimeType,
              data: extractedBase64
            }
          }] : [])
        ]
      }
    ];

    const toolsConfig = {
      functionDeclarations: toolsDefinition.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }))
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents,
        config: {
          temperature: 0.3,
          tools: toolsConfig
        }
      });
    } catch (err) {
      response = await ai.models.generateContent({
        model: 'gemini-1.5-pro',
        contents,
        config: {
          temperature: 0.3,
          tools: toolsConfig
        }
      });
    }

    const candidate = response.candidates?.[0];
    const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall) || [];

    if (functionCalls.length > 0) {
      const { name: toolName, args: toolArgs } = functionCalls[0].functionCall;

      if (toolsRegistry[toolName]) {
        try {
          // ربط الـ Base64 تلقائيًا إذا الأداة تحتاجه
          if (!toolArgs.base64 && extractedBase64) {
            toolArgs.base64 = extractedBase64;
          }

          // بدون أي منطق جاهز خاص بعمود "سبب الغياب" أو "الغياب"
          // الأداة نفسها (excel_modify أو غيرها) هي اللي تقرر بناءً على محتوى الملف وطلب المستخدم

          // توليد ملفات جديدة بشكل عام
          if (
            toolName.includes('generate') &&
            (!toolArgs.instruction && !toolArgs.prompt && !toolArgs.title)
          ) {
            toolArgs.instruction = userContent || "ملف جديد بناءً على طلب المستخدم.";
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

          // إذا رجعت Buffer (ملف جاهز)
          if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
            const isWord = toolName.includes('word');
            const isPdf = toolName.includes('pdf');
            return res.status(200).json({
              reply: "✅ تم تنفيذ العملية على الملف بنجاح.",
              fileBase64: Buffer.from(toolResult).toString('base64'),
              fileName: isWord
                ? 'document.docx'
                : (isPdf ? 'document.pdf' : 'modified_file.xlsx'),
              contentType: isWord
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : (isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            });
          }

          if (toolResult && toolResult.fileBase64) {
            return res.status(200).json({
              reply: toolResult.message || "✨ تم تنفيذ العملية بنجاح.",
              fileBase64: toolResult.fileBase64,
              fileName: toolResult.fileName || 'alatheer_output.xlsx',
              contentType: toolResult.contentType || 'application/octet-stream'
            });
          }

          return res.status(200).json({ reply: "✅ تم تنفيذ الأداة البرمجية بنجاح." });

        } catch (toolErr) {
          console.error("Tool execution error:", toolErr);
          return res.status(500).json({ reply: "⚠️ حدث خطأ أثناء تنفيذ الأداة: " + toolErr.message });
        }
      }
    }

    const replyText =
      candidate?.content?.parts?.map(p => p.text).join('\n') ||
      "تم الاستلام بنجاح وتمت معالجة الطلب نصيًا.";

    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Error in Chat API:", error);
    return res.status(500).json({
      reply: "⚠️ خطأ في المعالجة السيادية: " + (error.message || error)
    });
  }
          }
