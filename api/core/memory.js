/**
 * api/core/memory.js – Sovereign Dual Memory Engine (Final Production Edition)
 * ذاكرة ملفات + ذاكرة دردشة خفيفة بدون تضخيم للكرنل
 */

const sessions = {};

export default {
  /* ============================================================
     🧠 إنشاء أو استرجاع جلسة
     ============================================================ */
  getSession(id = "default-session") {
    if (!sessions[id]) {
      const sessionObj = {
        sovereign: {
          lastFile: null,
          history: []
        },

        chat: {
          history: []
        },

        meta: {
          createdAt: Date.now(),
          lastInteraction: Date.now(),
          lastIntent: null
        }
      };

      // ربط history مع chat.history
      Object.defineProperty(sessionObj, 'history', {
        get() { return this.chat.history; },
        set(val) { this.chat.history = val; },
        configurable: true,
        enumerable: true
      });

      sessions[id] = sessionObj;
    }

    sessions[id].meta.lastInteraction = Date.now();
    return sessions[id];
  },

  /* ============================================================
     🟥 ذاكرة الملفات (سيادية)
     ============================================================ */
  saveFile(id, fileObj) {
    const session = this.getSession(id);
    session.sovereign.lastFile = fileObj;
  },

  clearFile(id) {
    const session = this.getSession(id);
    session.sovereign.lastFile = null;
  },

  getFile(id) {
    const session = this.getSession(id);
    return session.sovereign.lastFile || null;
  },

  appendSovereignHistory(id, entry) {
    const session = this.getSession(id);
    const content = entry.content || entry.text || entry.message || "";

    session.sovereign.history.push({
      role: entry.role || "assistant",
      content: typeof content === "string" ? content : JSON.stringify(content),
      time: Date.now()
    });

    // تخفيف التاريخ السيادي
    if (session.sovereign.history.length > 30) {
      session.sovereign.history = session.sovereign.history.slice(-15);
    }
  },

  getSovereignHistory(id, max = 6) {
    const session = this.getSession(id);
    return session.sovereign.history.slice(-max);
  },

  /* ============================================================
     🟦 ذاكرة الدردشة (Anchoring خفيف)
     ============================================================ */
  appendChatHistory(id, entry) {
    const session = this.getSession(id);
    const content = entry.content || entry.text || entry.message || "";

    session.chat.history.push({
      role: entry.role || "user",
      content: typeof content === "string" ? content : JSON.stringify(content),
      time: Date.now()
    });

    // تخفيف التاريخ
    if (session.chat.history.length > 60) {
      session.chat.history = session.chat.history.slice(-30);
    }
  },

  getChatHistory(id, max = 12) {
    const session = this.getSession(id);
    const history = session.chat.history;

    if (history.length <= max) return history;

    // Anchoring خفيف: أول رسالة + آخر 11
    const anchor = history.slice(0, 1);
    const tail = history.slice(-(max - 1));

    return [...anchor, ...tail];
  },

  /* ============================================================
     🟪 ذاكرة موحّدة – appendHistory
     ============================================================ */
  appendHistory(id, entry) {
    const session = this.getSession(id);

    const content = entry.content || entry.text || entry.message || "";
    const role = entry.sender || entry.role || "user";

    session.chat.history.push({
      role,
      content: typeof content === "string" ? content : JSON.stringify(content),
      time: Date.now()
    });

    if (session.chat.history.length > 60) {
      session.chat.history = session.chat.history.slice(-30);
    }
  },

  /* ============================================================
     🟧 تحديث النية
     ============================================================ */
  updateIntent(id, intent) {
    const session = this.getSession(id);
    session.meta.lastIntent = intent;
  }
};
