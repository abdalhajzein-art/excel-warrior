import { initSessions, createNewSession, clearChat, exportChat, getStoredSessions, getCurrentSessionId } from './sessionManager.js';
import { initFileHandler, resetFile } from './fileHandler.js';
import { initUIController } from './uiController.js';
import { getIsGenerating, updateSendButtonState, handleMainAction, appendMessageToDOM } from './chatEngine.js';
import { stations, resolveStationUrl } from './radioService.js';

document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const exportChatBtn = document.getElementById('exportChatBtn');
    const copyHistoryBtn = document.getElementById('copyHistoryBtn');

    // عناصر راديو الأثير
    const radioTrigger = document.getElementById('radioTrigger');
    const radioDropdown = document.getElementById('radioDropdown');
    const radioLabel = document.getElementById('radioLabel');
    const radioStop = document.getElementById('radioStop');
    const radioModule = radioTrigger ? radioTrigger.closest('.radio-module') : null;

    let radioAudio = new Audio();
    let isDropdownOpen = false;

    // كولباكس للتنسيق المتبادل بين الوحدات
    const callbacks = {
        isGenerating: () => getIsGenerating(), // ⭐ تم إضافة الدالة هنا ليعمل زر الإرفاق بلا أخطاء
        onResetFile: () => resetFile(),
        onUpdateSendState: () => updateSendButtonState(),
        appendMessageToDOM: (sender, text, fileData) => appendMessageToDOM(sender, text, fileData)
    };

    // تهيئة الأنظمة الفرعية
    initUIController(getIsGenerating);
    initFileHandler(callbacks);
    initSessions(callbacks);

    // ربط الأزرار الرئيسية
    if (newChatBtn) newChatBtn.addEventListener('click', () => createNewSession(callbacks));
    if (newSessionBtn) newSessionBtn.addEventListener('click', () => createNewSession(callbacks));
    if (clearChatBtn) clearChatBtn.addEventListener('click', () => clearChat(callbacks));
    if (exportChatBtn) exportChatBtn.addEventListener('click', exportChat);

    if (sendBtn) {
        sendBtn.addEventListener('click', () => handleMainAction(callbacks));
        updateSendButtonState();
    }

    if (userInput) {
        userInput.addEventListener('input', function() {
            if (getIsGenerating()) return;
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            updateSendButtonState();
        });
        
        userInput.addEventListener('keydown', function(e) {
            if (getIsGenerating()) return;
            if (e.key === 'Enter') {
                const isMobile = window.innerWidth <= 768;
                if (isMobile) return;
                if (!e.shiftKey) {
                    e.preventDefault();
                    if (!sendBtn.disabled) {
                        handleMainAction(callbacks);
                    }
                }
            }
        });
    }

    // دالة نسخ سجل الجلسة
    function copySessionHistory() {
        const sessions = getStoredSessions();
        const sessionId = getCurrentSessionId();
        const session = sessions[sessionId];

        if (!session || !session.messages || session.messages.length === 0) {
            navigator.clipboard.writeText("لا يوجد سجل لنسخه.");
            return;
        }

        let output = "";

        session.messages.forEach(msg => {
            const sender = msg.sender === 'user' ? 'Abd' : 'الأثير';
            const timestamp = new Date().toLocaleString('ar-EG', { hour12: false });

            let line = `[${timestamp}] ${sender}:\n${msg.text}\n`;

            if (msg.fileData && msg.fileData.fileName) {
                line += `📎 ملف مرفق: ${msg.fileData.fileName}\n`;
            }

            output += line + "\n";
        });

        navigator.clipboard.writeText(output);

        const btn = document.getElementById('copyHistoryBtn');
        if (btn) {
            const originalHTML = btn.innerHTML;
            const originalWidth = btn.style.width;

            btn.style.width = "90px";
            btn.innerHTML = `<span style="color: var(--accent-gold); font-weight: bold;">تم النسخ ✓</span>`;
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.width = originalWidth;
            }, 2000);
        }
    }

    if (copyHistoryBtn) {
        copyHistoryBtn.addEventListener('click', copySessionHistory);
    }

    // ==========================================
    // ⭐ نظام راديو الأثير FM (النهائي والمربوط مع Service) ⭐
    // ==========================================

    if (radioDropdown) {
        radioDropdown.innerHTML = ''; // تفريغ لتجنب التكرار
        stations.forEach(station => {
            const item = document.createElement('div');
            item.className = 'radio-station-item';
            item.textContent = station.name;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                playStation(station);
            });
            
            radioDropdown.appendChild(item);
        });
    }

    if (radioTrigger && radioDropdown) {
        radioTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            isDropdownOpen = !isDropdownOpen;
            radioDropdown.style.display = isDropdownOpen ? 'flex' : 'none';
        });
    }

    document.addEventListener('click', (e) => {
        if (isDropdownOpen && radioDropdown && !radioTrigger.contains(e.target) && !radioDropdown.contains(e.target)) {
            radioDropdown.style.display = 'none';
            isDropdownOpen = false;
        }
    });

    async function playStation(station) {
        if (radioLabel) {
            radioLabel.textContent = "⏳ جارِ الاتصال...";
            radioLabel.style.color = 'var(--text-secondary)';
        }

        if (radioModule) {
            radioModule.classList.add('playing-active');
        }

        if (radioDropdown) {
            radioDropdown.style.display = 'none';
        }
        isDropdownOpen = false;

        if (radioStop) {
            radioStop.style.display = 'inline-flex';
        }

        // جلب الرابط الفعلي عبر دالة الخدمة المستقلة
        const streamUrl = await resolveStationUrl(station);

        if (!streamUrl) {
            if (radioLabel) {
                radioLabel.textContent = "⚠️ خطأ في الرابط";
                radioLabel.style.color = '#ff6b6b';
            }
            return;
        }

        radioAudio.pause();
        radioAudio.currentTime = 0;
        radioAudio.src = streamUrl;
        
        radioAudio.play().then(() => {
            if (radioLabel) {
                radioLabel.textContent = station.name;
                radioLabel.style.color = 'var(--accent-gold)';
            }
            console.log("▶️ الأثير FM يصدح الآن:", station.name);
        }).catch((error) => {
            console.error("⚠️ خطأ في التشغيل:", error);
            if (radioLabel) {
                radioLabel.textContent = "⚠️ انقر للتشغيل";
                radioLabel.style.color = '#ff6b6b';
            }
        });
    }

    function stopRadio() {
        radioAudio.pause();
        radioAudio.src = "";

        if (radioLabel) {
            radioLabel.textContent = "الأثير FM";
            radioLabel.style.color = '';
        }

        if (radioModule) {
            radioModule.classList.remove('playing-active');
        }

        if (radioStop) {
            radioStop.style.display = 'none';
        }

        console.log("⏹️ تم إيقاف الأثير FM");
    }

    if (radioStop) {
        radioStop.addEventListener('click', (e) => {
            e.stopPropagation();
            stopRadio();
        });
    }
});

