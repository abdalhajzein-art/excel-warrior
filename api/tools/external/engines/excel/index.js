/**
 * excel/index.js – المدخل السيادي الرئيسي
 * 🔥 يجمع كل الوحدات في واجهة واحدة موحدة
 */

import { ExcelAdapter } from './core/ExcelAdapter.js';
import { ErrorHandler } from './utils/ErrorHandler.js';
import { FileUtils } from './utils/FileUtils.js';
import { ENGINE_TYPES } from './types/ExcelTypes.js';

class ExcelUltimateEngine {
    constructor(engineType = ENGINE_TYPES.EXCELJS) {
        this.adapter = new ExcelAdapter(engineType);
        this.engineType = engineType;
    }
    
    async execute(filePath, action, params = {}) {
        return ErrorHandler.execute(action, async () => {
            await this.adapter.initialize();
            
            switch(action) {
                case 'read':
                case 'preview':
                case 'excel_preview':
                    return await this.adapter.read(filePath, params);
                    
                case 'modify':
                case 'excel_modify':
                    return await this.adapter.modify(filePath, params);
                    
                case 'create':
                    return await this.adapter.create(params);
                    
                default:
                    return await this.adapter.read(filePath, params);
            }
        }, { filePath, action });
    }
    
    // ✅ واجهات مباشرة للراحة
    async read(filePath, params = {}) {
        return this.execute(filePath, 'read', params);
    }
    
    async modify(filePath, params = {}) {
        return this.execute(filePath, 'modify', params);
    }
    
    async create(params = {}) {
        return this.execute(null, 'create', params);
    }
    
    // ✅ تغيير المحرك ديناميكياً
    async setEngine(engineType) {
        this.engineType = engineType;
        this.adapter = new ExcelAdapter(engineType);
        await this.adapter.initialize();
    }
}

// ✅ تصدير نسخة واحدة
const ultimateEngine = new ExcelUltimateEngine();

// ✅ تصدير الوظائف الرئيسية
export const excelRead = (filePath, params) => ultimateEngine.read(filePath, params);
export const excelModify = (filePath, params) => ultimateEngine.modify(filePath, params);
export const excelCreate = (params) => ultimateEngine.create(params);
export const excelSetEngine = (engineType) => ultimateEngine.setEngine(engineType);

export default ultimateEngine;
export { ExcelUltimateEngine };
