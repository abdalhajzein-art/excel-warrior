/**
 * js/chatEngine.js – النسخة النهائية المصلحة للربط مع Cloudflare Worker (Gemini)
 */

import { getStoredSessions, saveSessions, getCurrentSessionId, renderSessionsList } from './sessionManager.js';
import { getSelectedFile, getAttachedFileName, resetFile } from './fileHandler.js';
import { streamTextEffect, showTypingIndicator, hideTypingIndicator, showSearchIndicator, hideSearchIndicator, formatReply } from './uiController.js';

const WORKER_URL = "https://al-atheer.abd-alhajzein.workers.dev";

let isGenerating = false;
let currentAbortController = null;

export function getIsGenerating() {
    return isGenerating;
}

export function updateSendButtonState() {
    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    const attachBtn = document.getElementById('attachBtn');
    if (!sendBtn) return;
    
    if (isGenerating) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '◼';
        sendBtn.title = 'إيقاف الرد';
        sendBtn.style.background = 'var(--accent-gold)';
        if (userInput) {
            userInput.disabled = true;
            userInput.placeholder = 'جاري تدفق الأفكار... (اضغط للإيقاف)';
        }
        if (attachBtn) attachBtn.style.pointerEvents = 'none';
    } else {
        const hasText = userInput && userInput.value.trim().length > 0;
        const hasFileReady = getSelectedFile() !== null;
        sendBtn.disabled = !(hasText || hasFileReady);
        sendBtn.innerHTML = '➤';
        sendBtn.title = 'إرسال';
        sendBtn.style.background = 'var(--accent-gold)';
        if (userInput) {
            userInput.disabled = false;
            userInput.placeholder = 'اكتب رسالتك للأثير...';
        }
        if (attachBtn) attachBtn.style.pointerEvents = 'auto';
    }
}

export function stopGeneration() {
    isGenerating = false;
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
    updateSendButtonState();
    document.querySelectorAll('.typing-indicator, .search-indicator-badge').forEach(el => el.remove());
}

function cleanArtifacts(text) {
    if (!text) return "";
    return text
        .replace(/\$\d+/g, "")
        .replace(/<(unk|pad|mask)>/gi, "")
        .replace(/\s{3,}/g, " ");
}

export async function handleSendMessage(renderCallbacks) {
    const userInput = document.getElementById('userInput');
    const chatArea = document.getElementById('chatArea');
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (!userInput) return;

    const message = userInput.value.trim();
    const currentFileToProcess = getSelectedFile();
    const currentFileName = getAttachedFileName();

    if (!message && !currentFileToProcess) return;

    if (welcomeScreen) welcomeScreen.style.display = 'none';

    let displayMessage = message || "";
    let processedFileResult = null;
    let fileDisplayName = null;

    // 📎 رفع الملف إلى Cloudflare Worker
    if (currentFileToProcess) {
        try {
            const formData = new FormData();
            formData.append("file", currentFileToProcess);

            const uploadResponse = await fetch(`${WORKER_URL}/files/analyze`, {
                method: "POST",
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error(`Upload failed with status ${uploadResponse.status}`);
            }

            processedFileResult = await uploadResponse.json();
            fileDisplayName = currentFileName;

        } catch (err) {
            console.error("❌ Error processing file:", err);
            appendMessageToDOM('assistant', '⚠️ تعذر معالجة الملف. حاول مرة أخرى.');
            return;
        }
    }

    isGenerating = true;
    window._isUserScrolledUp = false;
    updateSendButtonState();
    currentAbortController = new AbortController();

    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'message user';
    
    const textSpan = document.createElement('div');
    textSpan.innerText = displayMessage || (fileDisplayName ? '📎 ملف مرفق' : '');
    userMessageDiv.appendChild(textSpan);
    
    if (fileDisplayName) {
        const fileTag = document.createElement('div');
        fileTag.style.cssText = `
            display: inline-block;
            margin-top: 6px;
            background: rgba(212, 175, 55, 0.15);
            color: #d4af37;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            border: 1px solid rgba(212, 175, 55, 0.3);
        `;
        fileTag.innerText = `📎 ${fileDisplayName}`;
        userMessageDiv.appendChild(fileTag);
    }
    
    chatArea.appendChild(userMessageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
    
    const sessionId = getCurrentSessionId();
    saveMessageToCurrentSession('user', displayMessage || (fileDisplayName ? '📎 ملف مرفق' : ''), {
        fileName: fileDisplayName,
        fileData: processedFileResult
    });

    if (currentFileToProcess) resetFile();

    let sessions = getStoredSessions();
    if (sessions[sessionId] && sessions[sessionId].title === 'جلسة جديدة') {
        sessions[sessionId].title = displayMessage.length > 20
            ? displayMessage.substring(0, 20) + '...'
            : displayMessage || (fileDisplayName ? 'ملف مرفق' : 'جلسة جديدة');
        saveSessions(sessions);
        
        try {
            if (typeof renderSessionsList === 'function') {
                renderSessionsList(renderCallbacks);
            }
        } catch (err) {
            console.warn("⚠️ Non-critical: renderSessionsList skipped or failed:", err);
        }
    }

    userInput.value = '';
    userInput.style.height = 'auto';
    updateSendButtonState();

    const isSearchQuery = /(ابحث|ابحثلي|بحث|النت|جوجل|شبكة|عن وصفة|أخبار|مصادر|رابط|روابط|طقس|الجو)/i.test(displayMessage);
    
    let indicatorId;
    if (isSearchQuery) indicatorId = showSearchIndicator();
    else indicatorId = showTypingIndicator();

    try {
        const currentSessionData = sessions[sessionId];
        const conversationHistory = currentSessionData ? currentSessionData.messages : [];

        const formattedHistoryForBackend = conversationHistory.map(msg => {
            let contentText = msg.text || '';
            if (msg.fileData && msg.fileData.fileName) {
                contentText += ` (الملف المرفق: ${msg.fileData.fileName})`;
            }
            return {
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: contentText
            };
        });

        let finalMessageForAI = displayMessage || "ممكن تعطيني ملخص عن محتوى الملف؟";

        // 🚀 إرسال الطلب إلى Cloudflare Worker
        const response = await fetch(`${WORKER_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    ...formattedHistoryForBackend,
                    { role: "user", content: finalMessageForAI }
                ],
                file: processedFileResult
            }),
            signal: currentAbortController.signal
        });

        const data = await response.json();

        if (isSearchQuery) hideSearchIndicator(indicatorId);
        else hideTypingIndicator(indicatorId);

        // 🛡️ معالجة الأخطاء السليمة لمنع ظهور [object Object]
        if (!response.ok || data.error) {
            const rawError = data.error;
            const errorMsg = typeof rawError === 'object' 
                ? (rawError.message || rawError.status || JSON.stringify(rawError)) 
                : rawError;
            throw new Error(errorMsg || `خطأ من الخادم (${response.status})`);
        }

        // 🛡️ استخراج النص المراد عرضه بدقة من أي مفتاح محتمل
        const replyText = data.reply 
            || data.output_text 
            || (data.candidates && data.candidates[0]?.content?.parts[0]?.text) 
            || "تم إنجاز طلبك بنجاح!";

        const cleanedReply = cleanArtifacts(replyText);

        const assistantMsgDiv = document.createElement('div');
        assistantMsgDiv.className = 'message ai';
        chatArea.appendChild(assistantMsgDiv);

        await streamTextEffect(assistantMsgDiv, cleanedReply, 15, getIsGenerating);
        addCopyButtonToMessage(assistantMsgDiv, cleanedReply);

        saveMessageToCurrentSession('assistant', cleanedReply);

    } catch (error) {
        console.error('❌ Fetch Error:', error);
        if (isSearchQuery) hideSearchIndicator(indicatorId);
        else hideTypingIndicator(indicatorId);

        if (error.name !== 'AbortError') {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message ai';
            
            // تحويل الرسالة لنص صريح بدقة
            const displayErr = typeof error.message === 'string' ? error.message : JSON.stringify(error);
            errorDiv.innerHTML = `<div>⚠️ ${displayErr || 'تعذر الاتصال بالسيرفر.'}</div>`;
            
            chatArea.appendChild(errorDiv);
            chatArea.scrollTop = chatArea.scrollHeight;
        }

    } finally {
        isGenerating = false;
        currentAbortController = null;
        updateSendButtonState();
    }
}

function addCopyButtonToMessage(messageDiv, textToCopy) {
    messageDiv.style.position = 'relative';
    messageDiv.style.paddingTop = '36px';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-msg-btn';
    copyBtn.title = 'نسخ النص';
    copyBtn.style.cssText = `position: absolute; top: 10px; left: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border: 1px solid var(--border-glass); padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; z-index: 5;`;
    
    copyBtn.innerHTML = `<span>نسخ</span>`;

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            copyBtn.innerHTML = `<span>تم النسخ ✓</span>`;
            copyBtn.style.color = 'var(--accent-gold)';
            setTimeout(() => {
                copyBtn.innerHTML = `<span>نسخ</span>`;
                copyBtn.style.color = 'var(--text-secondary)';
            }, 2000);
        });
    });
    messageDiv.appendChild(copyBtn);
}

export function saveMessageToCurrentSession(sender, text, fileData = null) {
    const sessionId = getCurrentSessionId();
    let sessions = getStoredSessions();
    if (!sessions[sessionId]) sessions[sessionId] = { title: 'جلسة جديدة', messages: [], pinned: false, lastFile: null };
    sessions[sessionId].messages.push({ sender, text, fileData });
    saveSessions(sessions);
}

export function appendMessageToDOM(sender, text, fileData = null) {
    const chatArea = document.getElementById('chatArea');
    if (!chatArea) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender === 'user' ? 'user' : 'ai'}`;
    messageDiv.innerHTML = formatReply(text);
    chatArea.appendChild(messageDiv);
    if (sender === 'assistant') addCopyButtonToMessage(messageDiv, text);

    chatArea.scrollTop = chatArea.scrollHeight;
}

