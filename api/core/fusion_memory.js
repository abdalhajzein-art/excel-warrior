/**
 * api/core/fusion_memory.js – Sovereign Memory Fusion (Sovereign Edition)
 * ذاكرة سياقية خفيفة، دقيقة، بدون نوايا، بدون حماية، بدون طبقات زائدة.
 */

import memory from "./memory.js";
import { generateFingerprint, fingerprintToText, mergeFingerprints } from "./file_fingerprint.js";

export default {
  apply(sessionId) {
    const session = memory.getSession(sessionId);

    if (!session) {
      return {
        history: [],
        userProfile: null,
        lastTopics: [],
        tags: [],
        fileFingerprint: null
      };
    }

    const history = session.chatHistory || [];
    const recentHistory = history.slice(-30);
    const lastTopics = extractTopics(recentHistory);
    const tags = extractTags(recentHistory);
    const userProfile = session.userProfile || null;
    const fileFingerprint = session.fileFingerprint || null;

    return {
      history: recentHistory,
      userProfile,
      lastTopics,
      tags,
      fileFingerprint
    };
  },

  storeFileFingerprint(sessionId, filePath, previewData) {
    let session = memory.getSession(sessionId);
    if (!session) {
      memory.createSession(sessionId);
      session = memory.getSession(sessionId);
    }
    
    const newFingerprint = generateFingerprint(filePath, previewData);
    const existingFingerprint = session.fileFingerprint || null;
    const mergedFingerprint = mergeFingerprints(existingFingerprint, newFingerprint);
    
    memory.updateSession(sessionId, {
      fileFingerprint: mergedFingerprint,
      fileFingerprintText: fingerprintToText(mergedFingerprint)
    });
    
    return mergedFingerprint;
  },

  getFingerprintText(sessionId) {
    const session = memory.getSession(sessionId);
    if (!session || !session.fileFingerprint) {
      return null;
    }
    return session.fileFingerprintText || fingerprintToText(session.fileFingerprint);
  },

  getLastUserMessage(sessionId) {
    const history = memory.getChatHistory(sessionId, 5);
    const userMessages = history.filter(msg => msg.role === "user");
    return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  }
};

function extractTopics(history) {
  const topics = [];
  history.forEach(h => {
    const text = (h.content || "").toLowerCase();
    if (text.includes("ملف")) topics.push("file");
    if (text.includes("شجرة")) topics.push("tree");
    if (text.includes("كرنل")) topics.push("kernel");
    if (text.includes("ذاكرة")) topics.push("memory");
    if (text.includes("نظام")) topics.push("system");
    if (text.includes("تنظيف")) topics.push("cleanup");
    if (text.includes("سياق")) topics.push("context");
    if (text.includes("اكسل") || text.includes("excel")) topics.push("excel");
    if (text.includes("تعديل")) topics.push("modify");
    if (text.includes("توليد")) topics.push("generate");
  });
  return [...new Set(topics)].slice(-10);
}

function extractTags(history) {
  const tags = [];
  history.forEach(h => {
    const text = (h.content || "").toLowerCase();
    if (text.includes("يلا")) tags.push("fast");
    if (text.includes("جاهز")) tags.push("ready");
    if (text.includes("بدون عشوائية")) tags.push("precision");
    if (text.includes("نظام")) tags.push("system");
    if (text.includes("بناء")) tags.push("build");
    if (text.includes("شيل")) tags.push("remove");
    if (text.includes("تفاعلي")) tags.push("interactive");
    if (text.includes("احترافي")) tags.push("professional");
  });
  return [...new Set(tags)].slice(-10);
}
