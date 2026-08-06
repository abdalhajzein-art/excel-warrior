/**
 * api/core/fusion_memory.js – Sovereign Memory Fusion (Sovereign Edition)
 * ذاكرة سياقية سيادية: تمسك الملف الحالي، العملية، وضع الجلسة، والنية، فوق التاريخ العادي.
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
        fileFingerprint: null,
        fileFingerprintText: null,
        currentFile: null,
        currentOperation: null,
        sessionMode: "idle",
        intent: null,
        contextDrift: false
      };
    }

    const history = session.chat?.history || [];
    const recentHistory = history.slice(-30);

    const lastTopics = extractTopics(recentHistory);
    const tags = extractTags(recentHistory);

    const intent = detectIntent(recentHistory);
    const contextDrift = detectContextDrift({
      currentOperation: session.currentOperation || null,
      intent
    });

    // تحديث النية داخل الجلسة
    memory.updateSession(sessionId, { intent });

    return {
      history: recentHistory,
      userProfile: session.userProfile || null,
      lastTopics,
      tags,
      fileFingerprint: session.fileFingerprint || null,
      fileFingerprintText: session.fileFingerprintText || (session.fileFingerprint ? fingerprintToText(session.fileFingerprint) : null),

      // الحقول السيادية
      currentFile: session.currentFile || null,
      currentOperation: session.currentOperation || null,
      sessionMode: session.sessionMode || "idle",
      intent,
      contextDrift
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
      fileFingerprintText: fingerprintToText(mergedFingerprint),
      currentFile: filePath
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
  },

  // سيطرة سيادية على السياق
  storeCurrentFile(sessionId, filePath) {
    memory.updateSession(sessionId, { currentFile: filePath });
  },

  storeOperation(sessionId, operation) {
    memory.updateSession(sessionId, { currentOperation: operation });
  },

  storeSessionMode(sessionId, mode) {
    memory.updateSession(sessionId, { sessionMode: mode });
  },

  storeIntent(sessionId, intent) {
    memory.updateSession(sessionId, { intent });
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

function detectIntent(history) {
  if (!history || history.length === 0) return null;
  const lastMsg = history[history.length - 1];
  const text = (lastMsg.content || "").toLowerCase();

  if (text.includes("طوّر") || text.includes("طور") || text.includes("حسّن")) return "improve_file";
  if (text.includes("طبق") || text.includes("نفّذ")) return "apply_changes";
  if (text.includes("أضف ورقة") || text.includes("ورقة جديدة") || text.includes("sheet")) return "add_sheet";
  if (text.includes("تعديل") || text.includes("عدّل")) return "modify_file";
  if (text.includes("توليد") || text.includes("أنشئ ملف") || text.includes("ملف جديد")) return "generate_file";
  if (text.includes("اعرض") || text.includes("معاينة") || text.includes("preview")) return "preview_file";

  return "general";
}

function detectContextDrift(session) {
  const lastOp = session.currentOperation;
  const intent = session.intent;

  // مثال بسيط: إذا كنا في وضع تعديل ملف، والنية صارت "general" فجأة، نعتبره انزلاق محتمل
  if (lastOp === "modify_file" && intent === "general") {
    return true;
  }

  return false;
      }
