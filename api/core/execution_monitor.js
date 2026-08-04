/**
 * api/core/execution_monitor.js – Sovereign Execution & Token Audit Guard (Advanced Edition)
 * ✅ مراقب سيادي متقدم يتتبع استهلاك التوكنز ويعرض المتبقي
 * ✅ إصلاح مشكلة isLocal الافتراضية
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 1. إعدادات المراقب
// ============================================================

const DAILY_LIMIT = 1000000; // 1 مليون توكن (الحد المجاني)
const USAGE_FILE = path.join(__dirname, '../../.token-usage.json');

// ============================================================
// 2. إدارة سجل الاستهلاك
// ============================================================

function getToday() {
    return new Date().toISOString().split('T')[0];
}

function loadUsage() {
    try {
        if (fs.existsSync(USAGE_FILE)) {
            const data = fs.readFileSync(USAGE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn('⚠️ [Token Monitor] فشل تحميل سجل الاستهلاك:', error.message);
    }
    return {};
}

function saveUsage(usage) {
    try {
        fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2), 'utf8');
    } catch (error) {
        console.warn('⚠️ [Token Monitor] فشل حفظ سجل الاستهلاك:', error.message);
    }
}

function resetDailyUsage(usage) {
    const today = getToday();
    if (!usage[today]) {
        usage[today] = {
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            requests: 0,
            actions: []
        };
    }
    return usage;
}

function updateUsage(usage, action, tokens, target) {
    const today = getToday();
    usage = resetDailyUsage(usage);
    
    usage[today].totalTokens += tokens;
    usage[today].requests += 1;
    usage[today].actions.push({
        action,
        target,
        tokens,
        timestamp: new Date().toISOString()
    });
    
    if (usage[today].actions.length > 100) {
        usage[today].actions = usage[today].actions.slice(-100);
    }
    
    return usage;
}

// ============================================================
// 3. الوظيفة الرئيسية للتدقيق (مع إصلاح isLocal)
// ============================================================

export function auditExecution({ action, target = "Unknown File", isLocal = null, usage = null }) {
    const timestamp = new Date().toLocaleTimeString("en-GB");
    
    // ✅ تحديد ما إذا كانت العملية محلية بناءً على وجود usage
    const isLocalExecution = isLocal !== null ? isLocal : !usage;
    
    // 🔹 العمليات المحلية (بدون توكنز)
    if (isLocalExecution) {
        console.log(`\x1b[32m[ALATHEER AUDIT @ ${timestamp}]\x1b[0m 🛡️ [LOCAL SOVEREIGN EXECUTION]`);
        console.log(`   ├─ Target File : \x1b[35m${target}\x1b[0m`);
        console.log(`   ├─ Action      : \x1b[36m${action}\x1b[0m`);
        console.log(`   └─ Cost        : \x1b[32m0 Tokens (Processed Locally)\x1b[0m\n`);
        return;
    }
    
    // 🔸 عمليات LLM (تستهلك توكنز)
    const tokens = usage?.total_tokens || usage?.totalTokenCount || 0;
    
    let usageData = loadUsage();
    usageData = updateUsage(usageData, action, tokens, target);
    saveUsage(usageData);
    
    const today = getToday();
    const dailyStats = usageData[today] || { totalTokens: 0, requests: 0 };
    const remaining = DAILY_LIMIT - dailyStats.totalTokens;
    const percentage = ((dailyStats.totalTokens / DAILY_LIMIT) * 100).toFixed(1);
    
    console.log(`\x1b[33m[ALATHEER AUDIT @ ${timestamp}]\x1b[0m 🧠 [LLM INFERENCE TRIGGERED]`);
    console.log(`   ├─ Target File : \x1b[35m${target}\x1b[0m`);
    console.log(`   ├─ Action      : \x1b[36m${action}\x1b[0m`);
    console.log(`   ├─ Tokens Used : \x1b[33m${tokens}\x1b[0m`);
    console.log(`   ├─ Total Today : \x1b[33m${dailyStats.totalTokens}\x1b[0m / \x1b[36m${DAILY_LIMIT}\x1b[0m (${percentage}%)`);
    console.log(`   ├─ Requests    : \x1b[33m${dailyStats.requests}\x1b[0m`);
    console.log(`   └─ Remaining   : \x1b[${remaining < 10000 ? '31' : '32'}m${remaining}\x1b[0m Tokens${remaining < 10000 ? ' ⚠️' : ''}\n`);
    
    if (remaining < 10000) {
        console.warn(`⚠️ [Token Alert] تبقى فقط ${remaining} توكن!`);
    }
}

// ============================================================
// 4. دوال مساعدة
// ============================================================

export function getTokenUsage() {
    const usage = loadUsage();
    const today = getToday();
    const dailyStats = usage[today] || { totalTokens: 0, requests: 0 };
    
    return {
        today: {
            date: today,
            tokens: dailyStats.totalTokens,
            requests: dailyStats.requests,
            actions: dailyStats.actions || []
        },
        remaining: DAILY_LIMIT - dailyStats.totalTokens,
        limit: DAILY_LIMIT,
        percentage: ((dailyStats.totalTokens / DAILY_LIMIT) * 100).toFixed(1)
    };
}

export function getTokenHistory(days = 7) {
    const usage = loadUsage();
    const history = [];
    const dates = Object.keys(usage).sort();
    const recent = dates.slice(-days);
    
    for (const date of recent) {
        history.push({
            date,
            tokens: usage[date].totalTokens,
            requests: usage[date].requests
        });
    }
    
    return history;
}

export function printTokenReport() {
    const stats = getTokenUsage();
    console.log('\n📊 [Token Usage Report]');
    console.log(`📅 اليوم: ${stats.today.date}`);
    console.log(`🔢 التوكنز المستهلكة: ${stats.today.tokens}`);
    console.log(`📨 عدد الطلبات: ${stats.today.requests}`);
    console.log(`✅ المتبقي: ${stats.remaining}`);
    console.log(`📈 النسبة: ${stats.percentage}%\n`);
    
    if (stats.today.actions.length > 0) {
        console.log('📋 آخر 5 عمليات:');
        const lastActions = stats.today.actions.slice(-5);
        for (const action of lastActions) {
            console.log(`   - ${action.action} (${action.target}): ${action.tokens} توكن`);
        }
        console.log('');
    }
}

export function resetTokenUsage() {
    try {
        if (fs.existsSync(USAGE_FILE)) {
            fs.unlinkSync(USAGE_FILE);
            console.log('🧹 [Token Monitor] تم إعادة ضبط سجل الاستهلاك.');
        }
    } catch (error) {
        console.warn('⚠️ [Token Monitor] فشل إعادة الضبط:', error.message);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    printTokenReport();
        }
