/**
 * api/core/conversation_orchestrator.js
 * Sovereign Final Heavy Orchestrator – النسخة المحصنة ضد التعليق والصمت اللانهائي
 */

import memory from "./memory.js";
import detectIntent from "./intent/intent_file.js";
import kernel from "../groqService.js";

/* ============================================================
   🟩 المحركات السيادية الجديدة
   ============================================================ */
import { excelRead, excelModify, excelCreate } from "../tools/excel.js";
import { pdfRead, pdfConvert, pdfCreate } from "../tools/pdf.js";
import { wordCreate } from "../tools/word.js";
import { pptCreate } from "../tools/ppt.js";
import { imageConvert } from "../tools/image.js";
import { libreConvert } from "../tools/index.js";

/* ============================================================
   🔍 محرك البحث الحي السيادي (مع مهلة أمان 4 ثوانٍ لمنع التعليق)
   ============================================================ */
async function performSovereignSearch(query) {
  try {
    console.log(`🔍 [Search Start] بدء البحث الحي عن: "${query}"`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://lite.duckduckgo.com/lite/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlatheerEngine/2.6'
      },
      body: `q=${encodeURIComponent(query)}`,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const html = await response.text();
    const results = [];

    const linkRegex = /<a class="result-link" href="([^"]+)"[^>]*>(.*?)<\/a>/g;
    const snippetRegex = /<td class="result-snippet"[^>]*>(.*?)<\/td>/g;

    let match;
    const links = [];
    while ((match = linkRegex.exec(html)) !== null) {
      links.push({
        url: match[1],
        title: match[2].replace(/<[^>]*>/g, '').trim()
      });
    }

    const snippets = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]*>/g, '').trim());
    }

    for (let i = 0; i < Math.min(links.length, 4); i++) {
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || 'محتوى بحث متوفر عبر الرابط.'
      });
    }

    console.log(`✅ [Search Success] تم جلب ${results.length} نتائج بحث بنجاح.`);
    return results;
  } catch (err) {
    console.warn("⚠️ [Search Timeout/Error]: تجاوز وقت البحث أو حدث خطأ، سيتم المتابعة بدون بحث.", err.message);
    return [];
  }
}

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    console.log(`📥 [Orchestrator] استلام رسالة للجلسة [${sessionId}]: "${message}"`);
    const session = memory.getSession(sessionId);

    const fileResult = extraCtx.fileResult || null;

    /* ============================================================
       🟧 الملف القادم من /api/upload
       ============================================================ */
    if (fileResult && fileResult.fileName) {
      console.log(`📁 [File Processing] معالجة ملف: ${fileResult.fileName}`);
      const fileName = fileResult.fileName.toLowerCase();
      const intent = detectIntent(message);

      let result = null;

      if (fileName.endsWith(".pdf")) {
        if (intent === "read_file") result = await pdfRead(fileResult.filePath);
        else if (intent === "convert_file") result = await pdfConvert(fileResult.filePath, "pdf");
        else if (intent === "summarize_file") {
          const content = await pdfRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await pdfRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      } else if (fileName.endsWith(".docx")) {
        if (intent === "convert_file") result = await libreConvert(fileResult.filePath, "pdf");
        else if (intent === "summarize_file") {
          const content = await pdfRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await pdfRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        if (intent === "read_file") result = await excelRead(fileResult.filePath);
        else if (intent === "modify_file") {
          const fn = (row) => row;
          result = await excelModify(fileResult.filePath, fn);
        } else if (intent === "summarize_file") {
          const content = await excelRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await excelRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      } else if (fileName.match(/\.(png|jpg|jpeg|webp|tiff|avif)$/)) {
        if (intent === "convert_file") {
          result = await imageConvert(fileResult.filePath, "png");
        } else {
          result = {
            ok: true,
            reply: "📷 هذا ملف صورة — لا يمكن استخراج نص منه.",
            fileBase64: null,
            fileName: null
          };
        }
      } else {
        const analysis = await pdfRead(fileResult.filePath);
        result = buildLocalDiscussionResult(fileResult, analysis);
      }

      memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: result.reply
      });

      return result;
    }

    /* ============================================================
       🟦 إذا ما في ملف → دردشة أو بحث حي عبر kernel
       ============================================================ */
    const history = memory.getChatHistory(sessionId, 12);

    const isSearchRequired = /(ابحث|بحث|مصادر|النت|جوجل|من النت|رابط|روابط|موقع|مواقع|تفسير|معنى|ما هو|أخبار)/i.test(message);
    
    let enhancedMessage = message;

    if (isSearchRequired) {
      const searchResults = await performSovereignSearch(message);
      
      if (searchResults.length > 0) {
        const searchContextLines = searchResults.map((r, idx) => 
          `[${idx + 1}] العنوان: ${r.title}\nالرابط الحقيقي: ${r.url}\nالمقتطف: ${r.snippet}`
        ).join('\n\n');

        enhancedMessage = `[معلومات حقيقية وموثوقة مسترجعة مباشرة من شبكة الإنترنت لعام 2026]:\n${searchContextLines}\n\nطلب المستخدم الأساسي: ${message}\n\nتعليمات صارمة: استخدم حصراً هذه الروابط والمصادر الحقيقية المذكورة أعلاه في إجابتك، ولا تقم باختلاق أي روابط وهمية إطلاقاً.`;
      }
    }

    memory.appendChatHistory(sessionId, { role: "user", content: message });

    console.log(`🤖 [Kernel Start] إرسال الطلب لنموذج Groq...`);

    // 🛡️ حماية أمان قسرية ضد تعليق نموذج الذكاء الاصطناعي (أقصى انتظار 15 ثانية)
    const kernelPromise = kernel(enhancedMessage, { history });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: تجاوز زمن انتظار استجابة نموذج الذكاء الاصطناعي (15s)')), 15000)
    );

    const output = await Promise.race([kernelPromise, timeoutPromise]);
    const final = typeof output === "string" ? output : JSON.stringify(output);

    console.log(`✅ [Kernel Success] تم استلام رد النموذج بنجاح.`);
    memory.appendChatHistory(sessionId, { role: "assistant", content: final });

    return {
      ok: true,
      reply: final,
      fileBase64: null,
      fileName: null
    };

  } catch (err) {
    console.error("🔥 [Orchestrator Fatal Error]:", err);
    return {
      ok: false,
      reply: `⚠️ حدث خطأ أثناء المعالجة: ${err.message}`,
      error: err.message,
      fileBase64: null,
      fileName: null
    };
  }
}

/* ============================================================
   🧠 تلخيص محلي
   ============================================================ */
function buildLocalSummaryResult(content) {
  const data = content?.data;
  const reply = content?.reply;

  if (data && typeof data.text === "string") {
    const text = data.text.trim();
    const preview = text.slice(0, 500);
    return {
      ok: true,
      reply: `ملخص محلي:\n\n${preview}${text.length > 500 ? "..." : ""}`,
      fileBase64: null,
      fileName: null
    };
  }

  if (data && Array.isArray(data.preview)) {
    return {
      ok: true,
      reply: `ملخص جدول Excel:\n- صفوف: ${data.rows}\n- ورقة: ${data.sheetName}`,
      fileBase64: null,
      fileName: null
    };
  }

  return {
    ok: true,
    reply: reply || "لا يوجد محتوى قابل للتلخيص.",
    fileBase64: null,
    fileName: null
  };
}

/* ============================================================
   🧠 نقاش محلي
   ============================================================ */
function buildLocalDiscussionResult(file, analysis) {
  const name = file.fileName;
  const data = analysis?.data || {};
  const parts = [];

  parts.push(`نقاش محلي حول الملف: ${name}`);

  if (typeof data.pages === "number") parts.push(`- عدد الصفحات: ${data.pages}`);
  if (data.sheetName) parts.push(`- ورقة Excel: ${data.sheetName}`);
  if (Array.isArray(data.columns)) parts.push(`- الأعمدة: ${data.columns.join(", ")}`);
  if (typeof data.characters === "number") parts.push(`- عدد الحروف: ${data.characters}`);
  if (data.hasImages !== undefined) parts.push(`- يحتوي صور: ${data.hasImages ? "نعم" : "لا"}`);
  if (data.hasTables !== undefined) parts.push(`- يحتوي جداول: ${data.hasTables ? "نعم" : "لا"}`);

  parts.push("\nهذا النقاش محلي بالكامل بدون ذكاء لغوي.");

  return {
    ok: true,
    reply: parts.join("\n"),
    fileBase64: null,
    fileName: null
  };
}

