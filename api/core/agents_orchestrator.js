/**
 * api/core/agents_orchestrator.js – Sovereign Multi-Agent Engine
 * تم الترقية للعمل مع الراوتر الدلالي (Semantic Router) المعتمد على gpt-oss-120b
 * وتجاوز التعبيرات النمطية (Regex) لضمان الدقة والسرعة في توجيه المهام.
 */

import memory from "./memory.js";
import routeIntent from "./intent/intent_router.js"; // 🧠 استدعاء العقل الدلالي الجديد بدلاً من الملف المحذوف
import conversationOrchestrator from "./conversation_orchestrator.js";
import * as toolsIndex from "../tools/index.js";

export default async function agentsOrchestrator(sessionId, input, ctx = {}) {
  const session = memory.getSession(sessionId);
  const text = typeof input === "string" ? input : ctx.message || "";
  const hasFile = !!ctx.file || !!session?.sovereign?.lastFile;

  // 🔍 تحليل النية عبر الذكاء الاصطناعي بدلاً من دوال البحث النصي القديمة
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
    intent: intentObj, // إضافة النية للرد لمتابعتها في الـ Logs وتحليل الأداء
    agents: outputs
  };
}

/* ============================================================
   ⭐ File Agent – يوجه نوايا الملفات إلى conversation_orchestrator
   ============================================================ */
const fileAgent = {
  name: "fileAgent",
  run: async (sessionId, intentObj, input, ctx) => {
    // نعتمد هنا على تصنيف الراوتر الدلالي بدلاً من البحث في الكلمات
    const isFileIntent = intentObj.category === "data_analysis" || 
                         intentObj.category === "file_generation" ||
                         String(intentObj.category).includes("file");

    if (!isFileIntent) return "تجاوز";

    const result = await conversationOrchestrator(sessionId, input, {
      ...ctx,
      intent: intentObj,
      file: ctx.file || memory.getSession(sessionId)?.sovereign?.lastFile || null
    });

    return result.reply ?? "⚠️ لم يتم توليد رد واضح من عقل الملفات.";
  }
};

/* ============================================================
   ⭐ Tools Agent – يوجه الطلبات إلى منظومة الأدوات
   ============================================================ */
const toolsAgent = {
  name: "toolsAgent",
  run: async (sessionId, intentObj, input, ctx) => {
    // التخلص من البحث العشوائي عن كلمة "أداة" والاعتماد على الـ Context والـ Router
    const isToolIntent = ctx.tools || intentObj.category === "tool_usage";

    if (!isToolIntent) return "تجاوز";

    if (ctx.fileResult) {
      const result = await toolsIndex.autoRead(ctx.fileResult);
      return result || "⚠️ لم يتم توليد رد واضح من أدوات القراءة.";
    }

    return "⚠️ لم يتم التعرف على أداة مناسبة في السياق الحالي.";
  }
};

/* ============================================================
   ⭐ Chat Agent – fallback للدردشة عبر conversation_orchestrator
   ============================================================ */
const chatAgent = {
  name: "chatAgent",
  run: async (sessionId, intentObj, input, ctx) => {
    // تمرير النية الجديدة للمايسترو ليولد رداً متوافقاً تماماً مع سياق الحديث
    const result = await conversationOrchestrator(sessionId, input, { 
      ...ctx, 
      intent: intentObj 
    });
    return result.reply ?? "⚠️ لم يتم توليد رد واضح من عقل الدردشة.";
  }
};
