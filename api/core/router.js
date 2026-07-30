// api/core/router.js – Sovereign Router (Final Edition)
// يوجّه الطلبات مباشرة إلى العقل السيادي الأعلى: global_orchestrator

import globalOrchestrator from "./global_orchestrator.js";
import memory from "./memory.js";

export default {
  async route(sessionId, message, ctx = {}) {
    try {
      // ضمان وجود جلسة
      const session = memory.getSession(sessionId);

      // ctx.message هو الرسالة الأصلية
      const context = {
        ...ctx,
        message,
        sessionId
      };

      // توجيه مباشر للعقل السيادي
      const result = await globalOrchestrator(sessionId, message, context);

      return {
        ok: true,
        output: result.reply,
        raw: result
      };

    } catch (err) {
      console.error("🔥 خطأ في Sovereign Router:", err);
      return {
        ok: false,
        output: "⚠️ حدث خطأ أثناء التوجيه.",
        error: err.message
      };
    }
  }
};