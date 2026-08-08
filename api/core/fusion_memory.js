/**
 * api/core/fusion_memory.js – Sovereign Memory Fusion (Intelligent Edition)
 * 🧠 ذاكرة سياقية ذكية - بدون استدعاء Gemini لتوفير الحصص
 */

import memory from "./memory.js";
import { generateFingerprint, fingerprintToText, mergeFingerprints } from "./file_fingerprint.js";

class FusionMemory {
  constructor() {
    // تخزين البيانات
    this.fileHistoryStore = new Map();
    this.operationStore = new Map();
    this.currentFileStore = new Map();
    this.sessionModeStore = new Map();
    this.intentStore = new Map();
    this.understandingStore = new Map();
    this.fingerprintStore = new Map(); // 🆕 تخزين البصمات
  }

  // ============================================================
  // 🧠 الفهم الذكي للسياق (بدون استدعاء Gemini)
  // ============================================================

  /**
   * تحليل ذكي للرسالة باستخدام أنماط ذكية وليس كلمات مفتاحية سطحية
   */
  analyzeMessage(sessionId, message, fileContext = null) {
    if (!message) return null;

    const lower = message.toLowerCase();
    
    // 🧠 كشف النفي أولاً - هذا مهم جداً
    const hasNegation = /لا\s|ما\s|ليس|غير|بدون|ما في|ما عندي/.test(lower);
    
    // 🧠 كشف التابعية (هل هي استكمال لطلب سابق؟)
    const isFollowUp = /(تمام|طيب|زبط|خلاص|ثاني|كمان|زيادة|تابع|اكمل|استكمل|بعدين|ثم|بعد|كمان مرة|مرة ثانية)/.test(lower);
    
    // 🧠 تحليل النية بناءً على فهم الجملة كاملة
    let intent = 'general_chat';
    let confidence = 0.5;
    let topics = [];
    let requiresFile = false;
    let sentiment = 'محايد';
    let complexity = 'simple';

    // 📊 تحليل متقدم للأنماط
    const patterns = [
      // إنشاء ملفات
      {
        pattern: /(أنشئ|اعمل|ولد|قم بإنشاء|توليد|ابنِ|صمم|ارسم|كون) (ملف|شيت|جدول|تقرير|اكسل|excel|word|pdf|base|قاعدة|نموذج)/,
        intent: 'generate_file',
        confidence: 0.9,
        topics: ['creation', 'file'],
        requiresFile: false
      },
      // تعديل ملفات
      {
        pattern: /(عدل|غير|اضف|أضف|زد|حط|ضع|أدخل|احذف|أزل|امسح|شيل|بدل|طور|حسن|نظم|رتب) (ملف|عمود|صف|خلية|صفحة|بيانات|جدول|شيت|ورقة)/,
        intent: 'modify_file',
        confidence: 0.85,
        topics: ['modification', 'file'],
        requiresFile: true
      },
      // تحليل وعرض
      {
        pattern: /(حلل|اعرض|أظهر|شوف|طالع|أطلع|استعرض|افتح|اقرأ) (ملف|بيانات|تقرير|جدول|شيت|ورقة|اكسل)/,
        intent: 'preview_file',
        confidence: 0.8,
        topics: ['analysis', 'view'],
        requiresFile: true
      },
      // تطوير وتحسين
      {
        pattern: /(طور|حسن|ارفع|كامل|مكتمل|أكمل|استكمل|جهز|أجهز) (ملف|شيت|جدول|بيانات|تقرير)/,
        intent: 'improve_file',
        confidence: 0.8,
        topics: ['improvement', 'file'],
        requiresFile: true
      },
      // حذف
      {
        pattern: /(احذف|شيل|امسح|أزل|احذفي|شيلو) (عمود|صف|خلية|بيانات|ورقة|شيت)/,
        intent: 'delete_content',
        confidence: 0.75,
        topics: ['deletion', 'file'],
        requiresFile: true
      },
      // ترتيب
      {
        pattern: /(رتب|نظم|صف|أعد ترتيب|رتّب|نظّم|صفّف) (بيانات|أعمدة|صفوف|جدول|شيت)/,
        intent: 'organize_data',
        confidence: 0.7,
        topics: ['organization', 'file'],
        requiresFile: true
      },
      // تحليل بيانات
      {
        pattern: /(حلل|استخرج|احسب|أحصي|قارن|صنف|صنف|قسّم) (بيانات|أرقام|إحصائيات|مؤشرات|نسب)/,
        intent: 'analyze_data',
        confidence: 0.8,
        topics: ['analysis', 'data'],
        requiresFile: true
      }
    ];

    // تطبيق الأنماط (مع مراعاة النفي)
    for (const p of patterns) {
      if (p.pattern.test(lower) && !hasNegation) {
        intent = p.intent;
        confidence = p.confidence;
        topics = p.topics;
        requiresFile = p.requiresFile;
        break;
      }
    }

    // 🎯 كشف المحادثة العامة
    if (intent === 'general_chat') {
      if (/(مرحبا|السلام|اهلا|هلا|كيف|شو اخبار|أهلاً|أهلا|يا هلا)/.test(lower)) {
        intent = 'greeting';
        confidence = 0.95;
        topics = ['greeting'];
        sentiment = 'إيجابي';
      } else if (/(ساعد|مساعدة|طريقة|كيف|شرح|وضح|فسر|أشرح|أوضح|افسر)/.test(lower)) {
        intent = 'help_request';
        confidence = 0.85;
        topics = ['help'];
        sentiment = 'محايد';
      } else if (/(شكر|مشكور|يعطيك العافية|تسلم|بارك الله)/.test(lower)) {
        intent = 'thanks';
        confidence = 0.9;
        topics = ['gratitude'];
        sentiment = 'إيجابي';
      }
    }

    // 📊 كشف التعقيد
    if (message.length > 100) {
      complexity = 'complex';
    } else if (message.length > 50) {
      complexity = 'medium';
    }

    // 📝 تلخيص
    const summary = message.length > 100 ? message.substring(0, 100) + '...' : message;

    const analysis = {
      intent,
      confidence,
      topics: [...new Set(topics)],
      sentiment,
      requires_file: requiresFile,
      is_follow_up: isFollowUp,
      summary,
      key_actions: [intent],
      complexity,
      has_negation: hasNegation,
      raw_message: message
    };

    // تخزين الفهم
    this.understandingStore.set(sessionId, {
      ...analysis,
      timestamp: Date.now()
    });

    // تحديث النية
    if (intent && intent !== 'general_chat' && intent !== 'greeting' && intent !== 'thanks') {
      this.storeIntent(sessionId, intent);
    }

    return analysis;
  }

  // ============================================================
  // 🧠 الوظائف الأساسية
  // ============================================================

  apply(sessionId, fileContext = null) {
    const session = memory.getSession(sessionId);

    if (!session) {
      return {
        history: [],
        userProfile: null,
        topics: [],
        tags: [],
        fileFingerprint: null,
        fileFingerprintText: null,
        currentFile: null,
        currentOperation: null,
        sessionMode: "idle",
        intent: null,
        understanding: null,
        contextDrift: false
      };
    }

    const history = session.chat?.history || [];
    const recentHistory = history.slice(-30);

    // تحليل آخر رسالة
    const lastMessage = recentHistory[recentHistory.length - 1];
    let understanding = null;
    
    if (lastMessage && lastMessage.role === 'user') {
      understanding = this.analyzeMessage(sessionId, lastMessage.content, fileContext);
    }

    // تحديث السياق
    if (understanding) {
      this.understandingStore.set(sessionId, understanding);
      if (understanding.intent && !['general_chat', 'greeting', 'thanks'].includes(understanding.intent)) {
        this.storeIntent(sessionId, understanding.intent);
      }
    }

    // كشف انزلاق السياق
    const contextDrift = this.detectContextDrift(sessionId, understanding);

    // استرجاع البصمة
    const fingerprintData = this.fingerprintStore.get(sessionId);
    const fingerprint = fingerprintData?.fingerprint || session.fileFingerprint || null;
    const fingerprintText = fingerprintData?.text || session.fileFingerprintText || (fingerprint ? fingerprintToText(fingerprint) : null);

    return {
      history: recentHistory,
      userProfile: session.userProfile || null,
      topics: understanding?.topics || this.extractTopics(history),
      tags: this.extractTags(history),
      fileFingerprint: fingerprint,
      fileFingerprintText: fingerprintText,
      currentFile: this.currentFileStore.get(sessionId) || session.currentFile || null,
      currentOperation: session.currentOperation || null,
      sessionMode: this.sessionModeStore.get(sessionId) || session.sessionMode || "idle",
      intent: understanding?.intent || this.getIntent(sessionId),
      understanding: understanding,
      contextDrift
    };
  }

  // ============================================================
  // 📁 إدارة الملفات والعمليات
  // ============================================================

  storeCurrentFile(sessionId, filePath) {
    this.currentFileStore.set(sessionId, filePath);
    memory.updateSession(sessionId, { currentFile: filePath });
  }

  getCurrentFile(sessionId) {
    return this.currentFileStore.get(sessionId) || null;
  }

  // ============================================================
  // 📜 تاريخ الملفات
  // ============================================================

  storeFileHistory(sessionId, historyArray) {
    this.fileHistoryStore.set(sessionId, historyArray);
  }

  getFileHistory(sessionId) {
    return this.fileHistoryStore.get(sessionId) || [];
  }

  appendFileHistory(sessionId, operation) {
    const history = this.getFileHistory(sessionId);
    history.push({
      operation,
      timestamp: Date.now()
    });
    this.fileHistoryStore.set(sessionId, history);
    return history;
  }

  // ============================================================
  // 🔄 سجل العمليات
  // ============================================================

  storeOperation(sessionId, operation) {
    if (!this.operationStore.has(sessionId)) {
      this.operationStore.set(sessionId, []);
    }
    const ops = this.operationStore.get(sessionId);
    ops.push({
      operation,
      timestamp: Date.now()
    });
    this.operationStore.set(sessionId, ops);
    memory.updateSession(sessionId, { currentOperation: operation });
    this.appendFileHistory(sessionId, operation);
  }

  getOperations(sessionId) {
    return this.operationStore.get(sessionId) || [];
  }

  getLastOperation(sessionId) {
    const ops = this.getOperations(sessionId);
    return ops.length > 0 ? ops[ops.length - 1] : null;
  }

  // ============================================================
  // 🎯 وضع الجلسة والنية
  // ============================================================

  storeSessionMode(sessionId, mode) {
    this.sessionModeStore.set(sessionId, mode);
    memory.updateSession(sessionId, { sessionMode: mode });
  }

  getSessionMode(sessionId) {
    return this.sessionModeStore.get(sessionId) || 'idle';
  }

  storeIntent(sessionId, intent) {
    this.intentStore.set(sessionId, intent);
    memory.updateSession(sessionId, { intent });
  }

  getIntent(sessionId) {
    return this.intentStore.get(sessionId) || null;
  }

  // ============================================================
  // 🔍 بصمات الملفات (Fingerprints)
  // ============================================================

  getFingerprint(sessionId) {
    const data = this.fingerprintStore.get(sessionId);
    return data?.fingerprint || null;
  }

  storeFileFingerprint(sessionId, filePath, previewData) {
    let session = memory.getSession(sessionId);
    if (!session) {
      memory.createSession(sessionId);
      session = memory.getSession(sessionId);
    }

    const newFingerprint = generateFingerprint(filePath, previewData);
    const existingFingerprint = this.getFingerprint(sessionId);
    const mergedFingerprint = mergeFingerprints(existingFingerprint, newFingerprint);
    const fingerprintText = fingerprintToText(mergedFingerprint);

    // تخزين في الذاكرة المؤقتة
    this.fingerprintStore.set(sessionId, {
      fingerprint: mergedFingerprint,
      text: fingerprintText,
      path: filePath,
      timestamp: Date.now()
    });

    // تخزين في memory
    memory.updateSession(sessionId, {
      fileFingerprint: mergedFingerprint,
      fileFingerprintText: fingerprintText,
      currentFile: filePath
    });

    this.currentFileStore.set(sessionId, filePath);
    return mergedFingerprint;
  }

  getFingerprintText(sessionId) {
    const data = this.fingerprintStore.get(sessionId);
    if (data?.text) return data.text;
    
    const session = memory.getSession(sessionId);
    if (session?.fileFingerprintText) return session.fileFingerprintText;
    
    const fingerprint = this.getFingerprint(sessionId);
    return fingerprint ? fingerprintToText(fingerprint) : null;
  }

  // ============================================================
  // 🧩 دوال مساعدة
  // ============================================================

  extractTopics(history) {
    const topics = [];
    const text = history.map(h => h.content || '').join(' ').toLowerCase();
    
    const patterns = [
      { pattern: /\bملف\b|\bاكسل\b|\bexcel\b|\bword\b|\bpdf\b/, topic: 'file' },
      { pattern: /\bبيانات\b|\bdata\b|\bأرقام\b/, topic: 'data' },
      { pattern: /\bجدول\b|\btable\b|\bشيت\b/, topic: 'spreadsheet' },
      { pattern: /\bتحليل\b|\banalysis\b/, topic: 'analysis' },
      { pattern: /\bمخطط\b|\bchart\b|\bgraph\b/, topic: 'visualization' },
      { pattern: /\bتعديل\b|\bmodify\b/, topic: 'modification' },
      { pattern: /\bإنشاء\b|\bgenerate\b|\bcreate\b/, topic: 'creation' },
      { pattern: /\bتطوير\b|\bimprove\b|\bdevelop\b/, topic: 'development' },
    ];

    patterns.forEach(({ pattern, topic }) => {
      if (pattern.test(text) && !topics.includes(topic)) {
        topics.push(topic);
      }
    });

    return topics.slice(0, 10);
  }

  extractTags(history) {
    const tags = [];
    const text = history.map(h => h.content || '').join(' ').toLowerCase();
    
    if (/\bسريع\b|\بسرعة\b|\bfast\b/.test(text)) tags.push('fast');
    if (/\bجاهز\b|\bready\b/.test(text)) tags.push('ready');
    if (/\bاحترافي\b|\bprofessional\b/.test(text)) tags.push('professional');
    if (/\bدقيق\b|\bprecise\b/.test(text)) tags.push('precise');
    if (/\bمعقد\b|\bcomplex\b/.test(text)) tags.push('complex');
    if (/\bبسيط\b|\bsimple\b/.test(text)) tags.push('simple');

    return tags.slice(0, 10);
  }

  detectContextDrift(sessionId, currentUnderstanding) {
    if (!currentUnderstanding) return false;
    
    const previousIntent = this.getIntent(sessionId);
    const currentIntent = currentUnderstanding.intent;
    const sessionMode = this.getSessionMode(sessionId);

    // إذا كنا في وضع تعديل والنية صارت عامة
    if ((sessionMode === 'file_edit' || sessionMode === 'modify') && 
        currentIntent === 'general_chat' && 
        currentUnderstanding.confidence > 0.7) {
      return true;
    }

    // تغير مفاجئ في النية
    if (previousIntent && currentIntent && 
        previousIntent !== currentIntent && 
        previousIntent !== 'general_chat' &&
        currentUnderstanding.confidence > 0.8 &&
        !currentUnderstanding.is_follow_up) {
      return true;
    }

    return false;
  }

  getLastUserMessage(sessionId) {
    const history = memory.getChatHistory(sessionId, 5);
    const userMessages = history.filter(msg => msg.role === "user");
    return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  }

  // ============================================================
  // 🧹 تنظيف وتقرير
  // ============================================================

  clearSession(sessionId) {
    this.fileHistoryStore.delete(sessionId);
    this.operationStore.delete(sessionId);
    this.currentFileStore.delete(sessionId);
    this.sessionModeStore.delete(sessionId);
    this.intentStore.delete(sessionId);
    this.understandingStore.delete(sessionId);
    this.fingerprintStore.delete(sessionId);
  }

  getSessionReport(sessionId) {
    const session = memory.getSession(sessionId);
    if (!session) return null;

    return {
      sessionId,
      mode: this.getSessionMode(sessionId),
      currentFile: this.getCurrentFile(sessionId),
      fileHistory: this.getFileHistory(sessionId),
      operations: this.getOperations(sessionId),
      intent: this.getIntent(sessionId),
      understanding: this.understandingStore.get(sessionId),
      hasFingerprint: !!this.getFingerprint(sessionId),
      chatLength: session.chat?.history?.length || 0
    };
  }
}

// ============================================================
// 🚀 تصدير نسخة مفردة
// ============================================================

const fusionMemory = new FusionMemory();
export default fusionMemory;
