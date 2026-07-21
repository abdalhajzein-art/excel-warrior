// api/tools/index.js
import { generateExcelHandler } from '../excel/generate.js';
import { modifyExcelHandler } from '../excel/modify.js';

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
  }
};

export const toolsDefinition = [
  {
    type: "function",
    function: {
      name: "excel_modify",
      description: "تعديل محتوى ملف إكسل أو أوفيس موجود بناءً على خريطة تعديلات (editMap) محددة.",
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
      description: "إنشاء ملف إكسل أو أوفيس جديد بالكامل بناءً على تعليمات المستخدم.",
      parameters: {
        type: "object",
        properties: {
          instruction: { type: "string", description: "وصف لهيكلية ومحتوى الملف المطلوب" }
        },
        required: ["instruction"]
      }
    }
  }
];
