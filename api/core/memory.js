/**
 * api/core/memory.js – Sovereign Dual Memory Engine (Final Edition with Anchoring)
 * ذاكرة ملفات + ذاكرة دردشة ذكية مع التثبيت المرجعي للبدايات
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
          lastInteraction: Date.now(),
          lastIntent: null
        }
      };
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
      role: entry.role || "user",
      content: typeof content === "string" ? content : JSON.stringify(content),
      time: Date.now()
    });

    // ضغط الذاكرة
    if (session.sovereign.history.length > 50) {
      session.sovereign.history = session.sovereign.history.slice(-25);
    }
  },

  getSovereignHistory(id, max = 12) {
    const session = this.getSession(id);
    return session.sovereign.history.slice(-max);
  },

  /* ============================================================
     🟦 ذاكرة الدردشة (مع ميزة التثبيت المرجعي - Anchoring)
     ============================================================ */
  appendChatHistory(id, entry) {
    const session = this.getSession(id);
    const content = entry.content || entry.text || entry.message || "";

    session.chat.history.push({
      role: entry.role || "user",
      content: typeof content === "string" ? content : JSON.stringify(content),
      time: Date.now()
    });

    if (session.chat.history.length > 80) {
      session.chat.history = session.chat.history.slice(-40);
    }
  },

  getChatHistory(id, max = 12) {
    const session = this.getSession(id);
    const history = session.chat.history;
    
    // إذا كان التاريخ أقل من أو يساوي الحد المطلوب، أعده كاملاً
    if (history.length <= max) return history;

    // استراتيجية التثبيت (Anchoring): الاحتفاظ بأول رسالتين (السياق والبداية) + آخر الرسائل الحية
    const anchorCount = 2; 
    const anchors = history.slice(0, anchorCount);
    
    const recentCount = max - anchorCount;
    const tail = history.slice(-recentCount);

    // دمج البداية مع النهاية الحية بدون تكرار
    const combined = [...anchors];
    tail.forEach(item => {
      if (!combined.includes(item)) {
        combined.push(item);
      }
    });

    return combined;
  },

  /* ============================================================
     🟧 تحديث النية
     ============================================================ */
  updateIntent(id, intent) {
    const session = this.getSession(id);
    session.meta.lastIntent = intent;
  }
};

