/**
 * api/core/agents_orchestrator.js – Sovereign Multi-Agent Engine (Final Edition)
 */

import memory from "./memory.js";
import routeIntent from "./intent/intent_router.js";
import conversationOrchestrator from "./conversation_orchestrator.js";
import * as toolsIndex from "../tools/index.js";

export default async function agentsOrchestrator(sessionId, input, ctx = {}) {
  const session = memory.getSession(sessionId);
  const text = typeof input === "string" ? input : ctx.message || "";
  const hasFile = !!ctx.file || !!session?.sovereign?.lastFile;

  // 🧠 تحليل النية عبر الراوتر الدلالي
  const intentObj = await routeIntent(text, hasFile);

  const agents = [
    fileAgent,
    toolsAgent,
    chatAgent
  ];

  const outputs = [];

  for (const agent of agents) {
    try {
      const result = await agent.run(sessionId, intentObj, input, ctx);
      if (result !== "تجاوز") {
        outputs.push({ agent: agent.name, output: result });
      }
    } catch (err) {
      console.error(`[Orchestrator] Error in ${agent.name}:`, err);
      outputs.push({
        agent: agent.name,
        output: `⚠️ خطأ في Agent (${agent.name}). تم إرجاع رد آمن.`
      });
    }
  }

  return {
    ok: true,
    intent: intentObj.intent,   // فقط النية الأساسية، بدون JSON كامل
    agents: outputs
  };
}

/* ============================================================
   ⭐ File Agent – مسار الملفات
   ============================================================ */
const fileAgent = {
  name: "fileAgent",
  run: async (sessionId, intentObj, input, ctx) => {
    const category = intentObj.category || "";
    const isFileIntent =
      category.includes("file") ||
      category === "data_analysis" ||
      category === "file_generation";

    if (!isFileIntent) return "تجاوز";

    const result = await conversationOrchestrator(sessionId, input, {
      ...ctx,
      intent: { type: intentObj.intent },   // نمرّر فقط النية الأساسية
      file: ctx.file || memory.getSession(sessionId)?.sovereign?.lastFile || null
    });

    return result.reply ?? "⚠️ ما طلع رد واضح من مسار الملفات.";
  }
};

/* ============================================================
   ⭐ Tools Agent – مسار الأدوات
   ============================================================ */
const toolsAgent = {
  name: "toolsAgent",
  run: async (sessionId, intentObj, input, ctx) => {
    const isToolIntent = ctx.tools || intentObj.category === "tool_usage";

    if (!isToolIntent) return "تجاوز";

    if (ctx.fileResult) {
      const result = await toolsIndex.autoRead(ctx.fileResult);
      return result || "⚠️ ما طلع رد واضح من أدوات القراءة.";
    }

    return "⚠️ ما في أداة مناسبة للسياق الحالي.";
  }
};

/* ============================================================
   ⭐ Chat Agent – fallback للدردشة
   ============================================================ */
const chatAgent = {
  name: "chatAgent",
  run: async (sessionId, intentObj, input, ctx) => {
    const result = await conversationOrchestrator(sessionId, input, {
      ...ctx,
      intent: { type: intentObj.intent }   // فقط النية الأساسية
    });

    return result.reply ?? "⚠️ ما طلع رد واضح من مسار الدردشة.";
  }
};
