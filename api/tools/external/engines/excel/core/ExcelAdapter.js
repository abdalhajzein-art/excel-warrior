/**
 * excel/core/ExcelAdapter.js – Sovereign Multi‑Engine Excel Adapter
 * محرك سيادي موحّد يعتمد على:
 * - SheetJS (XLSXAdapter) للقراءة والتحليل
 * - ExcelJS (ExcelJSAdapter) للتعديل والتنسيق
 * - ExcelAnalyzer للتحليل المتقدم
 * - ExcelFormatter للتنسيق المتقدم
 * - ExcelTableDetector لكشف الجداول
 */

import { ExcelJSAdapter } from "./ExcelJSAdapter.js";
import { XLSXAdapter } from "./XLSXAdapter.js";
import { ExcelAnalyzer } from "../analyzers/ExcelAnalyzer.js";
import { ExcelFormatter } from "../formatters/ExcelFormatter.js";
import { ExcelTableDetector } from "./ExcelTableDetector.js";

export class ExcelAdapter {
    constructor() {
        this.reader = new XLSXAdapter();        // SheetJS
        this.writer = new ExcelJSAdapter();     // ExcelJS
        this.analyzer = new ExcelAnalyzer(this.reader);
        this.formatter = new ExcelFormatter(this.writer);
        this.detector = ExcelTableDetector;
    }

    async initialize() {
        await this.reader.initialize?.();
        await this.writer.initialize?.();
        return true;
    }

    /* ============================================================
       📖 القراءة – دائماً عبر SheetJS
       ============================================================ */
    async read(filePath, params = {}) {
        await this.initialize();
        return this.reader.read(filePath, params);
    }

    async readFast(filePath, params = {}) {
        await this.initialize();
        return this.reader.readFast?.(filePath, params) || this.reader.read(filePath, params);
    }

    async readMetadata(filePath) {
        await this.initialize();
        return this.reader.readMetadata?.(filePath) || {};
    }

    async readRange(filePath, range, params = {}) {
        await this.initialize();
        return this.reader.readRange(filePath, range, params);
    }

    async readSheets(filePath, sheetNames, params = {}) {
        await this.initialize();
        return this.reader.readSheets(filePath, sheetNames, params);
    }

    /* ============================================================
       ✏️ التعديل – دائماً عبر ExcelJS
       ============================================================ */
    async modify(filePath, params = {}) {
        await this.initialize();
        return this.writer.modify(filePath, params);
    }

    async applyOperations(worksheet, operations) {
        await this.initialize();
        return this.writer.applyOperations(worksheet, operations);
    }

    async undo() {
        await this.initialize();
        return this.writer.undo?.();
    }

    /* ============================================================
       🧠 التحليل – عبر SheetJS + Analyzer
       ============================================================ */
    async analyze(filePath, params = {}) {
        await this.initialize();
        return this.analyzer.analyze(filePath, params);
    }

    /* ============================================================
       🎨 التنسيق – عبر ExcelJS + Formatter
       ============================================================ */
    async autoFormat(filePath, params = {}) {
        await this.initialize();
        return this.formatter.autoFormat(filePath, params);
    }

    async applyTemplate(filePath, templateName, params = {}) {
        await this.initialize();
        return this.writer.applyTemplate(filePath, templateName, params);
    }

    async conditionalFormat(filePath, params = {}) {
        await this.initialize();
        return this.writer.conditionalFormat?.(filePath, params) || this.writer.modify(filePath, params);
    }

    /* ============================================================
       📊 Pivot – عبر ExcelJS
       ============================================================ */
    async pivot(filePath, params = {}) {
        await this.initialize();
        return this.writer.pivot(filePath, params);
    }

    /* ============================================================
       🧩 كشف الجداول – عبر TableDetector + SheetJS
       ============================================================ */
    async detectTables(filePath, params = {}) {
        await this.initialize();
        const core = await this.reader.read(filePath, params);
        return this.detector.detectMainTable(core.data[0]);
    }

    async detectHeaders(filePath, params = {}) {
        await this.initialize();
        const core = await this.reader.read(filePath, params);
        return core.data[0]?.data?.[0] || [];
    }

    async detectMerged(filePath, params = {}) {
        await this.initialize();
        const core = await this.reader.read(filePath, params);
        return core.data[0]?.merges || [];
    }

    /* ============================================================
       🏗 إنشاء وتحويل – عبر ExcelJS
       ============================================================ */
    async create(params = {}) {
        await this.initialize();
        return this.writer.create(params);
    }

    async convertToPdf(filePath) {
        await this.initialize();
        return this.writer.convertToPdf(filePath);
    }

    async convertToCsv(filePath) {
        await this.initialize();
        return this.writer.convertToCsv(filePath);
    }
    }
