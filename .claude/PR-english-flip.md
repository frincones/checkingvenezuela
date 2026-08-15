**Título del PR:**

```
feat(i18n): flip the public site to English
```

**Base:** `dev` ← **Compare:** `feat/english-flip`

---

The site was half-translated and inconsistent: `<html lang="en">` and the root
metadata were already English while the whole landing, all DB content and every
customer-facing document were still Spanish. The audience is now English-only,
so this makes the flip permanent instead of adding an i18n abstraction we would
never use for a second language.

## Code — 45 files translated in place

No dictionary, no `t()`. A permanently monolingual site does not need the
abstraction, and git is the rollback.

- home sections, WhatsApp CTAs, lead-capture form
- packages, destinations, blog
- the 4 legal pages, rewritten rather than string-replaced
- flights/hotels metadata, root maintenance message
- the 3 `data/*.js` fallbacks — they render when Supabase fails, so leaving them
  in Spanish would return the landing to Spanish during an incident
- `openGraph.locale` normalised `es_VE` → `en_VE` on 6 pages

Deliberately untouched: `blog_posts.category` keys (they travel in
`/blog?category=…` and are compared raw against the DB — translating them would
have emptied the blog with no error), slugs, SKUs and enum values.

## Stable package slugs

`supabase/migrations/20260814_inventory_slug.sql` — **already applied.**

Package URLs were derived from `name` at runtime, so translating a name would
have silently changed its URL and broken every indexed, shared or quoted link.
Adds a real `slug` column; `findPackageBySlug` resolves by it with a fallback to
the old name match, so the deploy is order-independent.

Also fixes `app/sitemap.js`, which queried the non-existent column and therefore
left **every package out of the sitemap**. Now 11 package URLs are listed.

## Chatbot knowledge base

Four defects found while auditing the RAG pipeline:

- `extractDestinations` had no `is_active` filter, so the index included
  deactivated destinations
- `ingestDocuments` upserts by `content_hash`: re-syncing after a content change
  **inserted** the new document and orphaned the old one forever. Added a purge
  for `db_*` sources
- `kb/sync` re-tagged every document as `es` on each run
- `searchPackages` built `/packages/<destination-slug>` — a 404 in production
- `searchDestinations` offered deactivated destinations

## Database work (already applied to production)

| | before | after |
|---|---:|---:|
| Active Venezuela destinations | 14 (5 duplicated pairs) | **9** |
| Published packages | 15 | **11** |
| Published posts | 16 | **11** |
| Package URLs in sitemap | 0 | **11** |

Spanish rows that already had a hand-made English twin were archived, never
deleted — 11 packages are referenced by issued quotations. `destination_id` on
9 packages and 8 posts was repointed to the English destination first, so the
English destination pages keep their packages.

62 rows then translated in place with a free-tier LLM chain
(`nemotron-120b:free`), reviewed, and 14 leftovers corrected by hand.

## Verification

- `npm run build` exit 0, `npm run lint` no errors
- Historical quotations unaffected: `items[]` is a frozen snapshot and the PDF
  generator never re-reads `service_inventory`
- 0 slug collisions, 0 NULL slugs
- Scripts in `scripts/english-flip/` are dry-run by default, `--apply` to write
- `backups/` is gitignored — the dumps carry provider contact details

## After merging

1. Re-sync the KB from `/dashboard/chatbot/knowledge-base` (the purge must be
   live first, hence after deploy)
2. Upload the 4 corporate `.docx` in English

**Not in this PR**: customer-facing emails and PDFs. The `.hbs` templates still
say "CHECK-IN VENEZUELA", the quotation PDF and voucher are still Spanish, and
`emailDefaultData.js` links to `/terms-and-conditions`, which does not exist.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
