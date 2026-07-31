/**
 * api/core/global_orchestrator.js – Sovereign Global Orchestrator (Updated with Groq Kernel Integration)
 */

import memory from "./memory.js";
import conversationOrchestrator from "./conversation_orchestrator.js";
import agentsOrchestrator from "./agents_orchestrator.js";

import systemAgent from "../agent/system.js";
import uploadHandler from "../upload.js";

// ربط البوابة الذكية المركزية (Groq Kernel)
import kernel from "../groqService.js";

// ❗ تصحيح الاستدعاء للأدوات
import * as toolsIndex from "../tools/index.js";

export default async function globalOrchestrator(sessionId, input, ctx = {}) {
  const session = memory.getSession(sessionId);

  // نحدد النمط بناءً على محتوى الرسالة أو السياق بشكل مدمج
  const mode = ctx.mode || detectMode(input, ctx);

  let result;

  switch (mode) {
    case "file":
      result = await conversationOrchestrator(sessionId, input, {
        ...ctx,
        file: ctx.file || session.sovereign?.lastFile || null
      });
      break;

    case "search":
    case "chat":
      // ✨ التعديل الجذري: توجيه كل المحادثات والبحث إلى عقل Groq Kernel المركزي
      // الـ Kernel يحتوي مسبقاً على الـ Router الذكي والبحث السيادي والتعويذة السحرية!
      try {
        const history = session.history || [];
        const aiReply = await kernel(input, {
          history,
          temperature: 0.6,
          // إذا كان النمط المكتشف بحثاً، نجبره على تفعيل البحث، وإلا نترك الـ Router الذكي يقرر
          forceSearch: mode === "search" 
        });
        result = { ok: true, reply: aiReply };
      } catch (err) {
        console.error("🔥 خطأ في تشغيل الـ Kernel عبر الأوركستريتور:", err);
        result = { ok: false, reply: "⚠️ عذراً، حدث خطأ في معالجة طلبك عبر العقل المركزي." };
      }
      break;

    case "agent":
      result = await agentsOrchestrator(sessionId, input, ctx);
      break;

    case "system":
      result = await systemAgent(sessionId, input, ctx);
      break;

    case "upload":
      result = await uploadHandler(sessionId, input, ctx);
      break;

    case "tools":
      if (ctx.fileResult) {
        result = { ok: true, reply: await toolsIndex.autoRead(ctx.fileResult) };
      } else {
        result = { ok: true, reply: await toolsIndex.autoSearch(input) };
      }
      break;

    default:
      result = await conversationOrchestrator(sessionId, input, ctx);
      break;
  }

  return {
    ok: result?.ok ?? true,
    mode,
    reply: result?.reply ?? null,
    data: result?.data ?? null,
    fileBase64: result?.fileBase64 ?? null,
    fileName: result?.fileName ?? null,
    filePath: result?.filePath ?? null,
    raw: result
  };
}

function detectMode(input, ctx) {
  if (ctx.file) return "file";
  if (ctx.agent) return "agent";
  if (ctx.system) return "system";
  if (ctx.upload) return "upload";
  if (ctx.tools) return "tools";

  const text = typeof input === "string" ? input.toLowerCase() : "";

  if (text.includes("ارفع ملف") || text.includes("upload")) return "upload";
  if (text.includes("وكيل") || text.includes("agent")) return "agent";

  // دعنا نترك الـ Groq Kernel ومحرك الـ Router الخاص به يتعاملان بذكاء مع الكشف عن الحاجة للبحث
  return "chat";
}
