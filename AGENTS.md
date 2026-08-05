# AGENTS.md

## Project overview

- This is a static, Hebrew, right-to-left Xpeng delivery checklist web app.
- `xpeng_app.html` is the editable source page.
- `index.html` is the GitHub Pages entry point and must stay identical to `xpeng_app.html` after source changes.
- `Xpeng_Delivery_Checklist.xlsx` and `בדיקה במסירה אקספנג 02.26.pdf` are reference checklist documents.

## Development

- Keep the app dependency-free: HTML, CSS, and browser JavaScript only.
- Preserve Hebrew text, RTL layout, local-storage persistence, and mobile usability.
- After editing `xpeng_app.html`, copy it to `index.html` and run:

  `sed -n '/<script>/,/<\/script>/p' xpeng_app.html | sed '1d;$d' > /tmp/xpeng-app.js && node --check /tmp/xpeng-app.js`

- Do not commit generated temporary files or the intentionally untracked `GH_PAGES_SUMMARY.md`.

## Deployment

- GitHub Pages is deployed by `.github/workflows/pages.yml` on pushes to `main`.
- Live site: <https://zeevb.github.io/xpeng/>
- Keep checklist ordering and status/comment storage behavior consistent when changing the data model.
