import Groq from "groq-sdk";
import ExcelJS from "exceljs";
import { SYSTEM_PROMPT } from "./agent/system.js";
import { executeTool } from "./tools/execute.js";
import { toolsRegistry } from "./tools/index.js";

import { understandExcel } from "./excel/understanding.js";
import { cleanExcelStructure } from "./excel/cleaner.js";
import { extractMultipleTables } from "./excel/extractor.js";
import { detectSmartColumns } from "./excel/smartColumns.js";
import { detectRelations } from "./excel/relations.js";
import { detectKeys } from "./excel/keys.js";
import { detectIndexes } from "./excel/indexes.js";
import { detectConstraints } from "./excel/constraints.js";
import { detectDefaultValues } from "./excel/defaults.js";
import { autoFillData } from "./excel/autofill.js";
import { buildSmartTables } from "./excel/tableBuilder.js";
import { rebuildFullFile } from "./excel/fileRebuilder.js";

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

// 🛠️ دالة خلفية لقراءة أوراق الإكسل من الـ Base64 إذا لم تكن جاهزة
async function extractSheetsFromBase64(base64Data) {
  const sheets = [];
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.load(buffer);

    workbook.eachSheet((worksheet) => {
      const name = worksheet.name;
      const rows = [];
      
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        const rowValues = [];
        // ExcelJS row.values starts from index 1, index 0 is usually undefined
        const values = row.values;
        if (Array.isArray(values)) {
          for (let i = 1; i < values.length; i++) {
            rowValues.push(values[i] !== undefined && values[i] !== null ? values[i] : "");
          }
        }
        rows.push(rowValues);
      });

      let header = [];
      if (rows.length > 0) {
        header = rows[0].map(cell => (cell ? cell.toString().trim() : ""));
      }

      sheets.push({
        name,
        header,
        rows: rows.slice(1), // باقي الصفوف
        teachingRows: [],
        summaryRows: []
      });
    });
  } catch (err) {
    console.error("❌ خطأ في قراءة ملف الإكسل خلفياً عبر ExcelJS:", err);
  }
  return sheets;
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
    let cleaned = null;
    let extractedTables = null;
    let smartColumns = null;
    let relations = null;
    let keys = null;
    let indexes = null;
    let constraints = null;
    let defaultValues = null;
    let autoFilled = null;
    let smartTables = null;
    let fullRebuild = null;

    let fileSummary = "";

    const hasFile = excelJSON && excelJSON[0] && excelJSON[0].fileBase64;

    if (hasFile) {
      const fileObj = excelJSON[0];

      extractedBase64 = fileObj.fileBase64;
      fileName = fileObj.fileName || "ملف.xlsx";
      
      // 🛠️ التحقق من وجود الشيتات، وإذا لم تكن موجودة نقوم باستخراجها خلفياً من الـ Base64
      sheets = fileObj.sheets && fileObj.sheets.length > 0 ? fileObj.sheets : await extractSheetsFromBase64(extractedBase64);

      understood = understandExcel(sheets);
      cleaned = cleanExcelStructure(understood);
      extractedTables = extractMultipleTables(understood);
      smartColumns = detectSmartColumns(understood);
      relations = detectRelations(understood, smartColumns);
      keys = detectKeys(understood, smartColumns, relations);
      indexes = detectIndexes(understood, smartColumns, keys);
      constraints = detectConstraints(understood, smartColumns, keys);
      defaultValues = detectDefaultValues(understood, smartColumns, constraints);
      autoFilled = autoFillData(understood, smartColumns, relations, keys, defaultValues);
      smartTables = buildSmartTables(
        understood,
        cleaned,
        smartColumns,
        relations,
        keys,
        indexes,
        constraints,
        defaultValues,
        autoFilled
      );
      fullRebuild = rebuildFullFile(
        understood,
        cleaned,
        smartColumns,
        relations,
        keys,
        indexes,
        constraints,
        defaultValues,
        autoFilled,
        smartTables
      );

      fileSummary = `[ملف مرفق: ${fileName}]\n`;
      fileSummary += `عدد الأوراق: ${sheets.length}\n`;
      fileSummary += `الجداول المكتشفة: ${understood.tables.length}\n`;
      fileSummary += `الجداول المنظّفة: ${cleaned.cleanedTables.length}\n`;
      fileSummary += `جداول متعددة مستخرجة: ${extractedTables.length}\n`;
      fileSummary += `تحليل الأعمدة الذكي: ${smartColumns.length}\n`;
      fileSummary += `العلاقات الذكية: ${relations.length}\n`;
      fileSummary += `المفاتيح الذكية: ${keys.length}\n`;
      fileSummary += `الفهارس الذكية: ${indexes.length}\n`;
      fileSummary += `القيود الذكية: ${constraints.length}\n`;
      fileSummary += `القيم الافتراضية الذكية: ${defaultValues.length}\n`;
      fileSummary += `Auto-Fill الذكي: ${autoFilled.length}\n`;
      fileSummary += `الجداول الذكية المبنية: ${smartTables.length}\n`;
      fileSummary += `إعادة بناء كامل: ${fullRebuild.rebuiltSheets.length} ورقة\n`;

      session.lastFile = {
        base64: extractedBase64,
        name: fileName,
        sheets,
        understood,
        cleaned,
        extractedTables,
        smartColumns,
        relations,
        keys,
        indexes,
        constraints,
        defaultValues,
        autoFilled,
        smartTables,
        fullRebuild,
        summary: fileSummary,
      };
    } else if (session.lastFile) {
      ({
        base64: extractedBase64,
        name: fileName,
        sheets,
        understood,
        cleaned,
        extractedTables,
        smartColumns,
        relations,
        keys,
        indexes,
        constraints,
        defaultValues,
        autoFilled,
        smartTables,
        fullRebuild,
        summary: fileSummary
      } = session.lastFile);
    }

    session.history.push({
      role: "user",
      content:
        userContent +
        "\n\n" +
        fileSummary +
        "\n\n" +
        JSON.stringify(
          {
            understood,
            cleaned,
            extractedTables,
            smartColumns,
            relations,
            keys,
            indexes,
            constraints,
            defaultValues,
            autoFilled,
            smartTables,
            fullRebuild
          },
          null,
          2
        ),
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
            cleaned,
            extractedTables,
            smartColumns,
            relations,
            keys,
            indexes,
            constraints,
            defaultValues,
            autoFilled,
            smartTables,
            fullRebuild,
            format: action.format || "pdf",
            targetColumn: action.targetColumn || null,
            newColumns: action.newColumns || [],
            formulaTemplate: action.formulaTemplate || null,
            dropdownOptions: action.dropdownOptions || null,
          });

          session.step = "init";
          session.pendingAction = null;

          if (result.success && result.fileBase64) {
            session.lastFile.base64 = result.fileBase64;
            session.lastFile.name = result.fileName || fileName;
            session.lastFile.summary = result.summary || "تم تعديل الملف.";

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
        response: "فيني أفهم طلبك أكثر؟",
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
      let reply = analysisResult.response || "🤔 مافهمت قصدك …";
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
        cleaned,
        extractedTables,
        smartColumns,
        relations,
        keys,
        indexes,
        constraints,
        defaultValues,
        autoFilled,
        smartTables,
        fullRebuild,
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
      reply += `❓ بدك نكمل؟ (نعم / عدل على الخطة)`;

      return res.json({ reply });
    }

    return res.json({ reply: analysisResult.response });
  } catch (error) {
    return res.status(500).json({ reply: "⚠️ خطأ: " + error.message });
  }
}
