const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('xpeng_app.html', 'utf8');
assert.equal(fs.readFileSync('checklist.html', 'utf8'), html, 'checklist.html should match xpeng_app.html');
const script = html.match(/<script>\n([\s\S]*?)\n    <\/script>/)[1];
const checklist = JSON.parse(script.match(/const checklist = (\[[\s\S]*?\]);/)[1]);
const addedTask = 'מפתח פיזי לפתיחה ללא חשמל, כרטיס NFC';
assert.ok(checklist.some(item => item.task === addedTask), 'checklist should include the latest spreadsheet row');
const ids = new Set();
checklist.forEach(item => {
    assert.match(item.id, /^check-\d{3}$/, 'checklist item should include a stable id');
    assert.ok(!ids.has(item.id), `duplicate checklist id: ${item.id}`);
    ids.add(item.id);
});

const categoryOrder = ['מרכב הרכב', 'תוכנה', 'תאורה', 'תפעול ושליטה', 'אבזור פנימי', 'אפליקציה', 'אבזור נוסף'];
const sortedChecklist = checklist.slice().sort((a, b) => {
    const aRank = categoryOrder.indexOf(a.category);
    const bRank = categoryOrder.indexOf(b.category);
    const categoryCompare = (aRank < 0 ? categoryOrder.length : aRank) - (bRank < 0 ? categoryOrder.length : bRank);
    return categoryCompare || a.category.localeCompare(b.category, 'he') || a.task.localeCompare(b.task, 'he');
});
const categoryV1Checklist = checklist.filter(item => item.task !== addedTask).sort((a, b) => {
    const aRank = categoryOrder.indexOf(a.category);
    const bRank = categoryOrder.indexOf(b.category);
    const categoryCompare = (aRank < 0 ? categoryOrder.length : aRank) - (bRank < 0 ? categoryOrder.length : bRank);
    return categoryCompare || a.category.localeCompare(b.category, 'he') || a.task.localeCompare(b.task, 'he');
});
const categoryV2Checklist = sortedChecklist;

const oldIndex = checklist.findIndex(item => item.task === 'וו גרירה חשמלי - בדיקה שנכנס ויוצא ויציב, לנסות טיפה להזיז אותו');
const newIndex = sortedChecklist.findIndex(item => item.task === checklist[oldIndex].task);
assert.notEqual(oldIndex, newIndex, 'fixture must cover an item moved by the migration');

function createElements() {
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
    return elements;
}

function runChecklist(storage) {
    const elements = createElements();
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
    return { context, elements };
}

const storage = new Map([
    ['xpeng_checklist_order', 'legacy-order'],
    ['xpeng_checklist_comments', JSON.stringify({ [oldIndex]: 'הערה לפריט וו גרירה' })],
    ['xpeng_checklist', '{}']
]);
let { context, elements } = runChecklist(storage);
context.showItem(newIndex);

assert.equal(
    elements.get('comment-input').value,
    'הערה לפריט וו גרירה',
    'comments should follow their checklist task when ordering is migrated'
);
assert.equal(storage.get('xpeng_checklist_order'), 'id-v1', 'legacy storage should be marked as id-keyed after migration');
assert.equal(
    JSON.parse(storage.get('xpeng_checklist_comments'))[sortedChecklist[newIndex].id],
    'הערה לפריט וו גרירה',
    'legacy index comments should be stored by stable id after migration'
);

const shiftedTask = 'ערכות תיקון וקומפרסור, ערכת כלים (לא לחפש גלגל ספייר כי אין)';
const categoryV1Index = categoryV1Checklist.findIndex(item => item.task === shiftedTask);
const categoryV2Index = sortedChecklist.findIndex(item => item.task === shiftedTask);
assert.notEqual(categoryV1Index, categoryV2Index, 'fixture must cover an item shifted by the new spreadsheet row');

const categoryV1Storage = new Map([
    ['xpeng_checklist_order', 'category-v1'],
    ['xpeng_checklist_comments', JSON.stringify({ [categoryV1Index]: 'הערה שנשמרה לפני הוספת NFC' })],
    ['xpeng_checklist', '{}']
]);
({ context, elements } = runChecklist(categoryV1Storage));
context.showItem(categoryV2Index);

assert.equal(
    elements.get('comment-input').value,
    'הערה שנשמרה לפני הוספת NFC',
    'comments should follow their checklist task when category-v1 ordering is migrated'
);
assert.equal(categoryV1Storage.get('xpeng_checklist_order'), 'id-v1');
assert.equal(
    JSON.parse(categoryV1Storage.get('xpeng_checklist_comments'))[categoryV2Checklist[categoryV2Index].id],
    'הערה שנשמרה לפני הוספת NFC'
);

const idStorage = new Map([
    ['xpeng_checklist_order', 'id-v1'],
    ['xpeng_checklist_comments', JSON.stringify({ [categoryV2Checklist[categoryV2Index].id]: 'הערה לפי מזהה יציב' })],
    ['xpeng_checklist', JSON.stringify({ [categoryV2Checklist[categoryV2Index].id]: 'fail' })]
]);
({ context, elements } = runChecklist(idStorage));
context.showItem(categoryV2Index);

assert.equal(
    elements.get('comment-input').value,
    'הערה לפי מזהה יציב',
    'id-keyed comments should not require future ordering migration'
);

console.log('checklist migration test passed');
