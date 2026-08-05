import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

export async function executeOperations(filePath, operations) {
    if (!operations || operations.length === 0) return { success: true };
    const pythonEnginePath = path.join(__dirname, 'excel_engine.py');
    const opsJson = JSON.stringify(operations);
    
    try {
        const { stdout } = await execFileAsync('python3', [pythonEnginePath, filePath, opsJson]);
        return JSON.parse(stdout);
    } catch (error) {
        console.error('❌ Excel Engine Error:', error);
        return { success: false, error: error.message };
    }
}

export async function extractPreviewAsync(filePath) {
    const pythonPreviewPath = path.join(__dirname, 'excel_preview.py');
    try {
        const { stdout } = await execFileAsync('python3', [pythonPreviewPath, filePath], { maxBuffer: 10 * 1024 * 1024 });
        return JSON.parse(stdout);
    } catch (error) {
        console.warn("⚠️ Preview Engine Error:", error.message);
        return { error: error.message };
    }
}
