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

    // إدارة حالة الجلسات
    let currentSessionId = localStorage.getItem('alatheer_current_session') || generateSessionId();
    
    // تفعيل السايدبار
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            const isOpen = sidebar.style.transform === 'translateX(0px)' || sidebar.classList.contains('open');
            if (isOpen) {
                sidebar.style.transform = 'translateX(-100%)';
                sidebar.classList.remove('open');
                if (sidebarOverlay) { sidebarOverlay.style.display = 'none'; sidebarOverlay.style.opacity = '0'; }
            } else {
                sidebar.style.transform = 'translateX(0px)';
                sidebar.classList.add('open');
                if (sidebarOverlay) { sidebarOverlay.style.display = 'block'; sidebarOverlay.style.opacity = '1'; }
            }
        });

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                sidebar.style.transform = 'translateX(-100%)';
                sidebar.classList.remove('open');
                sidebarOverlay.style.display = 'none';
                sidebarOverlay.style.opacity = '0';
            });
        }
    }

    // تهيئة الجلسات عند التحميل
    initSessions();

    function generateSessionId() {
        return 'session_' + Date.now();
    }

    function initSessions() {
        let sessions = getStoredSessions();
        if (!sessions[currentSessionId]) {
            sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [] };
            saveSessions(sessions);
        }
        renderSessionsList();
        loadSession(currentSessionId);
    }

    function getStoredSessions() {
        return JSON.parse(localStorage.getItem('alatheer_sessions') || '{}');
    }

    function saveSessions(sessions) {
        localStorage.setItem('alatheer_sessions', JSON.stringify(sessions));
    }

    // عرض قائمة الجلسات في السايدبار بشكل أنيق
    function renderSessionsList() {
        if (!sessionsList) return;
        sessionsList.innerHTML = '';
        const sessions = getStoredSessions();

        Object.keys(sessions).reverse().forEach(sessionId => {
            const session = sessions[sessionId];
            const btn = document.createElement('div');
            btn.className = 'session-item';
            if (sessionId === currentSessionId) {
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                btn.style.borderRight = '3px solid #007bff';
            }
            
            btn.style.padding = '10px 12px';
            btn.style.margin = '5px 0';
            btn.style.borderRadius = '6px';
            btn.style.cursor = 'pointer';
            btn.style.color = '#fff';
            btn.style.fontSize = '14px';
            btn.style.whiteSpace = 'nowrap';
            btn.style.overflow = 'hidden';
            btn.style.textOverflow = 'ellipsis';
            btn.innerText = session.title || 'جلسة جديدة';

            btn.addEventListener('click', () => {
                switchSession(sessionId);
                if (window.innerWidth <= 768 && sidebar) {
                    sidebar.style.transform = 'translateX(-100%)';
                    if (sidebarOverlay) sidebarOverlay.style.display = 'none';
                }
            });

            sessionsList.appendChild(btn);
        });
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
                appendMessageToDOM(msg.sender, msg.text);
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

        // إضافة رسالة المستخدم للواجهة والتخزين
        appendMessageToDOM('user', message);
        saveMessageToCurrentSession('user', message);

        // تحديث عنوان الجلسة بناءً على أول رسالة إذا كانت جديدة
        let sessions = getStoredSessions();
        if (sessions[currentSessionId].title === 'جلسة جديدة') {
            sessions[currentSessionId].title = message.length > 25 ? message.substring(0, 25) + '...' : message;
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
                saveMessageToCurrentSession('assistant', data.reply);
            } else {
                appendMessageToDOM('assistant', '⚠️ حدث خطأ في استجابة السيرفر.');
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            removeMessageFromDOM(loadingId);
            appendMessageToDOM('assistant', '⚠️ تعذر الاتصال بالسيرفر.');
        }
    }

    function saveMessageToCurrentSession(sender, text) {
        let sessions = getStoredSessions();
        if (!sessions[currentSessionId]) {
            sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [] };
        }
        sessions[currentSessionId].messages.push({ sender, text });
        saveSessions(sessions);
    }

    function appendMessageToDOM(sender, text, isLoading = false) {
        const messageDiv = document.createElement('div');
        const messageId = isLoading ? 'loading_' + Date.now() : 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        messageDiv.id = messageId;
        
        messageDiv.style.margin = '10px 0';
        messageDiv.style.padding = '12px 16px';
        messageDiv.style.borderRadius = '8px';
        messageDiv.style.maxWidth = '80%';
        messageDiv.style.wordBreak = 'break-word';
        messageDiv.style.whiteSpace = 'pre-wrap';
        
        if (sender === 'user') {
            messageDiv.style.backgroundColor = '#007bff';
            messageDiv.style.color = '#fff';
            messageDiv.style.marginLeft = 'auto';
        } else {
            messageDiv.style.backgroundColor = '#f1f1f1';
            messageDiv.style.color = '#333';
            messageDiv.style.marginRight = 'auto';
        }

        messageDiv.innerText = text;
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight;

        return messageId;
    }

    function removeMessageFromDOM(id) {
        if (!id) return;
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // بدء جلسة جديدة نظيفة
    const createNewSession = () => {
        currentSessionId = generateSessionId();
        localStorage.setItem('alatheer_current_session', currentSessionId);
        
        let sessions = getStoredSessions();
        sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [] };
        saveSessions(sessions);

        renderSessionsList();
        loadSession(currentSessionId);
    };

    if (newChatBtn) newChatBtn.addEventListener('click', createNewSession);
    if (newSessionBtn) newSessionBtn.addEventListener('click', createNewSession);

    console.log('🌟 منصة الأثير تعمل بإدارة جلسات احترافية متكاملة!');
});
