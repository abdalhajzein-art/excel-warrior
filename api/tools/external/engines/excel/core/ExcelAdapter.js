/**
 * excel/core/ExcelAdapter.js – Sovereign Unified Excel Adapter
 * محرك سيادي موحّد يعتمد فقط على:
 * - ExcelJSAdapter
 * - XLSXAdapter
 * بدون Python، بدون جسور، بدون تشتت.
 */

import { ExcelJSAdapter } from "./ExcelJSAdapter.js";
import { XLSXAdapter } from "./XLSXAdapter.js";
import { ENGINE_TYPES } from "../types/ExcelTypes.js";

export class ExcelAdapter {
    constructor(engineType = ENGINE_TYPES.EXCELJS) {
        this.engineType = engineType;
        this.engine = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized && this.engine) return this.engine;

        switch (this.engineType) {
            case ENGINE_TYPES.EXCELJS:
                this.engine = new ExcelJSAdapter();
                break;

            case ENGINE_TYPES.XLSX:
                this.engine = new XLSXAdapter();
                break;

            default:
                throw new Error(`❌ محرك غير معروف: ${this.engineType}`);
        }

        await this.engine.initialize?.();
        this.initialized = true;
        return this.engine;
    }

    /* ============================================================
       📖 القراءة
       ============================================================ */

    async read(filePath, params = {}) {
        await this.initialize();
        return this.engine.read(filePath, params);
    }

    async readFast(filePath, params = {}) {
        await this.initialize();
        return this.engine.readFast?.(filePath, params) || this.engine.read(filePath, params);
    }

    async readRange(filePath, range, params = {}) {
        await this.initialize();
        if (!this.engine.readRange) {
            throw new Error("❌ المحرك الحالي لا يدعم readRange");
        }
        return this.engine.readRange(filePath, range, params);
    }

    async readSheets(filePath, sheetNames, params = {}) {
        await this.initialize();
        if (!this.engine.readSheets) {
            throw new Error("❌ المحرك الحالي لا يدعم readSheets");
        }
        return this.engine.readSheets(filePath, sheetNames, params);
    }

    async readMetadata(filePath) {
        await this.initialize();
        return this.engine.readMetadata?.(filePath) || { metadata: null };
    }

    /* ============================================================
       ✏️ التعديل
       ============================================================ */

    async modify(filePath, params = {}) {
        await this.initialize();
        return this.engine.modify(filePath, params);
    }

    async applyOperations(worksheet, operations) {
        await this.initialize();
        if (!this.engine.applyOperations) {
            throw new Error("❌ المحرك الحالي لا يدعم applyOperations");
        }
        return this.engine.applyOperations(worksheet, operations);
    }

    async undo() {
        await this.initialize();
        return this.engine.undo?.();
    }

    /* ============================================================
       🧠 التحليل
       ============================================================ */

    async analyze(filePath, params = {}) {
        await this.initialize();
        if (!this.engine.analyze) {
            throw new Error("❌ المحرك الحالي لا يدعم التحليل");
        }
        return this.engine.analyze(filePath, params);
    }

    /* ============================================================
       🎨 التنسيق
       ============================================================ */

    async autoFormat(filePath, params = {}) {
        await this.initialize();
        if (!this.engine.autoFormat) {
            throw new Error("❌ المحرك الحالي لا يدعم autoFormat");
        }
        return this.engine.autoFormat(filePath, params);
    }

    async applyTemplate(filePath, templateName, params = {}) {
        await this.initialize();
        if (!this.engine.applyTemplate) {
            throw new Error("❌ المحرك الحالي لا يدعم applyTemplate");
        }
        return this.engine.applyTemplate(filePath, templateName, params);
    }

    async conditionalFormat(filePath, params = {}) {
        await this.initialize();
        if (this.engine.conditionalFormat) {
            return this.engine.conditionalFormat(filePath, params);
        }
        return this.engine.modify(filePath, params);
    }

    /* ============================================================
       📊 Pivot
       ============================================================ */

    async pivot(filePath, params = {}) {
        await this.initialize();
        if (!this.engine.pivot) {
            throw new Error("❌ المحرك الحالي لا يدعم pivot");
        }
        return this.engine.pivot(filePath, params);
    }

    /* ============================================================
       🧩 كشف الجداول / الهياكل
       ============================================================ */

    async detectTables(filePath, params = {}) {
        await this.initialize();
        if (!this.engine.detectTables) {
            throw new Error("❌ المحرك الحالي لا يدعم detectTables");
        }
        return this.engine.detectTables(filePath, params);
    }

    async detectHeaders(filePath, params = {}) {
        await this.initialize();
        if (!this.engine.detectHeaders) {
            throw new Error("❌ المحرك الحالي لا يدعم detectHeaders");
        }
        return this.engine.detectHeaders(filePath, params);
    }

    async detectMerged(filePath, params = {}) {
        await this.initialize();
        if (!this.engine.detectMergedRegions) {
            throw new Error("❌ المحرك الحالي لا يدعم detectMergedRegions");
        }
        return this.engine.detectMergedRegions(filePath, params);
    }

    /* ============================================================
       🏗 إنشاء وتحويل
       ============================================================ */

    async create(params = {}) {
        await this.initialize();
        return this.engine.create(params);
    }

    async convertToPdf(filePath) {
        await this.initialize();
        if (!this.engine.convertToPdf) {
            throw new Error("❌ المحرك الحالي لا يدعم convertToPdf");
        }
        return this.engine.convertToPdf(filePath);
    }

    async convertToCsv(filePath) {
        await this.initialize();
        if (!this.engine.convertToCsv) {
            throw new Error("❌ المحرك الحالي لا يدعم convertToCsv");
        }
        return this.engine.convertToCsv(filePath);
    }

    /* ============================================================
       ⚙ إدارة المحرك
       ============================================================ */

    async setEngine(engineType) {
        this.engineType = engineType;
        this.initialized = false;
        return this.initialize();
    }

    getCurrentEngine() {
        return this.engineType;
    }
    }
