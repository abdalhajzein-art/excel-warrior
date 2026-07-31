/**
 * js/uiController.js – Alatheer UI Controller & Formatter (Final Edition)
 */

export function initUIController(getGeneratingStatus, onFileSelected) {
    const chatArea = document.getElementById('chatArea');
    
    if (chatArea) {
        let lastScrollTop = chatArea.scrollTop;

        chatArea.addEventListener('scroll', () => {
            if (!getGeneratingStatus()) return;
            
            const currentScrollTop = chatArea.scrollTop;
            
            if (currentScrollTop < lastScrollTop - 5) {
                window._isUserScrolledUp = true;
            } else {
                const threshold = 150;
                const isAtBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight <= threshold;
                if (isAtBottom) {
                    window._isUserScrolledUp = false;
                }
            }
            
            lastScrollTop = currentScrollTop;
        });
    }

    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

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
}

export function formatReply(text) {
    if (!text) return '';
    let formatted = text;
    
    // 1️⃣ استخراج الـ Code Blocks وتحويلها بأمان
    formatted = formatted.replace(/```([\s\S]*?)```/g, (match, code) => {
        return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    });
    
    // 2️⃣ مصحح الأثير الذكي للماركداون
    formatted = formatted.replace(/\|{2,}/g, '|');
    
    formatted = formatted.replace(/(?:^|\n)([^\n]*\|[^\n]*)\n([-\s:|]+)\n((?:[^\n]*\|[^\n]*(?:\n|$))*)/g, (match, header, sep, body) => {
        if (!/^[- \t:|]+$/.test(sep) || !sep.includes('-')) return match;
        
        let rawHeaderCells = header.trim().split('|').map(c => c.trim());
        if (rawHeaderCells[0] === '') rawHeaderCells.shift();
        if (rawHeaderCells[rawHeaderCells.length - 1] === '') rawHeaderCells.pop();
            
        const cleanHeaderStr = '| ' + rawHeaderCells.join(' | ') + ' |';
        const colCount = rawHeaderCells.length;
        const standardSep = '|' + Array(colCount).fill('---').join('|') + '|';
        
        const bLines = body.trim().split('\n').map(line => {
            let l = line.trim();
            if (!l) return '';
            let rowCells = l.split('|').map(c => c.trim());
            if (rowCells[0] === '') rowCells.shift();
            if (rowCells[rowCells.length - 1] === '') rowCells.pop();
            
            while (rowCells.length < colCount) rowCells.push('');
            if (rowCells.length > colCount) rowCells = rowCells.slice(0, colCount);
            
            return '| ' + rowCells.join(' | ') + ' |';
        }).filter(l => l !== '').join('\n');
        
        return '\n' + cleanHeaderStr + '\n' + standardSep + '\n' + bLines + '\n';
    });

    // 3️⃣ روابط التحميل والروابط الخارجية
    formatted = formatted.replace(/\[(.*?)\]\((data:[^)]+)\)/g, (match, label, url) => {
        return `<a href="${url}" download class="alatheer-download-btn">${label}</a>`;
    });

    formatted = formatted.replace(/\[(.*?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" style="color: #d4af37; text-decoration: underline; font-weight: bold;">$1</a>');

    // 4️⃣ الاعتماد على marked لتحويل الـ Markdown
    if (typeof marked !== 'undefined') {
        formatted = marked.parse(formatted);
    } else {
        formatted = formatted.replace(/^### (.*?)$/gm, '<h3 style="margin: 12px 0 6px 0; color: #d4af37;">$1</h3>');
        formatted = formatted.replace(/^## (.*?)$/gm, '<h2 style="margin: 16px 0 8px 0; color: #d4af37;">$2</h2>');
        formatted = formatted.replace(/^# (.*?)$/gm, '<h1 style="margin: 20px 0 10px 0; color: #d4af37;">$1</h1>');
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/^- (.*?)$/gm, '• $1');
        formatted = formatted.replace(/\n/g, '<br>');
    }

    // 5️⃣ الهيكل الهندسي العضوي للجدول
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = formatted;

    const tables = tempDiv.querySelectorAll('table');
    tables.forEach((table) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'alatheer-table-wrapper';
        
        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '📋 نسخ';
        copyBtn.className = 'floating-copy-btn';
        copyBtn.title = 'نسخ بيانات الجدول';
        
        copyBtn.onclick = () => {
            let csvText = [];
            for (let row of table.rows) {
                let rowData = [];
                for (let cell of row.cells) rowData.push(cell.innerText.trim());
                csvText.push(rowData.join('\t'));
            }
            navigator.clipboard.writeText(csvText.join('\n'));
            
            copyBtn.innerHTML = '✓ تم النسخ';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.innerHTML = '📋 نسخ';
                copyBtn.classList.remove('copied');
            }, 2000);
        };

        const scrollArea = document.createElement('div');
        scrollArea.className = 'alatheer-table-scroll';
        
        table.parentNode.insertBefore(wrapper, table);
        scrollArea.appendChild(table);
        wrapper.appendChild(copyBtn);
        wrapper.appendChild(scrollArea);
    });

    return tempDiv.innerHTML;
}

export async function streamTextEffect(messageDiv, fullText, speed = 25, getGeneratingStatus) {
    const chatArea = document.getElementById('chatArea');

    const words = fullText.split(/(\s+)/);
    let currentText = "";

    return new Promise((resolve) => {
        let index = 0;

        function typeNextWord() {
            if (!getGeneratingStatus()) {
                resolve(false); 
                return;
            }

            if (index < words.length) {
                let batchCount = Math.min(2, words.length - index); 
                for (let i = 0; i < batchCount; i++) {
                    currentText += words[index++];
                }

                messageDiv.innerHTML = formatReply(currentText);
                
                if (chatArea && !window._isUserScrolledUp) {
                    chatArea.scrollTop = chatArea.scrollHeight;
                }
                
                setTimeout(typeNextWord, speed);
            } else {
                messageDiv.innerHTML = formatReply(fullText);
                if (chatArea && !window._isUserScrolledUp) {
                    chatArea.scrollTop = chatArea.scrollHeight;
                }
                resolve(true);
            }
        }
        
        typeNextWord();
    });
}

export function showTypingIndicator() {
    const chatArea = document.getElementById('chatArea');
    if (!chatArea) return null;
    const indicatorId = 'typing_' + Date.now();
    const div = document.createElement('div');
    div.id = indicatorId;
    div.className = 'message ai typing-indicator';
    div.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 12px 16px; margin-bottom: 12px;';
    div.innerHTML = `
        <span style="background: #d4af37; width: 8px; height: 8px; border-radius: 50%; display: inline-block; animation: typingBounce 1.4s infinite both; animation-delay: 0s;"></span>
        <span style="background: #d4af37; width: 8px; height: 8px; border-radius: 50%; display: inline-block; animation: typingBounce 1.4s infinite both; animation-delay: 0.2s;"></span>
        <span style="background: #d4af37; width: 8px; height: 8px; border-radius: 50%; display: inline-block; animation: typingBounce 1.4s infinite both; animation-delay: 0.4s;"></span>
    `;
    chatArea.appendChild(div);
    if (!window._isUserScrolledUp && chatArea) {
        chatArea.scrollTop = chatArea.scrollHeight;
    }
    
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

export function hideTypingIndicator(indicatorId) {
    if (!indicatorId) return;
    const el = document.getElementById(indicatorId);
    if (el) el.remove();
}

export function showSearchIndicator() {
    const chatArea = document.getElementById('chatArea');
    if (!chatArea) return null;
    const searchId = 'search_badge_' + Date.now();
    const div = document.createElement('div');
    div.id = searchId;
    div.className = 'message ai search-indicator-badge';
    div.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        margin-bottom: 12px;
        background: rgba(212, 175, 55, 0.1);
        border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 20px;
        color: #d4af37;
        font-size: 13px;
        font-family: 'Cairo', sans-serif;
        box-shadow: 0 0 15px rgba(212, 175, 55, 0.15);
    `;
    div.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 2s linear infinite;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span>جاري استقراء شبكة الأثير الحية...</span>
    `;
    chatArea.appendChild(div);
    if (!window._isUserScrolledUp && chatArea) {
        chatArea.scrollTop = chatArea.scrollHeight;
    }
    return searchId;
}

export function hideSearchIndicator(searchId) {
    if (!searchId) return;
    const el = document.getElementById(searchId);
    if (el) el.remove();
}

