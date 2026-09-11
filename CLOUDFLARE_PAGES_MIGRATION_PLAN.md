# Cloudflare Pages Migration Plan

## Executive Recommendation

Create a new GitHub repository for the broader EV Deck site and connect it directly to a Cloudflare Pages project. Publish the current XPENG tools under `https://evdeck.app/xpeng/`, leaving the root domain available for the EV Deck landing page and future apps. Keep the existing `zeevb/xpeng` repository and its GitHub Pages deployment available as the rollback system during the migration window. The new repository should use a small dependency-free packaging command that creates `dist/` and places the XPENG files under `dist/xpeng/`:

- `dist/xpeng/index.html`
- `dist/xpeng/checklist.html`
- `dist/xpeng/faq.html`
- `dist/xpeng/xpeng_faq_data.js`
- `dist/xpeng/xpeng_faq_app.js`

Configure Cloudflare Pages to deploy `dist/`, with no framework and no package installation. This separates the new deployment process from GitHub Pages, reserves `evdeck.app/` for the platform landing page, and prevents raw source documents, tests, planning files, and editable source pages from becoming public assets.

Cloudflare's Git integration supports GitHub repositories, automatic production deployments, preview deployments, pull-request URLs, and deployment status checks. A framework is not required; for a site without a build step, Cloudflare documents leaving the build command blank. In this repository, a tiny packaging command is still recommended so the published file set remains explicit. See [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) and [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## Confirmed Decisions

- Cloudflare Pages will connect to a new GitHub repository rather than using the existing GitHub Pages repository as the deployment source.
- The intended domain is `evdeck.app`, purchased through Cloudflare Registrar if it is available. The current apps will be served under `evdeck.app/xpeng/`. The site may launch first on the Cloudflare-provided `pages.dev` URL.
- The current GitHub Pages site remains available as a rollback target during and after initial cutover.
- Existing URL paths do not have to be preserved if a cleaner structure or other migration change justifies updating them.
- The plan includes a final recommendations section covering hardening, redirects, preview deployments, uptime checks, and analytics verification.

## Repository Findings

### Application shape

- The application is static HTML, inline CSS, and browser JavaScript with no runtime server and no dependency manifest.
- The landing page is `index.html`.
- `xpeng_app.html` is the editable checklist source and `checklist.html` is the published copy. Repository tests require these files to remain identical.
- `xpeng_faq.html` is the editable FAQ source and `faq.html` is the published copy. Repository tests require these files to remain identical.
- `xpeng_faq_data.js` and `xpeng_faq_app.js` are required by `faq.html`.
- Checklist and comments are stored in browser `localStorage`; migration of hosting does not migrate or reset that data because it remains in each visitor's browser origin.
- The application already loads Cloudflare Web Analytics from `static.cloudflareinsights.com`.

### Existing deployment behavior

`.github/workflows/pages.yml` currently:

1. Runs on pushes to `main` and manual dispatch.
2. Copies only the five public files listed above into `_site/`.
3. Uploads `_site/` as a GitHub Pages artifact.
4. Deploys through the GitHub Pages environment.

The source pages, raw reference documents, tests, planning documents, previews, and WhatsApp source files are not included in the current public artifact. The Cloudflare plan should preserve this boundary.

### Existing verification

The repository has two Node-based test files:

- `tests/checklist-migration.test.js` validates source/published equality, stable checklist IDs, and storage migration behavior.
- `tests/faq.test.js` validates source/published equality, stable FAQ IDs, search/filter behavior, and safe answer rendering.

There is no `package.json`; tests can be run directly with Node. The environment instruction specifies Node.js `v24.12.0` through NVM when Node tooling is needed.

## Target Architecture

```text
New GitHub repository (main)
        |
        | Cloudflare Git integration
        v
Cloudflare Pages build
  mkdir -p dist
  copy XPENG files into dist/xpeng/
        |
        v
Cloudflare Pages project
  production: main
  previews: non-production branches / pull requests
  public output: dist/

Existing `zeevb/xpeng` repository
  GitHub Pages deployment retained as rollback
```

No Workers, Pages Functions, database, framework, bundler, or dependency installation is required for the current product.

## Implementation Plan

### 1. Create and seed the new GitHub repository

Create the new GitHub repository `xpeng-cf` and make it the long-term source repository for the Cloudflare deployment. Copy the XPENG application source, tests, raw data, and relevant documentation into `xpeng-cf` as needed, then make an initial commit before connecting Cloudflare Pages. Structure the repository so additional apps can be added without forcing the XPENG app to become the domain root.

Recommended repository properties:

- Keep the repository private or public according to the project's intended collaboration model.
- Use `main` as the production branch.
- Preserve the existing source/published-file workflow until a later controlled refactor.
- Treat `xpeng/` as the public URL namespace for the current tools.
- Do not copy GitHub Pages-specific deployment assumptions into the new deployment process.
- Do not copy temporary previews, generated review files, or unrelated untracked artifacts unless they are intentionally part of the new project.

The old `zeevb/xpeng` repository remains unchanged during the initial migration and continues serving the known-good GitHub Pages version.

### 2. Preserve the current source and published-file contract

Before changing deployment configuration:

- Confirm `xpeng_app.html` equals `checklist.html` byte-for-byte.
- Confirm `xpeng_faq.html` equals `faq.html` byte-for-byte.
- Keep all existing checklist item IDs unchanged.
- Inventory existing public links and decide whether to keep the `.html` paths or introduce cleaner routes such as `/checklist/` and `/faq/`.
- Do not include `raw-data/` or editable source pages in the public output unless there is an explicit reason to publish them.

This is important because `localStorage` keys and checklist IDs are part of the client-side data contract. A domain change creates a new browser storage origin, while changing only the hosting provider does not preserve data across different hostnames.

### 3. Add a deterministic static packaging step

Add a small executable script such as `scripts/build-pages.sh`, or use the equivalent inline Cloudflare build command. The script should:

- fail on errors;
- remove or recreate only the project-local `dist/` directory;
- copy the five files currently published by GitHub Pages into `dist/xpeng/`;
- optionally copy `_headers` and `_redirects` if those files are added;
- avoid copying tests, raw documents, previews, or planning files.

Recommended command behavior:

```sh
set -eu
rm -rf dist
mkdir -p dist
mkdir -p dist/xpeng
cp index.html checklist.html faq.html xpeng_faq_data.js xpeng_faq_app.js dist/xpeng/
```

The exact script should be tested locally before connecting Cloudflare. If retaining the repository's dependency-free policy is a priority, do not add `package.json` solely for this build.

### 4. Create the Cloudflare Pages project

In Cloudflare Dashboard:

1. Open `Workers & Pages` and create a Pages project.
2. Choose the GitHub integration.
3. Authorize the Cloudflare GitHub application for the new repository.
4. Select `main` as the production branch.
5. Set the Cloudflare Pages project name to something aligned with the repository, such as `xpeng-cf`, if available.
6. Set the root directory to the repository root.
7. Set the build command to the packaging command or the path to the packaging script.
8. Set the build output directory to `dist`.
9. Enable preview deployments for branches or pull requests as appropriate.

If choosing the no-command configuration instead, Cloudflare can deploy a static project without a framework or build command. That option should only be used if the output directory is configured so that only the intended public files are deployed; deploying the repository root would change the current exposure boundary.

### 5. Verify the first preview deployment

Before changing any production DNS or disabling GitHub Pages, test the Cloudflare-generated preview URL.

Check:

- `/xpeng/` loads in Hebrew and right-to-left layout.
- `/xpeng/checklist.html` loads and can mark an item, add a comment, refresh, and retain state.
- `/xpeng/faq.html` loads the FAQ data and app scripts without console errors.
- Hebrew search, Latin search, category filtering, and safe answer rendering work.
- Links between the landing page and tools resolve correctly.
- The browser requests `xpeng_faq_data.js` and `xpeng_faq_app.js` successfully.
- No raw-data, test, or planning paths are accidentally published.
- Mobile layouts work at narrow viewport sizes.
- Cloudflare Web Analytics continues to report page views after deployment.

Run the existing automated tests before and after deployment:

```sh
/home/zeev/.config/nvm/versions/node/v24.12.0/bin/node tests/checklist-migration.test.js
/home/zeev/.config/nvm/versions/node/v24.12.0/bin/node tests/faq.test.js
```

Also run the repository-required checklist syntax check after any checklist source edit:

```sh
sed -n '/<script>/,/<\/script>/p' xpeng_app.html | sed '1d;$d' > /tmp/xpeng-app.js
/home/zeev/.config/nvm/versions/node/v24.12.0/bin/node --check /tmp/xpeng-app.js
```

### 6. Register `evdeck.app` through Cloudflare Registrar

The desired domain is `evdeck.app`. Availability and the final registration price must be checked in Cloudflare Dashboard at purchase time; this plan does not assume that the name is currently available.

Prerequisites and important Registrar behavior:

- Use a Cloudflare account with a verified email address and a valid payment method.
- Cloudflare Registrar domains use Cloudflare nameservers. This is compatible with an apex-domain Pages setup and means the domain cannot use another DNS provider's nameservers while registered with Cloudflare Registrar.
- Enable or confirm auto-renewal intentionally. Cloudflare enables auto-renew by default for registrations.
- Complete the registrant email verification promptly. An unverified or expired verification can place the domain on hold and replace its nameservers with parking nameservers until verification is completed.
- Record the Cloudflare account ownership and renewal responsibility in the project documentation.

Purchase sequence:

1. In Cloudflare Dashboard, open `Register domains`.
2. Search for `evdeck.app` and confirm the definitive availability result.
3. Review the registration term, renewal date, price, and auto-renew setting.
4. Enter accurate registrant contact details.
5. Complete payment and registrant email verification.
6. Confirm the domain is active in Cloudflare DNS before attaching it to Pages.

Cloudflare's official registration requirements are documented in [Register a new domain](https://developers.cloudflare.com/registrar/get-started/register-domain/) and the [Registrar FAQ](https://developers.cloudflare.com/registrar/faq/). Pages domain attachment details are documented in [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

### 7. Launch on `pages.dev`, then attach `evdeck.app`

There are two cases:

#### Initial launch without a custom domain

Yes, the site can start without a custom domain. Use the project URL, for example `https://evdeck.pages.dev/xpeng/`. No DNS migration is needed. Validate the production deployment there, share it only as an interim URL, and attach the custom domain later from the Pages project settings.

The XPENG routes must be explicitly tested under the `/xpeng/` prefix. Since the current links and script references are relative (`index.html`, `checklist.html`, `faq.html`, `xpeng_faq_data.js`, and `xpeng_faq_app.js`), they should continue working when all XPENG assets are copied into the same `dist/xpeng/` directory. Do not convert them to root-absolute paths such as `/checklist.html`, because those would escape the `/xpeng/` namespace. Cloudflare Pages may also provide extensionless redirects for HTML pages; explicitly test both `.html` routes and extensionless variants before choosing canonical URLs. See [Cloudflare Pages serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/).

When `evdeck.app` is registered and active:

1. In the Pages project, open `Custom domains` and choose `Set up a domain`.
2. Enter `evdeck.app` and activate it.
3. Verify HTTPS and the selected canonical URL.
4. Decide whether `pages.dev` should redirect to `evdeck.app` or remain available.
5. Update external links, announcements, analytics expectations, and any canonical metadata.

### 8. Add the migration-specific test and route checks

If paths or script locations change, add a small link/asset smoke test before cutover. It should verify every public HTML page references files that exist in `dist/`, and that any old route redirects to the chosen new route. Keep the existing checklist and FAQ tests unchanged unless the application code itself changes.

### 9. Add low-risk security and indexing controls

Optionally add a repository-root `_headers` file so the packaging step copies it to `dist/`. Start with narrowly scoped headers:

```text
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Do not add a restrictive Content Security Policy without testing it against the inline scripts, Cloudflare Analytics beacon, and all pages. The current app uses inline CSS and inline JavaScript, so a CSP would require deliberate nonce/hash or architecture changes.

Consider adding `X-Robots-Tag: noindex` only for preview or `pages.dev` hostnames if the site should be indexed solely under a custom domain. Confirm the desired SEO behavior first. Cloudflare Pages supports `_headers` and `_redirects` files in the static output directory; redirects run before headers. See [custom headers](https://developers.cloudflare.com/pages/configuration/headers/) and [redirects](https://developers.cloudflare.com/pages/configuration/redirects/).

### 10. Cut over and keep rollback available

Recommended order:

1. Deploy and validate the Cloudflare Pages production branch on its `pages.dev` URL.
2. Keep the old GitHub Pages URL and deployment unchanged.
3. Compare the production pages with the known-good GitHub Pages site.
4. Publish the `pages.dev/xpeng/` URL as the initial production URL while `evdeck.app` is being registered or configured.
5. Attach `evdeck.app`, verify HTTPS, and make `evdeck.app/xpeng/` the canonical public URL for the XPENG tools.
6. Keep the old GitHub Pages workflow and project available for a defined rollback period.
7. After the rollback window, archive rather than delete the old repository/deployment unless there is a clear reason to remove it.

If the custom domain is moved to Cloudflare, rollback is a DNS change back to the GitHub Pages target, subject to DNS caching. If only the `pages.dev` URL is used, rollback is selecting a previous Cloudflare deployment or restoring the previous deployment configuration.

## GitHub Actions Decision

The current GitHub Pages workflow should be treated as one of these options:

- **Retire after cutover:** remove or disable `.github/workflows/pages.yml` after the Cloudflare production deployment is stable.
- **Keep as rollback:** leave it enabled temporarily, but recognize that pushes to `main` will publish both platforms.
- **Keep for validation only:** alter it to run tests without deploying, if a CI check is desired.

The recommended long-term state is Cloudflare Pages for deployment from the new repository, a lightweight GitHub Actions workflow for tests, and the old repository retained as read-only rollback history. Do not maintain two actively edited production sources indefinitely because they can drift in file selection or application behavior.

## Validation Matrix

| Area | Expected result | Evidence |
|---|---|---|
| Build | `dist/xpeng/` contains the five intended XPENG public files | Cloudflare build log and artifact inspection |
| XPENG landing page | `/xpeng/` renders correctly in Hebrew/RTL | Desktop and mobile browser check |
| Checklist | `/xpeng/checklist.html` statuses and comments survive refresh | Browser `localStorage` behavior |
| Checklist migration | Existing stable IDs and comments remain compatible | `tests/checklist-migration.test.js` |
| FAQ | Data, filters, search, and rendering work | `tests/faq.test.js` and browser console |
| Navigation | All public links resolve | Link smoke test |
| Analytics | Beacon requests and dashboard events continue | Browser network panel and analytics dashboard |
| Domain | HTTPS and intended hostname resolve | DNS and certificate check |
| Exposure | Raw source/reference files are not public | Request checks for representative paths |
| Rollback | Old deployment remains usable during the window | Direct old URL or DNS rollback test |

## Risks and Mitigations

### Browser storage and hostname changes

`localStorage` is scoped to the origin. Users moving from `zeevb.github.io` to a custom domain or `pages.dev` will not automatically carry their checklist state or comments to the new origin. This is expected for the current local-only design. If cross-device or cross-domain persistence is required, that is a separate product change involving an API and data/privacy decisions.

### Accidentally publishing repository files

Cloudflare Pages can deploy a repository without a framework, but deploying the repository root would expose more files than the current GitHub Pages workflow. The explicit `dist/` package avoids this.

### HTML extension behavior

Cloudflare may redirect `.html` requests to extensionless paths. Existing links should be tested on the actual Pages hostname, and any desired canonical URL policy should be documented before adding redirects.

### Inline scripts and headers

Security headers can break the current inline JavaScript if applied too aggressively. Start with non-breaking headers and add CSP only after a browser test matrix.

### Dual deployment drift

Keeping both GitHub Pages and Cloudflare Pages active can create mismatched public artifacts. Use one source of truth for deployment and keep the old platform only as a temporary rollback target.

## Definition of Done

The migration is complete when:

- Cloudflare Pages deploys `main` successfully from the GitHub repository.
- The output contains only the intended public files.
- The landing page, checklist, and FAQ pass automated and browser validation.
- Public paths and any agreed custom domain work over HTTPS.
- Analytics behavior is confirmed.
- DNS cutover and rollback ownership are documented.
- GitHub Pages is either intentionally retained as rollback or retired.
- Future content changes continue to run the existing equality, stable-ID, and FAQ tests.

## Recommendations

### Repository and deployment

- Make the new repository the only actively edited source after cutover.
- Keep Cloudflare Pages connected through Git integration so pushes and pull requests receive deployment status and preview URLs.
- Add a GitHub Actions test workflow in the new repository that runs the two existing Node tests and the checklist syntax check.
- Use a protected `main` branch and require the test workflow to pass before merging.
- Keep the old GitHub Pages repository read-only during the rollback window; do not accept content changes there.

### Build and release

- Keep the explicit `dist/` packaging step so the public file allowlist is visible and reviewable.
- Add a build verification step that fails if an expected public file is missing.
- Add a browser smoke test for the Cloudflare preview URL before merging changes that affect navigation, scripts, or layout.
- Treat route changes as a separate release decision and maintain redirects for any links that have already been distributed.

### Security and headers

- Add `_headers` with `X-Content-Type-Options`, `Referrer-Policy`, and a narrowly scoped `Permissions-Policy` after confirming browser compatibility.
- Add a Content Security Policy only as a separate task. The current inline CSS and JavaScript and external analytics beacon require deliberate CSP design and testing.
- Do not publish raw WhatsApp exports, reference documents, tests, or source-only files unless there is a specific public-use case.

### Domain, SEO, and redirects

- Launch on `pages.dev` first; Cloudflare supports adding a custom domain later without rebuilding the application architecture.
- Once a domain is selected, choose one canonical hostname and redirect alternate hostnames to it.
- Decide whether the `pages.dev` hostname should be indexed or redirected, then apply `X-Robots-Tag`, canonical metadata, or redirects consistently.
- Add `robots.txt`, sitemap, and canonical metadata only when the final hostname and route structure are known.

### Monitoring and rollback

- Verify Cloudflare Web Analytics after the first production deployment and again after adding the custom domain.
- Add an external uptime check for `/xpeng/`, `/xpeng/checklist.html`, and `/xpeng/faq.html` or their replacement routes.
- Keep a short written rollback runbook covering the old GitHub Pages URL, DNS changes, cache considerations, and the owner responsible for the decision.
- Review the old deployment after a defined period, such as 30 days, and archive it only after confirming that no important links or user workflows depend on it.

## Open Follow-up Work

These are outside the minimum hosting migration unless explicitly included:

- Converting editable source pages and published copies into a generated build process.
- Adding a formal `package.json` test command.
- Adding browser automation for desktop/mobile smoke tests.
- Adding a favicon, `robots.txt`, sitemap, or canonical metadata.
- Moving checklist state and comments from browser-only storage to a shared backend.
- Adding Cloudflare Workers or Pages Functions for server-side behavior.
