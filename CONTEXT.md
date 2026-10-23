# Project Context — KC Personal Archive

Snapshot: 2026-10-23 · branch `main` · base commit `cfc70ee` plus the dashboard and watch-archive
work in the working tree. Verified on this machine with Node 26.12.0 / npm 11.20.0: `npm run build`,
`npm run lint` and `npm test` pass. The watch archive now holds 16 pieces (4 owned, 11 wishlist,
1 grail) and 16 optimised product images. The site is deployed at
`https://kc-personal-archive.kvan-dev.workers.dev`; `/`, `/archive` and `/api/pihole`
return 200 over HTTPS, and 20/20 sampled dashboard requests succeeded.

## 1. What this is

A private, self-hosted personal archive for **watches, Obsidian notes and the homelab**.

- `/` is now a **dashboard**: archive totals, recent notes, a destination list, and a live
  Pi-hole status card.
- `/archive` is the warm editorial watch/notes experience: product photography, full
  specifications, purchase targets and priorities, the grail, and published notes.
- Content is static and baked in at build time. Only Pi-hole stats are fetched at runtime.

Audience: one owner (Kevin), on desktop and phone. Success means any app or archive is at most
two clicks away, key numbers are visible without scrolling, and a missing Pi-hole degrades
gracefully instead of breaking the page.

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| Framework | `vinext` 1.0.0-beta.2 — Next.js App Router-compatible runtime on Vite |
| UI | React 19.2.6, one client dashboard component, plain CSS |
| Bundler | Vite 8 + `@vitejs/plugin-react` + `@vitejs/plugin-rsc` |
| Hosting target | Cloudflare Workers via `@cloudflare/vite-plugin`; entry `worker/index.ts` |
| Styling | Hand-written CSS: `app/globals.css` (archive) + `app/dashboard.css` (dashboard) |
| Data | Generated TypeScript modules (`app/generated-*.ts`), committed to git |
| Image sync | `sharp` 0.34.5 (devDependency): WebP conversion, alpha and average-colour sampling |
| Runtime API | `app/api/pihole/route.ts`, server-side proxy with optional v5/v6 support |
| Tooling | TypeScript 5.9 strict, ESLint 9 flat config, Node >= 22.13.0, npm lockfile |

## 3. Routes

| Route | Type | Purpose |
| --- | --- | --- |
| `/` | Server page + client view | Dashboard (`app/page.tsx` → `app/dashboard.tsx`). |
| `/archive` | Server page + client view | Watch collection with photos/specs, wishlist priorities, grail, published notes. |
| `/api/pihole` | Route handler | Normalised Pi-hole stats for the dashboard. |

`app/page.tsx` and `app/archive/page.tsx` are thin server wrappers so each route can export
its own `metadata`; the interactive views live beside them.

## 4. Commands

```bash
npm install            # required first
npm run dev            # http://localhost:3000, loads .dev.vars
npm run build          # production build into dist/
npm run start          # Node production server (no .dev.vars loading)
npm run lint           # eslint . (ignores dist, .next, build)
npm test               # build, then node --test tests/rendered-html.test.mjs
npm run sync:obsidian  # regenerate app/generated-*.ts from the Obsidian vault
npm run db:generate    # drizzle-kit generate (no tables defined yet)
```

### Deployment

```bash
npx wrangler login
npm run build
npx @vinext/cloudflare deploy --skip-build --config dist/server/wrangler.json
```

The Worker is `kc-personal-archive` on the `kvan-dev` workers.dev subdomain. The
`--skip-build` flag is required because `vinext-cloudflare` 1.2.0 does not complete its
build lifecycle with vinext 1.0.0-beta.2; `npm run build` succeeds and the skip-build deploy
uploads `dist/server` + `dist/client`. `wrangler.jsonc` holds the name, compatibility flags
and assets config. The full `vinext-cloudflare deploy` command currently exits with
“The Cloudflare build lifecycle did not complete.” after a successful Vite build.

Automatic production deploys are handled by `.github/workflows/deploy.yml` on pushes to
`main` or `master` (the live repo uses `main`). It runs `npm ci`, `npm run lint`, `npm test`
(which builds) and `npx wrangler deploy --config dist/server/wrangler.json`. The repository
secrets are `CLOUDFLARE_API_TOKEN` (Account → Workers Scripts → Edit) and
`CLOUDFLARE_ACCOUNT_ID`. CI does not run `sync:obsidian`; generated watch/note data and
`public/watches/` must be committed with the content change.

Production HTTP requests are redirected to HTTPS in `worker/index.ts`; localhost,
127.0.0.1 and `.local` hosts are exempt for development.

Production Pi-hole secrets go through `npx wrangler secret put PIHOLE_PASSWORD` (and
`PIHOLE_API_TOKEN` for v5). Non-secret `PIHOLE_URL` can be a Worker variable. Nothing is
configured in production yet, so the card shows its setup state.

## 5. Repository map

```
app/
  page.tsx                 # "/" metadata + <Dashboard initialNow=… />
  dashboard.tsx            # dashboard client view: hero, stats, cards, search, theme
  dashboard-config.ts      # destination registry + owner identity (edit this to add apps)
  dashboard.css            # dashboard tokens, layout, states, dark mode, responsive rules
  pihole-types.ts          # shared PiholeState union for route + UI
  api/pihole/route.ts      # server-side Pi-hole v5/v6 adapter with session cache
  archive/
    page.tsx               # "/archive" metadata
    archive-view.tsx       # watch cards, filters, purchase plan, notes
  layout.tsx               # fonts, metadata template, theme bootstrap script, CSS imports
  globals.css              # archive styles (warm editorial language)
  generated-notes.ts       # GENERATED — do not edit
  generated-watches.ts     # GENERATED — watches + purchase plan (do not edit)
  components/icons.tsx     # inline SVG icon set
  chatgpt-auth.ts          # unused starter leftover
content/obsidian/          # committed copy of the published Obsidian note
scripts/sync-obsidian.mjs  # Markdown → generated TypeScript importer
worker/index.ts            # Cloudflare Worker entry (vinext + image optimisation)
wrangler.jsonc             # Worker name, compatibility flags, assets (deploy source of truth)
db/, drizzle/, examples/   # dormant D1/Drizzle scaffolding and example route
build/sites-vite-plugin.ts # unused OpenAI Sites packaging plugin
tests/rendered-html.test.mjs # dashboard, archive and Pi-hole-unconfigured render tests
public/watches/            # optimised watch photos (generated by sync:obsidian)
public/                    # favicon + unused starter SVGs
```

## 6. Dashboard composition

```
┌ sticky top bar: KC° · Apps/Archive/Status · search (⌘K) · clock · theme ┐
├ hero: live status · "Good morning, Kevin." · date/time/location          ┤
├ 4-stat strip: Owned · Wishlist · Notes · Blocked (links)                 ┤
├ 12-col bento                                                            ┤
│  Destinations list (5 cols)       Watch archive, dark (7 cols)           │
│  Pi-hole live card (5 cols)       Notes / recent notes (7 cols)          │
└ footer: status · totals · archive/top links ─────────────────────────────┘
```

Behaviour:

- **Search** filters destinations and notes together; a live region announces counts. `⌘K` /
  `Ctrl+K` focuses it, `/` focuses it outside inputs, `Escape` clears and blurs.
- **Theme**: CSS-only icon swap driven by `data-theme` on `<html>`; the preference is stored in
  `localStorage` under `kc-theme`, set before paint by an inline script in `layout.tsx`.
  `useSyncExternalStore` exposes the current theme to the button's `aria-pressed` label.
  Dark tokens are scoped to `.dashboard`, so `/archive` intentionally stays light.
- **Time**: the server passes `initialNow`; the client refreshes after 1s and every 30s.
  All formatting uses `Intl` with `Europe/Lisbon` and an explicit `h23` hour cycle.
- **Watch card**: total pieces, owned/wishlist/grail split, three CSS dials built from each
  watch's `dial`/`accent`, and the current grail name.
- **Pi-hole card** states: loading skeleton → not configured → unreachable (with retry) →
  live (gauge, queries, blocked, gravity domains, last update). The gauge is decorative;
  the percentage is also exposed as text.
- **Notes card**: up to three published notes, category, excerpt, date and read time. Rows are
  not links yet because no detail route exists.
- **Destinations**: config-driven list with icons, group/meta labels, external-link handling.

### Design tokens (light)

`--dash-bg #f1ece2` · `--dash-surface #fbf9f4` · `--dash-ink #1f211d` ·
`--dash-muted #5f6158` · `--dash-line #d8d2c5` · `--dash-accent #b8432c` ·
`--dash-accent-soft #f4b86e` · `--dash-ok #2f6b3f` · `--dash-danger #a3352a` ·
`--dash-wait #8a5a12` · dark card `#23251f`.

Dark values live in `:root[data-theme="dark"] .dashboard`. Contrast checks: ink on cream
≈13.9:1, muted on paper ≈6.1:1, accent on paper ≈5.2:1, ok on paper ≈6.0:1; dark ink on
`#141510` ≈14:1 and dark muted on `#1c1e18` ≈7:1. Focus is a 2px ink outline with 3px offset
(light outline on the dark watch card); the search shows a ring on `:focus-within`.

Breakpoints: 1120px (watch/destinations full width, Pi-hole/notes half), 900px (all cards
full width), 620px (2×2 stats, one-column grid, stacked watch body), 400px (stacked Pi-hole
gauge). Reduced motion disables animation and transitions.

## 7. Adding an app or archive

Edit `app/dashboard-config.ts` and append to `destinations`:

```ts
{
  id: "home-assistant",
  name: "Home Assistant",
  description: "Lights, climate and sensors.",
  href: "http://homeassistant.local:8123",
  meta: "Home automation",
  icon: "link",            // watch | note | shield | vault | link
  group: "Homelab",        // Archives | Homelab | Tools
  external: true,
}
```

Internal paths (`/archive#watches`) render with `next/link`; anything else opens in a new tab.
Stats and the watch card are computed from `generated-watches.ts` / `generated-notes.ts`, so
adding a watch or note requires re-running the importer, not editing the dashboard.

## 8. Pi-hole integration

`/api/pihole` reads environment variables server-side:

| Variable | Meaning |
| --- | --- |
| `PIHOLE_URL` | Base URL, e.g. `http://pi.hole` or a Tunnel hostname. Required. |
| `PIHOLE_PASSWORD` | Pi-hole v6 app password (Settings → API). |
| `PIHOLE_API_TOKEN` | Pi-hole v5 API token (alternative to the password). |
| `PIHOLE_ADMIN_URL` | Optional admin link override; defaults to `${PIHOLE_URL}/admin`. |
| `PIHOLE_VERSION` | Optional `v5`/`v6` override; otherwise inferred from which secret is set. |

Setup: `cp .dev.vars.example .dev.vars`, fill values, restart `npm run dev`. `.dev.vars` is
gitignored. `vinext start` does not read it — pass variables through the shell/process env
there. The Worker build enables `nodejs_compat_populate_process_env` so `process.env` works
in both runtimes.

Implementation notes:

- v6: `POST /api/auth` → `session.sid`, then `GET /api/stats/summary` with `X-FTL-SID`.
  The SID is cached in module scope until shortly before `session.validity` expires, and a
  401 triggers one re-authentication.
- v5: `GET /admin/api.php?summaryRaw&auth=…`.
- Every outbound request has a 6s timeout; failures map to `auth`, `http`, `network` or
  `timeout` messages. Responses are `no-store`.
- Secrets never leave the server; the client only sees normalised numbers and the admin URL.
- The dashboard polls once a minute and on tab visibility; failed polls keep the last
  successful card only until the next response replaces it.

**Network caveat:** a Pi-hole on a private LAN is unreachable from a deployed Cloudflare
Worker. Use a Cloudflare Tunnel hostname, or run the dashboard locally on the same network.
The UI's error state mentions reachability for this reason.

## 9. Obsidian → archive pipeline

```
Obsidian vault (iCloud: .../Documents/Kvan)
  → npm run sync:obsidian
  → scripts/sync-obsidian.mjs
  → app/generated-notes.ts + app/generated-watches.ts   (committed)
  → app/archive/archive-view.tsx + dashboard cards
```

A note is published only with `publish: true` in flat frontmatter (`title`, `category`,
`date`, `description`, `slug`). Inline lists such as `category: [gmt, pilot]` are supported;
nested objects and multi-line values are not. Read time is `words / 220`, minimum 1 minute.

Watches now come from the structured notes under `Watches/`: `Owned/` → Collection,
`Wishlist/` → Wishlist, `Grail/` → Grail. Flat frontmatter supplies brand, model, reference,
status, categories, movement, priority, target/excellent price, case size, crystal, water
resistance and bracelet. A `## Specifications` table (or prose) supplies the spec rows; the
first `![[…]]` embed supplies the product image. `scripts/sync-obsidian.mjs` copies each image
into `public/watches/<slug>.webp` through `sharp` (devDependency), detects alpha to choose
`contain` vs `cover`, and keeps the image caption and source URL. `Watches/00 - Watch
Collection.md` supplies the overview, purchase order, premium/lower targets, strategy and
collecting rules exposed as `watchPlan`.

Accent/dial colors still cycle through a fixed palette by index for the dashboard dials, so
reordering notes changes those colors. The default vault path is machine-specific; override
with `OBSIDIAN_VAULT_PATH`. If the vault has no published notes, the existing
`app/generated-notes.ts` is left untouched.

## 10. Known gaps

1. **Note detail pages do not exist.** Slugs are generated but the dashboard and archive show
   note summaries only; the archive's `↗` glyph is decorative.
2. **Starter leftovers remain:** `app/chatgpt-auth.ts`, `build/sites-vite-plugin.ts`, `db/`,
   `drizzle/`, `examples/d1/`, and unused `public/*.svg`. `db/index.ts` still references a
   deleted `.openai/hosting.json`.
3. **Watch import depends on Obsidian structure.** Notes need a recognised `status` (or to live
   under `Owned/`, `Wishlist/` or `Grail/`); a malformed frontmatter block or missing `## Photos`
   embed drops the image and falls back to the CSS illustration. Product images are copied by
   `sharp`, so `npm install` must complete before `sync:obsidian`.
4. **Public by default / no app authentication.** The current `workers.dev` deployment is
   publicly reachable. Enable Cloudflare Access before sharing the URL; the archive and
   Pi-hole status have no application-level auth of their own.
5. **Deploy lifecycle workaround.** `vinext-cloudflare deploy` without `--skip-build` exits
   with “The Cloudflare build lifecycle did not complete.” after a successful build. Use
   `npm run build` followed by the `--skip-build` deploy above until the CLI/vinext versions
   align. The initial HTTPS certificate for the new `workers.dev` hostname took several
   minutes to provision; HTTP worked immediately.
6. **Dormant database path.** `vite.config.ts` declares empty D1/R2 bindings; Drizzle has no
   tables or migrations.
7. **Branding leftovers:** the favicon is still the default Next.js mark; the archive uses
   the same `KC°` wordmark but no generated brand asset.
8. **Browser checks are manual.** Headless Chromium lives under the gitignored `.browsers/`
   directory; Playwright is not a project dependency. Re-run desktop/mobile click-throughs
   after routing changes.
9. **vinext client-router workaround.** Internal cross-page links are plain `<a>` elements
   because vinext 1.0.0-beta.2 throws during RSC prefetch ("f is not a function") and swallows
   the navigation; direct page loads and filters work. The dashboard date is joined from
   `formatToParts()` because Node and Chrome ICU versions disagree about commas. Do not
   restore `next/link` without retesting both issues.

## 11. Sensible next steps

1. Add `/notes/[slug]` detail pages and make note rows real links.
2. **Enable Cloudflare Access on the Worker** and test the email login flow.
3. Add a custom domain and point it at the Worker.
4. Add a small "add destination" flow or move `dashboard-config.ts` to a JSON file the owner
   can edit without a rebuild.
5. Remove or deliberately wire the starter leftovers listed above.
6. Replace the ad-hoc frontmatter/watch parser with a YAML parser plus validation.
7. Add a favicon/app icon matching `KC°`.
8. If Pi-hole should be live in production, put it behind a Cloudflare Tunnel and add
   Access service-token headers to the API route.
