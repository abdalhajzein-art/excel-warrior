/**
 * api/core/intent/intent_router.js
 * Sovereign Intent Router – يربط نوايا الملفات مع النوايا العامة
 */

import detectFileIntent from "./intent_file.js";
import detectGeneralIntent from "./intent_general.js";

export default function routeIntent(message = "") {
  const text = message.toLowerCase().trim();

  // نية الملفات أولاً (إذا كانت الرسالة تتعلق بملف)
  const fileIntent = detectFileIntent(text);

  // إذا كانت نية ملف → نرجّعها مباشرة
  if (fileIntent !== "chat_mode") {
    return {
      type: "file",
      intent: fileIntent
    };
  }

  // نية عامة (ذكاء عام)
  const generalIntent = detectGeneralIntent(text);

  // إذا كانت نية بحث خارجي
  if (generalIntent === "general_search") {
    return {
      type: "search",
      intent: "general_search"
    };
  }

  // إذا كانت نية طقس
  if (generalIntent === "weather_query") {
    return {
      type: "search",
      intent: "weather_query"
    };
  }

  // إذا كانت نية شخصية
  if (generalIntent === "person_query") {
    return {
      type: "search",
      intent: "person_query"
    };
  }

  // إذا كانت نية مكان
  if (generalIntent === "location_query") {
    return {
      type: "search",
      intent: "location_query"
    };
  }

  // إذا كانت نية تعريف
  if (generalIntent === "definition_query") {
    return {
      type: "search",
      intent: "definition_query"
    };
  }

  // إذا كانت نية أخبار
  if (generalIntent === "news_query") {
    return {
      type: "search",
      intent: "news_query"
    };
  }

  // إذا كانت نية مقارنة
  if (generalIntent === "compare_query") {
    return {
      type: "search",
      intent: "compare_query"
    };
  }

  // إذا كانت نية توصيات
  if (generalIntent === "recommendation_query") {
    return {
      type: "search",
      intent: "recommendation_query"
    };
  }

  // إذا كانت نية عامة غير بحث
  if (generalIntent !== "chat") {
    return {
      type: "general",
      intent: generalIntent
    };
  }

  // إذا ما في أي نية واضحة → دردشة
  return {
    type: "chat",
    intent: "chat"
  };
}
