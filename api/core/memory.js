/**
 * api/core/memory.js – Sovereign Dual Memory Engine (Sovereign Edition)
 * ذاكرة دردشة + ذاكرة ملفات، خفيفة، بدون نوايا، بدون حماية، بدون طبقات زائدة.
 */

const sessions = {};

export default {
  /* ============================================================
     🧠 إنشاء أو استرجاع جلسة
     ============================================================ */
  getSession(id = "default-session") {
    if (!sessions[id]) {
      sessions[id] = {
        sovereign: {
          lastFile: null,
          history: []
        },

        chat: {
          history: []
        },

        meta: {
          createdAt: Date.now(),
          lastInteraction: Date.now()
        }
      };

      // ربط history مع chat.history
      Object.defineProperty(sessions[id], "history", {
        get() { return this.chat.history; },
        set(val) { this.chat.history = val; },
        configurable: true,
        enumerable: true
      });
    }

    sessions[id].meta.lastInteraction = Date.now();
    return sessions[id];
  },

  /* ============================================================
     🟥 إنشاء جلسة جديدة
     ============================================================ */
  createSession(id = "default-session") {
    if (!sessions[id]) {
      sessions[id] = {
        sovereign: {
          lastFile: null,
          history: []
        },
        chat: {
          history: []
        },
        meta: {
          createdAt: Date.now(),
          lastInteraction: Date.now()
        },
        fileFingerprint: null,
        fileFingerprintText: null
      };

      Object.defineProperty(sessions[id], "history", {
        get() { return this.chat.history; },
        set(val) { this.chat.history = val; },
        configurable: true,
        enumerable: true
      });
    }
    return sessions[id];
  },

  /* ============================================================
     🟥 تحديث جلسة (إضافة حقول جديدة)
     ============================================================ */
  updateSession(id, updates) {
    const session = this.getSession(id);
    if (!session) {
      this.createSession(id);
      return this.updateSession(id, updates);
    }
    
    // دمج التحديثات مع الجلسة الحالية
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && updates[key] !== null) {
        session[key] = updates[key];
      }
    });
    
    session.meta.lastInteraction = Date.now();
    return session;
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

  /* ============================================================
     🟥 ذاكرة البصمة (Fingerprint)
     ============================================================ */
  getFingerprint(id) {
    const session = this.getSession(id);
    return session.fileFingerprint || null;
  },

  getFingerprintText(id) {
    const session = this.getSession(id);
    return session.fileFingerprintText || null;
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

  getChatHistory(id, max = 30) {
    const session = this.getSession(id);
    const history = session.chat.history;

    if (history.length <= max) return history;

    // Anchoring خفيف: أول رسالة + آخر (max - 1)
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
     🟥 إضافة للتاريخ السيادي
     ============================================================ */
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
  }
};
