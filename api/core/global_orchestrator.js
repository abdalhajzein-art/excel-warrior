// api/core/global_orchestrator.js – Sovereign Global Orchestrator (Updated for Search Mode)

import memory from "./memory.js";
import conversationOrchestrator from "./conversation_orchestrator.js";
import agentsOrchestrator from "./agents_orchestrator.js";

import systemAgent from "../agent/system.js";
import uploadHandler from "../upload.js";
import toolsIndex from "../tools/index.js";

// ⭐ محرك النوايا العامة
import routeIntent from "./intent/intent_router.js";

// ⭐ وكيل البحث الخارجي
import searchAgent from "./agents/searchAgent.js";

export default async function globalOrchestrator(sessionId, input, ctx = {}) {
  const session = memory.getSession(sessionId);

  // ⭐ تحليل النية العامة
  const routed = routeIntent(input);
  const mode = ctx.mode || detectMode(input, ctx, routed);

  let result;

  switch (mode) {
    case "file":
      result = await conversationOrchestrator(sessionId, input, {
        ...ctx,
        file: ctx.file || session.sovereign?.lastFile || null
      });
      break;

    case "search":
      // ⭐ تنفيذ البحث عبر searchAgent
      result = await searchAgent.run(sessionId, routed.intent, input, ctx);
      result = { ok: true, reply: result };
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
      result = await toolsIndex(sessionId, input, ctx);
      break;

    case "chat":
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

/**
 * كشف نمط الطلب – الآن يدعم "search"
 */
function detectMode(input, ctx, routed) {
  if (ctx.file) return "file";
  if (ctx.agent) return "agent";
  if (ctx.system) return "system";
  if (ctx.upload) return "upload";
  if (ctx.tools) return "tools";

  // ⭐ إذا النية العامة قالت "search"
  if (routed?.type === "search") return "search";

  const text = typeof input === "string" ? input.toLowerCase() : "";

  if (text.includes("ارفع ملف") || text.includes("upload")) return "upload";
  if (text.includes("وكيل") || text.includes("agent")) return "agent";

  return "chat";
                                     }
