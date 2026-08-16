# XPeng G6 Accessories MVP

## Summary

Add a third dependency-free Hebrew RTL app for useful XPeng G6 accessories discussed in the WhatsApp group, especially AliExpress products.

The catalog will use permanent accessory entities, support multiple replaceable listings, remain GitHub Pages-compatible, and be easy to update when new chat dumps arrive.

Initial chat review found 53 AliExpress-related messages and 48 unique AliExpress URLs, plus product discussions without links.

## Data And Updates

Review each chat dump for product links, product discussions, purchase reports, recommendations, and negative feedback. Build a manually reviewed candidate inventory, deduplicate by accessory function, and publish only useful products with meaningful community evidence.

Initial categories:

- `אחסון ונוחות`
- `הגנה ועיצוב`
- `טעינה וחשמל`
- `ניקוי ותחזוקה`
- `אלקטרוניקה ותיעוד`

Categories are editorial data and may be expanded or adjusted when future chat dumps reveal recurring new product groups. Do not create categories for isolated products.

For every new dump:

1. Store it under `raw-data/` with its date or period.
2. Extract new candidates and compare them with existing accessory IDs.
3. Add listings to existing accessories when appropriate.
4. Add new permanent accessory records for genuinely different products.
5. Reconsider categories when new recurring groups emerge.
6. Update source-period and review metadata.
7. Mark links that no longer work as `dead`; do not delete them.
8. Run the catalog tests.

This remains a manually reviewed workflow. No CMS, database server, automatic categorization, or automatic import is required for the MVP.

## JSON Data

Add `xpeng_accessories.json`:

```json
{
  "meta": {
    "source": "סיכום דיונים בקהילת WhatsApp",
    "source_period": "03.07.2026–14.08.2026",
    "last_reviewed": "2026-08-16",
    "disclaimer": "הקישורים והמידע מבוססים על דיוני קהילה ואינם המלצה רשמית."
  },
  "accessories": [
    {
      "id": "screen-protector",
      "name": "מגן מסך",
      "category": "הגנה ועיצוב",
      "search": "XPeng G6 screen protector 15.6 matte",
      "fit": "יש לבחור מידה ושנתון מתאימים",
      "notes": "בדיון הוזכרו גרסאות זכוכית מט וסיליקון.",
      "preview_image": "",
      "listings": [
        {
          "url": "https://a.aliexpress.com/...",
          "title": "Original listing title",
          "source_date": "2026-08-10",
          "last_seen": "2026-08-16",
          "status": "unknown",
          "affiliate_url": ""
        }
      ]
    }
  ]
}
```

Rules:

- The accessory `id` is permanent.
- `url` remains the original community URL.
- `affiliate_url` is optional; the UI uses it when populated and otherwise uses `url`.
- Dead listings remain stored with their original title and metadata.
- `preview_image` is optional and initially empty.
- `preview_image` must support a direct image URL or future local/static image path without a data-model rewrite.
- Do not store prices, stock, seller ratings, or automated availability data.

## Affiliate Links

Provide a simple editorial facility:

1. Preserve the original URL.
2. Add an optional `affiliate_url`.
3. Prefer `affiliate_url` in the rendered purchase link.
4. Show a generic affiliate disclosure when affiliate URLs exist.
5. Do not automatically generate or transform affiliate URLs.

## Product Preview Images

The UI and JSON must be designed so product previews can be enabled incrementally:

- Render an image only when `preview_image` is non-empty.
- Use fixed responsive dimensions and `object-fit: contain` so cards do not jump in size.
- Include meaningful Hebrew `alt` text derived from the accessory name.
- Do not require images for every product in the MVP.
- Prefer images hosted in the repository or stable direct image URLs; do not scrape AliExpress pages.
- Later image additions should require JSON edits and asset additions only, not a rendering redesign.

## Minimal UI

Add:

- `xpeng_accessories.html` as the editable source.
- `accessories.html` as the published copy.
- `xpeng_accessories_app.js`.
- `xpeng_accessories.json`.

The UI should include:

- Hebrew RTL header and home link.
- Community disclaimer.
- Search across names, categories, fit notes, notes, and listing titles.
- Category filter.
- Result count and empty state.
- Compact accessory cards.
- Optional product preview image.
- Fit and compatibility notes.
- Multiple listing links.
- Clear dead-link status.
- Search phrase when no active listing remains.

No local-storage state is required.

## Explicitly Out Of Scope

- Affiliate-link generation or automatic conversion.
- Automatic product-image scraping.
- Price, stock, shipping, seller-rating, or ranking data.
- User accounts, submissions, comments, voting, or moderation.
- Automatic category classification.
- Automated link-health monitoring.
- Favorites or purchase tracking.
- Publishing every raw link without editorial review.
