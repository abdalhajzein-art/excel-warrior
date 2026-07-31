/**
 * api/core/global_orchestrator.js – Sovereign Global Router (Stable)
 * طبقة توجيه بسيطة وآمنة بدون ذكاء داخلي
 */

import memory from "./memory.js";
import conversationOrchestrator from "./conversation_orchestrator.js";
import agentsOrchestrator from "./agents_orchestrator.js";
import searchAgent from "./agents/searchAgent.js";
import systemAgent from "../agent/system.js";
import uploadHandler from "../upload.js";
import * as toolsIndex from "../tools/index.js";

export default async function globalOrchestrator(sessionId, input, ctx = {}) {
  const session = memory.getSession(sessionId);

  // إذا في ملف → نمرّر للـ conversation_orchestrator مباشرة
  if (ctx.file || ctx.fileResult) {
    return await conversationOrchestrator(sessionId, input, ctx);
  }

  // إذا المستخدم طلب "agent"
  if (ctx.agent) {
    return await agentsOrchestrator(sessionId, input, ctx);
  }

  // إذا المستخدم طلب "system"
  if (ctx.system) {
    return await systemAgent(sessionId, input, ctx);
  }

  // إذا المستخدم طلب "upload"
  if (ctx.upload) {
    return await uploadHandler(sessionId, input, ctx);
  }

  // إذا المستخدم طلب "tools"
  if (ctx.tools) {
    if (ctx.fileResult) {
      return { ok: true, reply: await toolsIndex.autoRead(ctx.fileResult) };
    }
    return { ok: true, reply: await toolsIndex.autoSearch(input) };
  }

  // إذا الرسالة فيها كلمات بحث واضحة
  const text = input.toLowerCase();
  const isSearch =
    /طقس|weather|بحث|news|أخبار|من هو|ما هو|متى|أين|كم|إحصاء|عدد سكان|آخر إصدار|تحديث/.test(text);

  if (isSearch) {
    const reply = await searchAgent.run(sessionId, null, input, ctx);
    return { ok: true, reply };
  }

  // افتراضي: دردشة عبر orchestrator السيادي
  return await conversationOrchestrator(sessionId, input, ctx);
}
