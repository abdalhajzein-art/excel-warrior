import Groq from "groq-sdk";
import { SYSTEM_PROMPT } from "./agent/system.js";
import { executeTool } from "./tools/execute.js";
import { toolsRegistry } from "./tools/index.js";
import { understandExcel } from "./excel/understanding.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const sessions = {};

const toolMap = {
  modify: "excel_modify",
  generate: "excel_generate",
  convert: "file_convert",
  analyze: "excel_analyze",
};

async function callFunction(action, parameters) {
  const toolName = toolMap[action];
  if (!toolName || !toolsRegistry[toolName]) {
    throw new Error(`أداة غير معروفة: ${action}`);
  }
  return await executeTool(toolName, parameters);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ reply: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { message, excelJSON, sessionId } = body || {};

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        reply: "⚠️ خطأ داخلي: مفتاح GROQ_API_KEY غير موجود."
      });
    }

    const sessionKey = sessionId || "default";
    if (!sessions[sessionKey]) {
      sessions[sessionKey] = {
        step: "init",
        pendingAction: null,
        lastFile: null,
        history: [],
      };
    }
    const session = sessions[sessionKey];

    let userContent = (message || "").trim();
    let extractedBase64 = null;
    let fileName = null;
    let sheets = null;
    let understood = null;
    let fileSummary = "";

    const hasFile = excelJSON && excelJSON[0] && excelJSON[0].fileBase64;

    if (hasFile) {
      const fileObj = excelJSON[0];

      extractedBase64 = fileObj.fileBase64;
      fileName = fileObj.fileName || "ملف";
      sheets = fileObj.sheets || [];

      understood = understandExcel(sheets);

      fileSummary = `[ملف مرفق: ${fileName}]\n`;
      fileSummary += `عدد الأوراق: ${sheets.length}\n`;
      fileSummary += `الجداول المكتشفة: ${understood.tables.length}\n`;
      fileSummary += `صفوف تعليمية: ${understood.teaching.length}\n`;
      fileSummary += `صفوف ملخص: ${understood.summary.length}\n`;
      fileSummary += `Dashboard: ${understood.dashboard.length}\n`;

      session.lastFile = {
        base64: extractedBase64,
        name: fileName,
        sheets,
        understood,
        summary: fileSummary,
      };
    }

    else if (session.lastFile) {
      extractedBase64 = session.lastFile.base64;
      fileName = session.lastFile.name;
      sheets = session.lastFile.sheets;
      understood = session.lastFile.understood;
      fileSummary = session.lastFile.summary;
    }

    session.history.push({
      role: "user",
      content: userContent + "\n\n" + fileSummary + "\n\n" + JSON.stringify(understood, null, 2),
    });

    if (session.history.length > 25) {
      const recent = session.history.slice(-10);
      const old = session.history.slice(0, -10);

      const summary = old
        .map((m) => {
          const role = m.role === "user" ? "👤 المستخدم" : "🤖 المساعد";
          return `${role}: ${m.content.substring(0, 200)}${
            m.content.length > 200 ? "..." : ""
          }`;
        })
        .join("\n");

      session.history = [
        {
          role: "system",
          content: `📋 ملخص المحادثة:\n${summary}\n\n⚠️ تذكير: حافظ على النية الحالية واحترام آخر نسخة من الملف.`,
        },
        ...recent,
      ];
    }

    if (session.step === "awaiting_confirmation" && session.pendingAction) {
      const lowerMsg = userContent.toLowerCase();

      if (["نعم", "yes", "ok", "تمام", "موافق"].some((w) => lowerMsg.includes(w))) {
        const action = session.pendingAction;
        session.step = "executing";

        try {
          const result = await callFunction(action.type, {
            instruction: action.instruction,
            base64: extractedBase64,
            fileName,
            sheets,
            understood,
            format: action.format || "pdf",
            targetColumn: action.targetColumn || null,
            newColumns: action.newColumns || [],
            formulaTemplate: action.formulaTemplate || null,
            dropdownOptions: action.dropdownOptions || null,
          });

          session.step = "init";
          session.pendingAction = null;

          if (result.success && result.fileBase64) {
            session.lastFile = {
              base64: result.fileBase64,
              name: result.fileName || fileName,
              sheets,
              understood,
              summary: result.summary || "تم تعديل الملف.",
            };

            return res.json({
              reply: result.message || "✅ تم التنفيذ بنجاح!",
              fileBase64: result.fileBase64,
              fileName: result.fileName || fileName,
            });
          }

          return res.json({ reply: result.message || "تم التنفيذ." });
        } catch (err) {
          session.step = "init";
          session.pendingAction = null;
          return res.json({ reply: `❌ خطأ أثناء التنفيذ: ${err.message}` });
        }
      }

      return res.json({
        reply: "❓ هل توافق على التنفيذ؟ جاوب بـ نعم أو لا."
      });
    }

    const messagesPayload = [
      { role: "system", content: SYSTEM_PROMPT },
      ...session.history,
    ];

    const analysis = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: messagesPayload,
      temperature: 0.4,
      max_completion_tokens: 1500,
    });

    const analysisText = analysis.choices[0].message.content;

    let analysisResult;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      analysisResult = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
    } catch {
      analysisResult = {
        isClear: false,
        action: "chat",
        response: "مرحبا عبد، فيني أفهم طلبك أكثر؟",
      };
    }

    if (session.lastFile && analysisResult.action === "generate") {
      analysisResult.action = "modify";
      analysisResult.summary = `تعديل الملف الحالي (${session.lastFile.name})`;
      analysisResult.plan =
        "تطبيق التعديلات المطلوبة على الملف الحالي بدون إنشاء ملف جديد.";
    }

    session.history.push({
      role: "assistant",
      content: analysisResult.response,
    });

    if (!analysisResult.isClear) {
      let reply = analysisResult.response || "🤔 لحتى أفهمك أكثر…";
      if (analysisResult.questions?.length) {
        reply += "\n❓ أسئلة توضيحية:\n";
        analysisResult.questions.forEach((q, i) => {
          reply += `${i + 1}. ${q}\n`;
        });
      }
      return res.json({ reply });
    }

    if (analysisResult.action === "chat") {
      return res.json({ reply: analysisResult.response });
    }

    if (["modify", "generate", "convert", "analyze"].includes(analysisResult.action)) {
      session.step = "awaiting_confirmation";
      session.pendingAction = {
        type: analysisResult.action,
        instruction: userContent,
        base64: extractedBase64,
        fileName,
        sheets,
        understood,
        format: analysisResult.format || "pdf",
        targetColumn: analysisResult.targetColumn || null,
        newColumns: analysisResult.newColumns || [],
        formulaTemplate: analysisResult.formulaTemplate || null,
        dropdownOptions: analysisResult.dropdownOptions || null,
      };

      let reply = analysisResult.response || "✔ فهمت عليك.\n";
      reply += `📋 الملخص: ${analysisResult.summary}\n`;
      reply += `📝 الخطة:\n${
        analysisResult.plan || "سيتم تنفيذ الطلب حسب تعليماتك وباحترام الملف الحالي."
      }\n\n`;
      reply += `❓ هل تريد المتابعة؟ (نعم / عدل على الخطة)`;

      return res.json({ reply });
    }

    return res.json({ reply: analysisResult.response });
  } catch (error) {
    return res.status(500).json({ reply: "⚠️ خطأ: " + error.message });
  }
  }
