/**
 * api/core/memory.js – Sovereign Dual Memory Engine (مصحّح ومُحسّن)
 *
 * تحسينات رئيسية:
 * - توحيد بنية lastFile: { fileId, filePath, fileName, metadata, extractedContent, size, savedAt }
 * - saveFile يقوم بالدمج بدل الاستبدال الكامل لتفادي فقدان الحقول
 * - دوال مساعدة واضحة: getFile / clearFile / getSessionLastFile
 * - المحافظة على واجهات appendChatHistory/getChatHistory كما كانت
 *
 * ملاحظة: هذه الذاكرة لا تزال في الذاكرة (volatile). إن أردت دواماً عبر إعادة تشغيل، اربطها بقاعدة بيانات أو persist layer.
 */

const sessions = {};

function makeEmptySession() {
  return {
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
}

export default {
  /* ============================================================
     🧠 إنشاء أو استرجاع جلسة
     ============================================================ */
  getSession(id = "default-session") {
    if (!sessions[id]) {
      sessions[id] = makeEmptySession();
      // ربط history مع chat.history للتماشي مع الكود القديم
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

  createSession(id = "default-session") {
    if (!sessions[id]) {
      sessions[id] = makeEmptySession();
      Object.defineProperty(sessions[id], "history", {
        get() { return this.chat.history; },
        set(val) { this.chat.history = val; },
        configurable: true,
        enumerable: true
      });
    }
    return sessions[id];
  },

  updateSession(id, updates = {}) {
    const session = this.getSession(id);
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && updates[key] !== null) {
        session[key] = updates[key];
      }
    });
    session.meta.lastInteraction = Date.now();
    return session;
  },

  /* ============================================================
     🟥 ذاكرة الملفات (سيادية) — بنية موحدة وآمنة
     ============================================================ */
  /**
   * حفظ/تحديث مرجع الملف في الجلسة.
   * fileObj يمكن أن يحتوي على: { fileId, filePath, fileName, metadata, extractedContent, size }
   * الدالة تدمج الحقول مع أي lastFile موجود بدلاً من استبداله كلياً.
   */
  saveFile(id, fileObj = {}) {
    const session = this.getSession(id);
    const now = new Date().toISOString();

    const normalized = {
      fileId: fileObj.fileId || (session.sovereign.lastFile && session.sovereign.lastFile.fileId) || null,
      filePath: fileObj.filePath || (session.sovereign.lastFile && session.sovereign.lastFile.filePath) || null,
      fileName: fileObj.fileName || (session.sovereign.lastFile && session.sovereign.lastFile.fileName) || null,
      metadata: fileObj.metadata || (session.sovereign.lastFile && session.sovereign.lastFile.metadata) || {},
      extractedContent: fileObj.extractedContent || (session.sovereign.lastFile && session.sovereign.lastFile.extractedContent) || null,
      size: fileObj.size || (session.sovereign.lastFile && session.sovereign.lastFile.size) || null,
      savedAt: now
    };

    session.sovereign.lastFile = normalized;
    session.meta.lastInteraction = Date.now();
    return session.sovereign.lastFile;
  },

  /**
   * مسح مرجع الملف من الجلسة
   */
  clearFile(id) {
    const session = this.getSession(id);
    session.sovereign.lastFile = null;
    session.meta.lastInteraction = Date.now();
    return true;
  },

  /**
   * استرجاع مرجع الملف الأخير
   */
  getFile(id) {
    const session = this.getSession(id);
    return session.sovereign.lastFile || null;
  },

  /**
   * اسم بديل واضح للـ API: getSessionLastFile
   */
  getSessionLastFile(id) {
    return this.getFile(id);
  },

  /* ============================================================
     🟥 ذاكرة البصمة (Fingerprint)
     ============================================================ */
  getFingerprint(id) {
    const session = this.getSession(id);
    return session.fileFingerprint || null;
  },

  setFingerprint(id, fingerprintObj) {
    const session = this.getSession(id);
    session.fileFingerprint = fingerprintObj;
    session.meta.lastInteraction = Date.now();
    return session.fileFingerprint;
  },

  getFingerprintText(id) {
    const session = this.getSession(id);
    return session.fileFingerprintText || null;
  },

  setFingerprintText(id, text) {
    const session = this.getSession(id);
    session.fileFingerprintText = text;
    session.meta.lastInteraction = Date.now();
    return session.fileFingerprintText;
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

    session.meta.lastInteraction = Date.now();
  },

  getChatHistory(id, max = 30) {
    const session = this.getSession(id);
    const history = session.chat.history || [];

    if (history.length <= max) return history;

    // Anchoring خفيف: أول رسالة + آخر (max - 1)
    const anchor = history.slice(0, 1);
    const tail = history.slice(-(max - 1));
    return [...anchor, ...tail];
  },

  /* ============================================================
     🟪 ذاكرة موحّدة – appendHistory (متوافق مع الواجهات القديمة)
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

    session.meta.lastInteraction = Date.now();
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

    session.meta.lastInteraction = Date.now();
  },

  getSovereignHistory(id, max = 6) {
    const session = this.getSession(id);
    return session.sovereign.history.slice(-max);
  }
};
