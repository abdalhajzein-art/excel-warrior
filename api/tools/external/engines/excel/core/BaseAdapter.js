/**
 * excel/core/BaseAdapter.js – القاعدة المشتركة للمحركات
 */

export class BaseAdapter {
    constructor(engineType) {
        this.engineType = engineType;
        this.supportsFormulas = false;
        this.supportsStyles = false;
    }
    
    async read(filePath, params = {}) {
        throw new Error(`طريقة read غير مطبقة في ${this.engineType}`);
    }
    
    async modify(filePath, params = {}) {
        throw new Error(`طريقة modify غير مطبقة في ${this.engineType}`);
    }
    
    async create(params = {}) {
        throw new Error(`طريقة create غير مطبقة في ${this.engineType}`);
    }
    
    async applyOperations(worksheet, operations) {
        throw new Error(`طريقة applyOperations غير مطبقة في ${this.engineType}`);
    }
    
    dataToText(data) {
        return data.map(sheet => 
            sheet.map(row => row.join(' | ')).join('\n')
        ).join('\n\n---\n\n');
    }
    
    dataToMarkdown(data) {
        return data.map(sheet =>
            sheet.map(row => `| ${row.join(' | ')} |`).join('\n')
        ).join('\n\n---\n\n');
    }
}
