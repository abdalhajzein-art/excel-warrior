// api/core/cache_engine.js – Sovereign Cache Engine (Final Edition)

import memory from "./memory.js";

export default {
  save(sessionId, intent, payload = {}) {
    const session = memory.getSession(sessionId);

    session.cache = session.cache || {};

    // intent الآن نص مثل: "read_file" أو "chat"
    const key = intent;

    session.cache[key] = {
      intent,
      payload,
      at: Date.now()
    };

    return session.cache[key];
  },

  get(sessionId, intent) {
    const session = memory.getSession(sessionId);
    return session.cache?.[intent] || null;
  },

  clear(sessionId) {
    const session = memory.getSession(sessionId);
    session.cache = {};
    return true;
  }
};