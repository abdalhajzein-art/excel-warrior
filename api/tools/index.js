// /api/tools/index.js

export const toolsRegistry = {
  excel_upload: {
    name: "excel_upload",
    description: "رفع ملف Excel وتحويله إلى JSON كامل.",
    endpoint: "/api/upload",
    method: "POST",
    requiredFields: ["filename", "data"]
  },

  excel_modify: {
    name: "excel_modify",
    description: "تطبيق تعديل على ملف Excel باستخدام editMap.",
    endpoint: "/api/excel/modify",
    method: "POST",
    requiredFields: ["base64", "editMap"]
  },

  excel_generate: {
    name: "excel_generate",
    description: "توليد ملف Excel جديد من JSON.",
    endpoint: "/api/excel/generate",
    method: "POST",
    requiredFields: ["instruction"]
  },

  json_read: {
    name: "json_read",
    description: "قراءة JSON وتحليل الهيدر والصفوف والأنواع.",
    endpoint: "/api/tools/json-read",
    method: "POST",
    requiredFields: ["json"]
  },

  intent_detect: {
    name: "intent_detect",
    description: "تحليل نية المستخدم وإرجاع intent واضح.",
    endpoint: "/api/tools/intent",
    method: "POST",
    requiredFields: ["message"]
  },

  general_execute: {
    name: "general_execute",
    description: "تنفيذ عام لأي طلب يرسله النموذج عبر الأدوات.",
    endpoint: "/api/tools/execute",
    method: "POST",
    requiredFields: ["tool", "payload"]
  }
};
