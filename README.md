# KC Personal Archive

A self-hosted personal archive for watches, Obsidian notes and the homelab.
The home page is a dashboard: one place to jump into every app and archive.

## Pages

| Route | What it is |
| --- | --- |
| `/` | Dashboard: archive totals, recent notes, destination list and live Pi-hole status. |
| `/archive` | Watch collection with photos, specs and purchase targets, wishlist priorities, grail list and published notes. |
| `/api/pihole` | Server-side Pi-hole proxy used by the dashboard. |

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run start    # serve the production build
npm run lint
npm test         # build, then run the render tests
```

## Dashboard

Destinations live in [`app/dashboard-config.ts`](app/dashboard-config.ts). Add any
app or archive with a name, description and URL — internal paths start with `/`,
everything else opens in a new tab. The dashboard links to the watch and notes
archives, Pi-hole and the Obsidian vault out of the box.

### Connect Pi-hole

1. Copy the example file and fill in your server:

   ```bash
   cp .dev.vars.example .dev.vars
   ```

2. For Pi-hole v6, create an app password under **Settings → API** and set
   `PIHOLE_URL` + `PIHOLE_PASSWORD`. For v5, use `PIHOLE_API_TOKEN` instead.
   `PIHOLE_ADMIN_URL` and `PIHOLE_VERSION` are optional overrides.

3. Restart `npm run dev`. The card shows live queries, blocked percentage and
   gravity domains; if the server cannot be reached it shows a retry state
   instead of breaking the page.

Credentials are read server-side only. They are never sent to the browser.
`/api/pihole` reuses an in-memory session and the dashboard refreshes once a
minute (and when the tab becomes visible).

> Pi-hole must be reachable **from the machine running the app**. A deployed
> Cloudflare Worker cannot reach a private LAN address; use a Cloudflare Tunnel
> hostname, or run the dashboard on your own network.

The theme toggle stores a light/dark preference in `localStorage`; the archive
keeps its original warm editorial styling.

## Deploy to Cloudflare

The site runs as a Cloudflare Worker (`wrangler.jsonc`). Authenticate once:

```bash
npx wrangler login
```

Then build and publish:

```bash
npm run build
npx @vinext/cloudflare deploy --skip-build --config dist/server/wrangler.json
```

`--skip-build` is deliberate: the current `vinext-cloudflare` release does not
complete its own build lifecycle with this vinext beta, so `npm run build` is the
supported build step. The Worker name is `kc-personal-archive`.

### Automatic deploys

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every
push to `main` or `master` (and can be started manually from the Actions tab). It
installs dependencies, lints, builds and tests, then deploys
`dist/server/wrangler.json` with Wrangler.

Add two repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token from the **Edit Cloudflare Workers** template, restricted to the account |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (Workers & Pages overview URL) |

The workflow deploys committed content. CI cannot reach the iCloud vault, so run
`npm run sync:obsidian` locally and commit the updated
`app/generated-watches.ts`, `app/generated-notes.ts` and `public/watches/` files
before pushing.

`wrangler.jsonc` sets `keep_vars: true`, so variables managed in the Cloudflare
dashboard (such as `PIHOLE_URL`) survive a deploy.

Production requests are redirected from HTTP to HTTPS; localhost is exempt so
`npm run dev` keeps working.

The first deploy needs a `workers.dev` subdomain (Cloudflare prompts for one, or
register it under **Workers & Pages**). The URL is then
`https://kc-personal-archive.<your-subdomain>.workers.dev`. Add a custom domain
under **Workers & Pages → kc-personal-archive → Settings → Domains & Routes**.

Production secrets are set with Wrangler, not committed:

```bash
npx wrangler secret put PIHOLE_PASSWORD
```

Set the non-secret `PIHOLE_URL` as a Worker variable. The LAN caveat above still
applies — a Worker cannot reach a private Pi-hole without a Tunnel.

> **The site has no authentication of its own.** Before sharing the URL, enable
> Cloudflare Access: **Workers & Pages → kc-personal-archive → Access → Protect
> this Worker behind Access → All traffic**, then allow your email address.

## Import notes from Obsidian

The importer reads Markdown from the `Kvan` Obsidian vault in iCloud Drive.
Notes stay private unless they explicitly contain `publish: true`.

Add frontmatter to any note that should appear on the website:

```md
---
publish: true
title: My note title
category: Research
date: 2026-08-20
description: A short summary shown on the archive page.
---

# My note title

Your note content.
```

Then import published notes:

```bash
npm run sync:obsidian
```

For a different vault, set `OBSIDIAN_VAULT_PATH` before running the importer.
The generated website data is committed with the project so the production
host does not need access to iCloud Drive.

### Watches

Watch data comes from the structured notes under `Watches/`:

- `Owned/*.md` → Collection
- `Wishlist/*.md` → Wishlist
- `Grail/*.md` → Grail

Each note uses flat frontmatter (`brand`, `model`, `reference`, `status`,
`category`, `movement`, `priority`, `target_price_eur`, `case_size_mm`, and so
on), a `## Specifications` table or `- Label: value` bullets, and a `## Photos`
embed such as
`![[Watches/Attachments/Product Images/Swatch-Irony-Automatic-Body-Soul-YAS100G.png|360]]`.
Notes without a photo still render, using the CSS dial illustration.
The importer:

- copies the first image to `public/watches/<slug>.webp`, resizing it with
  `sharp` and preserving transparency;
- keeps the `[Image source](…)` link and the caption next to the embed;
- reads `Watches/00 - Watch Collection.md` for the overview, purchase order,
  premium targets, strategy and collecting rules.

`sharp` is a devDependency used only by this importer, so a normal
`npm install` is enough. Re-run `npm run sync:obsidian` after editing a watch
note. The generated `app/generated-watches.ts` and `public/watches/*.webp` are
committed, so the production host does not need access to iCloud Drive.

Published notes are still imported with `publish: true`. If the vault has no
published notes, the importer leaves the existing `app/generated-notes.ts`
unchanged rather than replacing it with an empty list.
