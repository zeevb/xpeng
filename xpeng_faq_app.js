(function () {
    const data = window.XPENG_FAQ_DATA || [];
    const meta = window.XPENG_FAQ_META || {};

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFKC')
            .replace(/[\u0591-\u05C7]/g, '')
            .toLocaleLowerCase('he');
    }

    function searchableText(item) {
        return normalizeText([
            item.category,
            item.question,
            item.answer,
            ...(item.keywords || [])
        ].join(' '));
    }

    function faqMatches(item, query, category) {
        const categoryMatches = !category || item.category === category;
        const normalizedQuery = normalizeText(query).trim();
        return categoryMatches && (!normalizedQuery || searchableText(item).includes(normalizedQuery));
    }

    function categoriesFor(items) {
        return Array.from(new Set(items.map(item => item.category)));
    }

    function cleanMarkdownText(value) {
        return String(value || '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
    }

    function appendTextBlock(container, tagName, text) {
        const element = document.createElement(tagName);
        element.textContent = cleanMarkdownText(text);
        container.appendChild(element);
        return element;
    }

    function renderAnswerBlocks(container, answer) {
        container.textContent = '';
        const lines = String(answer || '').split(/\r?\n/);
        let paragraph = [];
        let list = null;

        function flushParagraph() {
            const text = paragraph.join(' ').trim();
            if (text) appendTextBlock(container, 'p', text);
            paragraph = [];
        }

        function closeList() {
            list = null;
        }

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) {
                flushParagraph();
                closeList();
                return;
            }

            const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
            const unordered = trimmed.match(/^[-*]\s+(.+)$/);
            if (ordered || unordered) {
                flushParagraph();
                const tagName = ordered ? 'ol' : 'ul';
                if (!list || list.tagName.toLowerCase() !== tagName) {
                    list = document.createElement(tagName);
                    container.appendChild(list);
                }
                appendTextBlock(list, 'li', ordered ? ordered[1] : unordered[1]);
                return;
            }

            closeList();
            paragraph.push(trimmed);
        });

        flushParagraph();
    }

    function updateUrl(query, category, openId) {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (category) params.set('category', category);
        if (openId) params.set('open', openId);
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
        window.history.replaceState({}, '', next);
    }

    function resultCountText(count, total) {
        if (count === total) return `${total} שאלות`;
        if (count === 1) return 'שאלה אחת נמצאה';
        return `${count} שאלות נמצאו`;
    }

    function initFaqApp() {
        const els = {
            search: document.getElementById('faq-search'),
            clear: document.getElementById('clear-search'),
            category: document.getElementById('category-select'),
            count: document.getElementById('result-count'),
            list: document.getElementById('faq-list'),
            empty: document.getElementById('empty-state'),
            meta: document.getElementById('faq-meta'),
            disclaimer: document.getElementById('disclaimer-text')
        };

        if (!els.search || !els.category || !els.list) return;

        const params = new URLSearchParams(window.location.search);
        const categories = categoriesFor(data);
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            els.category.appendChild(option);
        });

        els.search.value = params.get('q') || '';
        els.category.value = params.get('category') || '';
        if (els.disclaimer) els.disclaimer.textContent = meta.disclaimer || '';
        if (els.meta) {
            els.meta.textContent = `מקור התוכן: ${meta.source || 'סיכום דיונים בקהילה'} · עדכון אחרון: ${meta.lastReviewed || 'לא צוין'}`;
        }

        function render() {
            const query = els.search.value;
            const category = els.category.value;
            const openId = new URLSearchParams(window.location.search).get('open');
            const filtered = data.filter(item => faqMatches(item, query, category));
            els.list.textContent = '';
            els.count.textContent = resultCountText(filtered.length, data.length);
            els.empty.hidden = filtered.length > 0;
            els.clear.hidden = !query && !category;

            filtered.forEach(item => {
                const details = document.createElement('details');
                details.id = item.id;
                details.open = item.id === openId;

                const summary = document.createElement('summary');
                const categoryLabel = document.createElement('span');
                categoryLabel.className = 'category-label';
                categoryLabel.textContent = item.category;
                const question = document.createElement('span');
                question.className = 'question-text';
                question.textContent = item.question;
                summary.append(categoryLabel, question);

                const answer = document.createElement('div');
                answer.className = 'answer';
                renderAnswerBlocks(answer, item.answer);

                details.append(summary, answer);
                details.addEventListener('toggle', () => {
                    if (details.open) updateUrl(els.search.value, els.category.value, item.id);
                    else if (new URLSearchParams(window.location.search).get('open') === item.id) {
                        updateUrl(els.search.value, els.category.value, '');
                    }
                });
                els.list.appendChild(details);
            });

            if (openId) {
                const opened = document.getElementById(openId);
                if (opened) opened.scrollIntoView({ block: 'nearest' });
            }
            updateUrl(query, category, openId && filtered.some(item => item.id === openId) ? openId : '');
        }

        els.search.addEventListener('input', render);
        els.category.addEventListener('change', render);
        els.clear.addEventListener('click', () => {
            els.search.value = '';
            els.category.value = '';
            render();
            els.search.focus();
        });
        render();
    }

    window.XPENG_FAQ_TEST_API = {
        normalizeText,
        faqMatches,
        categoriesFor,
        renderAnswerBlocks
    };
    window.addEventListener('DOMContentLoaded', initFaqApp);
})();
