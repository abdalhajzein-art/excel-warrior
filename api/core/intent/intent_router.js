/**
 * api/core/intent/intent_router.js
 * Sovereign Intent Router (Architect Edition)
 * بوابة النوايا الذكية: تفصل النية الأساسية، وتستخلص القيود برمجياً لتقليل استهلاك التوكنز.
 */

import detectFileIntent from "./intent_file.js";
import detectActionIntent from "./intent_actions.js";
import detectGeneralIntent from "./intent_general.js";

export default function routeIntent(message = "") {
  const text = message.toLowerCase().trim();

  // فلتر أولي: تجنب معالجة الرسائل الفارغة
  if (!text) {
    return { type: "chat", intent: "chat", metadata: { constraint: null } };
  }

  // 🧠 استخلاص القيود الذكية (Metadata Extraction)
  // التقاط أي قيود رقمية صريحة (مثل "٢٠ كلمة"، "30 كلمة"، "سطرين") لتمريرها كقيد برمجي صارم
  let wordConstraint = null;
  const wordMatch = text.match(/(\d+|[٠-٩]+)\s*(كلمة|كلمات|سطر|أسطر|حرف)/);
  if (wordMatch) {
    wordConstraint = wordMatch[0];
  }

  const metadata = { constraint: wordConstraint };

  /* ============================================================
     🟩 1) نية الملفات (File Operations)
     ============================================================ */
  const fileIntent = detectFileIntent(text);
  if (fileIntent !== "chat_mode") {
    return { type: "file", intent: fileIntent, metadata };
  }

  /* ============================================================
     🟧 2) نية الأفعال (Actions: Read, Modify, Analyze...)
     ============================================================ */
  const actionIntent = detectActionIntent(text);
  if (actionIntent !== "chat_mode") {
    return { type: "action", intent: actionIntent, metadata };
  }

  /* ============================================================
     🟥 3) النوايا العامة والبحث الخارجي (General, Search, Fact Check)
     ============================================================ */
  // تعديل التقاط النية العامة لتشمل التحقق من الحقائق والاستعلام التقني
  const generalIntent = detectGeneralIntent(text);
  if (generalIntent !== "chat_mode") {
    return { 
      type: generalIntent === "external_search" ? "external_search" : "general", 
      intent: generalIntent, 
      metadata 
    };
  }

  /* ============================================================
     🟦 4) افتراضي → دردشة نقية (Fallback: Chat)
     ============================================================ */
  return { type: "chat", intent: "chat", metadata };
}
