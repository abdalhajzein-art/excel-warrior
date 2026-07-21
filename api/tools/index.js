// /api/tools/index.js
import { generateExcelHandler } from '../excel/generate.js';
import { modifyExcelHandler } from '../excel/modify.js';
import { generateWordHandler } from '../word/generate.js';
import { modifyWordHandler } from '../word/modify.js';
import { generatePdfHandler } from '../pdf/generate.js';
import { modifyPdfHandler } from '../pdf/modify.js';
import { convertFileHandler } from '../convert/convert.js';

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
    endpoint: "/api/convert/convert",
    handler: convertFileHandler
  }
};

export const toolsDefinition = [
  {
    type: "function",
    function: {
      name: "excel_modify",
      description: "تعديل محتوى ملف إكسل موجود (إضافة صفوف، تعديل خلايا، أو تحديث البيانات) بناءً على تعليمات المستخدم.",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "ملف الإكسل بصيغة base64" },
          editMap: { type: "object", description: "تفاصيل التعديلات المطلوبة على الجداول" }
        },
        required: ["base64", "editMap"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "excel_generate",
      description: "إنشاء ملف إكسل جديد بالكامل (جداول بيانات، تقارير مالية، أو قوائم) بناءً على تعليمات المستخدم.",
      parameters: {
        type: "object",
        properties: {
          instruction: { type: "string", description: "وصف تفصيلي لهيكلية ومحتوى ملف الإكسل المطلوب" }
        },
        required: ["instruction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "word_generate",
      description: "إنشاء مستند Word احترافي جديد بالكامل (تقارير، عقود، أو مقالات) مع التنسيق والعناوين.",
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
          replacements: { type: "object", description: "النصوص المراد البحث عنها واستبدالها" }
        },
        required: ["base64", "replacements"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pdf_generate",
      description: "توليد ملف PDF احترافي جديد (مستندات رسمية، فواتير، أو تقارير موثقة) جاهز للتحميل والطباعة.",
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
      description: "تحويل الملفات بين جميع الصيغ بسلاسة مطلقة (مثل: إكسل إلى PDF، وورد إلى PDF، إكسل إلى CSV، أو العكس).",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "الملف المراد تحويله بصيغة base64" },
          targetFormat: { type: "string", description: "الصيغة المستهدفة للتحويل (مثلاً: pdf, excel, word, csv)" }
        },
        required: ["base64", "targetFormat"]
      }
    }
  }
];
