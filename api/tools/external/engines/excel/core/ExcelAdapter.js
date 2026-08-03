/**
 * excel/core/ExcelAdapter.js – طبقة التجريد السيادية
 * 🔥 تسمح بالتبديل بين محركات Excel المختلفة (ExcelJS, XLSX, Python)
 */

export class ExcelAdapter {
    constructor(engineType = 'exceljs') {
        this.engineType = engineType;
        this.engine = null;
    }
    
    async initialize(engineType = this.engineType) {
        switch(engineType) {
            case 'exceljs':
                const { ExcelJSAdapter } = await import('./ExcelJSAdapter.js');
                this.engine = new ExcelJSAdapter();
                break;
            case 'xlsx':
                const { XLSXAdapter } = await import('./XLSXAdapter.js');
                this.engine = new XLSXAdapter();
                break;
            case 'python':
                const { PythonAdapter } = await import('./PythonAdapter.js');
                this.engine = new PythonAdapter();
                break;
            default:
                throw new Error(`محرك غير معروف: ${engineType}`);
        }
        return this.engine;
    }
    
    async read(filePath, params = {}) {
        if (!this.engine) await this.initialize();
        return this.engine.read(filePath, params);
    }
    
    async modify(filePath, params = {}) {
        if (!this.engine) await this.initialize();
        return this.engine.modify(filePath, params);
    }
    
    async create(params = {}) {
        if (!this.engine) await this.initialize();
        return this.engine.create(params);
    }
    
    async applyOperations(worksheet, operations) {
        if (!this.engine) await this.initialize();
        return this.engine.applyOperations(worksheet, operations);
    }
}
