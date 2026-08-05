/**
 * api/core/execution_monitor.js – Sovereign Execution & Token Audit Guard
 * ✅ مراقب سيادي يتتبع استهلاك التوكنز من المصدر الفعلي (Google Cloud)
 * ✅ يعرض الاستهلاك الحقيقي بدون أرقام وهمية
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 1. إعدادات المراقب
// ============================================================

const USAGE_FILE = path.join(__dirname, '../../.token-usage.json');
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const MONITORING_ENABLED = process.env.GOOGLE_CLOUD_MONITORING_ENABLED === 'true';
const CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

// ============================================================
// 2. استعلام فعلي من Google Cloud Monitoring
// ============================================================

async function getActualTokenUsage() {
    if (!MONITORING_ENABLED || !PROJECT_ID || !CREDENTIALS_JSON) {
        console.log('ℹ️ [Token Monitor] مراقبة Google Cloud غير مفعلة');
        return null;
    }

    try {
        const auth = new GoogleAuth({
            credentials: JSON.parse(CREDENTIALS_JSON),
            scopes: ['https://www.googleapis.com/auth/monitoring.read'],
        });

        const client = await auth.getClient();
        
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const url = `https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}/timeSeries?filter=metric.type="generativelanguage.googleapis.com/gemini/token_count"&interval.startTime=${oneDayAgo.toISOString()}&interval.endTime=${now.toISOString()}&aggregation.alignmentPeriod=86400s&aggregation.perSeriesAligner=ALIGN_SUM`;

        const response = await client.request({ url });
        
        if (response.data && response.data.timeSeries) {
            let totalTokens = 0;
            for (const series of response.data.timeSeries) {
                if (series.points && series.points.length > 0) {
                    const point = series.points[0];
                    const value = point.value?.int64Value || point.value?.doubleValue || 0;
                    totalTokens += Number(value);
                }
            }
            
            console.log(`📊 [Token Monitor] الاستهلاك الفعلي من Google Cloud: ${totalTokens.toLocaleString()} توكن`);
            return totalTokens;
        }
        
        return null;
    } catch (error) {
        console.error('❌ [Token Monitor] فشل الاستعلام من Google Cloud:', error.message);
        return null;
    }
}

// ============================================================
// 3. إدارة سجل الاستهلاك المحلي (للمقارنة)
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
        console.warn('⚠️ [Token Monitor] فشل تحميل السجل المحلي:', error.message);
    }
    return {};
}

function saveUsage(usage) {
    try {
        fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2), 'utf8');
    } catch (error) {
        console.warn('⚠️ [Token Monitor] فشل حفظ السجل المحلي:', error.message);
    }
}

function updateUsage(usage, action, tokens, target) {
    const today = getToday();
    if (!usage[today]) {
        usage[today] = {
            totalTokens: 0,
            requests: 0,
            actions: []
        };
    }
    
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
// 4. الوظيفة الرئيسية للتدقيق
// ============================================================

export async function auditExecution({ action, target = "Unknown File", isLocal = null, usage = null }) {
    const timestamp = new Date().toLocaleTimeString("en-GB");
    
    // ✅ تحديد ما إذا كانت العملية محلية
    const isLocalExecution = isLocal !== null ? isLocal : !usage;
    
    if (isLocalExecution) {
        console.log(`\x1b[32m[ALATHEER AUDIT @ ${timestamp}]\x1b[0m 🛡️ [LOCAL SOVEREIGN EXECUTION]`);
        console.log(`   ├─ Target File : \x1b[35m${target}\x1b[0m`);
        console.log(`   ├─ Action      : \x1b[36m${action}\x1b[0m`);
        console.log(`   └─ Cost        : \x1b[32m0 Tokens (Processed Locally)\x1b[0m\n`);
        return;
    }
    
    // 🔸 عمليات LLM (تستهلك توكنز)
    const tokens = usage?.total_tokens || usage?.totalTokenCount || 0;
    
    // تحديث السجل المحلي
    let usageData = loadUsage();
    usageData = updateUsage(usageData, action, tokens, target);
    saveUsage(usageData);
    
    // ✅ الحصول على الاستهلاك الفعلي من المصدر
    const actualUsage = await getActualTokenUsage();
    
    const today = getToday();
    const dailyStats = usageData[today] || { totalTokens: 0, requests: 0 };
    
    console.log(`\x1b[33m[ALATHEER AUDIT @ ${timestamp}]\x1b[0m 🧠 [LLM INFERENCE TRIGGERED]`);
    console.log(`   ├─ Target File : \x1b[35m${target}\x1b[0m`);
    console.log(`   ├─ Action      : \x1b[36m${action}\x1b[0m`);
    console.log(`   ├─ Tokens Used : \x1b[33m${tokens}\x1b[0m`);
    console.log(`   ├─ Local Total : \x1b[33m${dailyStats.totalTokens}\x1b[0m (هذه الجلسة)`);
    if (actualUsage !== null) {
        console.log(`   ├─ Cloud Total : \x1b[33m${actualUsage.toLocaleString()}\x1b[0m (فعلي من Google Cloud)`);
    }
    console.log(`   ├─ Requests    : \x1b[33m${dailyStats.requests}\x1b[0m`);
    console.log(`   └─ ${actualUsage !== null ? '✅ الاستهلاك الفعلي من المصدر' : '⚠️ الاستعلام الخارجي غير مفعل'}\n`);
}

// ============================================================
// 5. دوال مساعدة
// ============================================================

export async function getTokenUsage() {
    const usage = loadUsage();
    const today = getToday();
    const dailyStats = usage[today] || { totalTokens: 0, requests: 0 };
    const actualUsage = await getActualTokenUsage();
    
    return {
        today: {
            date: today,
            tokens: dailyStats.totalTokens,
            requests: dailyStats.requests,
            actions: dailyStats.actions || []
        },
        actual: actualUsage,
        local: dailyStats.totalTokens
    };
}

export async function printTokenReport() {
    const stats = await getTokenUsage();
    console.log('\n📊 [Token Usage Report]');
    console.log(`📅 اليوم: ${stats.today.date}`);
    console.log(`🔢 التوكنز المستهلكة (محلياً): ${stats.local.toLocaleString()}`);
    if (stats.actual !== null) {
        console.log(`🔢 التوكنز المستهلكة (Google Cloud): ${stats.actual.toLocaleString()}`);
        console.log(`✅ هذا هو الاستهلاك الحقيقي من المصدر!`);
    } else {
        console.log(`⚠️ الاستعلام الخارجي غير مفعل، اعرض الأرقام المحلية فقط.`);
    }
    console.log(`📨 عدد الطلبات: ${stats.today.requests}\n`);
}

export function resetTokenUsage() {
    try {
        if (fs.existsSync(USAGE_FILE)) {
            fs.unlinkSync(USAGE_FILE);
            console.log('🧹 [Token Monitor] تم إعادة ضبط السجل المحلي.');
        }
    } catch (error) {
        console.warn('⚠️ [Token Monitor] فشل إعادة الضبط:', error.message);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    printTokenReport();
            }
