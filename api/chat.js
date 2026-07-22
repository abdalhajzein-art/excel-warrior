import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from "./agent/system.js";
import { toolsRegistry, toolsDefinition } from "./tools/index.js";
import XLSX from 'xlsx';

// ✅ استخدام Groq بدل Gemini
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ reply: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, excelJSON } = body || {};

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ reply: "⚠️ خطأ: مفتاح GROQ_API_KEY غير مضاف في متغيرات البيئة." });
    }

    // =========================
    // عقل المنصّة الهجيني
    // =========================

    // 1) تجهيز السياق الأساسي
    let userContent = (message || "").trim();
    let extractedBase64 = null;
    let fileMimeType = null;
    let fileName = null;
    let fileSummary = "";

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

        // ✅ نص ملخص الملف (بدون Base64 عشان نوفر توكنز)
        fileSummary = `[ملف مرفق: ${fileName}]\nنوع الملف: إكسل\nعدد الصفوف: ${rawData.length}\nالشيت الأولى: ${firstSheetName}\n`;
        
        // ✅ أول 10 صفوف فقط عشان ما نستهلك توكنز كثيرة
        const sampleData = rawData.slice(0, 10);
        fileSummary += `\nعينة من البيانات:\n${JSON.stringify(sampleData, null, 2)}`;
      } catch (parseErr) {
        console.error("Error parsing Excel in chat:", parseErr);
        fileSummary = `[ملف مرفق: ${fileName} - تعذّر تحليل المحتوى]`;
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
            if (intent.wantsGenerate) return "excel_generate";
            return null;
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
        "المستخدم يطلب توليد ملف جديد، مهمتك فهم نوع الملف المطلوب وبناء وصف واضح للتوليد.";
      finalUserText = `طلب التوليد:\n${userContent}\n\nنوع الملف المطلوب: ${fileType}.`;
    } else if (taskType === "file_convert") {
      systemBehaviorNote =
        "المستخدم يطلب تحويل ملف بين الصيغ، مهمتك تحديد الصيغة المستهدفة بوضوح.";
      finalUserText = `طلب التحويل:\n${userContent}\n\nنوع الملف الحالي: ${fileType}.`;
    } else if (taskType === "file_analyze") {
      systemBehaviorNote =
        "المستخدم يطلب تحليل ملف، مهمتك استخراج أهم النقاط والملخصات.";
      finalUserText = `طلب التحليل:\n${userContent}\n\nنوع الملف: ${fileType}.`;
    } else if (taskType === "file_read" || taskType === "file_mixed") {
      systemBehaviorNote =
        "المستخدم يتعامل مع ملف مرفق وتعليمات عامة، مهمتك فهم المطلوب واختيار أفضل رد.";
      finalUserText = `تعليمات المستخدم:\n${userContent}\n\nنوع الملف: ${fileType}.`;
    }

    // =========================
    // 5) بناء الرسالة النهائية لـ Groq
    // =========================
    const fullMessage = `${SYSTEM_PROMPT}\n\n${systemBehaviorNote}\n\n${finalUserText}\n\n${fileSummary}`;

    // =========================
    // 6) استدعاء Groq (بدون أدوات حالياً، لأن Groq مختلف)
    // =========================
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: fullMessage }
      ],
      temperature: 0.3,
      max_completion_tokens: 512,
      top_p: 1,
    });

    const replyText = completion.choices[0]?.message?.content || "تم الاستلام";

    // =========================
    // 7) التحقق من وجود أداة مطلوبة (تحليل بسيط)
    // =========================
    const autoTool = selectTool(intent, fileType);

    if (autoTool && toolsRegistry[autoTool]) {
      try {
        const autoArgs = {};

        if (extractedBase64) {
          autoArgs.base64 = extractedBase64;
        }

        if (autoTool.includes("generate")) {
          autoArgs.instruction = userContent || "ملف جديد بناءً على طلب المستخدم.";
          autoArgs.content = userContent;
          autoArgs.prompt = userContent;
        }

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

        if (Buffer.isBuffer(autoResult) || autoResult instanceof Uint8Array) {
          const isWord = autoTool.includes("word");
          const isPdf = autoTool.includes("pdf");
          const isExcel = autoTool.includes("excel");

          return res.status(200).json({
            reply: "✨ تم تنفيذ العملية تلقائيًا.",
            fileBase64: Buffer.from(autoResult).toString("base64"),
            fileName: isWord ? "document.docx" : isPdf ? "document.pdf" : "sheet.xlsx",
            contentType: isWord ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          });
        }

        if (autoResult && autoResult.fileBase64) {
          return res.status(200).json({
            reply: autoResult.message || "✨ تم تنفيذ العملية تلقائيًا.",
            fileBase64: autoResult.fileBase64,
            fileName: autoResult.fileName || "alatheer_output.xlsx",
            contentType: autoResult.contentType || "application/octet-stream"
          });
        }

      } catch (autoErr) {
        console.error("Auto Tool Execution Error:", autoErr);
        // نكمل بالرد النصي بدل ما نفشل
      }
    }

    // =========================
    // 8) طبقة تحسين الرد البشري
    // =========================
    function humanizeReply(text) {
        if (!text) return "تمام، خلّيني ساعدك بخطوة تانية إذا حابب.";

        let reply = text.trim();

        reply = reply.replace(/نموذج|ذكاء اصطناعي|أداة|معالجة/g, "");
        reply = reply.replace(/JSON|Base64|API|endpoint|parameters/gi, "");

        reply = reply
            .replace(/تم التنفيذ بنجاح/g, "تمام، خلّصنا الشغلة بنجاح")
            .replace(/تمت المعالجة/g, "تمام، خلّصنا المطلوب")
            .replace(/خطأ/g, "في شغلة بسيطة لازم ننتبه عليها");

        if (!reply.includes("تمام") && !reply.includes("طيب")) {
            reply = "تمام… " + reply;
        }

        return reply;
    }

    return res.status(200).json({
      reply: humanizeReply(replyText)
    });

  } catch (error) {
    console.error("❌ خطأ في Groq:", error);
    return res.status(500).json({
      reply: "⚠️ خطأ: " + (error.message || "مشكلة في الاتصال بـ Groq")
    });
  }
          }
