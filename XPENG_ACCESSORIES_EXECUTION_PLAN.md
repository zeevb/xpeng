# XPeng G6 Accessories Execution Plan

## 1. Files To Add Or Change

Create:

- `xpeng_accessories.html`: editable source page.
- `accessories.html`: exact published copy of the source page.
- `xpeng_accessories_app.js`: data loading, filtering, rendering, and link selection.
- `xpeng_accessories.json`: metadata and accessory records.
- `tests/accessories.test.js`: dependency-free Node.js tests.

Modify:

- `index.html`: replace the future-app placeholder with a link to `accessories.html`.
- `.github/workflows/pages.yml`: copy the accessory HTML, JS, and JSON into `_site`.

Do not modify checklist storage keys or checklist behavior.

## 2. Build The Initial Data

Use `raw-data/WhatsApp Chat with קהילת אקספנג - XPENG.txt` as the source.

Extract:

- AliExpress URLs and their surrounding product titles.
- Non-AliExpress product links.
- Product mentions without links.
- Evidence that an item was purchased, tested, recommended, questioned, or rejected.

Start with the 48 unique AliExpress URLs found in the current dump, then add useful text-only products when the discussion contains enough information to identify the accessory.

Exclude community links, videos, news, unrelated software discussions, and products with no meaningful accessory use case.

Use these categories initially:

- `אחסון ונוחות`
- `הגנה ועיצוב`
- `טעינה וחשמל`
- `ניקוי ותחזוקה`
- `אלקטרוניקה ותיעוד`

Deduplicate by function. A new listing for the same type of screen protector, USB drive, armrest cover, or tire-repair kit belongs in the existing accessory record.

Use stable kebab-case IDs such as `screen-protector`, `console-organizer`, and `v2l-discharge-adapter`. Never change an existing accessory ID during later updates.

## 3. JSON Contract

The root object must contain `meta` and `accessories`.

Every accessory must contain:

- `id`: stable unique string.
- `name`: Hebrew display name.
- `category`: one current category.
- `search`: useful Hebrew and English search terms.
- `fit`: optional compatibility note.
- `notes`: optional community context.
- `preview_image`: empty string or direct/local image path.
- `listings`: array.

Every listing must contain:

- `url`: original community URL.
- `title`: original or normalized listing title.
- `source_date`: date found in the chat.
- `last_seen`: date last reviewed by the editor.
- `status`: `unknown`, `active`, or `dead`.
- `affiliate_url`: empty string until an affiliate link is added.

The renderer must use `affiliate_url || url`, while retaining and never overwriting `url`.

## 4. Implement The Page

Copy the visual conventions from `xpeng_faq.html`:

- `lang="he" dir="rtl"`.
- Same navy/blue/sky palette and system font stack.
- Responsive shell and mobile controls.
- Header link back to `index.html`.

Add:

- Search input.
- Category select generated from JSON records.
- Clear button.
- Result count.
- Empty state.
- Accessory card list.

Each card renders:

- Optional preview image only when `preview_image` is non-empty.
- Stable image box dimensions with `object-fit: contain`.
- `alt` text based on the accessory name.
- Name, category, fit, and notes.
- All listings, with dead listings visibly marked.
- A replacement search phrase when no active listing exists.

Use `textContent` and DOM APIs for community data. Do not inject JSON text through `innerHTML`.

Load the JSON with a relative `fetch('xpeng_accessories.json')`. Show a clear data-loading error if loading fails. Test through a local static server because browser `file://` fetch behavior is not reliable.

Use URL parameters `q` and `category` only if they fit the existing implementation cleanly. Do not add local-storage persistence.

Show an affiliate disclosure only when at least one rendered listing has a non-empty `affiliate_url`.

## 5. Publish And Deploy

After editing `xpeng_accessories.html`, copy it to `accessories.html` and verify byte-for-byte equality.

Add these workflow copy steps:

```yaml
cp accessories.html _site/accessories.html
cp xpeng_accessories_app.js _site/xpeng_accessories_app.js
cp xpeng_accessories.json _site/xpeng_accessories.json
```

Do not publish the raw chat dump, reference PDFs, spreadsheets, or source-only pages.

## 6. Tests

Create `tests/accessories.test.js` using Node built-ins only. Test:

1. `accessories.html` equals `xpeng_accessories.html`.
2. JSON parses successfully.
3. The root has `meta` and an `accessories` array.
4. Accessory IDs are unique and match a stable slug format.
5. Names, categories, search text, and listings are valid.
6. Listing URLs are valid HTTP(S) URLs.
7. Listing statuses use the allowed values.
8. `affiliate_url` falls back to `url` when empty.
9. A populated `affiliate_url` is preferred without changing `url`.
10. Empty `preview_image` produces no image requirement.
11. Search handles Hebrew, English, category, and no-result queries.
12. Product text is rendered as text rather than executable HTML.

Run:

```bash
node tests/accessories.test.js
node tests/faq.test.js
node tests/checklist-migration.test.js
git diff --check
```

Run the existing checklist inline-script check after any checklist edit:

```bash
sed -n '/<script>/,/<\/script>/p' xpeng_app.html | sed '1d;$d' > /tmp/xpeng-app.js
node --check /tmp/xpeng-app.js
```

## 7. Browser Verification

Start a local static server, for example:

```bash
python3 -m http.server 8000
```

Verify:

- `/index.html` shows three usable app links.
- `/accessories.html` loads JSON and renders cards.
- Search works in Hebrew and English.
- Category filtering works.
- Dead listings remain understandable.
- Affiliate fallback and disclosure work with test data.
- Cards remain stable with and without preview images.
- Mobile layout has no horizontal overflow or overlapping text.
- `/checklist.html` and `/faq.html` remain unchanged in behavior.

## 8. Future Chat-Dump Procedure

For each new dump:

1. Add the dated source file under `raw-data/`.
2. Extract candidate products and URLs.
3. Compare each candidate with existing accessory functions and IDs.
4. Add new listings to existing records where appropriate.
5. Add a new record only for a genuinely new accessory.
6. Add a category only when the product group recurs enough to justify one.
7. Mark unavailable links as `dead`; retain their title and URL.
8. Update `source_period` and `last_reviewed`.
9. Add preview images only as optional local/static assets or stable direct URLs.
10. Run all tests and copy the source page to its published counterpart.

## 9. MVP Boundaries

Do not implement automatic AliExpress scraping, automatic affiliate conversion, price or stock tracking, image scraping, user accounts, submissions, ratings, favorites, automated link checks, CMS functionality, or a large taxonomy.
