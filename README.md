# KC Personal Archive

A self-hosted personal archive for watches and Obsidian notes.

## Development

```bash
npm install
npm run dev
npm run build
```

## Import notes from Obsidian

The importer reads Markdown from the `Kvan` Obsidian vault in iCloud Drive.
Notes stay private unless they explicitly contain `publish: true`.

Add this frontmatter to any note that should appear on the website:

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
