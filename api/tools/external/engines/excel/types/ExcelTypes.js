/**
 * excel/types/ExcelTypes.js – الأنواع والثوابت السيادية
 */

export const SUPPORTED_FORMATS = ['.xlsx', '.xlsm', '.xls', '.csv'];
export const HEADER_ROW = 3;
export const MAX_TEXT_LENGTH = 1500;
export const MAX_TOKENS = 4096;

export const OPERATION_TYPES = {
    ADD_COLUMN: 'add_column',
    ADD_ROW: 'add_row',
    UPDATE_CELL: 'update_cell',
    COLOR_CELLS: 'color_cells',
    FORMAT_RANGE: 'format_range',
    ADD_FORMULA: 'add_formula',
    ADD_VALIDATION: 'add_validation',
    ADD_FILTER: 'add_filter'
};

export const INTENT_TYPES = {
    INFO: 'info',
    MODIFY: 'modify',
    GENERAL: 'general'
};

export const ENGINE_TYPES = {
    EXCELJS: 'exceljs',
    XLSX: 'xlsx',
    PYTHON: 'python'
};
