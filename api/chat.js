import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

async function extractSheetsFromBase64(base64Data) {
  const sheets = [];
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    workbook.eachSheet((worksheet) => {
      const name = worksheet.name;
      const rows = [];
      
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        const rowValues = [];
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
        rows: rows.slice(1),
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

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        reply: "⚠️ خطأ داخلي: مفتاح GEMINI_API_KEY غير موجود."
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
        understood, cleaned, smartColumns, relations, keys, indexes, constraints, defaultValues, autoFilled
      );
      fullRebuild = rebuildFullFile(
        understood, cleaned, smartColumns, relations, keys, indexes, constraints, defaultValues, autoFilled, smartTables
      );

      // 🧠 الحقن السيادي للبيانات: تمرير الأعمدة مع عينة واضحة من الصفوف ليمتلك النموذج الرؤية المطلقة
      let sheetDetails = sheets.map(s => {
        let sampleRows = s.rows.slice(0, 15).map(r => `    [${r.join(', ')}]`).join('\n');
        return `- الورقة: "${s.name}"\n  الأعمدة: [${s.header.join(', ')}]\n  إجمالي الصفوف: ${s.rows.length}\n  عينة من البيانات:\n${sampleRows}`;
      }).join('\n');

      fileSummary = `[ملف مرفق: ${fileName}]\nتفاصيل الهيكل والبيانات المستخرجة برمجياً:\n${sheetDetails}\n`;
      
      session.lastFile = {
        base64: extractedBase64,
        name: fileName,
        sheets,
        understood,
        cleaned,
        summary: fileSummary,
      };
    } else if (session.lastFile) {
      ({
        base64: extractedBase64,
        name: fileName,
        sheets,
        understood,
        cleaned,
        summary: fileSummary
      } = session.lastFile);
    }

    session.history.push({
      role: "user",
      content: userContent + "\n\n" + fileSummary,
    });

    if (session.history.length > 15) {
      session.history = session.history.slice(-10);
    }

    const messagesPayload = [
      ...session.history,
    ];

    // إعداد النموذج المعماري بحد أقصى للتوكنز ومخطط صارم
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            isClear: { type: SchemaType.BOOLEAN },
            action: { type: SchemaType.STRING, description: "modify, generate, convert, analyze, or chat" },
            summary: { type: SchemaType.STRING },
            plan: { type: SchemaType.STRING },
            questions: { 
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            },
            response: { type: SchemaType.STRING }
          },
          required: ["isClear", "action", "response"]
        }
      }
    });

    let promptText = messagesPayload.map(m => `${m.role === "user" ? "المستخدم" : "المساعد"}: ${m.content}`).join("\n\n");

    const result = await model.generateContent(promptText);
    const analysisText = result.response.text();

    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisText);
    } catch {
      analysisResult = {
        isClear: true,
        action: "chat",
        response: analysisText || "أهلاً بك يا غالي، تفضل كيف أساعدك بالملف؟",
      };
    }

    session.history.push({
      role: "model",
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

    // 🚀 التنفيذ السيادي الفوري للأدوات عند رصد أي عملية تحليل أو تعديل
    if (["modify", "generate", "convert", "analyze"].includes(analysisResult.action)) {
      try {
        let toolResult = await callFunction(analysisResult.action, {
          instruction: userContent,
          base64: extractedBase64,
          fileName,
          sheets,
          understood,
          cleaned,
          smartTables,
          fullRebuild
        });

        let finalReply = `${analysisResult.response}\n\n`;
        if (toolResult && typeof toolResult === "string") {
          finalReply += `📊 **النتيجة البرمجية التنفيذية:**\n${toolResult}`;
        } else if (toolResult && toolResult.message) {
          finalReply += `📊 **النتيجة:** ${toolResult.message}`;
        }

        return res.json({ reply: finalReply });
      } catch (toolError) {
        console.error("❌ خطأ في تنفيذ الأداة برمجياً:", toolError);
        // في حال فشل الأداة البرمجية المباشرة، يعود بالرد التحليلي للنموذج حصرياً
        return res.json({ reply: analysisResult.response });
      }
    }

    return res.json({ reply: analysisResult.response });
  } catch (error) {
    return res.status(500).json({ reply: "⚠️ خطأ تقني: " + error.message });
  }
}

