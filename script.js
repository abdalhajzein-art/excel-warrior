document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatArea = document.getElementById('chatArea');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const newChatBtn = document.getElementById('newChatBtn');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const sessionsList = document.getElementById('sessionsList');
    
    // عناصر السايدبار
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    // إدارة الجلسات
    let currentSessionId = localStorage.getItem('alatheer_current_session') || generateSessionId();

    // 1. تفعيل السايدبار والطبقة الشفافة (Overlay)
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
            sidebarOverlay.addEventListener('click', () => {
                toggleSidebar(false);
            });
        }
    }

    // تهيئة الجلسات
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

    // عرض الجلسات في السايدبار مع تفعيل الحذف، التثبيت، والتحكم الكامل
    function renderSessionsList() {
        if (!sessionsList) return;
        sessionsList.innerHTML = '';
        
        let sessions = getStoredSessions();
        
        // ترتيب الجلسات: المثبتة أولاً، ثم الحديثة
        const sortedSessionIds = Object.keys(sessions).sort((a, b) => {
            const sessionA = sessions[a];
            const sessionB = sessions[b];
            if (sessionA.pinned && !sessionB.pinned) return -1;
            if (!sessionA.pinned && sessionB.pinned) return 1;
            return b.localeCompare(a); // الأحدث أولاً
        });

        if (sortedSessionIds.length === 0) return;

        sortedSessionIds.forEach(sessionId => {
            const session = sessions[sessionId];
            const item = document.createElement('div');
            
            item.className = `session-item ${sessionId === currentSessionId ? 'active' : ''}`;
            
            // تصميم العنصر مع دعم الأيقونات وأزرار الإجراءات
            item.innerHTML = `
                <div class="session-title-row">
                    <span class="session-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">
                        ${session.pinned ? '📌 ' : ''}${session.title || 'جلسة جديدة'}
                    </span>
                    <div class="session-badges">
                        ${session.pinned ? '<span class="session-badge">مثبت</span>' : ''}
                    </div>
                </div>
                <div class="session-actions">
                    <button class="session-action-btn pin-btn" title="${session.pinned ? 'إلغاء التثبيت' : 'تثبيت الجلسة'}">
                        ${session.pinned ? '📍' : '📌'}
                    </button>
                    <button class="session-action-btn delete-btn" title="حذف الجلسة">🗑️</button>
                </div>
            `;

            // حدث النقر لاختيار الجلسة
            item.addEventListener('click', (e) => {
                // منع التفعيل إذا ضغط المستخدم على أزرار الإجراءات الداخلية
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

            // تفعيل زر التثبيت (Pin)
            const pinBtn = item.querySelector('.pin-btn');
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePinSession(sessionId);
            });

            // تفعيل زر الحذف (Delete)
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSession(sessionId);
            });

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
            // إذا تم حذف كل الجلسات، أنشئ جلسة جديدة تلقائياً
            currentSessionId = generateSessionId();
            sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [], pinned: false };
        } else if (sessionId === currentSessionId) {
            // إذا حذف المستخدم الجلسة الحالية، انتقل لأول جلسة متبقية
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

    async function handleSendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }

        appendMessageToDOM('user', message);
        saveMessageToCurrentSession('user', message);

        // تحديث العنوان التلقائي لأول رسالة في الجلسة
        let sessions = getStoredSessions();
        if (sessions[currentSessionId] && sessions[currentSessionId].title === 'جلسة جديدة') {
            sessions[currentSessionId].title = message.length > 20 ? message.substring(0, 20) + '...' : message;
            saveSessions(sessions);
            renderSessionsList();
        }

        userInput.value = '';
        userInput.style.height = 'auto';

        const loadingId = appendMessageToDOM('assistant', 'جاري المعالجة... ⏳', true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, sessionId: currentSessionId })
            });

            const data = await response.json();
            removeMessageFromDOM(loadingId);

            if (data && data.reply) {
                appendMessageToDOM('assistant', data.reply);
                
                let savedFileData = null;
                if (data.fileBase64) {
                    const downloadBtn = document.createElement('a');
                    downloadBtn.href = `data:application/octet-stream;base64,${data.fileBase64}`;
                    downloadBtn.download = data.fileName || 'file.xlsx';
                    downloadBtn.innerText = '📥 اضغط هنا لتحميل الملف الناتج';
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
            console.error('Fetch Error:', error);
            removeMessageFromDOM(loadingId);
            appendMessageToDOM('assistant', '⚠️ تعذر الاتصال بالسيرفر.');
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
        const messageDiv = document.createElement('div');
        const messageId = isLoading ? 'loading_' + Date.now() : 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        messageDiv.id = messageId;
        
        messageDiv.className = `message ${sender === 'user' ? 'user' : 'ai'}`;
        messageDiv.innerText = text;
        chatArea.appendChild(messageDiv);

        if (fileData) {
            const downloadBtn = document.createElement('a');
            downloadBtn.href = `data:application/octet-stream;base64,${fileData.base64}`;
            downloadBtn.download = fileData.name;
            downloadBtn.innerText = '📥 اضغط هنا لتحميل الملف الناتج';
            chatArea.appendChild(downloadBtn);
        }

        chatArea.scrollTop = chatArea.scrollHeight;
        return messageId;
    }

    function removeMessageFromDOM(id) {
        if (!id) return;
        const el = document.getElementById(id);
        if (el) el.remove();
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
    }

    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    console.log('💎 منصة الأثير تعمل بكامل ميزات الجلسات، الحذف، والتثبيت بنجاح!');
});
