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
    
    // 2️⃣ مصحح الأثير الذكي للماركداون (معدل لمنع الأعمدة الوهمية الفارغة جذرياً)
    formatted = formatted.replace(/\|{2,}/g, '|'); // إزالة الأنابيب المزدوجة
    
    formatted = formatted.replace(/(?:^|\n)([^\n]*\|[^\n]*)\n([-\s:|]+)\n((?:[^\n]*\|[^\n]*(?:\n|$))*)/g, (match, header, sep, body) => {
        if (!/^[- \t:|]+$/.test(sep) || !sep.includes('-')) return match;
        
        // تنظيف الهيدر وتصفية أي خلايا فارغة تماماً من الأطراف
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
            
            // مطابقة عدد الخلايا مع الهيدر تماماً لمنع اختلال الجدول
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

    // 4️⃣ الاعتماد على marked لمعالجة الـ Markdown
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

    // 5️⃣ الهيكل الهندسي العضوي للجدول (نظيف، بدون ستايلات مضمنة)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = formatted;

    const tables = tempDiv.querySelectorAll('table');
    tables.forEach((table) => {
        // الحاوية الخارجية الشفافة
        const wrapper = document.createElement('div');
        wrapper.className = 'alatheer-table-wrapper';
        
        // الزر العائم (يتحكم فيه الـ CSS بالكامل)
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
            
            // تأثير النجاح
            copyBtn.innerHTML = '✓ تم النسخ';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.innerHTML = '📋 نسخ';
                copyBtn.classList.remove('copied');
            }, 2000);
        };

        // حاوية السكرول المخفية
        const scrollArea = document.createElement('div');
        scrollArea.className = 'alatheer-table-scroll';
        
        // تجميع القطع المعمارية
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

