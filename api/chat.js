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

    // =========================
    // عقل المنصّة الهجيني
    // =========================

    // 1) تجهيز السياق الأساسي
    let userContent = (message || "").trim();
    let extractedBase64 = null;
    let fileMimeType = null;
    let fileName = null;
    let fileSummary = null;

    const hasText = userContent.length > 0;
    const hasFile = excelJSON && Array.isArray(excelJSON) && excelJSON[0] && excelJSON[0].fileBase64;

    // 2) استقبال الملف وتحليل أولي
    if (hasFile) {
      const fileObj = excelJSON[0];
      extractedBase64 = fileObj.fileBase64;
      fileMimeType = fileObj.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileName = fileObj.fileName || 'ملف';

      try {
        const buffer = Buffer.from(extractedBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        fileSummary = `الملف يحتوي على ${rawData.length} صفوف في الشيت الأولى (${firstSheetName}).`;
      } catch (parseErr) {
        console.error("Error parsing Excel in chat:", parseErr);
        fileSummary = "تعذّر تحليل الملف إكسل بشكل آلي، يمكن التعامل معه كنص أو إعادة رفعه.";
      }
    }

    // =========================
    // طبقة كشف نوع الملف
    // =========================
    function detectFileType(mime) {
      if (!mime) return "unknown";

      const m = mime.toLowerCase();

      if (m.includes("spreadsheet") || m.includes("excel")) return "excel";
      if (m.includes("wordprocessing") || m.includes("word")) return "word";
      if (m.includes("pdf")) return "pdf";
      if (m.includes("image")) return "image";
      if (m.includes("text")) return "text";

      return "unknown";
    }

    const fileType = detectFileType(fileMimeType);
// =========================
    // محرك اختيار الأداة – Tool Selector Engine
    // =========================
    function selectTool(intent, fileType) {
        // 1) إذا ما في ملف → توليد أو رد نصي
        if (!fileType || fileType === "unknown") {
            if (intent.wantsGenerate) return "excel_generate"; // توليد افتراضي
            return null; // دردشة فقط
        }

        // 2) Excel
        if (fileType === "excel") {
            if (intent.wantsModify) return "excel_modify";
            if (intent.wantsGenerate) return "excel_generate";
            if (intent.wantsConvert) return "file_convert";
        }

        // 3) Word
        if (fileType === "word") {
            if (intent.wantsModify) return "word_modify";
            if (intent.wantsGenerate) return "word_generate";
            if (intent.wantsConvert) return "file_convert";
        }

        // 4) PDF
        if (fileType === "pdf") {
            if (intent.wantsModify) return "pdf_modify";
            if (intent.wantsGenerate) return "pdf_generate";
            if (intent.wantsConvert) return "file_convert";
        }

        // 5) Image
        if (fileType === "image") {
            if (intent.wantsModify) return "image_modify";
            if (intent.wantsGenerate) return "image_generate";
        }

        // 6) إذا ما قدر يحدد
        return null;
    }
    
    // =========================
    // محرك النية الذكي – Intent Engine v2
    // =========================
    const lowerText = userContent.toLowerCase();

    const intent = {
      isChatOnly: hasText && !hasFile,
      isFileOnly: hasFile && !hasText,
      isFileWithText: hasFile && hasText,

      wantsModify: /عدل|تعديل|غيّر|تغيير|edit|update/.test(lowerText),
      wantsGenerate: /ولد|توليد|انشئ|إنشاء|create|generate|جهز|حضّر/.test(lowerText),
      wantsConvert: /حول|تحويل|convert/.test(lowerText),
      wantsAnalyze: /حلل|تحليل|analyze|افهم|فسر/.test(lowerText),
      wantsRead: /اقرأ|قراءة|عرض|اظهر|أظهر|show|display/.test(lowerText),

      mentionsExcel: /اكسل|excel|جدول/.test(lowerText),
      mentionsWord: /وورد|word|مستند/.test(lowerText),
      mentionsPdf: /pdf|بي دي اف/.test(lowerText),
      mentionsImage: /صورة|تصميم|image|logo|banner|poster/.test(lowerText)
    };

    // تحديد نوع المهمة العامة
    let taskType = "chat";

    if (intent.isChatOnly) {
      taskType = "chat";
    } else if (intent.isFileOnly) {
      taskType = "file_question";
    } else if (intent.isFileWithText) {
      if (intent.wantsModify) taskType = "file_modify";
      else if (intent.wantsGenerate) taskType = "file_generate";
      else if (intent.wantsConvert) taskType = "file_convert";
      else if (intent.wantsAnalyze) taskType = "file_analyze";
      else if (intent.wantsRead) taskType = "file_read";
      else taskType = "file_mixed";
    }

    // =========================
    // 4) بناء رسالة واضحة للذكاء حسب الحالة
    // =========================
    let finalUserText = "";
    let systemBehaviorNote = "";

    if (taskType === "chat") {
      systemBehaviorNote =
        "أنت مساعد ذكاء عام، دردشة حرة، ترد باختصار ووضوح وبأسلوب بشري لطيف.";
      finalUserText = userContent || "احكي معي بشكل عام.";
    } else if (taskType === "file_question") {
      systemBehaviorNote =
        "وصلك ملف بدون تعليمات نصية، مهمتك تسأل المستخدم بلطف شو المطلوب من الملف.";
      finalUserText = `وصل ملف باسم: ${fileName || "ملف"}.\nنوع الملف: ${fileType}.\n${fileSummary || ""}\nاسأل المستخدم: "شو حابب نعمل بهذا الملف؟"`;
    } else if (taskType === "file_modify") {
      systemBehaviorNote =
        "أنت مساعد ذكاء يتعامل مع ملف مرفق وتعليمات تعديل، مهمتك فهم المطلوب وبناء خطة تعديل واضحة أو اختيار أداة مناسبة.";
      finalUserText = `تعليمات التعديل:\n${userContent}\n\nنوع الملف: ${fileType}.\nمعلومات عن الملف:\n${fileSummary || "لا يوجد ملخص متاح."}`;
    } else if (taskType === "file_generate") {
      systemBehaviorNote =
        "المستخدم يطلب توليد ملف جديد (Excel/Word/PDF أو غيره)، مهمتك فهم نوع الملف المطلوب وبناء وصف واضح للتوليد أو اختيار أداة التوليد المناسبة.";
      finalUserText = `طلب التوليد:\n${userContent}\n\nنوع الملف المطلوب: ${fileType}.`;
    } else if (taskType === "file_convert") {
      systemBehaviorNote =
        "المستخدم يطلب تحويل ملف بين الصيغ، مهمتك تحديد الصيغة المستهدفة بوضوح واختيار أداة التحويل المناسبة.";
      finalUserText = `طلب التحويل:\n${userContent}\n\nنوع الملف الحالي: ${fileType}.`;
    } else if (taskType === "file_analyze") {
      systemBehaviorNote =
        "المستخدم يطلب تحليل ملف، مهمتك استخراج أهم النقاط، الملخصات، الأنماط، أو المشاكل من الملف.";
      finalUserText = `طلب التحليل:\n${userContent}\n\nنوع الملف: ${fileType}.`;
    } else if (taskType === "file_read" || taskType === "file_mixed") {
      systemBehaviorNote =
        "المستخدم يتعامل مع ملف مرفق وتعليمات عامة، مهمتك فهم المطلوب (عرض، قراءة، تعديل، تحليل) واختيار أفضل رد أو أداة.";
      finalUserText = `تعليمات المستخدم:\n${userContent}\n\nنوع الملف: ${fileType}.`;
    }

    // =========================
    // 5) بناء محتوى الرسالة للذكاء
    // =========================
    const contents = [
      {
        role: "system",
        parts: [
          { text: SYSTEM_PROMPT },
          { text: systemBehaviorNote }
        ]
      },
      {
        role: "user",
        parts: [
          { text: finalUserText },
          ...(extractedBase64 ? [{
            fileData: {
              mimeType: fileMimeType,
              data: extractedBase64
            }
          }] : [])
        ]
      }
    ];

    // =========================
    // 6) تعريف الأدوات للذكاء
    // =========================
    const toolsConfig = {
      functionDeclarations: toolsDefinition.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }))
    };

    // =========================
    // 7) استدعاء النموذج مع الأدوات
    // =========================
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
        model: 'gemini-3.5-flash',
        contents,
        config: {
          temperature: 0.3,
          tools: toolsConfig
        }
      });
    }

    const candidate = response.candidates?.[0];
    const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall) || [];

// =========================
    // طبقة التنفيذ التلقائي للأداة – Auto Tool Execution
    // =========================
    const autoTool = selectTool(intent, fileType);

    // إذا النموذج ما اختار أداة، والعقل الهجيني قدر يحدد أداة مناسبة
    if (functionCalls.length === 0 && autoTool) {
        try {
            const autoArgs = {};

            // إذا الأداة تحتاج ملف
            if (extractedBase64) {
                autoArgs.base64 = extractedBase64;
            }

            // إذا توليد وما في تعليمات
            if (autoTool.includes("generate")) {
                autoArgs.instruction = userContent || "ملف جديد بناءً على طلب المستخدم.";
                autoArgs.content = userContent;
                autoArgs.prompt = userContent;
            }

            // إذا تعديل وما في تفاصيل
            if (autoTool.includes("modify") && !autoArgs.editMap) {
                autoArgs.editMap = { instruction: userContent };
            }

            let autoResult = null;
            const mockReq = { body: autoArgs };
            const mockRes = {
                status: (code) => ({
                    json: (resultData) => {
                        autoResult = resultData;
                        return resultData;
                    }
                }),
                setHeader: () => {},
                send: (data) => { autoResult = data; }
            };

            const handlerFn = toolsRegistry[autoTool].handler;
            const directResult = await handlerFn(mockReq, mockRes);

            if (directResult && (directResult.fileBase64 || directResult.success)) {
                autoResult = directResult;
            }

            // إذا رجع ملف جاهز
            if (Buffer.isBuffer(autoResult) || autoResult instanceof Uint8Array) {
                const isWord = autoTool.includes("word");
                const isPdf = autoTool.includes("pdf");
                const isExcel = autoTool.includes("excel");

                return res.status(200).json({
                    reply: "✨ تم تنفيذ العملية تلقائيًا بناءً على فهم النية.",
                    fileBase64: Buffer.from(autoResult).toString("base64"),
                    fileName: isWord
                        ? "document.docx"
                        : isPdf
                        ? "document.pdf"
                        : isExcel
                        ? "sheet.xlsx"
                        : "output.bin",
                    contentType: isWord
                        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        : isPdf
                        ? "application/pdf"
                        : isExcel
                        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        : "application/octet-stream"
                });
            }

            // إذا رجع ملف Base64 جاهز
            if (autoResult && autoResult.fileBase64) {
                return res.status(200).json({
                    reply: autoResult.message || "✨ تم تنفيذ العملية تلقائيًا.",
                    fileBase64: autoResult.fileBase64,
                    fileName: autoResult.fileName || "alatheer_output.xlsx",
                    contentType: autoResult.contentType || "application/octet-stream"
                });
            }

            // إذا نجحت العملية بدون ملف
            return res.status(200).json({
                reply: "✨ تم تنفيذ العملية تلقائيًا بناءً على فهم النية."
            });

        } catch (autoErr) {
            console.error("Auto Tool Execution Error:", autoErr);
            return res.status(500).json({
                reply: "⚠️ صار خطأ أثناء التنفيذ التلقائي: " + autoErr.message
            });
        }
    }
    // =========================
    // 8) تنفيذ الأداة إذا النموذج قرر يستخدمها
    // =========================
    if (functionCalls.length > 0) {
      const { name: toolName, args: toolArgs } = functionCalls[0].functionCall;

      if (toolsRegistry[toolName]) {
        try {
          if (!toolArgs.base64 && extractedBase64) {
            toolArgs.base64 = extractedBase64;
          }

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

          if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
            const isWord = toolName.includes('word');
            const isPdf = toolName.includes('pdf');
            const isExcel = toolName.includes('excel');

            return res.status(200).json({
              reply: "✅ تم تنفيذ العملية على الملف بنجاح.",
              fileBase64: Buffer.from(toolResult).toString('base64'),
              fileName: isWord
                ? 'document.docx'
                : (isPdf ? 'document.pdf' : 'sheet.xlsx'),
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
// =========================
    // طبقة الرد البشري – Human Response Layer
    // =========================
    function humanizeReply(text) {
        if (!text) return "تمام، خلّيني ساعدك بخطوة تانية إذا حابب.";

        let reply = text.trim();

        // إزالة أي جفاف أو لغة روبوت
        reply = reply.replace(/نموذج|ذكاء اصطناعي|أداة|معالجة/g, "");

        // إزالة أي جمل تقنية غير مناسبة
        reply = reply.replace(/JSON|Base64|API|endpoint|parameters/gi, "");

        // تحسين الأسلوب ليكون بشري ولطيف
        reply = reply
            .replace(/تم التنفيذ بنجاح/g, "تمام، خلّصنا الشغلة بنجاح")
            .replace(/تمت المعالجة/g, "تمام، خلّصنا المطلوب")
            .replace(/خطأ/g, "في شغلة بسيطة لازم ننتبه عليها");

        // إضافة لمسة بشرية سورية بيضاء
        if (!reply.includes("تمام") && !reply.includes("طيب")) {
            reply = "تمام… " + reply;
        }

        return reply;
    }

    // =========================
    // طبقة تلطيف الأخطاء – Error Softening Layer
    // =========================
    function softenError(errText) {
        if (!errText) return "صار في شغلة بسيطة، خلّيني أرتّبها ونكمل.";

        let reply = errText.trim();

        // إزالة الكلمات التقنية الثقيلة
        reply = reply.replace(/Exception|Stack|Trace|Unhandled|Internal|API|endpoint|server/gi, "");

        // إزالة أي تفاصيل مخيفة
        reply = reply.replace(/at .*?\n/g, "");
        reply = reply.replace(/\s{2,}/g, " ");

        // تحويل الأسلوب ليكون بشري ولطيف
        reply = reply
            .replace(/خطأ/g, "في شغلة بسيطة لازم ننتبه عليها")
            .replace(/failed|error/gi, "صار ظرف بسيط أثناء التنفيذ");

        // إضافة لمسة بشرية
        if (!reply.includes("تمام") && !reply.includes("طيب")) {
            reply = "تمام… " + reply;
        }

        return reply;
    }

    // =========================
    // طبقة توحيد الرد النهائي – Final Response Layer
    // =========================
    function finalizeReply(text) {
        if (!text) return "تمام… خلّصنا المطلوب.";

        let reply = text.trim();

        // إزالة أي تكرار غير ضروري
        reply = reply.replace(/\n{2,}/g, "\n");

        // إزالة أي بقايا تقنية
        reply = reply.replace(/functionCall|tool|model|parameters|args/gi, "");

        // إزالة أي جمل غير بشرية
        reply = reply.replace(/تم الاستلام بنجاح وتمت معالجة الطلب نصيًا\./g, "");

        // تحسين الأسلوب العام
        reply = reply
            .replace(/تم التنفيذ تلقائيًا/g, "تمام… خلّصنا الشغلة")
            .replace(/تم التنفيذ/g, "تمام… خلّصنا المطلوب")
            .replace(/تمت المعالجة/g, "تمام… خلّصنا المطلوب");

        // إضافة لمسة بشرية نهائية
        if (!reply.includes("تمام")) {
            reply = "تمام… " + reply;
        }

        return reply;
    }

    // =========================
    // 9) إذا ما في أدوات، نرجّع رد نصّي من النموذج
    // =========================
    const replyText =
        candidate?.content?.parts?.map(p => p.text).join('\n') ||
        "تم الاستلام بنجاح وتمت معالجة الطلب نصيًا.";

    return res.status(200).json({
        reply: finalizeReply(
            humanizeReply(
                softenError(replyText)
            )
        )
    });

  } catch (error) {
    console.error("Error in Chat API:", error);
    return res.status(500).json({
      reply: "⚠️ خطأ في المعالجة السيادية: " + (error.message || error)
    });
  }
    }
