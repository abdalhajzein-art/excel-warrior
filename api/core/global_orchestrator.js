// api/core/global_orchestrator.js – Sovereign Global Orchestrator (Final)
// نقطة الدخول العليا: توجيه بسيط وسيادي بين الدردشة، الملفات، الوكلاء، النظام، والرفع

import memory from "./memory.js";
import conversationOrchestrator from "./conversation_orchestrator.js";
import agentsOrchestrator from "./agents_orchestrator.js";

// طبقات أخرى اختيارية حسب حاجتك
import systemAgent from "../agent/system.js";
import uploadHandler from "../upload.js";
import toolsIndex from "../tools/index.js";

export default async function globalOrchestrator(sessionId, input, ctx = {}) {
  // ضمان وجود جلسة
  const session = memory.getSession(sessionId);

  // تحديد نمط الطلب
  const mode = ctx.mode || detectMode(input, ctx);

  let result;

  switch (mode) {
    case "file":
      // معالجة ملف عبر الـ conversation_orchestrator (المحركات السيادية)
      result = await conversationOrchestrator(sessionId, input, {
        ...ctx,
        file: ctx.file || session.sovereign?.lastFile || null
      });
      break;

    case "chat":
      // دردشة عادية عبر الـ conversation_orchestrator (هنا فقط يُستخدم kernel داخليًا)
      result = await conversationOrchestrator(sessionId, input, ctx);
      break;

    case "agent":
      // توجيه إلى منظومة الوكلاء
      result = await agentsOrchestrator(sessionId, input, ctx);
      break;

    case "system":
      // أوامر نظامية خاصة (system.js)
      result = await systemAgent(sessionId, input, ctx);
      break;

    case "upload":
      // رفع ملفات ومعالجتها
      result = await uploadHandler(sessionId, input, ctx);
      break;

    case "tools":
      // استدعاء مباشر لأدوات المنصة (tools/index.js)
      result = await toolsIndex(sessionId, input, ctx);
      break;

    default:
      // fallback: اعتبرها دردشة
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

/**
 * كشف بسيط لنمط الطلب – بدون ذكاء، فقط قواعد خفيفة
 */
function detectMode(input, ctx) {
  if (ctx.file) return "file";
  if (ctx.agent) return "agent";
  if (ctx.system) return "system";
  if (ctx.upload) return "upload";
  if (ctx.tools) return "tools";

  const text = typeof input === "string" ? input.toLowerCase() : "";

  if (text.includes("ارفع ملف") || text.includes("upload")) return "upload";
  if (text.includes("وكيل") || text.includes("agent")) return "agent";

  // افتراضي: دردشة
  return "chat";
}