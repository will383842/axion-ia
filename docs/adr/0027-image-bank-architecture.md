# ADR 0027 — Image Bank Architecture (V1)

> ⚠️ **SUPERSEDED (identité) — Axion-IA est désormais une SAS française (régime France).** Le copyright/licence des images doit porter « © Axion-IA SAS » et non « Axion-IA OÜ (estonienne, 0 SIREN) ». L'architecture image-bank décrite reste valable. Corps historique conservé pour l'audit trail.

- **Statut** : Accepted
- **Date** : 2026-05-16
- **Sprint** : 1 → 7 (autopilot V1)
- **Spec maître** : `_AUDIT/PROMPT-IMAGE-BANK-AUDIT-AUTOPILOT-2026.md` (~1100 lignes)
- **Skill SSOT** : `.claude/skills/axionia-image-bank/`

## Contexte

Axion-IA OÜ a besoin d'une banque d'images SEO/AEO/GEO 2026 :

- Optimisée pour Google Image Sitemap 1.1, Perplexity citations, Claude.ai answer engines, ChatGPT Search
- Bilingue FR canonique / EN miroir
- License CC BY 4.0 par défaut (badge Licensable Google +30% CTR)
- Copyright `Axion-IA OÜ` (estonienne, 0 SIREN — anti-French entity)
- Pipeline Sharp natif (variants WebP + AVIF + LQIP + thumbnail)
- Auto-traduction Claude Sonnet 4.6 vision
- Auto-détection pays cibles déterministe (table Country)
- IndexNow ping étendu Bing/Yandex
- Watermark on-the-fly optionnel per-image
- RGPD : IP SHA-256 hashées via `IP_HASH_SALT`, droit à l'effacement

## Décisions

### 1. Schema DB — 10 nouvelles tables Prisma

- **Country** (PRÉREQUIS bloquant) : seedée depuis REST Countries API
  (~249 lignes, idempotent upsert) → `image-country-detector.service.ts`
  résout `nom de pays → ISO 2-letters` déterministe.
- **8 tables image-bank core** : ImageAsset (50+ colonnes), ImageAssetTranslation,
  ImageCategory + Translation, ImageTag + Translation, ImageAssetTag (M:N pivot),
  ImageUsageLog.
- **ImageDownloadLog** : table dédiée RGPD (rétention 12 mois par défaut via
  `RETENTION_IMAGE_LOGS_MONTHS`).
- **ImageImportBatch** : audit trail bulk-import CSV (compliance traçabilité).

Indexes GIN raw SQL (Prisma ne supporte pas natif) sur `target_countries`,
`target_languages`, `keywords_secondary` (jsonb arrays).

FTS tsvector sur `image_asset_translations.search_vector` (pondération
A=title/alt, B=caption, C=description).

### 2. Décisions défauts autopilote (5 STOP & ASK SKILL §12)

| #   | Question     | Décision                                                                                           | Réversible |
| --- | ------------ | -------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Storage dev  | Local `public/image-bank/` ; prod = `/data/image-bank/` Hetzner                                    | Oui        |
| 2   | EN miroir V1 | Oui — Claude worker translate FR→EN ; translations stockées DB même si `EN_LOCALE_ENABLED=false`   | Oui        |
| 3   | Watermark    | Optionnel per-image (`watermarkEnabled boolean @default(false)`) + on-the-fly Sharp composite      | Oui        |
| 4   | License enum | Éditable admin (6 options CC BY) ; défaut `cc-by-4.0`                                              | Oui        |
| 5   | AI-generated | Autorisé avec `sourceType` enum + `aiModel` string ; JSON-LD `isBasedOn: SoftwareApplication` auto | Oui        |

### 3. Cloisonnement strict (isolation-check)

Tout le code image-bank vit EXCLUSIVEMENT sous :

- `src/server/image-bank/**` (services, taxonomy SSOT)
- `src/server/actions/image-bank/**` (Server Actions)
- `src/app/[locale]/(admin)/[adminPrefix]/image-bank/**` (admin UI, 15 sub-pages V1)
- `src/app/[locale]/galerie/**` (public, 6 routes V1)
- `src/app/sitemaps/images-{fr,en}.xml/**` (sub-sitemaps Google 1.1)
- `src/components/admin/image-bank/**`, `src/components/galerie/**`
- `src/server/queue/workers/image-bank-*-worker.ts` (4 workers V1)
- `prisma/{seeds,migrations,migrations_fts}/image-bank/**`
- `scripts/image-bank/**`

Exceptions explicites listées dans `scripts/image-bank/isolation-check.ts`
(sitemap.ts, routing.ts, Footer.tsx, presse, AdminCommandPalette,
queues.ts, worker.ts, connection.ts, package.json, schema.prisma,
env.ts, lighthouserc.json, image-utils.ts shared lib).

### 4. Web Vitals — gate CI

Source de vérité = `lighthouserc.json` (PAS AGENTS.md cible interne).
Seuils bloquants PR :

- LCP ≤ 1800ms, INP ≤ 80ms, CLS ≤ 0.05, TBT ≤ 150ms
- FCP ≤ 1500ms, Speed Index ≤ 2500ms
- Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO = 100
- First Load JS ≤ 75 KB gz/route (`/galerie/**`, `/gallery/**`)

ADR de resync `AGENTS.md` (cible interne « INP ≤ 100ms p75, CLS = 0 »)
ouvert ici — alignement futur sur `lighthouserc.json` à la prochaine MAJ
de la doctrine perf.

### 5. Conséquences

**Positif** :

- Architecture SSOT taxonomy + 11 services modulaires testables
- Bilingue native — translations Claude background job, pas de waste
  build CPU
- IndexNow extension automatique pour les URLs publiées (best-effort
  via `collectImageBankUrls()` non-bloquant)
- Cloisonnement isole les régressions cross-module
- RGPD by design (ip_hash SHA-256, retention purge worker étendu)

**Négatif** :

- Volume schema : 10 tables nouvelles, ~30 indexes (acceptable Postgres
  16+ Hetzner CPX42)
- Sprint 5 workers nécessitent activation manuelle (`startXxxWorker()`
  appelée depuis `src/server/queue/worker.ts` — Sprint 5.x QA staging)
- Tests E2E Playwright admin + public reportés Sprint 2.x/3.x (DB live
  - seed images requis)
- LCP gate sur `/galerie/[slug]` requiert images seed en CI (Sprint 6.x)

### 6. Roadmap V1.5 (backlog Sprint 8)

- pHash perceptual (sharp-phash) → reverse image search admin
- JPEG XL Sharp 0.34+ (Chrome 119+/Safari 17+)
- Cloudflare Polish + Mirage (action humaine dashboard)
- Dashboard ROI AEO/GEO (Recharts, embeds par jour, referrers LLM)
- IPTC/XMP namespace `XMP-axionia:*` via `exiftool-vendored`
- Naver Webmaster (marché coréen si confirmé)
- AVIF effort 9 async worker (gain 5-10% poids)

## Refs

- Spec maître : `_AUDIT/PROMPT-IMAGE-BANK-AUDIT-AUTOPILOT-2026.md`
- Skill : `.claude/skills/axionia-image-bank/{SKILL.md,IMPLEMENTATION-PLAN.md}`
- Reality-check : `references/axionia-stack-validated.md`
- Décisions défauts : `prompts/stop-and-ask-decisions.md`
- Inputs Will : `prompts/inputs-will-required.md`
- Commits V1 : `git log feat/image-bank-v1 --oneline` (7 commits Sprint 1-7)
