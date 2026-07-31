/**
 * api/core/intent/intent_router.js
 * Sovereign Intent Router – يربط نوايا الملفات مع نوايا الأفعال
 */

import detectFileIntent from "./intent_file.js";
import detectActionIntent from "./intent_actions.js";
import detectGeneralIntent from "./intent_general.js";

export default function routeIntent(message = "") {
  const text = message.toLowerCase().trim();

  /* ============================================================
     🟩 1) نية الملفات أولاً
     ============================================================ */
  const fileIntent = detectFileIntent(text);
  if (fileIntent !== "chat_mode") {
    return {
      type: "file",
      intent: fileIntent
    };
  }

  /* ============================================================
     🟧 2) نية الأفعال (قراءة، تعديل، تحليل، تلخيص...)
     ============================================================ */
  const actionIntent = detectActionIntent(text);
  if (actionIntent !== "chat_mode") {
    return {
      type: "action",
      intent: actionIntent
    };
  }

  /* ============================================================
     🟥 3) بحث خارجي صريح فقط
     ============================================================ */
  const generalIntent = detectGeneralIntent(text);
  if (generalIntent === "external_search") {
    return {
      type: "external_search",
      intent: "external_search"
    };
  }

  /* ============================================================
     🟦 4) افتراضي → دردشة
     ============================================================ */
  return {
    type: "chat",
    intent: "chat"
  };
}
