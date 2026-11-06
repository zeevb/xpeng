# XPENG community tools

Dependency-free Hebrew, right-to-left web tools for the XPENG community.

- [Live site](https://zeevb.github.io/xpeng/)
- [Delivery checklist](checklist.html)
- [Community FAQ](faq.html)

## Repository layout

| Location | Contents |
| --- | --- |
| Root HTML and JavaScript | Live app entry points, editable HTML sources and browser scripts. Paths stay stable for GitHub Pages, shared FAQ links and browser storage. |
| [`content/`](content/) | Editable [FAQ Markdown](content/xpeng_community_faq.md). Synchronize changes to `xpeng_faq_data.js`. |
| [`docs/faq/reviews/`](docs/faq/reviews/) | Dated chat analyses, FAQ update recommendations and manual comparisons. |
| [`docs/plans/`](docs/plans/) | FAQ/accessories app plans and the proposed Cloudflare migration. |
| [`docs/operations/`](docs/operations/) | [WhatsApp export instructions](docs/operations/WHATSAPP-EXPORT.md) and export handoffs. |
| [`docs/communications/`](docs/communications/) | Community announcement copy. |
| `docs/deployment/` | Local deployment notes; `GH_PAGES_SUMMARY.md` remains intentionally Git-ignored. |
| [`previews/`](previews/) | Earlier [landing page](previews/landing_preview.html) and [FAQ](previews/faq_preview.html) prototypes; these are not deployed. |
| [`raw-data/manuals/`](raw-data/manuals/) | Original G6 user manual and extracted Markdown. |
| [`raw-data/checklists/`](raw-data/checklists/) | Reference delivery-checklist spreadsheet and PDF. |
| [`raw-data/chats/`](raw-data/chats/) | Mobile chat snapshots in `YYYYMMDD/` folders. |
| `raw-data/exports/` | Local, Git-ignored WhatsApp browser JSON checkpoints. |
| [`scripts/`](scripts/) | WhatsApp export launcher, cutoff preparation, browser script and browser configuration. |
| [`tests/`](tests/) | FAQ, checklist migration and offline exporter tests. |
| `.github/workflows/pages.yml` | Deploys the explicit public file list on pushes to `main`. |

The November review is available as [Markdown](docs/faq/reviews/FAQ_UPDATE_FINDINGS_20261106.md) or [readable HTML](docs/faq/reviews/FAQ_UPDATE_FINDINGS_20261106.html). Only its P1 recommendations have been implemented. Reviews and plans describe the state at their date; they are not the current FAQ source.

`output/`, `.playwright-cli/` and `.npm-cache/` contain local artifacts, browser diagnostics/profiles and package caches. Their paths are retained for the tools that use them; they are not deployed or committed. Hidden environment/agent configuration directories are not project content.

## Editing the apps

- Edit `xpeng_app.html` for the checklist and copy it to `checklist.html`.
- Edit `xpeng_faq.html` for the FAQ page and copy it to `faq.html`.
- Edit `content/xpeng_community_faq.md` for FAQ answers, then synchronize `xpeng_faq_data.js`. Answer links such as `checklist.html` and `faq.html?open=...` are relative to the **app root**, because the Markdown content is rendered inside the app. Preserve existing FAQ and checklist item IDs.
- Keep `index.html`, published pages and runtime scripts at the root. The workflow publishes only `index.html`, `checklist.html`, `faq.html`, `xpeng_faq_data.js` and `xpeng_faq_app.js`; source documents and chat exports are not in the deployment artifact.

Full project instructions are in [AGENTS.md](AGENTS.md).

## Checks

Run from the repository root with Node.js from NVM (no project dependencies):

```sh
node --check xpeng_faq_data.js
node --check xpeng_faq_app.js
node tests/faq.test.js
node tests/checklist-migration.test.js
node --test tests/export-whatsapp-xpeng.test.cjs
cmp xpeng_app.html checklist.html
cmp xpeng_faq.html faq.html
git diff --check
```

For local viewing, serve the repository root, for example `python3 -m http.server 8765 --bind 127.0.0.1`, and open `http://127.0.0.1:8765/`.

## Source snapshots and exports

Put mobile exports in `raw-data/chats/YYYYMMDD/` using the exact filename `WhatsApp Chat with <group name>.txt`. The G6 export previously named `WhatsApp Chat with Xpeng G6 20261029.txt` is now `raw-data/chats/20261029/WhatsApp Chat with Xpeng G6.txt`, so its date is kept in the folder rather than treated as part of the group name. Snapshot contents and source line numbers are preserved.

The exporter reads all dated snapshots and saved JSON checkpoints, chooses the latest supported cutoff for each group, and preserves the existing overlap/partial-export rules. It also accepts legacy exports directly inside `raw-data/`. New JSON checkpoints go to `raw-data/exports/`; browser profiles and temporary downloads stay in `output/playwright/`.

To run an export, follow the [operations guide](docs/operations/WHATSAPP-EXPORT.md). Exporting is separate from updating the FAQ or publishing the site.
