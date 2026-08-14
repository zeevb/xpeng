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
- After editing `xpeng_app.html`, copy it to `checklist.html` and run:

  `sed -n '/<script>/,/<\/script>/p' xpeng_app.html | sed '1d;$d' > /tmp/xpeng-app.js && node --check /tmp/xpeng-app.js`

- After editing `xpeng_faq.html`, copy it to `faq.html` and run JavaScript syntax checks for the FAQ scripts.

- Do not commit generated temporary files or the intentionally untracked `GH_PAGES_SUMMARY.md`.

## Deployment

- GitHub Pages is deployed by `.github/workflows/pages.yml` on pushes to `main`.
- Live site: <https://zeevb.github.io/xpeng/>
- Keep checklist ordering and status/comment storage behavior consistent when changing the data model.
