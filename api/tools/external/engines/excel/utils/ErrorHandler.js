/**
 * excel/utils/ErrorHandler.js – معالجة الأخطاء السيادية المركزية
 * ✅ تم إصلاح مشكلة error undefined
 */

export class ErrorHandler {
    /**
     * 🛡️ تنفيذ دالة مع معالجة الأخطاء
     */
    static async execute(action, fn, context = {}) {
        try {
            const result = await fn();
            
            // ✅ إذا كانت النتيجة فيها ok: false وليس فيها error، نضيف error
            if (result && result.ok === false && !result.error) {
                result.error = 'فشل العملية بدون تفاصيل';
            }
            
            // ✅ إذا كانت النتيجة مش كائن أو مش فيها ok، نعتبرها نجاح
            if (!result || typeof result !== 'object') {
                return {
                    ok: true,
                    data: result,
                    reply: `تم تنفيذ ${action} بنجاح`
                };
            }
            
            return result;
        } catch (err) {
            const errorLog = {
                action,
                timestamp: new Date().toISOString(),
                message: err.message,
                stack: err.stack,
                context
            };
            
            console.error(`❌ [${action}] خطأ:`, errorLog);
            
            // ✅ تسجيل مركزي
            try {
                await this.logError(errorLog);
            } catch (logErr) {
                // تجاهل أخطاء التسجيل
            }
            
            return {
                ok: false,
                error: err.message || 'خطأ غير معروف',
                reply: `فشل ${action}`,
                data: null,
                fileBase64: null,
                fileName: null,
                filePath: null
            };
        }
    }
    
    static async logError(errorLog) {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const logPath = path.join(process.cwd(), 'logs', 'errors.log');
            const logDir = path.dirname(logPath);
            
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            fs.appendFileSync(logPath, JSON.stringify(errorLog) + '\n');
        } catch (e) {
            // تجاهل أخطاء التسجيل
        }
    }
    
    static normalizedError(reply, err = null) {
        return {
            ok: false,
            reply,
            error: err?.message || reply || 'خطأ غير معروف',
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

export default ErrorHandler;
