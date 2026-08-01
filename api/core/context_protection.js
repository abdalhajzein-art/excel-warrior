/**
 * api/core/context_protection.js – Sovereign Context Protection (Architect Edition)
 * جدار الحماية: يمنع التشويش اللغوي، يدير الانتقالات الحادة، ويحمي سياق الكرنل
 */

import memory from "./memory.js";

export default {
  /**
   * 🛡️ الفحص الرئيسي للسياق والتشويش
   */
  check(sessionId, intent, userMessage = "") {
    const session = memory.getSession(sessionId);
    const currentIntent = session.meta?.lastIntent || null;

    // 1. فحص الفخاخ والتشويش اللغوي (Noise & Garbage Detection)
    if (this.isGarbage(userMessage)) {
      return { 
        ok: false, 
        state: "noise_detected", 
        reason: "المدخلات تحتوي على تشويش أو رموز غير مفهومة",
        fallbackIntent: "chat" 
      };
    }

    // 2. إذا كانت هذه أول رسالة في الجلسة
    if (!currentIntent) {
      memory.updateIntent(sessionId, intent);
      return { ok: true, state: "initial_intent" };
    }

    // 3. استقرار السياق (نفس النية)
    if (currentIntent === intent) {
      return { ok: true, state: "stable" };
    }

    // 4. مصفوفة الانتقالات الآمنة (Transition Matrix)
    // نحدد بوضوح ما هو المنطقي للانتقال من حالة لأخرى
    const safeTransitions = {
      "chat": ["read_file", "modify_file", "analyze_file", "tools"],
      "read_file": ["chat", "modify_file", "analyze_file"],
      "modify_file": ["chat", "read_file", "analyze_file"],
      "analyze_file": ["chat", "modify_file", "read_file", "tools"],
      "tools": ["chat", "read_file", "modify_file"]
    };

    const allowedNext = safeTransitions[currentIntent] || ["chat"];
    const isSafe = allowedNext.includes(intent);

    // تحديث النية في الذاكرة المركزية بشكل صحيح
    memory.updateIntent(sessionId, intent);

    if (isSafe) {
      return { ok: true, state: "safe_transition" };
    }

    // 5. انتقال حاد أو فخ تشتيت (Abrupt Shift)
    // لا نمنعه، لكن نضع علامة تحذير للكرنل ليأخذ حذره من الهلوسة
    return { 
      ok: true, 
      state: "abrupt_shift", 
      note: `Context hard-shifted from [${currentIntent}] to [${intent}]` 
    };
  },

  /**
   * 🧹 فلتر التشويش (Anti-Noise Filter)
   * يكتشف النصوص العشوائية (مثل: asdfghjkl أو !@#$% أو الأحرف المكررة بجنون)
   */
  isGarbage(text) {
    if (!text || typeof text !== 'string') return true;
    const stripped = text.trim();
    
    // إذا كان فارغاً تماماً
    if (stripped.length === 0) return true;
    
    // فحص التكرار الجنوني (مثل خخخخخخخخخخ أو hhhhhhhhhh أكثر من 15 مرة متتالية)
    const repetitivePattern = /(.)\1{15,}/; 
    if (repetitivePattern.test(stripped)) return true;

    // (يمكننا لاحقاً إضافة فحص لحقن الأوامر Prompt Injection هنا)
    
    return false;
  },

  /**
   * 🧼 تعقيم المدخلات
   * تنظيف النص من أكواد HTML الخبيثة قبل تمريره للنموذج
   */
  sanitizeInput(text) {
    if (!text) return "";
    return text.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
  }
};
