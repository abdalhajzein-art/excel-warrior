import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsRegistry, toolsDefinition } from "./tools/index.js";

const ai = new GoogleGenAI({});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ reply: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { message, excelJSON, file } = body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        reply: "⚠️ مفتاح GEMINI_API_KEY مو مضاف بمتغيرات البيئة."
      });
    }

    // =========================
    // 1) تجهيز السياق الأساسي
    // =========================
    const userText = (message || "").trim();

    let fileBase64 = null;
    let fileMimeType = null;
    let fileName = null;

    // دعم ملف عام (Excel/Word/PDF/Image) أو excelJSON
    if (file && file.base64) {
      fileBase64 = file.base64;
      fileMimeType = file.type || "application/octet-stream";
      fileName = file.name || "ملف";
    } else if (excelJSON && Array.isArray(excelJSON) && excelJSON[0]?.fileBase64) {
      fileBase64 = excelJSON[0].fileBase64;
      fileMimeType =
        excelJSON[0].type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      fileName = excelJSON[0].fileName || "ملف إكسل";
    }

    const hasText = userText.length > 0;
    const hasFile = !!fileBase64;

    // =========================
    // 2) تحليل نية المستخدم
    // =========================
    const lower = userText.toLowerCase();

    const intent = {
      isChatOnly: hasText && !hasFile,
      isFileOnly: hasFile && !hasText,
      isFileWithText: hasFile && hasText,
      wantsModify: /عدل|تعديل|غيّر|تغيير|edit|update/.test(lower),
      wantsGenerate: /ولد|توليد|انشئ|إنشاء|create|generate|جهز|حضّر/.test(lower),
      wantsConvert: /حول|تحويل|convert/.test(lower),
      wantsAnalyze: /حلل|تحليل|analyze|افهم|فسر/.test(lower),
      wantsRead: /اقرأ|قراءة|عرض|اظهر|أظهر|show|display/.test(lower),
      wantsImage: /صورة|تصميم|image|logo|banner|poster/.test(lower),
      mentionsExcel: /اكسل|excel|جدول/.test(lower),
      mentionsWord: /وورد|word|مستند/.test(lower),
      mentionsPdf: /pdf|بي دي اف/.test(lower)
    };

    // =========================
    // 3) تحديد نوع المهمة العامة
    // =========================
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
    } else {
      taskType = "unknown";
    }

    // =========================
    // 4) بناء رسالة واضحة للذكاء
    // =========================
    let systemBehaviorNote = "";
    let finalUserText = "";

    if (taskType === "chat") {
      systemBehaviorNote =
        "أنت مساعد ذكاء عام، دردشة حرة، ترد باختصار ووضوح وبأسلوب بشري لطيف.";
      finalUserText = userText || "احكي معي بشكل عام.";
    } else if (taskType === "file_question") {
      systemBehaviorNote =
        "وصلك ملف بدون تعليمات نصية، مهمتك تسأل المستخدم بلطف شو المطلوب من الملف.";
      finalUserText = `وصل ملف باسم: ${fileName || "ملف"}.\nاسأل المستخدم: "شو حابب نعمل بهذا الملف؟"`;
    } else if (taskType === "file_modify") {
      systemBehaviorNote =
        "أنت مساعد ذكاء يتعامل مع ملف مرفق وتعليمات تعديل، مهمتك فهم المطلوب وبناء خطة تعديل واضحة أو اختيار أداة مناسبة.";
      finalUserText = `تعليمات التعديل:\n${userText}\n\nاسم الملف: ${fileName || "ملف"}.\nاشرح للمستخدم باختصار شو رح تعمل، وبعدين نفّذ أو اقترح أداة.`;
    } else if (taskType === "file_generate") {
      systemBehaviorNote =
        "المستخدم يطلب توليد ملف جديد (Excel/Word/PDF أو غيره)، مهمتك فهم نوع الملف المطلوب وبناء وصف واضح للتوليد أو اختيار أداة التوليد المناسبة.";
      finalUserText = `طلب التوليد:\n${userText}\n\nإذا مناسب، حضّر وصف منظم لهيكل الملف (أعمدة، صفوف، عناوين) قبل التنفيذ.`;
    } else if (taskType === "file_convert") {
      systemBehaviorNote =
        "المستخدم يطلب تحويل ملف بين الصيغ، مهمتك تحديد الصيغة المستهدفة بوضوح واختيار أداة التحويل المناسبة.";
      finalUserText = `طلب التحويل:\n${userText}\n\nاسم الملف: ${fileName || "ملف"}.\nحدّد نوع التحويل (مثلاً: من Excel إلى PDF).`;
    } else if (taskType === "file_analyze") {
      systemBehaviorNote =
        "المستخدم يطلب تحليل ملف، مهمتك استخراج أهم النقاط، الملخصات، الأنماط، أو المشاكل من الملف.";
      finalUserText = `طلب التحليل:\n${userText}\n\nاسم الملف: ${fileName || "ملف"}.\nقدّم ملخص ذكي وتحليل مبسّط.`;
    } else if (taskType === "file_read" || taskType === "file_mixed") {
      systemBehaviorNote =
        "المستخدم يتعامل مع ملف مرفق وتعليمات عامة، مهمتك فهم المطلوب (عرض، قراءة، تعديل، تحليل) واختيار أفضل رد أو أداة.";
      finalUserText = `تعليمات المستخدم:\n${userText}\n\nاسم الملف: ${fileName || "ملف"}.\nافهم النية أولاً، وبعدين قرر: عرض، تحليل، تعديل، أو تحويل.`;
    } else {
      systemBehaviorNote =
        "ما وصل طلب واضح، اسأل المستخدم بلطف يوضّح شو حابب نعمل.";
      finalUserText = `ما قدرت أفهم الطلب بشكل كامل، اسأل المستخدم: "شو حابب نعمل بالضبط؟"`;
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
          ...(fileBase64
            ? [
                {
                  fileData: {
                    mimeType: fileMimeType,
                    data: fileBase64
                  }
                }
              ]
            : [])
        ]
      }
    ];

    // =========================
    // 6) تعريف الأدوات للذكاء
    // =========================
    const toolsConfig = {
      functionDeclarations: toolsDefinition.map((t) => ({
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
        model: "gemini-1.5-flash",
        contents,
        config: {
          temperature: 0.3,
          tools: toolsConfig
        }
      });
    } catch (err) {
      response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents,
        config: {
          temperature: 0.3,
          tools: toolsConfig
        }
      });
    }

    const candidate = response.candidates?.[0];
    const functionCalls =
      candidate?.content?.parts?.filter((p) => p.functionCall) || [];

    // =========================
    // 8) تنفيذ الأداة إذا النموذج قرر يستخدمها
    // =========================
    if (functionCalls.length > 0) {
      const { name: toolName, args: toolArgs } = functionCalls[0].functionCall;

      if (toolsRegistry[toolName]) {
        try {
          // ربط الـ Base64 تلقائيًا إذا الأداة تحتاجه
          if (!toolArgs.base64 && fileBase64) {
            toolArgs.base64 = fileBase64;
          }

          // إذا أداة توليد وما في تعليمات، نمرّر نص المستخدم
          if (
            toolName.includes("generate") &&
            !toolArgs.instruction &&
            !toolArgs.prompt &&
            !toolArgs.title
          ) {
            toolArgs.instruction =
              userText || "ملف جديد بناءً على طلب المستخدم.";
            toolArgs.content = userText;
            toolArgs.prompt = userText;
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
            send: (data) => {
              toolResult = data;
            }
          };

          const handlerFn = toolsRegistry[toolName].handler;
          const directResult = await handlerFn(mockReq, mockRes);

          if (directResult && (directResult.fileBase64 || directResult.success)) {
            toolResult = directResult;
          }

          // إذا رجعت Buffer (ملف جاهز)
          if (Buffer.isBuffer(toolResult) || toolResult instanceof Uint8Array) {
            const isWord = toolName.includes("word");
            const isPdf = toolName.includes("pdf");
            const isExcel = toolName.includes("excel");

            return res.status(200).json({
              reply: "✅ تم تنفيذ العملية على الملف بنجاح.",
              fileBase64: Buffer.from(toolResult).toString("base64"),
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

          if (toolResult && toolResult.fileBase64) {
            return res.status(200).json({
              reply: toolResult.message || "✨ تم تنفيذ العملية بنجاح.",
              fileBase64: toolResult.fileBase64,
              fileName: toolResult.fileName || "alatheer_output.xlsx",
              contentType: toolResult.contentType || "application/octet-stream"
            });
          }

          return res
            .status(200)
            .json({ reply: "✅ تم تنفيذ الأداة البرمجية بنجاح." });
        } catch (toolErr) {
          console.error("Tool execution error:", toolErr);
          return res.status(500).json({
            reply: "⚠️ صار خطأ أثناء تنفيذ الأداة: " + toolErr.message
          });
        }
      }
    }

    // =========================
    // 9) إذا ما في أدوات، نرجّع رد نصّي
    // =========================
    const replyText =
      candidate?.content?.parts?.map((p) => p.text).join("\n") ||
      "تم الاستلام وتمت معالجة الطلب نصيًا.";

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    console.error("Error in Chat API:", error);
    return res.status(500).json({
      reply: "⚠️ خطأ عام أثناء المعالجة: " + (error.message || error)
    });
  }
        }
