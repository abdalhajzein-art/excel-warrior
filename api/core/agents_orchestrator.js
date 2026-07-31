/**
 * api/core/agents_orchestrator.js – Sovereign Multi-Agent Engine (Stable, No External Search)
 * بعد إيقاف البحث الخارجي، يتم تبسيط النظام ليعمل فقط على:
 * - ملفات
 * - أدوات
 * - دردشة
 */

import memory from "./memory.js";
import detectFileIntent from "./intent/intent_file.js";
import conversationOrchestrator from "./conversation_orchestrator.js";
import * as toolsIndex from "../tools/index.js";

export default async function agentsOrchestrator(sessionId, input, ctx = {}) {
  const session = memory.getSession(sessionId);
  const text = typeof input === "string" ? input : ctx.message || "";
  const intent = detectFileIntent(text);

  const agents = [
    fileAgent,
    toolsAgent,
    chatAgent
  ];

  const outputs = [];

  for (const agent of agents) {
    try {
      const result = await agent.run(sessionId, intent, input, ctx);
      if (result !== "تجاوز") {
        outputs.push({ agent: agent.name, output: result });
      }
    } catch (err) {
      outputs.push({
        agent: agent.name,
        output: `⚠️ خطأ في Agent (${agent.name}). تم إرجاع رد آمن.`
      });
    }
  }

  return {
    ok: true,
    agents: outputs
  };
}

/* ============================================================
   ⭐ File Agent – يوجه نوايا الملفات إلى conversation_orchestrator
   ============================================================ */
const fileAgent = {
  name: "fileAgent",
  run: async (sessionId, intent, input, ctx) => {
    if (!intent || !String(intent).includes("file")) return "تجاوز";

    const result = await conversationOrchestrator(sessionId, input, {
      ...ctx,
      file: ctx.file || memory.getSession(sessionId).sovereign?.lastFile || null
    });

    return result.reply ?? "⚠️ لم يتم توليد رد واضح من عقل الملفات.";
  }
};

/* ============================================================
   ⭐ Tools Agent – يوجه الطلبات إلى منظومة الأدوات
   ============================================================ */
const toolsAgent = {
  name: "toolsAgent",
  run: async (sessionId, intent, input, ctx) => {
    const text = typeof input === "string" ? input.toLowerCase() : "";
    const isToolIntent =
      ctx.tools ||
      text.includes("أداة") ||
      text.includes("tool") ||
      text.includes("tools");

    if (!isToolIntent) return "تجاوز";

    if (ctx.fileResult) {
      const result = await toolsIndex.autoRead(ctx.fileResult);
      return result || "⚠️ لم يتم توليد رد واضح من أدوات القراءة.";
    }

    return "⚠️ لم يتم التعرف على أداة مناسبة.";
  }
};

/* ============================================================
   ⭐ Chat Agent – fallback للدردشة عبر conversation_orchestrator
   ============================================================ */
const chatAgent = {
  name: "chatAgent",
  run: async (sessionId, intent, input, ctx) => {
    const result = await conversationOrchestrator(sessionId, input, ctx);
    return result.reply ?? "⚠️ لم يتم توليد رد واضح من عقل الدردشة.";
  }
};
