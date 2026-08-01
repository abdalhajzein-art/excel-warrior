/**
 * api/core/context_protection.js – Sovereign Context Protection (Final Edition)
 * جدار الحماية: يمنع التشويش اللغوي، يدير الانتقالات، ويحمي سياق الكرنل.
 */

import memory from "./memory.js";

export default {
  /**
   * 🛡️ الفحص الرئيسي للسياق والتشويش
   */
  check(sessionId, intent, userMessage = "") {
    const session = memory.getSession(sessionId);
    const currentIntent = session.meta?.lastIntent || null;

    // 1. فحص التشويش
    if (this.isGarbage(userMessage)) {
      return {
        ok: false,
        state: "noise_detected",
        reason: "المدخلات فيها تشويش أو رموز غير مفهومة.",
        fallbackIntent: "chat"
      };
    }

    // 2. أول رسالة
    if (!currentIntent) {
      memory.updateIntent(sessionId, intent);
      return { ok: true, state: "initial_intent" };
    }

    // 3. نفس النية
    if (currentIntent === intent) {
      return { ok: true, state: "stable" };
    }

    // 4. مصفوفة الانتقالات الآمنة
    const safeTransitions = {
      chat: ["read_file", "modify_file", "analyze_file", "tools"],
      read_file: ["chat", "modify_file", "analyze_file"],
      modify_file: ["chat", "read_file", "analyze_file"],
      analyze_file: ["chat", "modify_file", "read_file", "tools"],
      tools: ["chat", "read_file", "modify_file"]
    };

    const allowedNext = safeTransitions[currentIntent] || ["chat"];
    const isSafe = allowedNext.includes(intent);

    memory.updateIntent(sessionId, intent);

    if (isSafe) {
      return { ok: true, state: "safe_transition" };
    }

    // 5. انتقال حاد
    return {
      ok: true,
      state: "abrupt_shift",
      note: `انتقل السياق فجأة من [${currentIntent}] إلى [${intent}]، خليك حذر بالتحليل.`
    };
  },

  /**
   * 🧹 فلتر التشويش
   */
  isGarbage(text) {
    if (text == null) return true;
    if (typeof text !== "string") return false;

    const stripped = text.trim();
    if (stripped.length === 0) return true;

    const repetitivePattern = /(.)\1{15,}/;
    if (repetitivePattern.test(stripped)) return true;

    return false;
  },

  /**
   * 🧼 تعقيم المدخلات
   */
  sanitizeInput(text) {
    if (!text) return "";
    return text.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
  }
};
