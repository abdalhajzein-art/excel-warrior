/**
 * api/core/fusion_memory.js – Sovereign Memory Fusion (Intelligent Edition)
 * 🧠 ذاكرة سياقية ذكية تعتمد على الفهم وليس الكلمات المفتاحية
 */

import memory from "./memory.js";
import { generateFingerprint, fingerprintToText, mergeFingerprints } from "./file_fingerprint.js";

class FusionMemory {
  constructor() {
    this.fileHistoryStore = new Map();
    this.operationStore = new Map();
    this.currentFileStore = new Map();
    this.sessionModeStore = new Map();
    this.intentStore = new Map();
    this.contextStore = new Map();  // 🆕 تخزين السياق الكامل
    this.understandingStore = new Map(); // 🆕 فهم الجلسة
  }

  // ============================================================
  // 🧠 الفهم الذكي للسياق (بدون كلمات مفتاحية)
  // ============================================================

  /**
   * تحليل ذكي للرسالة باستخدام Gemini
   * هذا يستدعي Gemini لفهم المعنى الحقيقي
   */
  async analyzeMessage(sessionId, message, fileContext = null) {
    // بناء سياق التحليل
    const context = {
      message,
      fileExists: !!fileContext?.exists,
      fileType: fileContext?.type || 'none',
      previousIntent: this.getIntent(sessionId),
      sessionMode: this.getSessionMode(sessionId),
      fileHistory: this.getFileHistory(sessionId)
    };

    // استخدام Gemini للفهم
    const analysisPrompt = `
أنت محلل ذكي للنية والسياق.

الرسالة: "${message}"

السياق الحالي:
- ملف موجود: ${context.fileExists ? 'نعم' : 'لا'}
- نوع الملف: ${context.fileType}
- الوضع الحالي: ${context.sessionMode}
- النية السابقة: ${context.previousIntent || 'لا يوجد'}

حلل هذه الرسالة وأخرج JSON واحد فقط:

{
  "intent": "نوع النية من القائمة: generate_file | modify_file | analyze_data | improve_file | preview_file | delete_content | organize_data | general_chat | help_request | unknown",
  "confidence": "درجة الثقة من 0 إلى 1",
  "topics": ["قائمة", "المواضيع", "المستخلصة"],
  "sentiment": "إيجابي | سلبي | محايد",
  "requires_file": true/false,
  "is_follow_up": true/false,
  "summary": "تلخيص قصير للرسالة بجملة واحدة",
  "key_actions": ["الإجراءات", "المطلوبة"],
  "complexity": "simple | medium | complex"
}

لا تخرج أي شيء آخر غير JSON.
`;

    try {
      // استدعاء Gemini للتحليل
      const response = await geminiService.chat([
        { role: "system", content: analysisPrompt },
        { role: "user", content: message }
      ]);

      const analysisText = response?.text || '';
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        // تخزين الفهم
        this.understandingStore.set(sessionId, {
          ...analysis,
          timestamp: Date.now(),
          rawMessage: message
        });

        // تحديث النية
        if (analysis.intent && analysis.intent !== 'unknown') {
          this.storeIntent(sessionId, analysis.intent);
        }

        return analysis;
      }
    } catch (error) {
      console.warn('⚠️ [FusionMemory] فشل التحليل الذكي، استخدام تحليل بسيط:', error.message);
    }

    // تحليل بسيط كحل احتياطي (لكن ليس كلمات مفتاحية سطحية)
    return this.fallbackAnalysis(message);
  }

  /**
   * تحليل احتياطي بسيط (لكن بفهم أفضل من الكلمات المفتاحية)
   */
  fallbackAnalysis(message) {
    const lower = message.toLowerCase();
    
    // كشف النفي أولاً
    const hasNegation = /لا|ما|ليس|غير|بدون|ما في/.test(lower);
    
    // تحليل النية بناءً على فهم الجملة وليس كلمات منفردة
    let intent = 'general_chat';
    let confidence = 0.5;
    let topics = [];
    let requiresFile = false;

    // أنماط الجمل المعقدة
    if (/(أنشئ|اعمل|ولد|قم بإنشاء|توليد|ابنِ|صمم) (ملف|شيت|جدول|تقرير|اكسل|word|pdf)/.test(lower) && !hasNegation) {
      intent = 'generate_file';
      confidence = 0.9;
      requiresFile = false;
      topics.push('creation');
    }
    else if (/(عدل|غير|اضف|احذف|أزل|بدل|طور|حسن) (ملف|عمود|صفحة|بيانات)/.test(lower) && !hasNegation) {
      intent = 'modify_file';
      confidence = 0.85;
      requiresFile = true;
      topics.push('modification');
    }
    else if (/(حلل|اعرض|أظهر|شوف|طالع) (ملف|بيانات|تقرير|جدول)/.test(lower)) {
      intent = 'preview_file';
      confidence = 0.8;
      requiresFile = true;
      topics.push('analysis');
    }
    else if (/(طور|حسن|ارفع|كامل|مكتمل) (ملف|شيت|جدول)/.test(lower) && !hasNegation) {
      intent = 'improve_file';
      confidence = 0.8;
      requiresFile = true;
      topics.push('improvement');
    }
    else if (/(احذف|شيل|امسح|أزل) /.test(lower) && !hasNegation) {
      intent = 'delete_content';
      confidence = 0.7;
      requiresFile = true;
      topics.push('deletion');
    }
    else if (/(رتب|نظم|صف|أعد ترتيب) /.test(lower)) {
      intent = 'organize_data';
      confidence = 0.7;
      requiresFile = true;
      topics.push('organization');
    }
    else if (/(مرحبا|السلام|اهلا|هلا|كيف|شو اخبار)/.test(lower)) {
      intent = 'general_chat';
      confidence = 0.9;
      topics.push('greeting');
    }
    else if (/(ساعد|مساعدة|طريقة|كيف) /.test(lower)) {
      intent = 'help_request';
      confidence = 0.8;
      topics.push('help');
    }

    // كشف التابعية (هل هي استكمال لطلب سابق؟)
    const isFollowUp = /(تمام|طيب|زبط|خلاص|ثاني|كمان|زيادة|تابع|اكمل|استكمل|بعدين|ثم)/.test(lower);

    return {
      intent,
      confidence,
      topics: [...new Set(topics)],
      sentiment: 'محايد',
      requires_file: requiresFile,
      is_follow_up: isFollowUp,
      summary: message.substring(0, 100),
      key_actions: [intent],
      complexity: message.length > 50 ? 'medium' : 'simple'
    };
  }

  // ============================================================
  // 🧠 الوظائف الأساسية (محسنة بالفهم)
  // ============================================================

  async apply(sessionId, fileContext = null) {
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

    // 🧠 فهم آخر رسالة باستخدام الذكاء
    const lastMessage = recentHistory[recentHistory.length - 1];
    let understanding = null;
    
    if (lastMessage && lastMessage.role === 'user') {
      understanding = await this.analyzeMessage(sessionId, lastMessage.content, fileContext);
    }

    // تحديث السياق بناءً على الفهم
    if (understanding) {
      this.understandingStore.set(sessionId, understanding);
      if (understanding.intent && understanding.intent !== 'unknown') {
        this.storeIntent(sessionId, understanding.intent);
      }
      if (understanding.requires_file !== undefined) {
        // تحديث الحالة بناءً على الحاجة للملف
      }
    }

    // كشف انزلاق السياق بشكل ذكي
    const contextDrift = this.detectContextDriftSmart(sessionId, understanding);

    return {
      history: recentHistory,
      userProfile: session.userProfile || null,
      topics: understanding?.topics || this.extractTopicsFallback(recentHistory),
      tags: this.extractTagsFallback(recentHistory),
      fileFingerprint: session.fileFingerprint || null,
      fileFingerprintText: session.fileFingerprintText || (session.fileFingerprint ? fingerprintToText(session.fileFingerprint) : null),
      currentFile: this.currentFileStore.get(sessionId) || session.currentFile || null,
      currentOperation: session.currentOperation || null,
      sessionMode: this.sessionModeStore.get(sessionId) || session.sessionMode || "idle",
      intent: understanding?.intent || this.getIntent(sessionId),
      understanding: understanding,
      contextDrift
    };
  }

  /**
   * كشف انزلاق السياق بشكل ذكي
   */
  detectContextDriftSmart(sessionId, currentUnderstanding) {
    if (!currentUnderstanding) return false;
    
    const previousIntent = this.getIntent(sessionId);
    const currentIntent = currentUnderstanding.intent;
    const sessionMode = this.getSessionMode(sessionId);

    // إذا كنا في وضع تعديل والنية صارت عامة، قد يكون انزلاق
    if ((sessionMode === 'file_edit' || sessionMode === 'modify') && 
        currentIntent === 'general_chat' && 
        currentUnderstanding.confidence > 0.7) {
      return true;
    }

    // إذا تغيرت النية بشكل مفاجئ
    if (previousIntent && currentIntent && 
        previousIntent !== currentIntent && 
        previousIntent !== 'general_chat' &&
        currentUnderstanding.confidence > 0.8) {
      // لكن إذا كان طلب متابعة، ليس انزلاق
      if (currentUnderstanding.is_follow_up) {
        return false;
      }
      return true;
    }

    return false;
  }

  // ============================================================
  // 📁 إدارة الملفات والعمليات (نفس السابق لكن محسّن)
  // ============================================================

  storeCurrentFile(sessionId, filePath) {
    this.currentFileStore.set(sessionId, filePath);
    memory.updateSession(sessionId, { currentFile: filePath });
  }

  getCurrentFile(sessionId) {
    return this.currentFileStore.get(sessionId) || null;
  }

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

    this.currentFileStore.set(sessionId, filePath);
    return mergedFingerprint;
  }

  getFingerprintText(sessionId) {
    const session = memory.getSession(sessionId);
    if (!session || !session.fileFingerprint) {
      return null;
    }
    return session.fileFingerprintText || fingerprintToText(session.fileFingerprint);
  }

  getLastUserMessage(sessionId) {
    const history = memory.getChatHistory(sessionId, 5);
    const userMessages = history.filter(msg => msg.role === "user");
    return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  }

  // ============================================================
  // 🔄 طرق احتياطية (Fallback) بدلاً من الكلمات المفتاحية
  // ============================================================

  extractTopicsFallback(history) {
    const topics = [];
    const text = history.map(h => h.content || '').join(' ').toLowerCase();
    
    // استخدام أنماط أكثر ذكاءً
    const patterns = [
      { pattern: /\bملف\b|\bاكسل\b|\bexcel\b|\bword\b|\bpdf\b/, topic: 'file' },
      { pattern: /\bشجرة\b|\bstructure\b|\bهيكل\b/, topic: 'structure' },
      { pattern: /\bكرنل\b|\bkernel\b/, topic: 'kernel' },
      { pattern: /\bذاكرة\b|\bmemory\b/, topic: 'memory' },
      { pattern: /\bتحليل\b|\bdata\b|\bبيانات\b/, topic: 'analysis' },
      { pattern: /\bجدول\b|\btable\b|\bشيت\b/, topic: 'spreadsheet' },
      { pattern: /\bمخطط\b|\bchart\b|\bgraph\b/, topic: 'visualization' },
      { pattern: /\bتعديل\b|\bmodify\b/, topic: 'modification' },
      { pattern: /\bإنشاء\b|\bgenerate\b|\bcreate\b/, topic: 'creation' },
    ];

    patterns.forEach(({ pattern, topic }) => {
      if (pattern.test(text)) topics.push(topic);
    });

    return [...new Set(topics)].slice(-10);
  }

  extractTagsFallback(history) {
    const tags = [];
    const text = history.map(h => h.content || '').join(' ').toLowerCase();
    
    if (/\bسريع\b|\بسرعة\b|\bfast\b/.test(text)) tags.push('fast');
    if (/\bجاهز\b|\bready\b/.test(text)) tags.push('ready');
    if (/\bاحترافي\b|\bprofessional\b/.test(text)) tags.push('professional');
    if (/\bدقيق\b|\bprecise\b/.test(text)) tags.push('precise');
    if (/\bمعقد\b|\bcomplex\b/.test(text)) tags.push('complex');
    if (/\bبسيط\b|\bsimple\b/.test(text)) tags.push('simple');

    return [...new Set(tags)].slice(-10);
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
    this.contextStore.delete(sessionId);
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
      fingerprint: session.fileFingerprint ? '✅' : '❌',
      chatLength: session.chat?.history?.length || 0
    };
  }
}

// ============================================================
// 🚀 تصدير نسخة مفردة
// ============================================================

const fusionMemory = new FusionMemory();
export default fusionMemory;
