// /api/tools/index.js
import { generateExcelHandler } from '../excel/generate.js';
import { modifyExcelHandler } from '../excel/modify.js';
import { generateWordHandler } from '../word/generate.js';
import { modifyWordHandler } from '../word/modify.js';
import { generatePdfHandler } from '../pdf/generate.js';
import { modifyPdfHandler } from '../pdf/modify.js';
import { convertFileHandler } from '../convert/convert.js';
import { generateImageHandler } from '../image/generate.js';
import { modifyImageHandler } from '../image/modify.js';

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
  },
  pdf_generate: {
    method: "POST",
    endpoint: "/api/pdf/generate",
    handler: generatePdfHandler
  },
  pdf_modify: {
    method: "POST",
    endpoint: "/api/pdf/modify",
    handler: modifyPdfHandler
  },
  file_convert: {
    method: "POST",
    endpoint: "/api/convert",  // ✅ تم التصحيح
    handler: convertFileHandler
  },
  image_generate: {
    method: "POST",
    endpoint: "/api/image/generate",
    handler: generateImageHandler
  },
  image_modify: {
    method: "POST",
    endpoint: "/api/image/modify",
    handler: modifyImageHandler
  }
};

export const toolsDefinition = [
  {
    type: "function",
    function: {
      name: "excel_modify",
      description: "تعديل محتوى ملف إكسل موجود (إضافة أعمدة، حذف أعمدة، تحديث خلايا، إضافة صيغ، قوائم منسدلة) بناءً على تعليمات المستخدم.",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "ملف الإكسل بصيغة base64" },
          instruction: { type: "string", description: "تعليمات التعديل المطلوبة" },
          targetColumn: { type: "string", description: "اسم العمود المستهدف (للإضافة بعده)" },
          newColumns: { 
            type: "array", 
            items: { type: "string" },
            description: "أسماء الأعمدة الجديدة المراد إضافتها" 
          },
          formulaTemplate: { type: "string", description: "صيغة مخصصة للتطبيق (مثل: =SUM({target_col}{row}))" },
          dropdownOptions: { 
            type: "array", 
            items: { type: "string" },
            description: "خيارات القائمة المنسدلة" 
          }
        },
        required: ["base64", "instruction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "excel_generate",
      description: "إنشاء ملف إكسل جديد بالكامل (جداول بيانات، تقارير، قوائم) بناءً على تعليمات المستخدم.",
      parameters: {
        type: "object",
        properties: {
          instruction: { type: "string", description: "وصف تفصيلي لهيكلية ومحتوى ملف الإكسل المطلوب" },
          columns: { 
            type: "array", 
            items: { type: "string" },
            description: "أسماء الأعمدة المطلوبة" 
          },
          rows: { 
            type: "array", 
            items: { type: "array" },
            description: "البيانات (صفوف) للملف" 
          },
          sheetName: { type: "string", description: "اسم الورقة" }
        },
        required: ["instruction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "word_generate",
      description: "إنشاء مستند Word احترافي جديد بالكامل (تقارير، عقود، مقالات) مع التنسيق والعناوين.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان المستند الأساسي" },
          content: { type: "string", description: "المحتوى النصي التفصيلي للمستند" }
        },
        required: ["title", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "word_modify",
      description: "تعديل مستند Word موجود مسبقاً عبر استبدال النصوص، تحديث الفقرات، أو إضافة محتوى جديد.",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "ملف الوورد بصيغة base64" },
          instruction: { type: "string", description: "تعليمات التعديل المطلوبة" }
        },
        required: ["base64", "instruction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pdf_generate",
      description: "توليد ملف PDF احترافي جديد (مستندات رسمية، فواتير، تقارير) جاهز للتحميل والطباعة.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان مستند الـ PDF" },
          content: { type: "string", description: "المحتوى النصي أو التقرير المراد طباعته" }
        },
        required: ["title", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pdf_modify",
      description: "استخراج البيانات أو النصوص من ملف PDF موجود، أو دمج وتعديل محتواه.",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "ملف الـ PDF بصيغة base64" },
          instruction: { type: "string", description: "العملية المطلوبة على ملف الـ PDF" }
        },
        required: ["base64", "instruction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "file_convert",
      description: "تحويل الملفات بين جميع الصيغ (Excel ↔ PDF ↔ Word ↔ CSV ↔ JSON ↔ HTML ↔ SQL ↔ XML ↔ Image).",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "الملف المراد تحويله بصيغة base64" },
          targetFormat: { type: "string", description: "الصيغة المستهدفة (pdf, excel, word, csv, json, html, sql, xml, png)" },
          sourceFormat: { type: "string", description: "الصيغة المصدر (excel, word, pdf, image) - اختياري" }
        },
        required: ["base64", "targetFormat"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "image_generate",
      description: "توليد صورة بصرية جديدة بناءً على وصف دقيق من المستخدم.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "الوصف التفصيلي للصورة المراد توليدها" }
        },
        required: ["prompt"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "image_modify",
      description: "تعديل، تحسين، أو معالجة صورة مرفقة (تغيير الحجم، اقتصاص، تحويل) بناءً على تعليمات المستخدم.",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "الصورة المراد تعديلها بصيغة base64" },
          instruction: { type: "string", description: "التعديلات المطلوبة على الصورة" }
        },
        required: ["base64", "instruction"]
      }
    }
  }
];

// ✅ دالة مساعدة للحصول على أداة معينة
export function getTool(toolName) {
  return toolsRegistry[toolName] || null;
}

// ✅ دالة مساعدة للحصول على تعريف أداة معينة
export function getToolDefinition(toolName) {
  return toolsDefinition.find(t => t.function.name === toolName) || null;
}

// ✅ دالة مساعدة للحصول على جميع تعريفات الأدوات
export function getAllToolDefinitions() {
  return toolsDefinition;
  }
