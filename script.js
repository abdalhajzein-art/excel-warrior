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

    // 1. تفعيل السايدبار والطبقة الشفافة (Overlay) بإتقان تام
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
            sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [] };
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

    // عرض الجلسات في السايدبار مع ضمان ظهورها وتنسيقها
    function renderSessionsList() {
        if (!sessionsList) return;
        sessionsList.innerHTML = '';
        
        let sessions = getStoredSessions();
        const sessionIds = Object.keys(sessions);

        if (sessionIds.length === 0) return;

        sessionIds.reverse().forEach(sessionId => {
            const session = sessions[sessionId];
            const item = document.createElement('div');
            
            item.className = 'session-item';
            item.style.padding = '10px 14px';
            item.style.margin = '6px 0';
            item.style.borderRadius = '8px';
            item.style.cursor = 'pointer';
            item.style.transition = 'all 0.2s ease';
            item.style.fontSize = '14px';
            item.style.whiteSpace = 'nowrap';
            item.style.overflow = 'hidden';
            item.style.textOverflow = 'ellipsis';
            
            if (sessionId === currentSessionId) {
                item.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                item.style.color = '#fff';
                item.style.fontWeight = 'bold';
                item.style.borderRight = '4px solid #007bff';
            } else {
                item.style.color = '#ccc';
                item.style.backgroundColor = 'transparent';
            }

            item.innerText = session.title || 'جلسة جديدة';

            item.addEventListener('click', () => {
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

            sessionsList.appendChild(item);
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

        appendMessageToDOM('user', message);
        saveMessageToCurrentSession('user', message);

        // تحديث العنوان التلقائي أول رسالة
        let sessions = getStoredSessions();
        if (sessions[currentSessionId] && sessions[currentSessionId].title === 'جلسة جديدة') {
            sessions[currentSessionId].title = message.length > 22 ? message.substring(0, 22) + '...' : message;
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

    // ربط زر الإرسال بالحدث لكي يستجيب عند الضغط عليه
    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendMessage);
    }

    // دعم الإرسال بزر Enter من لوحة المفاتيح
    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    console.log('💎 منصة الأثير تعمل بأعلى أداء واحترافية!');
});
