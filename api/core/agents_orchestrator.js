// api/core/agents_orchestrator.js – Sovereign Multi-Agent Engine (Final, متوافق مع المعمارية الجديدة)

import memory from "./memory.js";
import detectIntent from "./intent/intent_file.js";
import conversationOrchestrator from "./conversation_orchestrator.js";
import toolsIndex from "../tools/index.js";

// ⭐ إضافة وكيل البحث الخارجي
import searchAgent from "./agents/searchAgent.js";

export default async function agentsOrchestrator(sessionId, input, ctx = {}) {
  const session = memory.getSession(sessionId);
  const text = typeof input === "string" ? input : ctx.message || "";
  const intent = detectIntent(text);

  const agents = [
    fileAgent,
    toolsAgent,
    searchAgent,   // ⭐ تمت الإضافة هنا
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

// =======================
// ⭐ File Agent – يوجه نوايا الملفات إلى conversation_orchestrator
// =======================
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

// =======================
// ⭐ Tools Agent – يوجه الطلبات إلى منظومة الأدوات
// =======================
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

    const result = await toolsIndex(sessionId, input, ctx);
    return result?.reply ?? "⚠️ لم يتم توليد رد واضح من منظومة الأدوات.";
  }
};

// =======================
// ⭐ Chat Agent – fallback للدردشة عبر conversation_orchestrator
// =======================
const chatAgent = {
  name: "chatAgent",
  run: async (sessionId, intent, input, ctx) => {
    const result = await conversationOrchestrator(sessionId, input, ctx);
    return result.reply ?? "⚠️ لم يتم توليد رد واضح من عقل الدردشة.";
  }
};
