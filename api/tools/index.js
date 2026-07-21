// api/tools/index.js
import { generateExcelHandler } from '../excel/generate.js';
import { modifyExcelHandler } from '../excel/modify.js';
import { generateWordHandler } from '../word/generate.js';
import { modifyWordHandler } from '../word/modify.js';

export const toolsRegistry = {
  excel_modify: {
    method: "POST",
    endpoint: "/api/excel/modify",
    handler: modifyExcelHandler
  },
  excel_generate: {
    method: "POST",
    endpoint: "/api/excel/generate",
    handler: generateExcelHandler
  },
  word_generate: {
    method: "POST",
    endpoint: "/api/word/generate",
    handler: generateWordHandler
  },
  word_modify: {
    method: "POST",
    endpoint: "/api/word/modify",
    handler: modifyWordHandler
  }
};

export const toolsDefinition = [
  {
    type: "function",
    function: {
      name: "excel_modify",
      description: "تعديل محتوى ملف إكسل موجود بناءً على خريطة تعديلات محددة.",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "الملف بصيغة base64" },
          editMap: { type: "object", description: "التغييرات المطلوبة" }
        },
        required: ["base64", "editMap"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "excel_generate",
      description: "إنشاء ملف إكسل جديد بالكامل بناءً على تعليمات المستخدم.",
      parameters: {
        type: "object",
        properties: {
          instruction: { type: "string", description: "وصف لهيكلية ومحتوى ملف الإكسل المطلوب" }
        },
        required: ["instruction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "word_generate",
      description: "إنشاء مستند Word (تقرير أو ملف نصي) جديد بالكامل بناءً على العنوان والمحتوى.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان المستند" },
          content: { type: "string", description: "المحتوى النصي التفصيلي" }
        },
        required: ["title", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "word_modify",
      description: "تعديل مستند Word موجود مسبقاً عبر استبدال النصوص والمتغيرات.",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "ملف الوورد بصيغة base64" },
          replacements: { type: "object", description: "الكلمات المراد استبدالها" }
        },
        required: ["base64", "replacements"]
      }
    }
  }
];
