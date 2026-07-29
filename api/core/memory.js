/**
 * api/core/memory.js – Dual Memory Engine
 * ذاكرة سيادية للملفات + ذاكرة دردشة شخصية
 */

const sessions = {};

export default {
  getSession(id = "default-session") {
    if (!sessions[id]) {
      sessions[id] = {
        // ⭐ ذاكرة الملفات (سيادية)
        sovereign: {
          lastFile: null,
          history: []
        },

        // ⭐ ذاكرة الدردشة (شخصية)
        persona: {
          history: [],
          personality: {
            empathy: 1,
            humor: 0,
            strictness: 0,
            tone: "neutral",
            evolution: 0
          },
          emotions: {
            last: null,
            trend: {},
            memory: []
          },
          behavior: {
            askCount: 0,
            correctionCount: 0,
            continuationCount: 0
          }
        }
      };
    }
    return sessions[id];
  },

  // ============================
  // ⭐ ذاكرة الملفات (سيادية)
  // ============================

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
      role: entry.role || entry.sender || "user",
      content: typeof content === "string" ? content : JSON.stringify(content),
      time: Date.now()
    });
  },

  getSovereignHistory(id, max = 4) {
    const session = this.getSession(id);
    return session.sovereign.history.slice(-max).map(item => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content
    }));
  },

  // ============================
  // ⭐ ذاكرة الدردشة (شخصية)
  // ============================

  appendPersonaHistory(id, entry) {
    const session = this.getSession(id);
    const content = entry.content || entry.text || entry.message || "";
    session.persona.history.push({
      role: entry.role || entry.sender || "user",
      content: typeof content === "string" ? content : JSON.stringify(content),
      time: Date.now()
    });
  },

  getPersonaHistory(id, max = 10) {
    const session = this.getSession(id);
    return session.persona.history.slice(-max).map(item => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content
    }));
  },

  updatePersona(id, updates) {
    const session = this.getSession(id);
    session.persona.personality = {
      ...session.persona.personality,
      ...updates
    };
  },

  updateEmotion(id, emotion) {
    const session = this.getSession(id);
    session.persona.emotions.last = emotion;
    session.persona.emotions.memory.push(emotion);
    if (session.persona.emotions.memory.length > 20) {
      session.persona.emotions.memory.shift();
    }
  },

  updateBehavior(id, behaviorUpdate) {
    const session = this.getSession(id);
    session.persona.behavior = {
      ...session.persona.behavior,
      ...behaviorUpdate
    };
  }
};