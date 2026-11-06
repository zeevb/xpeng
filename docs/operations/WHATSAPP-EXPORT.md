# WhatsApp export

## Manual run

Run in a terminal with access to the desktop (Chromium opens a visible window):

```sh
cd /home/zeev/dev/xpeng
bash scripts/export-whatsapp-xpeng.sh
```

The launcher sets the NVM Node.js path, local npm cache and Israel timezone
itself. It expects Chromium at `/usr/bin/chromium` and the Playwright wrapper at
`/home/zeev/.codex/skills/playwright/scripts/playwright_cli.sh`. The wrapper uses
`npx`; its first run may need network access to fetch Playwright CLI.

Before running, keep mobile exports in `raw-data/chats/YYYYMMDD/` and JSON
checkpoints in `raw-data/exports/`. Mobile filenames must be
`WhatsApp Chat with <exact group name>.txt`; put the snapshot date in the folder,
not the group name. Legacy files directly inside `raw-data/` are also accepted.
Read the printed per-group cutoffs before extraction starts. A missing cutoff
means the script will attempt all available Web history for that group.

If prompted, link the browser using WhatsApp on your phone: **Settings → Linked
devices → Link a device**, then scan the QR code. The saved login lives in
`output/playwright/.whatsapp-profile/`. Leave the browser open and let the script
control it. Avoid another export or browser session using that same profile.
The launcher closes the named `whatsapp` and `whatsapp-xpeng-export` sessions
before starting, and closes its export session when finished.

The first roughly 30 seconds are startup checks. Wait for the final group summary;
quiet terminal output can be normal. To stop, use Ctrl+C in the terminal: the exit
trap attempts to preserve the latest completed checkpoint. A forced process kill
cannot run this cleanup; check `output/playwright/` for surviving downloads.

Rerun the same command after a failure. Up to three browser-command attempts are
automatic; individual `partial_*` group results still need inspection and may
require another run. A zero shell exit code does not mean every group is complete.

## Inspect the result

Exports are saved as `raw-data/exports/xpeng_whatsapp_export-<timestamp>.json`. To find
recent files:

```sh
ls -lt raw-data/exports/xpeng_whatsapp_export-*.json
```

Print only group metadata (replace the quoted filename with the desired export):

```sh
/home/zeev/.config/nvm/versions/node/v24.12.0/bin/node -e '
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
console.table(data.groups.map(g => ({
  group: g.name, status: g.status, messages: g.messages.length,
  cutoff: g.incrementalAfter, reachedCutoff: g.incrementalBoundaryReached,
  oldestLoaded: g.earliestLoadedDate, coveredThrough: g.coveredThrough
})));
' 'raw-data/exports/xpeng_whatsapp_export-<timestamp>.json'
```

| Status | Meaning / next step |
| --- | --- |
| `incremental_complete` | Loaded back to the previous cutoff and retained newer records. Review the content. |
| `incremental_up_to_date` | Reached the cutoff without finding newer eligible records. |
| `browser_history_boundary` | Web history stopped; if `incrementalBoundaryReached` is false, coverage back to the cutoff is unverified. |
| `partial_stalled`, `partial_time_limit`, `partial_error` | Retained data is incomplete. Inspect `errorStage` if present, then retry. |
| `skipped_advanced_chat_privacy` | The group restricts export; no messages are retained for that group. |
| `not_found` | The configured group was not found during the initial lookup. Check group configuration and login. |

During a run, `starting` and `loading` are intermediate states. Check the newest
`output/playwright/xpeng-whatsapp-export-*.json` for live checkpoint metadata;
the launcher copies checkpoints into `raw-data/exports/` at completion, failure or exit.

## How the scripts fit together

- `export-whatsapp-xpeng.sh`: environment, browser startup, retries and checkpoint preservation.
- `prepare-whatsapp-incremental.cjs`: reads local exports and generates the browser script with per-group cutoffs.
- `export-whatsapp-xpeng.browser.js`: group configuration, privacy checks, extraction and redaction.
- `whatsapp-playwright.config.json`: Chromium executable, saved profile and artifact directory.

Use the launcher for exports. Running the browser source directly leaves
`previousExports` empty and omits automatic cutoff preparation. Edit the source
under `scripts/`, not the generated copy under `output/playwright/`.

To preview cutoffs without opening WhatsApp (this only writes a generated script):

```sh
cd /home/zeev/dev/xpeng
TZ=Asia/Jerusalem /home/zeev/.config/nvm/versions/node/v24.12.0/bin/node \
  scripts/prepare-whatsapp-incremental.cjs "$PWD" \
  scripts/export-whatsapp-xpeng.browser.js \
  output/playwright/cutoff-preview.browser.js
```

## Lessons learned from September 19

1. **A run timestamp is not a coverage watermark.** Nonempty partial exports
   previously caused unseen messages to be skipped. Advance only from verified
   incremental coverage; retain the mobile exports as the baseline.
2. **Old system events are not old conversation history.** Group-creation events
   falsely satisfied the cutoff and caused premature completion. Measure progress
   using conversation-message timestamps.
3. **A history banner can be transient.** G6 initially appeared to stop with 45
   records. Continuing while history progressed yielded 362 and reached the cutoff.
   Require 30 seconds without progress before accepting a browser boundary.
4. **Verify filenames on disk.** Playwright replaces underscores with hyphens in
   download names. Recognize both forms when preserving checkpoints.
5. **Allow overlap, then select sources carefully.** Minute-precision mobile dates
   and day-precision Web records need conservative cutoffs. Retries and subsequent
   runs can overlap; do not concatenate every JSON file as if all records were new.
   Run-local `sequence` values are not stable cross-run deduplication IDs.
6. **Treat browser closures as recoverable, with limits.** Intermittent
   `Target page, context or browser has been closed` errors were reproduced, but
   the underlying cause was not established. Preserve checkpoints and retry, rather
   than assuming every closure is a data-extraction bug. Three attempts are bounded;
   they do not guarantee successful extraction.
7. **Check data, not just exit codes.** Confirm per-group status, message counts,
   oldest loaded dates and cutoff flags before declaring the export usable.

For the exact successful files and overlap handling from this run, see
[September 19 handoff](WHATSAPP-EXPORT-2026-09-19.md).

## Where group privacy is checked

All three checks are in [export-whatsapp-xpeng.browser.js](../../scripts/export-whatsapp-xpeng.browser.js).
The underlying WhatsApp flag is `limitSharing?.sharingLimited`:

1. **Before opening a group**, under `failureStage = 'privacy_check'`: the script
   opens IndexedDB `model-storage`, reads the configured group from the `chat`
   object store, and evaluates `!q.result.limitSharing?.sharingLimited`. A truthy
   restriction flag produces `skipped_advanced_chat_privacy`; a missing chat
   produces `not_found`.
2. **After selecting the group**, under `failureStage = 'selected_privacy_check'`:
   it resolves the active `WAWebCollections.Chat` model and checks
   `!chat.limitSharing?.sharingLimited` again. This checks the actual selected
   conversation, including the fallback lookup by group name.
3. **On every extraction batch**, under `failureStage = 'extract_messages'`:
   `if (chat.limitSharing?.sharingLimited) return { restricted: true };` runs before
   reading messages. The `if (batch.restricted)` handler then clears retained
   messages, sets the count to zero and marks the group skipped.

Locate the current lines after any future edits with:

```sh
rg -n 'privacy_check|sharingLimited|batch\.restricted' scripts/export-whatsapp-xpeng.browser.js
```

This is an undocumented WhatsApp model property, not a supported export API.
A missing property on an existing chat currently evaluates as unrestricted;
a missing chat is skipped. If WhatsApp changes this schema, revalidate the checks
before relying on them. These checks read the setting; they do not change it.

## Export behavior and limitations

Uses the installed Chromium, NVM Node.js and Playwright CLI wrapper. This is
development tooling; the static website remains dependency-free. Login may
require scanning the QR code. The four selected group IDs are configured in
`export-whatsapp-xpeng.browser.js`.

Each run creates a timestamped JSON in `raw-data/exports/` and checkpoints after each
batch. Existing runs are preserved. The launcher retries browser-command failures
up to three times with the original cutoff, saving checkpoints before retrying.
An interruption leaves the last completed checkpoint; the next run starts a new
export. The original unversioned JSON is
an empty failed test and must not be used as FAQ input.

Playwright first auto-saves each checkpoint in its ignored `output/playwright/`
directory (its filename sanitization replaces underscores with hyphens). The
launcher recognizes both forms and copies the newest current-run checkpoint into
`raw-data/exports/` on success and from its exit trap after an interruption.

Before opening WhatsApp, the launcher scans JSON checkpoints in `raw-data/exports/`
and all mobile snapshots under `raw-data/chats/`, including dated subfolders.
It also accepts legacy JSON and `WhatsApp Chat with *.txt` files directly inside
`raw-data/`. It chooses the latest supported cutoff per exact group name across
all snapshots; a folder date alone never establishes coverage.
Mobile exports establish a cutoff using their month/day/year dates in
`Asia/Jerusalem`, overlapping the last minute to avoid losing same-minute messages.
Only verified incremental JSON results with `coveredThrough` advance that cutoff;
partial and legacy exports never establish coverage from `generatedAt`.
Verified results retain a day of overlap because exported dates have day precision.
A group without a reliable cutoff attempts the available WhatsApp Web history.
Keep earlier files: later incremental exports do not replace their messages.

The exporter uses a 15-second operation timeout, a 30-second oldest-message
stall timeout, and a five-minute history limit per group. The launcher also
limits the browser command externally. Progress is assessed from actual oldest
conversation-message timestamps, excluding old group-creation/security events.
A history boundary must remain stalled for 30 seconds before it is accepted.
Playwright CLI may buffer terminal output: absence of
errors or output does not establish progress. Check checkpoint modification
times and per-group statuses instead.

No export is labelled complete phone history. `browser_history_boundary` means
WhatsApp Web reported its available history boundary. `partial_stalled`,
`partial_time_limit`, and `partial_error` describe incomplete results.
System events, contact cards, attachments and view-once messages are excluded.
The resulting record count therefore differs from WhatsApp's full record count.

Advanced Chat Privacy groups are skipped, even when exporting redacted text.
Anonymization does not override that explicit export restriction.

Participant fields, phone numbers in IDs, raw message/group IDs, filenames,
exact timestamps and quoted messages are not exported. Known sender names,
URLs, emails and common numeric identifiers in text are redacted inside the
browser. This is best-effort de-identification, not guaranteed anonymity:
unrecognized names, addresses, number plates and personal stories may remain.
Every export has `reviewRequired: true` and needs manual review before FAQ use
or publication. Conservative redaction may remove useful numeric information.

JSON checkpoints and browser artifacts are Git-ignored. Browser profiles and
CLI diagnostic files can still contain personal data; keep them local. The
Pages workflow publishes only its explicit website file list.

The exporter depends on undocumented WhatsApp Web models and English UI
selectors. Updates to WhatsApp can require changes. Offline regression checks:

```sh
/home/zeev/.config/nvm/versions/node/v24.12.0/bin/node --test tests/export-whatsapp-xpeng.test.cjs
```
