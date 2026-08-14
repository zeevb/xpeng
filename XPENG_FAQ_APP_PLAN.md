# XPENG Multi-App and Community FAQ Plan

## Objective

Add a second, dependency-free Hebrew RTL web app containing frequently asked questions and answers gathered from the XPENG WhatsApp community. Provide fast browsing and searching, and introduce a landing page that lets users choose between the delivery checklist and FAQ app while leaving room for additional apps later.

## Current context

- `xpeng_app.html` is the current checklist source.
- `index.html` is currently the GitHub Pages entry point and is identical to the checklist source.
- `.github/workflows/pages.yml` currently publishes only `index.html`.
- `xpeng_community_faq.md` contains the initial FAQ content, organized by Hebrew category headings and question headings.
- The apps must remain static, dependency-free, mobile-friendly, Hebrew RTL, and usable with English product terms such as XPILOT, CarPlay, NFC, and Android Auto.
- Prefer native HTML and CSS behavior over JavaScript whenever they can provide the same user experience cleanly. Use JavaScript only for behavior that cannot reasonably be handled with semantic HTML/CSS, such as final search/filter logic, URL state, and persistence.

## Proposed site structure

Use separate source and published pages:

```text
index.html                 # landing page / app selector
xpeng_app.html             # checklist source, retained for editing
checklist.html             # published checklist app page
xpeng_faq.html             # FAQ source page
faq.html                   # published FAQ app page
xpeng_faq_data.js          # generated or maintained FAQ data, if kept separate
tests/
  checklist-migration.test.js
  faq.test.js
```

The landing page should link to `checklist.html` and `faq.html`. Each app should link back to the landing page. The existing checklist behavior and local-storage keys must remain unchanged.

Before implementation, update `AGENTS.md` to replace the current “`index.html` must equal `xpeng_app.html`” rule with the new source/published-page rules.

## Phase 1 — Confirm content and data model

1. Treat `xpeng_community_faq.md` as the editorial source for the first FAQ release.
2. Convert each category and question into structured data:

   ```js
   {
     id: "stable-slug",
     category: "טעינה וסוללה",
     question: "...",
     answer: "...",
     keywords: ["טעינה", "AC", "22kW"]
   }
   ```

3. Give every question a stable ID so future edits or reordering do not break bookmarks, favorites, or stored UI state.
4. Preserve the FAQ disclaimer that the content reflects community experience and is not official XPENG/importer guidance.
5. Review the source for personally identifiable information, phone numbers, invite links, and claims that need attribution or qualification before publishing.

## Phase 2 — Build the FAQ app

Implement the FAQ as a single static page with inline or locally bundled data:

- Hebrew RTL layout with readable mixed Hebrew/English text.
- Search field with instant filtering over questions, answers, categories, and keywords.
- Category browsing/filter buttons or a compact select control.
- Expand/collapse question cards; show answers in a readable accordion layout.
- Result count and a clear “no results” state.
- Preserve the active search/filter in the URL query string where practical, allowing links to a filtered view.
- Add a reset/clear-search action.
- Include a visible disclaimer and a “last reviewed” date.
- Use semantic buttons, labels, keyboard navigation, focus styles, and sufficient color contrast.
- Avoid `innerHTML` for community text unless it is safely escaped; prefer DOM text insertion so FAQ content cannot become executable markup.

Do not add a runtime dependency or require a server/API. The initial data should be available immediately offline after the page loads.

## Phase 2A — Build preview HTML before app development

Create browser-previewable static prototypes before implementing the full FAQ behavior:

- `landing_preview.html` — the proposed app-selection landing page.
- `faq_preview.html` — the proposed FAQ layout using a representative sample of real questions and answers from `xpeng_community_faq.md`.

The prototypes should demonstrate the visual direction and information architecture, including:

- Hebrew RTL typography, spacing, colors, and mobile layout.
- Landing-page app cards for the checklist and FAQ, plus a placeholder for future apps.
- FAQ category navigation, search-field placement, question cards, expanded answers, disclaimer, and return-to-home navigation.
- Mixed Hebrew/English terms such as XPILOT, CarPlay, NFC, Android Auto, and 22kW.
- Realistic long answers and multi-step answers so wrapping and scrolling can be evaluated.

Keep these prototypes dependency-free and openable directly in a browser or through a simple local static server. Use representative static states rather than implementing the final search, filtering, persistence, or deployment behavior yet.

After the prototypes are created:

1. Open both pages on desktop and mobile-sized viewports.
2. Review the layout, terminology, navigation, card density, and accessibility with the user.
3. Record requested changes and revise the prototypes.
4. Stop and present the completed previews to the user for approval.
5. Continue with production implementation only after the user gives explicit permission to proceed.

This is a hard phase boundary. Do not build or replace the production landing page, FAQ app, checklist publication path, data model, tests, or deployment workflow beyond what is necessary to make the previews viewable before receiving that permission.

## Phase 3 — Create the landing page

Replace the current root entry point with a simple app selector:

- XPENG visual identity consistent with the checklist.
- Two clear cards/buttons: “בדיקת מסירה” and “שאלות ותשובות מהקהילה”.
- Short descriptions explaining each app.
- Responsive layout for phones first, with larger-screen spacing.
- A reusable app-card pattern so future tools can be added by inserting another card.
- No redirect or framework dependency; plain links should work on GitHub Pages.

The checklist should be published at `checklist.html`, and its header should include a link back to the landing page. The FAQ should similarly link back to the landing page.

## Phase 4 — Deployment changes

Update `.github/workflows/pages.yml` so the Pages artifact includes the landing page, both app pages, and any local data/assets required by them. Prefer an explicit preparation step that copies only the intended public files rather than publishing reference documents or private working files.

Verify:

- Pushes to `main` still deploy automatically.
- `https://zeevb.github.io/xpeng/` shows the landing page.
- `.../checklist.html` opens the unchanged checklist app.
- `.../faq.html` opens the FAQ app.
- Relative links work under the `/xpeng/` repository path.

## Phase 5 — Tests and verification

Add lightweight Node.js tests without introducing a package dependency:

- FAQ data test: every item has a unique stable ID, category, question, and answer.
- Search test: Hebrew, English terms, category text, mixed-case Latin terms, and no-result searches behave correctly.
- Rendering/security test: FAQ text is inserted as text and does not interpret answer content as HTML.
- Existing checklist migration test continues to pass.
- Validate that `xpeng_app.html` and `checklist.html` are identical if that remains the chosen publication convention.
- Run the required inline JavaScript `node --check` command for every HTML page containing inline scripts.
- Run `git diff --check` and manually test the landing, checklist, FAQ, search, category filtering, accordion, back links, and mobile layout.

## Suggested implementation order

1. Update the repository instructions and define the new source/public file convention.
2. Create the landing and FAQ preview HTML pages.
3. Review and revise the previews based on feedback.
4. Stop and request explicit user permission to continue.
5. After approval, parse and review the FAQ content into stable structured records.
6. Build the FAQ page and its search/filter behavior.
7. Add tests for data validity and search behavior.
8. Move the checklist publication to `checklist.html` without changing its behavior.
9. Build the production landing page and cross-links.
10. Update the Pages workflow.
11. Run local checks and browser smoke tests.
12. Commit and push; verify the deployed Pages URL.

## Future extensions

- Favorites or “save for later” using local storage keyed by stable FAQ IDs.
- Shareable links to a specific question.
- Model/version filters if answers differ between XPENG models or software versions.
- An editorial update process that records source date, confidence, and review status.
- Additional tools added to the landing page without changing the existing app contracts.
