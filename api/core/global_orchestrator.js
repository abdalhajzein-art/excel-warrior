/**
 * api/core/global_orchestrator.js – Sovereign Global Router (Final Edition)
 * لا بحث خارجي – كل شي يمر عبر المايسترو أو الوكلاء أو النظام.
 */

import memory from "./memory.js";
import conversationOrchestrator from "./conversation_orchestrator.js";
import agentsOrchestrator from "./agents_orchestrator.js";
import systemAgent from "../agent/system.js";
import uploadHandler from "../upload.js";
import * as toolsIndex from "../tools/index.js";

export default async function globalOrchestrator(sessionId, input, ctx = {}) {
  const session = memory.getSession(sessionId);

  /* ============================================================
     🟧 مسار الملفات
     ============================================================ */
  if (ctx.file || ctx.fileResult) {
    return await conversationOrchestrator(sessionId, input, ctx);
  }

  /* ============================================================
     🟦 مسار الوكلاء
     ============================================================ */
  if (ctx.agent) {
    return await agentsOrchestrator(sessionId, input, ctx);
  }

  /* ============================================================
     🟦 مسار النظام
     ============================================================ */
  if (ctx.system) {
    return await systemAgent(sessionId, input, ctx);
  }

  /* ============================================================
     🟦 مسار رفع الملفات
     ============================================================ */
  if (ctx.upload) {
    return await uploadHandler(sessionId, input, ctx);
  }

  /* ============================================================
     🟦 مسار الأدوات
     ============================================================ */
  if (ctx.tools) {
    if (ctx.fileResult) {
      return { ok: true, reply: await toolsIndex.autoRead(ctx.fileResult) };
    }
    return { ok: true, reply: await toolsIndex.autoSearch(input) };
  }

  /* ============================================================
     🟥 البحث الخارجي متوقف بالكامل
     ============================================================ */
  const text = input.toLowerCase();
  const looksLikeSearch =
    /طقس|weather|بحث|news|أخبار|من هو|ما هو|متى|أين|كم|إحصاء|عدد سكان|آخر إصدار|تحديث/.test(text);

  if (looksLikeSearch) {
    return {
      ok: true,
      reply: "🔍 ميزة البحث الخارجي لسا ما اكتملت… عبد عم يشتغل عليها، ورح تنزل قريب."
    };
  }

  /* ============================================================
     🟦 مسار الدردشة الافتراضي (المايسترو)
     ============================================================ */
  return await conversationOrchestrator(sessionId, input, ctx);
}
