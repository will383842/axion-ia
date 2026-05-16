# Image Bank — Documentation V1

> Banque d'images SEO/AEO/GEO 2026 Axion-IA OÜ. Spec maître :
> [`_AUDIT/PROMPT-IMAGE-BANK-AUDIT-AUTOPILOT-2026.md`](../../_AUDIT/PROMPT-IMAGE-BANK-AUDIT-AUTOPILOT-2026.md).
> ADR : [`0027-image-bank-architecture.md`](../adr/0027-image-bank-architecture.md).

## Overview

Stack Next.js 16 App Router + Postgres 16 + Prisma 5.22 + BullMQ + Sharp +
Claude Sonnet 4.6 vision. Bilingue FR canonique + EN miroir.

**10 tables Prisma** : Country (prérequis) + 8 image-bank core +
ImageDownloadLog + ImageImportBatch.

**11 services TS** : image-bank, image-import, image-seo, image-country-detector,
image-translation, image-seo-enrichment, image-watermark, image-attribute-validator,
image-taxonomy-detector, image-jsonld-graph + taxonomy SSOT.

**4 workers BullMQ** : enrich, import, translate, crons.

**15 sous-pages admin** (overview, library, library/[id], upload, quality

- 10 stubs Sprint 2.x).

**6 routes publiques** : `/galerie/` index + `/galerie/[slug]` detail +
`/galerie/[slug]/telecharger` download + 3 hubs (interventions-formations,
audits, implementations).

**2 sub-sitemaps** Image Sitemap 1.1 : `/sitemaps/images-{fr,en}.xml`.

## Quick start

```bash
# 1. Migration DB (requiert Docker pour pnpm db:up)
pnpm db:up
pnpm prisma:migrate
psql $DATABASE_URL -f prisma/migrations_fts/20260516142018_image_bank_fts.sql

# 2. Seed countries + categories + tags
pnpm image-bank:seed

# 3. Lancer dev
pnpm dev
# Admin : http://localhost:3000/fr/admin-dev-x7k2n9/image-bank
# Public : http://localhost:3000/fr/galerie

# 4. Workers (terminal séparé, requiert Redis localhost:6381)
pnpm worker
```

## Activation des workers en prod

Les 4 workers exportent `startXxxWorker()`. Pour activation en prod, patcher
`src/server/queue/worker.ts` :

```ts
import { startImageBankEnrichWorker } from "./workers/image-bank-enrich-worker";
import { startImageBankImportWorker } from "./workers/image-bank-import-worker";
import { startImageBankTranslateWorker } from "./workers/image-bank-translate-worker";
import { startImageBankCronsWorker } from "./workers/image-bank-crons-worker";

if (!isBullmqDisabled()) {
  startImageBankEnrichWorker();
  startImageBankImportWorker();
  startImageBankTranslateWorker();
  startImageBankCronsWorker();
}
```

À faire **après QA staging** (Redis + Prisma live + ANTHROPIC_API_KEY set).

## Pipelines

### Upload

```
admin UI → upload.action.ts → imageImportService.importImage()
  → Sharp variants (4 widths × WebP+AVIF) + LQIP + thumbnail + EXIF strip
  → DB insert ImageAsset + FR translation (draft)
  → enqueue image-bank-enrich worker
```

### Enrich

```
image-bank-enrich worker
  → ImageSeoEnrichmentService.enrichAndSave({ lang: "fr" })
    → Claude Sonnet 4.6 vision : alt, caption, description, keywords,
      ai_summary, meta_title, meta_description
    → image-attribute-validator.service : 8 validators, reroll max 2,
      flag requiresHumanReview si KO
  → ImageTranslationService.translateAndSave({ source: "fr", target: "en" })
    → Claude vision FR→EN
  → recalc seoScore via image-seo.service.calculateSeoScore()
  → si seoScore ≥ IMAGE_AUTO_PUBLISH_SCORE → auto-publish
```

### Download

```
public /galerie/[slug]/telecharger
  → rate-limit Redis 10/min/IP (checkRateLimit)
  → DB lookup ImageAsset publiée
  → fs.readFile variant (sm/md/lg/xl/original)
  → si watermarkEnabled : imageWatermarkService.apply(buffer, {position, opacity})
  → track ImageDownloadLog (ip_hash SHA-256, non-blocking)
  → bump downloadCount (non-blocking)
  → serve binary Cache-Control: no-store
```

## Gates CI

- `pnpm typecheck` (strict + exactOptionalPropertyTypes)
- `pnpm lint` (0 errors)
- `pnpm image-bank:isolation-check` (path-based + content-based, 1500+ fichiers)
- `pnpm verify:all` (inclut image-bank:isolation-check)
- `pnpm lhci` (lighthouserc.json + URLs `/galerie` ajoutées Sprint 6)
- `pnpm bundle:check` (size-limit galerie ≤ 75 KB gz/route)

## Env vars

Voir `.env.example`. Variables image-bank :

- `IP_HASH_SALT` (≥ 32 chars, superRefine prod, RGPD)
- `IMAGE_AUTO_PUBLISH_SCORE` (int 0-100, default 999 = jamais auto)
- `RETENTION_IMAGE_LOGS_MONTHS` (int ≥ 1, default 12)
- `IMAGE_BANK_CDN_URL` (optional, fallback SITE_URL)
- `IMAGE_BANK_STORAGE_PATH` (default `/data/image-bank`)

## RGPD

- IP downloads : SHA-256 hashées avec `IP_HASH_SALT` (jamais l'IP brute en DB)
- Soft delete `ImageAsset.deletedAt` + purge fichiers/S3 après 90 jours
- Endpoint admin pour droit à l'effacement (Sprint 2.x — TODO)
- Pas de cookie tracking sur `/galerie/*`
- Logs purge auto via retention-purge-worker (12 mois par défaut)

## Voir aussi

- [pipeline.md](./pipeline.md) — détail pipelines pas-à-pas
- [admin-guide.md](./admin-guide.md) — guide admin (upload, edit, publish)
- [faq.md](./faq.md) — FAQ admin/public
- [takedown.md](./takedown.md) — procédure DMCA / droit à l'oubli
