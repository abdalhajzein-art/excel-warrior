/**
 * api/core/conversation_orchestrator.js
 * Sovereign Lite Orchestrator – نسخة تدعم الذاكرة المزدوجة
 */

import memory from "./memory.js";
import { readFile, modifyFile, convertFile, createFile } from "../tools/office.js";
import kernel from "../groqService.js";
import detectIntent from "./intent/intent_file.js";

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    const session = memory.getSession(sessionId);

    // ⭐ تحديد نوع الذاكرة حسب وجود ملف
    const file = extraCtx.file || session.sovereign.lastFile || null;

    const history = file
      ? memory.getSovereignHistory(sessionId, 10)
      : memory.getPersonaHistory(sessionId, 10);

    // ⭐ اكتشاف النية
    const intent = detectIntent(message);

    // ⭐ إذا في ملف → تنفيذ نوايا الملفات
    if (file) {
      memory.appendSovereignHistory(sessionId, { role: "user", content: message });

      if (intent === "read_file") {
        const content = await readFile(file.path);
        memory.appendSovereignHistory(sessionId, { role: "assistant", content });
        return { reply: content };
      }

      if (intent === "analyze_file") {
        const content = await readFile(file.path);
        const analysis = await kernel(`حلل هذا المحتوى:\n\n${content}`);
        memory.appendSovereignHistory(sessionId, { role: "assistant", content: analysis });
        return { reply: analysis };
      }

      if (intent === "modify_file") {
        const modified = await modifyFile(file.path, message);

        // ⭐ تحديث آخر ملف
        memory.saveFile(sessionId, {
          path: file.path,
          name: modified.fileName
        });

        memory.appendSovereignHistory(sessionId, { role: "assistant", content: "تم تعديل الملف" });
        return { reply: "تم تعديل الملف", fileBase64: modified.fileBase64, fileName: modified.fileName };
      }

      if (intent === "convert_file") {
        const converted = await convertFile(file.path);

        // ⭐ تحديث آخر ملف
        memory.saveFile(sessionId, {
          path: file.path,
          name: converted.fileName
        });

        memory.appendSovereignHistory(sessionId, { role: "assistant", content: "تم تحويل الملف" });
        return { reply: "تم تحويل الملف", fileBase64: converted.fileBase64, fileName: converted.fileName };
      }

      if (intent === "summarize_file") {
        const content = await readFile(file.path);
        const summary = await kernel(`لخص هذا المحتوى:\n\n${content}`);
        memory.appendSovereignHistory(sessionId, { role: "assistant", content: summary });
        return { reply: summary };
      }

      if (intent === "discuss_file") {
        const content = await readFile(file.path);
        const discussion = await kernel(`ناقش هذا المحتوى:\n\n${content}`);
        memory.appendSovereignHistory(sessionId, { role: "assistant", content: discussion });
        return { reply: discussion };
      }
    }

    // ⭐ إذا ما في ملف → دردشة شخصية
    memory.appendPersonaHistory(sessionId, { role: "user", content: message });

    const output = await kernel(message, { history });
    const final = typeof output === "string" ? output : JSON.stringify(output);

    memory.appendPersonaHistory(sessionId, { role: "assistant", content: final });

    return { reply: final };

  } catch (err) {
    console.error("🔥 خطأ في conversationOrchestrator:", err);
    return { reply: "⚠️ حدث خطأ أثناء التنفيذ." };
  }
}