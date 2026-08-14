const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('xpeng_app.html', 'utf8');
const script = html.match(/<script>\n([\s\S]*?)\n    <\/script>/)[1];
const checklist = JSON.parse(script.match(/const checklist = (\[[\s\S]*?\]);/)[1]);

const categoryOrder = ['מרכב הרכב', 'תוכנה', 'תאורה', 'תפעול ושליטה', 'אבזור פנימי', 'אפליקציה', 'אבזור נוסף'];
const sortedChecklist = checklist.slice().sort((a, b) => {
    const aRank = categoryOrder.indexOf(a.category);
    const bRank = categoryOrder.indexOf(b.category);
    const categoryCompare = (aRank < 0 ? categoryOrder.length : aRank) - (bRank < 0 ? categoryOrder.length : bRank);
    return categoryCompare || a.category.localeCompare(b.category, 'he') || a.task.localeCompare(b.task, 'he');
});

const oldIndex = checklist.findIndex(item => item.task === 'וו גרירה חשמלי - בדיקה שנכנס ויוצא ויציב, לנסות טיפה להזיז אותו');
const newIndex = sortedChecklist.findIndex(item => item.task === checklist[oldIndex].task);
assert.notEqual(oldIndex, newIndex, 'fixture must cover an item moved by the migration');

const elements = new Map();
for (const id of [
    'item-category', 'item-task', 'progress-text', 'header-actions', 'current-idx', 'total-idx',
    'btn-prev', 'btn-next', 'btn-ok', 'btn-fail', 'comment-input', 'checklist-screen',
    'list-screen', 'summary-screen', 'checklist-header', 'checklist-footer', 'sum-total',
    'sum-ok', 'sum-comments', 'sum-fail', 'sum-empty'
]) {
    elements.set(id, {
        textContent: '',
        value: '',
        className: '',
        style: {},
        disabled: false,
        addEventListener() {},
        classList: { add() {} }
    });
}

const storage = new Map([
    ['xpeng_checklist_order', 'legacy-order'],
    ['xpeng_checklist_comments', JSON.stringify({ [oldIndex]: 'הערה לפריט וו גרירה' })],
    ['xpeng_checklist', '{}']
]);
const context = {
    localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key)
    },
    document: {
        getElementById: id => elements.get(id),
        createElement: () => ({})
    },
    confirm: () => true,
    setTimeout,
    console
};
context.window = context;

vm.createContext(context);
vm.runInContext(script, context);
context.showItem(newIndex);

assert.equal(
    elements.get('comment-input').value,
    'הערה לפריט וו גרירה',
    'comments should follow their checklist task when ordering is migrated'
);

console.log('checklist migration test passed');
