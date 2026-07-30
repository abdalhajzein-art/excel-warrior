// api/core/context_protection.js – Sovereign Context Protection (Final Edition)

import memory from "./memory.js";

export default {
  check(sessionId, intent) {
    const session = memory.getSession(sessionId);

    // أول مرة: خزّن النية
    if (!session.lastIntent) {
      session.lastIntent = intent;
      return { ok: true };
    }

    // إذا كانت النية الجديدة نفس القديمة → سياق مستقر
    if (session.lastIntent === intent) {
      return { ok: true };
    }

    // إذا تغيّر السياق لكن بشكل طبيعي (ملف → دردشة أو العكس)
    const safeTransitions = [
      ["read_file", "chat"],
      ["chat", "read_file"],
      ["modify_file", "chat"],
      ["chat", "modify_file"],
      ["analyze_file", "chat"],
      ["chat", "analyze_file"],
      ["tools", "chat"],
      ["chat", "tools"]
    ];

    const isSafe = safeTransitions.some(
      ([from, to]) => session.lastIntent === from && intent === to
    );

    if (isSafe) {
      session.lastIntent = intent;
      return { ok: true };
    }

    // أي انتقال غير معروف → مسموح لكنه يُسجّل فقط
    session.lastIntent = intent;
    return { ok: true, note: "context_shift_recorded" };
  }
};