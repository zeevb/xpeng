# AGENTS.md

## Project overview

- This is a static, Hebrew, right-to-left Xpeng community tools site.
- `index.html` is the GitHub Pages landing page / app selector.
- `xpeng_app.html` is the editable checklist source page; `checklist.html` is its published copy and must stay identical after source changes.
- `xpeng_faq.html` is the editable FAQ source page; `faq.html` is its published copy and must stay identical after source changes.
- `xpeng_faq_data.js` contains structured FAQ data generated from `raw-data/xpeng_community_faq.md`.
- `raw-data/Xpeng_Delivery_Checklist.xlsx` and `raw-data/בדיקה במסירה אקספנג 02.26.pdf` are reference checklist documents.

## Development

- Keep the app dependency-free: HTML, CSS, and browser JavaScript only.
- Preserve Hebrew text, RTL layout, local-storage persistence, and mobile usability.
- Checklist item `id` values are stable storage keys. Do not change or renumber existing IDs when adding, deleting, reordering, or editing checklist rows; assign a new unused ID only for a new checklist item.
- After editing `xpeng_app.html`, copy it to `checklist.html` and run:

  `sed -n '/<script>/,/<\/script>/p' xpeng_app.html | sed '1d;$d' > /tmp/xpeng-app.js && node --check /tmp/xpeng-app.js`

- After editing `xpeng_faq.html`, copy it to `faq.html` and run JavaScript syntax checks for the FAQ scripts.

- Do not commit generated temporary files or the intentionally untracked `GH_PAGES_SUMMARY.md`.

## Browser testing

- For UI and interaction changes, use the Playwright skill and Playwright CLI to drive a real Chromium browser against a local server. Start the server from the repository root, for example: `python3 -m http.server 8765 --bind 127.0.0.1`, then open `http://127.0.0.1:8765/faq.html` (or the page being changed).
- Prefer the skill's CLI wrapper. If the default Chrome executable is unavailable, configure Playwright to use an installed Chromium executable. Keep browser configuration, screenshots, and other temporary artifacts in `/tmp` or `output/playwright/`; do not add project dependencies or commit artifacts for ad hoc checks.
- Exercise actual interactions and assert the resulting DOM and URL state. For FAQ changes, check search, category filtering, result counts, empty state, opening and closing answers, and `?open=<id>` links in a new tab. Verify the linked answer opens and scrolls into view.
- For copy-link changes, grant clipboard permissions and read back the actual clipboard. Verify the absolute URL contains only `?open=<id>`, including while search and category filters are active, and that copying does not toggle the answer. Check visible feedback and the polite live region, including the feedback reset.
- Exercise the fallback separately by disabling the Clipboard API and checking the temporary textarea, `execCommand('copy')` call, and cleanup. If `execCommand` is simulated, report this as a fallback-path check rather than proof of actual legacy-browser clipboard support.
- Check mobile RTL layout at a narrow viewport (for example, 375px): assert there is no horizontal overflow and visually inspect a screenshot. Inspect browser console errors and distinguish application failures from local-only analytics or missing favicon errors.
- Run relevant existing tests (for FAQ changes: `node tests/faq.test.js`), required JavaScript syntax checks, and `git diff --check`. Report what was verified and any limits; no permanent browser test files are required for ad hoc checks.

## Deployment

- GitHub Pages is deployed by `.github/workflows/pages.yml` on pushes to `main`.
- Live site: <https://zeevb.github.io/xpeng/>
- Keep checklist ordering and status/comment storage behavior consistent when changing the data model.
