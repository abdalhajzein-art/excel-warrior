/**
 * excel/utils/ErrorHandler.js – معالجة الأخطاء السيادية
 */

export class ErrorHandler {
    static async execute(action, fn, context = {}) {
        try {
            return await fn();
        } catch (err) {
            const errorLog = {
                action,
                timestamp: new Date().toISOString(),
                message: err.message,
                stack: err.stack,
                context
            };
            
            console.error(`❌ [${action}] خطأ:`, errorLog);
            
            // تسجيل مركزي (يمكن ربطه بـ logger لاحقاً)
            await this.logError(errorLog);
            
            return this.normalizedError(`فشل ${action}`, err);
        }
    }
    
    static async logError(errorLog) {
        // يمكن إرسال الأخطاء إلى نظام مراقبة مثل Sentry
        // أو تسجيلها في ملف
        if (process.env.NODE_ENV === 'production') {
            // إرسال إلى نظام المراقبة
        }
    }
    
    static normalizedError(reply, err = null) {
        return {
            ok: false,
            reply,
            error: err?.message || reply,
            data: null,
            fileBase64: null,
            fileName: null,
            filePath: null
        };
    }
    
    static normalizedReply(reply, data = {}) {
        return {
            ok: true,
            reply,
            data,
            fileBase64: null,
            fileName: null,
            filePath: null
        };
    }
    
    static normalizedFile(reply, filePath, fileName, base64) {
        return {
            ok: true,
            reply,
            data: null,
            fileBase64: base64,
            fileName,
            filePath
        };
    }
  }
