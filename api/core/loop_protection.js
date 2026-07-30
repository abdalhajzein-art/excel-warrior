// api/core/loop_protection.js – Sovereign Loop Protection (Final Edition)

import memory from "./memory.js";

export default {
  check(sessionId, intent) {
    const session = memory.getSession(sessionId);

    session.loopHistory = session.loopHistory || [];

    // intent الآن نص وليس كائن
    const last = session.loopHistory.at(-1);

    // إذا تكررت نفس النية 5 مرات → سجّل فقط
    if (last && last.intent === intent && last.count >= 5) {
      return { ok: true, note: "loop_pattern_detected" };
    }

    // تحديث التاريخ
    if (!last || last.intent !== intent) {
      session.loopHistory.push({ intent, count: 1 });
    } else {
      last.count++;
    }

    return { ok: true };
  }
};