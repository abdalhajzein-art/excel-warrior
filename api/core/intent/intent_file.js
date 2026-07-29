/**
 * api/core/intent/intent_file.js
 * Sovereign Smart Intent – فهم المعنى الحقيقي للطلب
 */

export default function detectIntent(message = "") {
  const text = message.toLowerCase().trim();

  // إذا الرسالة قصيرة جداً → دردشة
  if (text.length < 3) return "chat_mode";

  // ============================
  // 1) نوايا القراءة – read_file
  // ============================
  if (
    /اقر|اقرا|اقري|read|show|display|شوف|فرجيني|ورجيني|اعرض|عرض|شو فيه|محتوى|مضمون/.test(text)
  ) {
    return "read_file";
  }

  // ============================
  // 2) نوايا التحليل – analyze_file
  // ============================
  if (
    /حلل|تحليل|قيم|استنتج|استنتاج|نسبة|معدل|متوسط|اعلى|اقل|analysis|insight/.test(text)
  ) {
    return "analyze_file";
  }

  // ============================
  // 3) نوايا التعديل – modify_file
  // ============================
  if (
    /عدل|غير|رتب|نظف|زبط|زبطلي|اضف|احذف|دمج|اعد كتابة|اعد بناء|modify|edit|fix/.test(text)
  ) {
    return "modify_file";
  }

  // ============================
  // 4) نوايا التحويل – convert_file
  // ============================
  if (
    /حول|حوّل|صيغة|format|convert|pdf|word|excel/.test(text)
  ) {
    return "convert_file";
  }

  // ============================
  // 5) نوايا التلخيص – summarize_file
  // ============================
  if (
    /لخص|ملخص|مختصر|بشكل عام|summary|brief/.test(text)
  ) {
    return "summarize_file";
  }

  // ============================
  // 6) نوايا النقاش – discuss_file
  // ============================
  if (
    /ناقش|فسر|شرح|explain|discuss/.test(text)
  ) {
    return "discuss_file";
  }

  // ============================
  // 7) إذا ما في نية واضحة → دردشة
  // ============================
  return "chat_mode";
}