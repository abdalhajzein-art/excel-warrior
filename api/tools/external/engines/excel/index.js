/**
 * excel/index.js – Sovereign ExcelEngine (Unified JS Edition)
 * محرك إكسل سيادي موحّد يعتمد على:
 * - ExcelAdapter (ExcelJS + XLSX)
 * - ExcelReader, ExcelModifier, ExcelAnalyzer, ExcelFormatter, ExcelPivot
 * - ExcelTableDetector, FileUtils, ErrorHandler, ExcelTypes
 * بدون أي اعتماد على Python أو جسور خارجية.
 */

import { ExcelAdapter } from "./core/ExcelAdapter.js";
import { ExcelReader } from "./readers/ExcelReader.js";
import { ExcelModifier } from "./modifiers/ExcelModifier.js";
import { ExcelAnalyzer } from "./analyzers/ExcelAnalyzer.js";
import { ExcelFormatter } from "./formatters/ExcelFormatter.js";
import { ExcelPivot } from "./pivots/ExcelPivot.js";
import { FileUtils } from "./utils/FileUtils.js";
import { ENGINE_TYPES } from "./types/ExcelTypes.js";
import { ExcelTableDetector } from "./core/ExcelTableDetector.js";

class ExcelEngine {
  constructor(engineType = ENGINE_TYPES.EXCELJS) {
    this.engineType = engineType;
    this.adapter = new ExcelAdapter(engineType);
    this.reader = new ExcelReader(this.adapter);
    this.modifier = new ExcelModifier(this.adapter);
    this.analyzer = new ExcelAnalyzer(this.adapter);
    this.formatter = new ExcelFormatter(this.adapter);
    this.pivot = new ExcelPivot(this.adapter);
    this.detector = new ExcelTableDetector(this.adapter);
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      await this.adapter.initialize();
      this.initialized = true;
    }
    return this;
  }

  // 📖 القراءة
  async read(filePath, params = {}) {
    await this.initialize();
    return this.reader.readFull(filePath, params);
  }

  async readFast(filePath, params = {}) {
    await this.initialize();
    return this.reader.readFast(filePath, params);
  }

  async readMetadata(filePath) {
    await this.initialize();
    return this.reader.readMetadata(filePath);
  }

  async readRange(filePath, range, params = {}) {
    await this.initialize();
    return this.reader.readRange(filePath, range, params);
  }

  async readSheets(filePath, sheetNames, params = {}) {
    await this.initialize();
    return this.reader.readSheets(filePath, sheetNames, params);
  }

  // ✏️ التعديل
  async modify(filePath, params = {}) {
    await this.initialize();
    const ops = params.operations || [];
    if (!ops.length) {
      return { ok: false, error: "لا توجد عمليات لتنفيذها." };
    }
    return this.modifier.modifyWithBackup(filePath, ops, params);
  }

  async undo() {
    return this.modifier.undo();
  }

  // 🧠 التحليل
  async analyze(filePath, params = {}) {
    await this.initialize();
    return this.analyzer.analyze(filePath, params);
  }

  // 🎨 التنسيق
  async autoFormat(filePath, params = {}) {
    await this.initialize();
    return this.formatter.autoFormat(filePath, params);
  }

  async applyTemplate(filePath, templateName, params = {}) {
    await this.initialize();
    return this.formatter.applyTemplate(filePath, templateName, params);
  }

  async conditionalFormat(filePath, params = {}) {
    await this.initialize();
    if (this.formatter.conditionalFormat) {
      return this.formatter.conditionalFormat(filePath, params);
    }
    return this.modify(filePath, params);
  }

  // 📊 Pivot
  async pivot(filePath, params = {}) {
    await this.initialize();
    return this.pivot.createPivot(filePath, params);
  }

  // 🧩 كشف الجداول / الهياكل
  async detectTables(filePath, params = {}) {
    await this.initialize();
    return this.detector.detectTables(filePath, params);
  }

  async detectHeaders(filePath, params = {}) {
    await this.initialize();
    return this.detector.detectHeaders(filePath, params);
  }

  async detectMerged(filePath, params = {}) {
    await this.initialize();
    return this.detector.detectMergedRegions(filePath, params);
  }

  // 🏗 إنشاء وتحويل
  async create(params = {}) {
    await this.initialize();
    return this.adapter.create(params);
  }

  async convertToPdf(filePath) {
    await this.initialize();
    return this.adapter.convertToPdf(filePath);
  }

  async convertToCsv(filePath) {
    await this.initialize();
    return this.adapter.convertToCsv(filePath);
  }

  // ⚙ إدارة المحرك
  async setEngine(engineType) {
    this.engineType = engineType;
    this.adapter = new ExcelAdapter(engineType);
    await this.adapter.initialize();
    this.reader = new ExcelReader(this.adapter);
    this.modifier = new ExcelModifier(this.adapter);
    this.analyzer = new ExcelAnalyzer(this.adapter);
    this.formatter = new ExcelFormatter(this.adapter);
    this.pivot = new ExcelPivot(this.adapter);
    this.detector = new ExcelTableDetector(this.adapter);
    this.initialized = true;
    return this;
  }

  getCurrentEngine() {
    return this.engineType;
  }

  async cleanup() {
    await FileUtils.cleanupOldTempFiles();
  }

  async getStatus() {
    return {
      initialized: this.initialized,
      engine: this.engineType,
      modules: {
        reader: true,
        modifier: true,
        analyzer: true,
        formatter: true,
        pivot: true,
        detector: true
      }
    };
  }
}

const excelEngine = new ExcelEngine();
export default excelEngine;
export { ExcelEngine };

// واجهة التصدير الاحترافية
export const excelRead = (filePath, params) => excelEngine.read(filePath, params);
export const excelReadFast = (filePath, params) => excelEngine.readFast(filePath, params);
export const excelReadMetadata = (filePath) => excelEngine.readMetadata(filePath);
export const excelReadRange = (filePath, range, params) => excelEngine.readRange(filePath, range, params);
export const excelReadSheets = (filePath, sheetNames, params) => excelEngine.readSheets(filePath, sheetNames, params);

export const excelModify = (filePath, params) => excelEngine.modify(filePath, params);
export const excelUndo = () => excelEngine.undo();

export const excelAnalyze = (filePath, params) => excelEngine.analyze(filePath, params);

export const excelAutoFormat = (filePath, params) => excelEngine.autoFormat(filePath, params);
export const excelApplyTemplate = (filePath, templateName, params) =>
  excelEngine.applyTemplate(filePath, templateName, params);
export const excelFormat = (filePath, params) => excelEngine.autoFormat(filePath, params);
export const excelConditionalFormat = (filePath, params) =>
  excelEngine.conditionalFormat(filePath, params);

export const excelPivot = (filePath, params) => excelEngine.pivot(filePath, params);

export const excelDetectTables = (filePath, params) => excelEngine.detectTables(filePath, params);
export const excelDetectHeaders = (filePath, params) => excelEngine.detectHeaders(filePath, params);
export const excelDetectMerged = (filePath, params) => excelEngine.detectMerged(filePath, params);

export const excelCreate = (params) => excelEngine.create(params);
export const excelConvertToPdf = (filePath) => excelEngine.convertToPdf(filePath);
export const excelConvertToCsv = (filePath) => excelEngine.convertToCsv(filePath);

export const excelSetEngine = (engineType) => excelEngine.setEngine(engineType);
export const excelGetEngine = () => excelEngine.getCurrentEngine();
export const excelGetStatus = () => excelEngine.getStatus();
export const excelCleanup = () => excelEngine.cleanup();
