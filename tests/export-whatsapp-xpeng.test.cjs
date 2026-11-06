const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(`${__dirname}/../scripts/export-whatsapp-xpeng.browser.js`, 'utf8');

// Execute the actual browser script with synthetic chat data. No WhatsApp
// connection, account information, filesystem exports or external writes.
async function simulate({ stalled = false, failExtraction = false, previousExports = {} } = {}) {
  let clock = 0, selected = null, downloads = [], currentPayload;
  let calls = 0;
  class Clock extends Date {
    static now() { clock += 10000; return clock; }
  }
  const contact = { name: 'Dana Example', pushname: 'דנה דוגמה' };
  const model = {
    id: { toString: () => 'false_GROUP_972501234567@c.us' },
    senderObj: contact, type: 'chat', t: 1700000000,
    body: 'Dana Example דנה דוגמה phone +972 50-123-4567 email dana@example.com https://example.org/private?user=555 G6 charging 80%'
  };
  const scroller = { scrollTop: 0, scrollHeight: 300, dispatchEvent() {}, querySelectorAll: () => [] };
  const browser = vm.createContext({
    window: {}, Map, Set, Date: Clock, Event: class {},
    setTimeout: () => 0,
    Blob: class { constructor(parts) { currentPayload = JSON.parse(parts[0]); } },
    URL: { createObjectURL: () => 'blob:local', revokeObjectURL() {} },
    document: {
      querySelector: () => scroller,
      createElement: () => ({ click() {} })
    },
    require: () => ({
      Chat: { get: (id) => ({ active: id === selected,
        noEarlierMsgs: !stalled,
        limitSharing: { sharingLimited: false },
        getAllMsgs: () => {
          if (failExtraction) throw new Error('Sensitive sender should not leak');
          calls++;
          return [model, { ...model, t: 1000000000, type: 'gp2' },
            { ...model, id: { toString: () => 'CONTACT' }, type: 'vcard' },
            { ...model, id: { toString: () => 'VIEW_ONCE' }, isViewOnce: true }];
        }
      }) },
      Contact: { get: () => contact }
    }),
    indexedDB: { open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {}, transaction: () => ({ objectStore: () => ({ get(id) {
            const q = {};
            queueMicrotask(() => {
              q.result = { limitSharing: { sharingLimited: id === '120363319968739918@g.us' } };
              q.onsuccess();
            });
            return q;
          } }) })
        };
        request.onsuccess();
      });
      return request;
    } }
  });
  const locator = {
    waitFor: async () => {}, count: async () => 1, fill: async () => {},
    click: async () => {}, filter() { return this; }, first() { return this; },
    getByText() { return this; }, getByRole() { return this; }
  };
  const page = {
    getByRole: () => locator,
    locator: () => locator,
    waitForFunction: async (_fn, arg) => { selected = typeof arg === 'object' ? arg.id : arg; },
    evaluate: async (fn, arg) => {
      browser.argument = arg;
      return vm.runInContext(`(${fn.toString()})(argument)`, browser);
    },
    waitForEvent: async () => ({ path: async () => {
      downloads.push({ path: 'output/playwright/checkpoint.json', data: structuredClone(currentPayload) });
    } })
  };
  const host = vm.createContext({
    Date: Clock, setTimeout: (fn, ms) => ms === 1500 ? setTimeout(fn, 0) : setTimeout(fn, ms),
    clearTimeout
  });
  const preparedSource = source.replace(
    'const previousExports = {}; // __XPENG_PREVIOUS_EXPORTS__',
    `const previousExports = ${JSON.stringify(previousExports)}; // test cutoffs`);
  const result = await vm.runInContext(`(${preparedSource})`, host)(page);
  return { result, downloads, calls };
}

test('checkpoints redact identifiers, omit restricted content and never claim full history', async () => {
  const { downloads, result } = await simulate();
  assert.ok(downloads.length > 4);
  assert.match(result.outputFile, /^raw-data\/exports\/xpeng_whatsapp_export-.*\.json$/);
  const data = downloads.at(-1).data;
  assert.equal(data.complete, false);
  assert.equal(data.reviewRequired, true);
  assert.equal(data.groups[1].status, 'skipped_advanced_chat_privacy');
  assert.equal(data.groups[1].messages.length, 0);
  for (const group of data.groups.filter(g => g.status === 'browser_history_boundary')) {
    assert.equal(group.messages.length, 1);
    assert.equal(group.complete, false);
    const text = JSON.stringify(group.messages);
    for (const sensitive of ['Dana', 'Example', 'דנה', 'דוגמה', '972', 'example.com', 'GROUP', 'senderId', 'filename']) {
      assert.ok(!text.includes(sensitive), sensitive);
    }
    assert.match(text, /G6 charging 80%/);
  }
});

test('unchanged oldest message stops with a partial checkpoint', async () => {
  const { downloads, calls } = await simulate({ stalled: true });
  assert.ok(calls < 30);
  const group = downloads.at(-1).data.groups[0];
  assert.equal(group.status, 'partial_stalled', JSON.stringify(group));
  assert.equal(downloads.at(-1).data.groups[0].messages.length, 1);
});

test('extraction errors are reported without leaking exception content', async () => {
  const { downloads } = await simulate({ failExtraction: true });
  const data = downloads.at(-1).data;
  assert.equal(data.groups[0].status, 'partial_error');
  assert.ok(!JSON.stringify(data).includes('Sensitive sender'));
});

test('prior exports stop history loading and omit already exported messages', async () => {
  const previousExports = {
    'קהילת אקספנג - XPENG': new Date(1700000000 * 1000).toISOString()
  };
  const { downloads } = await simulate({ previousExports });
  const group = downloads.at(-1).data.groups[0];
  assert.equal(group.mode, 'incremental');
  assert.equal(group.status, 'incremental_up_to_date');
  assert.equal(group.incrementalBoundaryReached, true);
  assert.equal(group.messages.length, 0);
});

test('old system events do not establish incremental coverage', async () => {
  const { downloads } = await simulate({ stalled: true, previousExports: {
    'קהילת אקספנג - XPENG': new Date(1600000000 * 1000).toISOString()
  } });
  const group = downloads.at(-1).data.groups[0];
  assert.equal(group.status, 'partial_stalled');
  assert.equal(group.incrementalBoundaryReached, false);
  assert.equal(group.coveredThrough, undefined);
});

test('incremental preparation ignores partial and legacy run times and uses Israel mobile dates', () => {
  const os = require('node:os');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xpeng-cutoff-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'raw-data'));
    fs.writeFileSync(path.join(dir, 'raw-data', 'WhatsApp Chat with Xpeng G6.txt'),
      '9/11/26, 07:19 - Example: charging\n');
    fs.writeFileSync(path.join(dir, 'raw-data', 'xpeng_whatsapp_export-partial.json'), JSON.stringify({
      generatedAt: '2026-09-19T17:00:00Z', groups: [
        { name: 'Xpeng G6', status: 'partial_stalled', messages: [{ date: '2026-09-19' }] },
        { name: 'Legacy', status: 'browser_history_boundary', messages: [{ date: '2026-09-19' }] }
      ]
    }));
    const result = JSON.parse(execFileSync(process.execPath, [
      path.join(__dirname, '../scripts/prepare-whatsapp-incremental.cjs'), dir,
      path.join(__dirname, '../scripts/export-whatsapp-xpeng.browser.js'), path.join(dir, 'generated.js')
    ], { env: { ...process.env, TZ: 'Asia/Jerusalem' }, encoding: 'utf8' }));
    assert.deepEqual(result, { 'Xpeng G6': '2026-09-11T04:18:59.999Z' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('organized exports retain the newest per-group coverage across dated snapshots and JSON checkpoints', () => {
  const os = require('node:os');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xpeng-organized-cutoff-test-'));
  const write = (relative, contents) => {
    const filename = path.join(dir, relative);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, contents);
  };
  try {
    write('raw-data/chats/20261006/WhatsApp Chat with Xpeng G6.txt',
      '10/6/26, 15:25 - Example: older snapshot\n');
    write('raw-data/chats/20261029/WhatsApp Chat with Xpeng G6.txt',
      '10/29/26, 07:46 - Example: newer snapshot\n');
    // A later-named folder with older content must not regress the cutoff.
    write('raw-data/chats/20261106/WhatsApp Chat with Xpeng G6.txt',
      '9/11/26, 07:19 - Example: archived old content\n');
    write('raw-data/chats/20261106/WhatsApp Chat with Community.txt',
      '11/6/26, 15:45 - Example: newest community snapshot\n');
    write('raw-data/exports/xpeng_whatsapp_export-verified.json', JSON.stringify({ groups: [
      { name: 'Xpeng G6', status: 'incremental_complete', incrementalBoundaryReached: true,
        coveredThrough: '2026-10-07T00:00:00Z' },
      { name: 'Verified only', status: 'incremental_up_to_date', incrementalBoundaryReached: true,
        coveredThrough: '2026-11-05T00:00:00Z' },
      { name: 'Partial', status: 'partial_stalled', incrementalBoundaryReached: false,
        coveredThrough: '2026-12-01T00:00:00Z' }
    ] }));
    write('raw-data/exports/xpeng_whatsapp_export-interrupted.json', '{');
    const result = JSON.parse(execFileSync(process.execPath, [
      path.join(__dirname, '../scripts/prepare-whatsapp-incremental.cjs'), dir,
      path.join(__dirname, '../scripts/export-whatsapp-xpeng.browser.js'), path.join(dir, 'generated.js')
    ], { env: { ...process.env, TZ: 'Asia/Jerusalem' }, encoding: 'utf8' }));
    assert.deepEqual(result, {
      Community: '2026-11-06T13:44:59.999Z',
      'Verified only': '2026-11-05T00:00:00.000Z',
      'Xpeng G6': '2026-10-29T05:45:59.999Z'
    });
    const generated = fs.readFileSync(path.join(dir, 'generated.js'), 'utf8');
    assert.ok(generated.includes(JSON.stringify(result)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
