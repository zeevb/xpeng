async (page) => {
  // Each browser operation is bounded from the Playwright side. A frozen page
  // cannot indefinitely suspend the history deadline or discard prior checkpoints.
  const groups = [
    ['120363406338781218@g.us', 'קהילת אקספנג - XPENG'],
    ['120363319968739918@g.us', '🟠G6 Drivers Club IL (Xpeng)'],
    ['120363389862473662@g.us', 'Xpeng G6'],
    ['120363334377838756@g.us', 'קהילת אקספנג (Xpeng)']
  ];
  const previousExports = {}; // __XPENG_PREVIOUS_EXPORTS__
  const run = new Date().toISOString().replace(/[:.]/g, '-');
  const outputName = `xpeng_whatsapp_export-${run}.json`;
  const outputFile = `raw-data/exports/${outputName}`;
  const payload = {
    schemaVersion: 2, generatedAt: new Date().toISOString(),
    complete: false, reviewRequired: true,
    scope: 'Messages available to this WhatsApp Web session; full phone history is not verified.',
    privacy: 'No sender IDs, names, message IDs, contact cards, filenames or attachments. Known names and common identifiers in text are redacted. Free text can still identify people; review before publication.',
    groups: []
  };
  async function bounded(operation, ms = 15000) {
    let timer;
    const timeout = typeof page.waitForTimeout === 'function' ? page.waitForTimeout(ms)
      : new Promise(resolve => { timer = setTimeout(resolve, ms); });
    try {
      return await Promise.race([operation(), timeout.then(() => {
        throw new Error('Browser operation timed out');
      })]);
    } finally {
      if (timer !== undefined && typeof clearTimeout === 'function') clearTimeout(timer);
    }
  }
  async function checkpoint() {
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    // Observe rejection even if the page evaluation fails before awaiting download.
    downloadPromise.catch(() => {});
    await bounded(() => page.evaluate(({ data, outputName }) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = outputName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }, { data: payload, outputName }));
    const download = await downloadPromise;
    // Playwright CLI automatically stores accepted downloads in its outputDir.
    // Waiting for the temporary path ensures the checkpoint is fully written;
    // the launcher then copies the latest current-run checkpoint into raw-data/exports.
    await bounded(() => download.path());
  }
  // Wait for the authenticated sidebar, not merely the presence of JS modules.
  // The search box loses its accessible name while a query is present.
  const sidebarSearch = page.locator('#side').getByRole('textbox').first();
  await sidebarSearch.waitFor({ state: 'visible', timeout: 120000 });
  await sidebarSearch.fill('');
  await checkpoint();
  for (const [groupId, name] of groups) {
    const incrementalAfter = previousExports[name] || null;
    const cutoffMs = incrementalAfter ? Date.parse(incrementalAfter) : null;
    const result = { name, status: 'starting', complete: false,
      mode: incrementalAfter ? 'incremental' : 'full_history_attempt',
      incrementalAfter, messages: [] };
    payload.groups.push(result);
    await checkpoint();
    let failureStage = 'privacy_check';
    try {
      const allowed = await bounded(() => page.evaluate(async (id) => {
        const db = await new Promise((resolve, reject) => {
          const q = indexedDB.open('model-storage');
          q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error);
        });
        try {
          return await new Promise((resolve, reject) => {
            const q = db.transaction('chat').objectStore('chat').get(id);
            q.onerror = () => reject(q.error);
            q.onsuccess = () => resolve(q.result ? !q.result.limitSharing?.sharingLimited : null);
          });
        } finally { db.close(); }
      }, groupId));
      if (allowed !== true) {
        result.status = allowed === false ? 'skipped_advanced_chat_privacy' : 'not_found';
        await checkpoint(); continue;
      }
      await sidebarSearch.fill(name, { timeout: 15000 });
      failureStage = 'search_result';
      await page.getByRole('grid', { name: 'Search results.' })
        .getByRole('gridcell').filter({ hasText: name }).first().click({ timeout: 15000 });
      failureStage = 'activate_chat';
      await page.waitForFunction(({ id, expectedName }) => {
        try {
          const chats = require('WAWebCollections').Chat;
          if (chats.get(id)?.active === true) return true;
          const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
          return (chats.models || []).some(chat => chat.active === true && [
            chat.name, chat.formattedTitle, chat.contact?.name, chat.groupMetadata?.subject
          ].some(value => normalized(value) === normalized(expectedName)));
        }
        catch { return false; }
      }, { id: groupId, expectedName: name }, { timeout: 15000 });
      failureStage = 'selected_privacy_check';
      const selectedAllowed = await bounded(() => page.evaluate(({ id, expectedName }) => {
        const chats = require('WAWebCollections').Chat;
        const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
        const expected = chats.get(id);
        const chat = expected?.active ? expected : (chats.models || []).find(candidate =>
          candidate.active === true && [candidate.name, candidate.formattedTitle,
            candidate.contact?.name, candidate.groupMetadata?.subject]
            .some(value => normalized(value) === normalized(expectedName)));
        return chat ? !chat.limitSharing?.sharingLimited : null;
      }, { id: groupId, expectedName: name }));
      if (selectedAllowed !== true) {
        result.status = selectedAllowed === false ? 'skipped_advanced_chat_privacy' : 'partial_error';
        result.errorStage = selectedAllowed === false ? undefined : failureStage;
        await checkpoint(); continue;
      }
      failureStage = 'prepare_scroller';
      await bounded(() => page.evaluate(() => {
        const s = document.querySelector('[data-testid="conversation-panel-messages"]');
        if (!s) throw new Error('Missing conversation scroller');
        s.scrollTop = s.scrollHeight;
      }));
      let bestOldest = Infinity, stalledAt = Date.now();
      const deadline = Date.now() + 5 * 60 * 1000;
      const retained = new Map();
      result.status = 'loading';
      while (Date.now() < deadline) {
        failureStage = 'extract_messages';
        const batch = await bounded(() => page.evaluate(({ id, expectedName, cutoffMs }) => {
          const C = require('WAWebCollections'), chats = C.Chat;
          const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
          const expected = chats.get(id);
          const chat = expected?.active ? expected : (chats.models || []).find(candidate =>
            candidate.active === true && [candidate.name, candidate.formattedTitle,
              candidate.contact?.name, candidate.groupMetadata?.subject]
              .some(value => normalized(value) === normalized(expectedName)));
          if (!chat?.active) throw new Error('Selected conversation changed');
          if (chat.limitSharing?.sharingLimited) return { restricted: true };
          const models = chat.getAllMsgs();
          // Names are used solely inside the page for redaction, never returned.
          const names = new Set();
          for (const m of models) {
            const contact = m.senderObj || C.Contact.get(m.author?._serialized || m.from?._serialized);
            for (const value of [contact?.name, contact?.pushname, contact?.formattedName]) {
              if (typeof value !== 'string') continue;
              names.add(value);
              for (const token of value.split(/\s+/)) if (token.length >= 2) names.add(token);
            }
          }
          const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const patterns = [...names].filter(s => s.length >= 2).sort((a,b) => b.length-a.length)
            .map(s => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, 'giu'));
          const redact = value => {
            if (typeof value !== 'string') return null;
            let s = value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
            s = s.replace(/(?:https?:\/\/|www\.)\S+/gi, '[link removed]')
              .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email removed]')
              .replace(/@?\d+(?:@(?:lid|c\.us|g\.us))?/g, match => match.length >= 7 ? '[identifier removed]' : match)
              .replace(/\+?\d[\d ()-]{6,}\d/g, '[number removed]');
            for (const pattern of patterns) s = s.replace(pattern, '[name removed]');
            return s || null;
          };
          // Internal IDs remain in page memory; an opaque run-local index is the
          // only deduplication key crossing the browser boundary.
          window.__xpengPrivateKeys ||= new Map();
          const keys = window.__xpengPrivateKeys;
          const records = [];
          let oldest = Infinity;
          for (const m of models) {
            const t = Number(m.t);
            if (!['chat', 'image', 'video', 'document', 'ptt', 'audio', 'sticker'].includes(m.type)) continue;
            // Group-creation/security events can be months older than the
            // loaded message window. They cannot prove the cutoff was reached.
            if (Number.isFinite(t)) oldest = Math.min(oldest, t);
            if (m.isViewOnce || m.type === 'revoked') continue;
            if (cutoffMs !== null && Number.isFinite(t) && t * 1000 <= cutoffMs) continue;
            const key = String(m.id?._serialized || m.id?.$1 || m.id?.toString?.() || m.rowId);
            if (!keys.has(key)) keys.set(key, keys.size + 1);
            records.push({ sequence: keys.get(key),
              date: Number.isFinite(t) ? new Date(t * 1000).toISOString().slice(0,10) : null,
              type: m.type, text: redact(m.body || m.caption) });
          }
          const scroller = document.querySelector('[data-testid="conversation-panel-messages"]');
          if (!scroller) throw new Error('Conversation scroller disappeared');
          // Move off zero before returning to it: repeated scrollTop=0 does not
          // necessarily trigger WhatsApp's virtual list history loader.
          scroller.scrollTop = Math.min(100, scroller.scrollHeight);
          scroller.scrollTop = 0;
          scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
          const earlier = [...scroller.querySelectorAll('[title]')].find(e => /Load earlier messages/i.test(e.title));
          earlier?.click();
          const browserBoundary = scroller.innerText?.includes(
            'Use WhatsApp on your phone to see older messages') === true;
          return { records, oldest: Number.isFinite(oldest) ? oldest : null,
            loaded: models.length, noEarlier: chat.noEarlierMsgs === true || browserBoundary,
            incrementalBoundary: cutoffMs !== null && Number.isFinite(oldest) && oldest * 1000 <= cutoffMs };
        }, { id: groupId, expectedName: name, cutoffMs }));
        if (batch.restricted) {
          result.status = 'skipped_advanced_chat_privacy'; result.messages = [];
          result.exportedMessageCount = 0;
          break;
        }
        for (const record of batch.records) retained.set(record.sequence, record);
        result.messages = [...retained.values()].sort((a,b) => (a.date || '').localeCompare(b.date || '') || a.sequence-b.sequence);
        result.loadedRecordCount = batch.loaded;
        result.exportedMessageCount = result.messages.length;
        result.earliestLoadedDate = batch.oldest ? new Date(batch.oldest*1000).toISOString().slice(0,10) : null;
        result.browserHistoryBoundaryReached = batch.noEarlier;
        result.incrementalBoundaryReached = batch.incrementalBoundary;
        // A browser boundary is not proof of all phone history being synced.
        result.status = batch.incrementalBoundary
          ? (result.messages.length ? 'incremental_complete' : 'incremental_up_to_date')
          : 'loading';
        if (batch.incrementalBoundary) {
          // Keep a whole-day overlap because exported messages have day precision.
          // Never use the wall-clock run time as evidence of message coverage.
          const latestDate = result.messages.map(m => m.date).filter(Boolean).sort().at(-1);
          result.coveredThrough = latestDate
            ? new Date(Math.max(cutoffMs, Date.parse(latestDate))).toISOString()
            : incrementalAfter;
        }
        await checkpoint();
        if (batch.incrementalBoundary) break;
        if (batch.oldest !== null && batch.oldest < bestOldest) {
          bestOldest = batch.oldest; stalledAt = Date.now();
        }
        // A boundary banner can appear while another history batch is loading.
        // Require sustained lack of progress before accepting it.
        if (Date.now() - stalledAt > 30000) {
          result.status = batch.noEarlier ? 'browser_history_boundary' : 'partial_stalled';
          break;
        }
        if (typeof page.waitForTimeout === 'function') await page.waitForTimeout(1500);
        else await new Promise(resolve => setTimeout(resolve, 1500));
      }
      if (result.status === 'loading') result.status = 'partial_time_limit';
    } catch (error) {
      result.status = 'partial_error';
      result.errorStage = failureStage;
      // Exception text may contain contact or message details. Do not export it.
      result.error = 'Browser navigation, privacy check or extraction failed; retained previous checkpoint.';
    }
    await checkpoint();
  }
  await checkpoint();
  return { outputFile, reviewRequired: true, groups: payload.groups.map(g => ({
    name: g.name, status: g.status, messages: g.messages.length
  })) };
}
