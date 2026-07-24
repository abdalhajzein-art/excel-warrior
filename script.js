document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatArea = document.getElementById('chatArea');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const newChatBtn = document.getElementById('newChatBtn');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const sessionsList = document.getElementById('sessionsList');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const exportChatBtn = document.getElementById('exportChatBtn');
    
    const attachBtn = document.getElementById('attachBtn');
    const fileBubbles = document.getElementById('fileBubbles');
    
    let selectedFileObject = null;
    let attachedFileName = null;
    let isFileLoading = false;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx, .xls, .csv, .json, .txt, .docx, .pdf, .png, .jpg, .jpeg';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    let currentSessionId = localStorage.getItem('alatheer_current_session') || generateSessionId();

    if (sidebarToggle && sidebar) {
        const toggleSidebar = (open) => {
            if (open) {
                sidebar.style.transform = 'translateX(0px)';
                sidebar.classList.add('open');
                if (sidebarOverlay) {
                    sidebarOverlay.style.display = 'block';
                    setTimeout(() => sidebarOverlay.style.opacity = '1', 10);
                }
            } else {
                sidebar.style.transform = 'translateX(-100%)';
                sidebar.classList.remove('open');
                if (sidebarOverlay) {
                    sidebarOverlay.style.opacity = '0';
                    setTimeout(() => sidebarOverlay.style.display = 'none', 300);
                }
            }
        };

        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = sidebar.classList.contains('open');
            toggleSidebar(!isOpen);
        });

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
        }
    }

    initSessions();

    function generateSessionId() {
        return 'session_' + Date.now();
    }

    function initSessions() {
        let sessions = getStoredSessions();
        if (!sessions || Object.keys(sessions).length === 0) {
            sessions = {};
            sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [], pinned: false };
            saveSessions(sessions);
        } else if (!sessions[currentSessionId]) {
            currentSessionId = Object.keys(sessions)[0];
            localStorage.setItem('alatheer_current_session', currentSessionId);
        }
        renderSessionsList();
        loadSession(currentSessionId);
    }

    function getStoredSessions() {
        try {
            return JSON.parse(localStorage.getItem('alatheer_sessions') || '{}');
        } catch (e) {
            return {};
        }
    }

    function saveSessions(sessions) {
        localStorage.setItem('alatheer_sessions', JSON.stringify(sessions));
    }

    function renderSessionsList() {
        if (!sessionsList) return;
        sessionsList.innerHTML = '';
        
        let sessions = getStoredSessions();
        
        const sortedSessionIds = Object.keys(sessions).sort((a, b) => {
            const sessionA = sessions[a];
            const sessionB = sessions[b];
            if (sessionA.pinned && !sessionB.pinned) return -1;
            if (!sessionA.pinned && sessionB.pinned) return 1;
            return b.localeCompare(a);
        });

        if (sortedSessionIds.length === 0) return;

        sortedSessionIds.forEach(sessionId => {
            const session = sessions[sessionId];
            const item = document.createElement('div');
            
            item.className = `session-item ${sessionId === currentSessionId ? 'active' : ''}`;
            item.style.cssText = 'padding: 10px 12px; margin-bottom: 8px; border-radius: 8px; cursor: pointer; background: #1a1a1a; border: 1px solid #2a2a2a; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s;';
            
            item.innerHTML = `
                <div class="session-title-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span class="session-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; font-size: 13px; color: #e0e0e0; font-weight: 500;">
                        ${session.pinned ? '📌 ' : ''}${session.title || 'جلسة جديدة'}
                    </span>
                    <div class="session-badges">
                        ${session.pinned ? '<span class="session-badge" style="font-size: 10px; color: #d4af37; background: rgba(212, 175, 55, 0.1); padding: 2px 6px; border-radius: 4px;">مثبت</span>' : ''}
                        ${session.messages && session.messages.length > 0 ? `<span style="font-size: 10px; color: #888; background: #2a2a2a; padding: 2px 6px; border-radius: 4px;">${session.messages.length}</span>` : ''}
                    </div>
                </div>
                <div class="session-actions" style="display: flex; gap: 12px; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;">
                    <button class="session-action-btn pin-btn" title="${session.pinned ? 'إلغاء التثبيت' : 'تثبيت الجلسة'}" style="background:none; border:none; cursor:pointer; font-size:12px; color: #d4af37;">
                        ${session.pinned ? '📍 إلغاء التثبيت' : '📌 تثبيت'}
                    </button>
                    <button class="session-action-btn delete-btn" title="حذف الجلسة" style="background:none; border:none; cursor:pointer; font-size:12px; color: #ff5555;">
                        🗑️ حذف
                    </button>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.closest('.session-actions')) return;
                switchSession(sessionId);
                if (window.innerWidth <= 768 && sidebar) {
                    sidebar.style.transform = 'translateX(-100%)';
                    sidebar.classList.remove('open');
                    if (sidebarOverlay) {
                        sidebarOverlay.style.opacity = '0';
                        setTimeout(() => sidebarOverlay.style.display = 'none', 300);
                    }
                }
            });

            const pinBtn = item.querySelector('.pin-btn');
            if (pinBtn) {
                pinBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    togglePinSession(sessionId);
                });
            }

            const deleteBtn = item.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteSession(sessionId);
                });
            }

            sessionsList.appendChild(item);
        });
    }

    function togglePinSession(sessionId) {
        let sessions = getStoredSessions();
        if (sessions[sessionId]) {
            sessions[sessionId].pinned = !sessions[sessionId].pinned;
            saveSessions(sessions);
            renderSessionsList();
        }
    }

    function deleteSession(sessionId) {
        let sessions = getStoredSessions();
        delete sessions[sessionId];
        
        let remainingIds = Object.keys(sessions);
        if (remainingIds.length === 0) {
            currentSessionId = generateSessionId();
            sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [], pinned: false };
        } else if (sessionId === currentSessionId) {
            currentSessionId = remainingIds[remainingIds.length - 1];
            localStorage.setItem('alatheer_current_session', currentSessionId);
        }

        saveSessions(sessions);
        renderSessionsList();
        loadSession(currentSessionId);
    }

    function switchSession(sessionId) {
        currentSessionId = sessionId;
        localStorage.setItem('alatheer_current_session', sessionId);
        renderSessionsList();
        loadSession(sessionId);
    }

    function loadSession(sessionId) {
        if (!chatArea) return;
        chatArea.innerHTML = '';
        const sessions = getStoredSessions();
        const session = sessions[sessionId];

        if (session && session.messages && session.messages.length > 0) {
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            session.messages.forEach(msg => {
                appendMessageToDOM(msg.sender, msg.text, false, msg.fileData);
            });
        } else {
            if (welcomeScreen) welcomeScreen.style.display = 'flex';
        }
    }

    function updateSendButtonState() {
        if (!sendBtn) return;
        const hasText = userInput && userInput.value.trim().length > 0;
        const hasFileReady = selectedFileObject !== null && !isFileLoading;

        if (hasText || hasFileReady) {
            sendBtn.disabled = false;
        } else {
            sendBtn.disabled = true;
        }
    }

    if (attachBtn) {
        attachBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        isFileLoading = true;
        updateSendButtonState();

        if (fileBubbles) {
            fileBubbles.innerHTML = `
                <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; background: rgba(212, 175, 55, 0.05); color: #d4af37; padding: 6px 12px; border-radius: 6px; border: 1px dashed rgba(212, 175, 55, 0.3); opacity: 0.6; margin-bottom: 6px;">
                    <span>جاري تحميل الملف من الذاكرة...</span>
                </div>
            `;
        }

        try {
            selectedFileObject = file;
            attachedFileName = file.name;
            
            await new Promise(resolve => setTimeout(resolve, 400));

            isFileLoading = false;
            updateSendButtonState();

            if (fileBubbles) {
                fileBubbles.innerHTML = `
                    <div style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; background: rgba(212, 175, 55, 0.15); color: #d4af37; padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(212, 175, 55, 0.4); opacity: 1; margin-bottom: 6px;">
                        <span>📎 ${file.name}</span>
                        <button type="button" id="removeFileBtn" style="background:none; border:none; color: #ff5555; cursor:pointer; font-weight:bold; font-size:14px; padding:0; line-height:1;" title="إزالة الملف">&times;</button>
                    </div>
                `;

                const removeFileBtn = document.getElementById('removeFileBtn');
                if (removeFileBtn) {
                    removeFileBtn.addEventListener('click', () => {
                        selectedFileObject = null;
                        attachedFileName = null;
                        isFileLoading = false;
                        fileBubbles.innerHTML = '';
                        fileInput.value = '';
                        updateSendButtonState();
                    });
                }
            }
        } catch (err) {
            console.error("Error processing file upload:", err);
            isFileLoading = false;
            selectedFileObject = null;
            attachedFileName = null;
            if (fileBubbles) {
                fileBubbles.innerHTML = '<span style="color:#ff5555; font-size:12px; padding: 4px;">⚠️ فشل تحميل الملف</span>';
            }
            updateSendButtonState();
        }
    });

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64String = event.target.result.split(',')[1];
                resolve([{
                    fileName: file.name,
                    fileBase64: base64String,
                    size: file.size,
                    type: file.type
                }]);
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    }

    function formatReply(text) {
        if (!text) return '';
        let formatted = text;
        
        formatted = formatted.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre style="background: #1a1a1a; padding: 12px; border-radius: 8px; overflow-x: auto; border: 1px solid #333; direction: ltr; text-align: left;"><code style="color: #e0e0e0; font-family: monospace;">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        });
        
        formatted = formatted.replace(/^### (.*?)$/gm, '<h3 style="margin: 12px 0 6px 0; color: #d4af37;">$1</h3>');
        formatted = formatted.replace(/^## (.*?)$/gm, '<h2 style="margin: 16px 0 8px 0; color: #d4af37;">$1</h2>');
        formatted = formatted.replace(/^# (.*?)$/gm, '<h1 style="margin: 20px 0 10px 0; color: #d4af37;">$1</h1>');
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/^- (.*?)$/gm, '• $1');
        formatted = formatted.replace(/^\d+\. (.*?)$/gm, (match, p1) => {
            const num = match.match(/^\d+/)[0];
            return `${num}. ${p1}`;
        });
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }

    function showTypingIndicator() {
        if (!chatArea) return null;
        const indicatorId = 'typing_' + Date.now();
        const div = document.createElement('div');
        div.id = indicatorId;
        div.className = 'message ai typing-indicator';
        div.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 12px 16px;';
        div.innerHTML = `
            <span style="background: #444; width: 8px; height: 8px; border-radius: 50%; display: inline-block; animation: typingBounce 1.4s infinite both; animation-delay: 0s;"></span>
            <span style="background: #444; width: 8px; height: 8px; border-radius: 50%; display: inline-block; animation: typingBounce 1.4s infinite both; animation-delay: 0.2s;"></span>
            <span style="background: #444; width: 8px; height: 8px; border-radius: 50%; display: inline-block; animation: typingBounce 1.4s infinite both; animation-delay: 0.4s;"></span>
        `;
        chatArea.appendChild(div);
        chatArea.scrollTop = chatArea.scrollHeight;
        
        if (!document.getElementById('typingStyle')) {
            const style = document.createElement('style');
            style.id = 'typingStyle';
            style.textContent = `
                @keyframes typingBounce {
                    0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
                    40% { transform: scale(1.2); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        return indicatorId;
    }

    function hideTypingIndicator(indicatorId) {
        if (!indicatorId) return;
        const el = document.getElementById(indicatorId);
        if (el) el.remove();
    }

    function clearChat() {
        if (!confirm('🗑️ هل تريد مسح جميع رسائل هذه الجلسة؟')) return;
        let sessions = getStoredSessions();
        if (sessions[currentSessionId]) {
            sessions[currentSessionId].messages = [];
            saveSessions(sessions);
            loadSession(currentSessionId);
            if (welcomeScreen) welcomeScreen.style.display = 'flex';
            renderSessionsList();
        }
    }

    function exportChat() {
        const sessions = getStoredSessions();
        const session = sessions[currentSessionId];
        if (!session || !session.messages || session.messages.length === 0) {
            alert('⚠️ لا توجد رسائل لتصديرها.');
            return;
        }
        const text = session.messages.map(m => {
            const sender = m.sender === 'user' ? '👤 المستخدم' : '🤖 الأثير';
            return `[${sender}]: ${m.text}`;
        }).join('\n\n');
        
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${session.title || 'session'}_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);
    if (exportChatBtn) exportChatBtn.addEventListener('click', exportChat);

    async function handleSendMessage() {
        if (!userInput) return;
        const message = userInput.value.trim();
        const currentFileToProcess = selectedFileObject;
        const currentFileName = attachedFileName;

        if (!message && !currentFileToProcess) return;

        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }

        let displayMessage = message || "";
        let payloadExcel = null;
        let fileDisplayName = null;

        if (currentFileToProcess) {
            try {
                payloadExcel = await readFileAsBase64(currentFileToProcess);
                fileDisplayName = currentFileName;
            } catch (err) {
                console.error("❌ Error reading file:", err);
                appendMessageToDOM('assistant', '⚠️ تعذر قراءة الملف. حاول مرة أخرى.');
                return;
            }
        }

        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user';
        
        const textSpan = document.createElement('div');
        textSpan.innerText = displayMessage || '📎 ملف مرفق';
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
        
        saveMessageToCurrentSession('user', displayMessage || '📎 ملف مرفق', {
            fileName: fileDisplayName,
            fileData: payloadExcel
        });

        let sessions = getStoredSessions();
        if (sessions[currentSessionId] && sessions[currentSessionId].title === 'جلسة جديدة') {
            sessions[currentSessionId].title = displayMessage.length > 20 ? displayMessage.substring(0, 20) + '...' : displayMessage || 'ملف مرفق';
            saveSessions(sessions);
            renderSessionsList();
        }

        userInput.value = '';
        userInput.style.height = 'auto';
        selectedFileObject = null;
        attachedFileName = null;
        isFileLoading = false;
        fileInput.value = '';
        if (fileBubbles) fileBubbles.innerHTML = '';
        updateSendButtonState();

        const typingId = showTypingIndicator();

        try {
            const requestPayload = { 
                message: displayMessage || "📎 ملف مرفق", 
                excelJSON: payloadExcel, 
                sessionId: currentSessionId 
            };

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });

            const data = await response.json();
            hideTypingIndicator(typingId);

            if (data && data.reply) {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message ai';
                msgDiv.innerHTML = formatReply(data.reply);
                chatArea.appendChild(msgDiv);
                
                let savedFileData = null;
                if (data.fileBase64 && chatArea) {
                    const downloadBtn = document.createElement('a');
                    downloadBtn.href = `data:application/octet-stream;base64,${data.fileBase64}`;
                    downloadBtn.download = data.fileName || 'file.xlsx';
                    downloadBtn.innerText = '📥 اضغط هنا لتحميل الملف الناتج';
                    downloadBtn.style.cssText = 'display: inline-block; margin-top: 8px; color: #d4af37; text-decoration: underline; font-weight: bold; cursor: pointer;';
                    chatArea.appendChild(downloadBtn);
                    chatArea.scrollTop = chatArea.scrollHeight;
                    
                    savedFileData = {
                        base64: data.fileBase64,
                        name: data.fileName || 'file.xlsx'
                    };
                }

                saveMessageToCurrentSession('assistant', data.reply, savedFileData);
            } else {
                appendMessageToDOM('assistant', '⚠️ حدث خطأ في استجابة السيرفر.');
            }
        } catch (error) {
            console.error('❌ Fetch Error:', error);
            hideTypingIndicator(typingId);
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message ai';
            errorDiv.innerHTML = `
                ⚠️ تعذر الاتصال بالسيرفر.
                <button onclick="location.reload()" style="display: block; margin-top: 8px; background: #d4af37; color: #000; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">🔄 إعادة المحاولة</button>
            `;
            chatArea.appendChild(errorDiv);
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    }

    function saveMessageToCurrentSession(sender, text, fileData = null) {
        let sessions = getStoredSessions();
        if (!sessions[currentSessionId]) {
            sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [], pinned: false };
        }
        sessions[currentSessionId].messages.push({ sender, text, fileData });
        saveSessions(sessions);
    }

    function appendMessageToDOM(sender, text, isLoading = false, fileData = null) {
        if (!chatArea) return null;
        const messageDiv = document.createElement('div');
        const messageId = isLoading ? 'loading_' + Date.now() : 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        messageDiv.id = messageId;
        
        messageDiv.className = `message ${sender === 'user' ? 'user' : 'ai'}`;
        messageDiv.innerHTML = formatReply(text);
        chatArea.appendChild(messageDiv);

        if (fileData && fileData.base64) {
            const downloadBtn = document.createElement('a');
            downloadBtn.href = `data:application/octet-stream;base64,${fileData.base64}`;
            downloadBtn.download = fileData.name || 'file.xlsx';
            downloadBtn.innerText = '📥 اضغط هنا لتحميل الملف الناتج';
            downloadBtn.style.cssText = 'display: inline-block; margin-top: 8px; color: #d4af37; text-decoration: underline; font-weight: bold; cursor: pointer;';
            chatArea.appendChild(downloadBtn);
        }

        chatArea.scrollTop = chatArea.scrollHeight;
        return messageId;
    }

    const createNewSession = () => {
        currentSessionId = generateSessionId();
        localStorage.setItem('alatheer_current_session', currentSessionId);
        let sessions = getStoredSessions();
        sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [], pinned: false };
        saveSessions(sessions);
        renderSessionsList();
        loadSession(currentSessionId);
    };

    if (newChatBtn) newChatBtn.addEventListener('click', createNewSession);
    if (newSessionBtn) newSessionBtn.addEventListener('click', createNewSession);

    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendMessage);
        updateSendButtonState();
    }

    if (userInput) {
        userInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            updateSendButtonState();
        });
        
        userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const isMobile = window.innerWidth <= 768;
                if (!isMobile && !e.shiftKey) {
                    e.preventDefault();
                    if (!sendBtn.disabled) {
                        handleSendMessage();
                    }
                }
            }
        });
    }
});

