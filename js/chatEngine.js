/**
 * js/chatEngine.js – النسخة السيادية النهائية (مصحّحة ومحسنة الأداء)
 */

import { getStoredSessions, saveSessions, getCurrentSessionId, renderSessionsList } from './sessionManager.js';
import { getSelectedFile, getAttachedFileName, resetFile } from './fileHandler.js';
import { streamTextEffect, showTypingIndicator, hideTypingIndicator, showSearchIndicator, hideSearchIndicator, formatReply } from './uiController.js';

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

export function handleMainAction(renderCallbacks) {
    if (isGenerating) {
        stopGeneration();
    } else {
        handleSendMessage(renderCallbacks);
    }
}

function cleanArtifacts(text) {
    return text
        .replace(/\$\d+/g, "")
        .replace(/<(unk|pad|mask)>/gi, "")
        .replace(/#{2,}/g, "")
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
    let fileBase64 = null;

    if (currentFileToProcess) {
        try {
            const fileBuffer = await currentFileToProcess.arrayBuffer();
            const base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
            
            fileBase64 = base64Data;
            fileDisplayName = currentFileName;
            
            const formData = new FormData();
            formData.append("file", currentFileToProcess);
            formData.append("action", "preview");

            const uploadResponse = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });

            processedFileResult = await uploadResponse.json();
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
    if (isSearchQuery) {
        indicatorId = showSearchIndicator();
    } else {
        indicatorId = showTypingIndicator();
    }

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

        const requestPayload = { 
            message: finalMessageForAI,
            history: formattedHistoryForBackend,
            sessionId: sessionId,
            fileData: fileBase64,
            fileName: fileDisplayName || null
        };

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            signal: currentAbortController.signal
        });

        const data = await response.json();

        try {
            if (currentFileToProcess) {
                const uploadFailed = processedFileResult && processedFileResult.error;
                const hasPersistentPath = processedFileResult && processedFileResult.filePath;

                if (uploadFailed || !hasPersistentPath) {
                    resetFile();
                }
            }
        } catch (e) {
            console.warn("⚠️ خطأ أثناء تحديد مصير الملف:", e);
            resetFile();
        }

        if (isSearchQuery) {
            hideSearchIndicator(indicatorId);
        } else {
            hideTypingIndicator(indicatorId);
        }

        const replyText = data.reply || "تم إنجاز طلبك بنجاح!";
        const cleanedReply = cleanArtifacts(replyText);

        const assistantMsgDiv = document.createElement('div');
        assistantMsgDiv.className = 'message ai';
        chatArea.appendChild(assistantMsgDiv);

        await streamTextEffect(assistantMsgDiv, cleanedReply, 15, getIsGenerating);

        addCopyButtonToMessage(assistantMsgDiv, cleanedReply);

        let savedFileData = null;

        if (data.isFileGenerated && data.downloadUrl) {
            const safeFileName = data.fileName || 'generated_file.xlsx';
            const downloadUrl = data.downloadUrl;
            
            savedFileData = {
                downloadUrl: downloadUrl,
                name: safeFileName,
                isGenerated: true
            };

            const downloadBtn = document.createElement('a');
            downloadBtn.href = downloadUrl;
            downloadBtn.download = safeFileName;
            downloadBtn.className = 'alatheer-download-btn generated-file';
            downloadBtn.innerHTML = `📥 تحميل الملف المُنشأ (${safeFileName})`;
            assistantMsgDiv.appendChild(downloadBtn);

            const successMsg = document.createElement('div');
            successMsg.style.cssText = `
                margin-top: 8px;
                color: #4CAF50;
                font-size: 14px;
                font-weight: bold;
            `;
            successMsg.innerHTML = '✅ تم إنشاء الملف بنجاح!';
            assistantMsgDiv.appendChild(successMsg);
        }

        if (data.fileBase64 && !data.isFileGenerated) {
            const safeFileName = data.fileName || 'modified_file.xlsx';
            const fileDownloadUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${data.fileBase64}`;
            
            savedFileData = {
                downloadUrl: fileDownloadUrl,
                base64: data.fileBase64,
                name: safeFileName,
                isGenerated: false
            };

            const downloadBtn = document.createElement('a');
            downloadBtn.href = fileDownloadUrl;
            downloadBtn.download = safeFileName;
            downloadBtn.className = 'alatheer-download-btn';
            downloadBtn.innerHTML = `📥 اضغط هنا لتحميل ملفك المعدل (${safeFileName})`;
            assistantMsgDiv.appendChild(downloadBtn);
        }

        if (!window._isUserScrolledUp) {
            chatArea.scrollTop = chatArea.scrollHeight;
        }

        saveMessageToCurrentSession('assistant', cleanedReply, savedFileData);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('🛑 Request aborted by user.');
        } else {
            console.error('❌ Fetch Error:', error);
            if (isSearchQuery) hideSearchIndicator(indicatorId);
            else hideTypingIndicator(indicatorId);

            const errorDiv = document.createElement('div');
            errorDiv.className = 'message ai';
            
            const errContent = document.createElement('div');
            errContent.innerHTML = '⚠️ تعذر الاتصال بالسيرفر.';
            errorDiv.appendChild(errContent);

            const retryBtn = document.createElement('button');
            retryBtn.style.cssText = 'display: block; margin-top: 8px; background: #d4af37; color: #000; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;';
            retryBtn.innerHTML = '🔄 إعادة المحاولة';
            retryBtn.onclick = () => {
                errorDiv.remove();
                userInput.value = displayMessage;
                handleSendMessage(renderCallbacks);
            };
            errorDiv.appendChild(retryBtn);

            chatArea.appendChild(errorDiv);
            if (!window._isUserScrolledUp) chatArea.scrollTop = chatArea.scrollHeight;
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
    copyBtn.style.cssText = `
        position: absolute;
        top: 10px;
        left: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-secondary);
        border: 1px solid var(--border-glass);
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 5;
    `;
    
    copyBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        <span>نسخ</span>
    `;

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            copyBtn.innerHTML = `<span>تم النسخ ✓</span>`;
            copyBtn.style.color = 'var(--accent-gold)';
            copyBtn.style.borderColor = 'var(--accent-gold)';
            setTimeout(() => {
                copyBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span>نسخ</span>
                `;
                copyBtn.style.color = 'var(--text-secondary)';
                copyBtn.style.borderColor = 'var(--border-glass)';
            }, 2000);
        });
    });

    messageDiv.appendChild(copyBtn);
}

export function saveMessageToCurrentSession(sender, text, fileData = null) {
    const sessionId = getCurrentSessionId();
    let sessions = getStoredSessions();
    if (!sessions[sessionId]) {
        sessions[sessionId] = { title: 'جلسة جديدة', messages: [], pinned: false, lastFile: null };
    }
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

    if (sender === 'assistant') {
        addCopyButtonToMessage(messageDiv, text);
    }

    if (fileData?.downloadUrl) {
        const downloadBtn = document.createElement('a');
        downloadBtn.href = fileData.downloadUrl;
        downloadBtn.download = fileData.name || 'file.xlsx';
        downloadBtn.className = 'alatheer-download-btn';
        
        if (fileData.isGenerated) {
            downloadBtn.innerHTML = `📥 تحميل الملف المُنشأ (${fileData.name || 'file.xlsx'})`;
            downloadBtn.style.cssText = `
                display: inline-block;
                margin-top: 12px;
                background: linear-gradient(135deg, #d4af37, #f5d76e);
                color: #1a1a2e;
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: bold;
                text-decoration: none;
                border: none;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 2px 10px rgba(212, 175, 55, 0.3);
            `;
        } else {
            downloadBtn.innerHTML = `📥 اضغط هنا لتحميل الملف الناتج (${fileData.name || 'file.xlsx'})`;
        }
        messageDiv.appendChild(downloadBtn);
    }

    chatArea.scrollTop = chatArea.scrollHeight;
}

