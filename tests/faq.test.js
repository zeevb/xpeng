const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createElement(tagName) {
    return {
        tagName: tagName.toUpperCase(),
        children: [],
        textContent: '',
        appendChild(child) {
            this.children.push(child);
            return child;
        }
    };
}

const context = {
    window: {
        addEventListener() {},
        location: { search: '', pathname: '/faq.html' },
        history: { replaceState() {} }
    },
    document: {
        createElement,
        createTextNode(textContent) { return { textContent }; }
    },
    URLSearchParams
};
context.window.window = context.window;
context.window.document = context.document;
context.window.URLSearchParams = URLSearchParams;

assert.equal(
    fs.readFileSync('faq.html', 'utf8'),
    fs.readFileSync('xpeng_faq.html', 'utf8'),
    'faq.html should match xpeng_faq.html'
);

vm.createContext(context);
vm.runInContext(fs.readFileSync('xpeng_faq_data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('xpeng_faq_app.js', 'utf8'), context);

const data = context.window.XPENG_FAQ_DATA;
const api = context.window.XPENG_FAQ_TEST_API;

assert.ok(data.length > 50, 'FAQ should contain the community source questions');

const ids = new Set();
data.forEach(item => {
    assert.match(item.id, /^faq-[a-z0-9]+$/, 'item should have a stable FAQ id');
    assert.ok(!ids.has(item.id), `duplicate FAQ id: ${item.id}`);
    ids.add(item.id);
    assert.ok(item.category.trim(), 'item should include a category');
    assert.ok(item.question.trim(), 'item should include a question');
    assert.ok(item.answer.trim(), 'item should include an answer');
    assert.ok(Array.isArray(item.keywords), 'item should include keywords');
});

assert.ok(
    data.some(item => api.faqMatches(item, 'טעינה', '')),
    'Hebrew search should match FAQ text'
);
assert.ok(
    data.some(item => api.faqMatches(item, 'carplay', '')),
    'Latin search should be case-insensitive'
);
assert.ok(
    data.some(item => api.faqMatches(item, 'ANDROID AUTO', '')),
    'mixed-case English product terms should match'
);
assert.ok(
    data.some(item => api.faqMatches(item, 'XPILOT', 'XPILOT, LCC, בלימת חירום וחניה')),
    'category filtering should keep matching results in the selected category'
);
assert.equal(
    data.some(item => api.faqMatches(item, 'מחרוזת שלא אמורה להופיע בשאלות', '')),
    false,
    'no-result searches should produce no matches'
);

const container = createElement('div');
api.renderAnswerBlocks(container, '<img src=x onerror=alert(1)>\n\n- **מודגש**');
assert.equal(container.children[0].tagName, 'P');
assert.equal(container.children[0].textContent, '<img src=x onerror=alert(1)>');
assert.equal(container.children[1].tagName, 'UL');
assert.equal(container.children[1].children[0].textContent, 'מודגש');

const deliveryAnswer = data.find(item => item.id === 'faq-1idx0rowna4').answer;
const deliveryContainer = createElement('div');
api.renderAnswerBlocks(deliveryContainer, deliveryAnswer);
const checklistLink = deliveryContainer.children
    .flatMap(block => block.children)
    .find(child => child.tagName === 'A');
assert.ok(checklistLink, 'delivery answer should render a clickable checklist link');
assert.equal(checklistLink.href, 'checklist.html');
assert.equal(checklistLink.textContent, 'צ׳ק־ליסט המסירה האינטראקטיבי');

const unsafeContainer = createElement('div');
api.renderAnswerBlocks(unsafeContainer, '[unsafe](javascript:alert%281%29)');
assert.ok(unsafeContainer.children[0].children.every(child => child.tagName !== 'A'),
    'unsafe link protocols should remain plain text');

console.log('FAQ data and search tests passed');
