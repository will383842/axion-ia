# Phase 1 — Inventaire structuré existant (réutilisable / manquant)

> Cartographie complète : (a) ce qui peut être réutilisé sans modification, (b) ce qui est partiellement présent à enrichir, (c) ce qui est à coder from scratch.

> **Note source images (clarif Will 2026-05-16)** : la pipeline image-bank V1+V1.5 traite **exclusivement des uploads humains** (Will fournit les images). Pas de générateur IA intégré. Cf. `02-decisions-default.md` §"Décision #6". Aucun impact sur l'estimation effort 255-400h (le scope code reste identique — c'est de l'infra de gestion, pas de création).

## Catégorie A — ✅ Réutilisable sans modification (8 éléments)

| Élément                      | Path                                                     | Réutilisation Phase X                                                                                   |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `robots.ts` route handler    | `src/app/robots.ts` (150 lignes)                         | Phase 5 — étendre `AI_BOTS_ALLOWED` avec crawlers 2026 (Claude-SearchBot, Copilot-User, GoogleOther)    |
| `llms.txt`                   | `public/llms.txt` (4585 bytes)                           | Phase 5 — ajouter section image-bank dédiée (sitemap-images-fr/en.xml + licensing CC BY 4.0 image-bank) |
| `ai.txt` route handler       | `src/app/ai.txt/route.ts` (97 lignes)                    | Phase 5 — confirmer cohérence image-bank consent (déjà standard Spawning.ai/IAB)                        |
| `AdminCommandPalette` ⌘K     | `src/components/admin/AdminCommandPalette.tsx`           | Phase 3 — ajouter entries image-bank (search images, taxonomy edit, bulk-import, etc.)                  |
| `AdminSidebar` (générique)   | `src/components/admin/AdminSidebar.tsx` (66 lignes)      | Phase 3 — ajouter 9ᵉ groupe `image-bank` avec 15 sous-pages                                             |
| `PressImageBank`             | `src/components/sections/PressImageBank.tsx` (80 lignes) | Phase 4 — laisser tel quel, cible `/galerie` réparée par création de la page                            |
| Messages i18n imageBank      | `messages/fr.json` l201-213 + `messages/en.json` miroir  | Phase 4 — étendre avec labels nouvelles pages (hubs, détail, admin)                                     |
| Routing pathnames `/galerie` | `src/i18n/routing.ts`                                    | Phase 4 — étendre avec `/galerie/[module]` hubs                                                         |

## Catégorie B — 🟡 Partiellement présent à enrichir (5 éléments)

| Élément                                                                                         | État actuel                                               | Patch requis                                                                              |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Env vars image-bank (`IP_HASH_SALT`, `IMAGE_AUTO_PUBLISH_SCORE`, `RETENTION_IMAGE_LOGS_MONTHS`) | Déclarées `env.ts:413-415`, jamais lues                   | Phase 2 — consommer dans workers + retention-purge cron                                   |
| Footer entrée galerie                                                                           | Commentée `P0-10` lignes 52-56                            | Phase 4 — décommenter + anchor « Banque d'images » / « Image bank »                       |
| `meta viewport`                                                                                 | `layout.tsx:77-82` : `width=device-width, initialScale=1` | Phase 4 — ajouter `viewport-fit=cover` (iPhone notch)                                     |
| `meta robots`                                                                                   | Pas de `max-image-preview:large` ni `max-snippet:-1`      | Phase 4 — ajouter ces directives (critique Google Images Discover)                        |
| `Organization.sameAs` JSON-LD                                                                   | LinkedIn + X (à vérifier `src/lib/seo.ts`)                | Phase 2 — étendre avec Wikidata Q-id (action humaine Will Phase 7) + Crunchbase + Bluesky |

## Catégorie C — 🔴 À coder from scratch (43+ éléments)

### C.1 — Prisma schema (8 tables)

| Table                   | Colonnes principales                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ImageAsset`            | id, slug, originalFilename, sha256, width, height, fileSize, mime, sourceType, photographerName, photographerUrl, geoPlacename, geoRegion, geoPosition (PostGIS Point), targetCountries (TEXT[]), keywordsPrimary, keywordsSecondary (TEXT[]), licenseUrl, embedCount, downloadCount, seoScore, publishedAt, deletedAt + **taxonomie GAP-01** (module, subModule, targetEntity, targetCity, targetRegion, targetSize, targetPersona, targetSector, targetTechno, targetFormat, targetDuration) + **GAP-02** (subjectOfUrl, subjectOfType) + **GAP-19** (pHash optionnel V1.5) + **AI tracking** (aiModel, isAiGenerated) |
| `ImageAssetTranslation` | id, imageAssetId, locale, title, alt, caption, description (TipTap JSON), metaTitle, metaDescription, ogTitle, ogDescription, aiSummary (✨ AEO), keywords                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `ImageCategory`         | id, slug, name, descriptionFr, descriptionEn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ImageTag`              | id, slug, nameFr, nameEn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ImageTagOnAsset`       | imageAssetId, imageTagId (M2M)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ImageUsageLog`         | id, imageAssetId, action, referrerUrl, referrerType (page-metier/blog/external-llm), ipHash, userAgent, occurredAt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ImageDownloadLog`      | id, imageAssetId, variant, ipHash, userAgent, downloadedAt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `ImageImportBatch`      | id, filename, totalRows, successCount, errorCount, errors (JSONB), createdBy, createdAt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### C.2 — Services backend (`src/server/image-bank/services/`, 0 fichiers → 15+ requis)

| Service                                | Responsabilité                                                                                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taxonomy.ts`                          | SSOT 3 modules × N sous-modules (cf. §3.2 du prompt). Types TS + listes typées.                                                                                                                                 |
| `image-import.service.ts`              | Pipeline sync ≤ 5 MB : validation magic bytes, SHA-256 dedup, variants Sharp (thumb/sm/md/lg/xl webp + md/lg avif + og.webp 1200×630 + square.webp 1080×1080), LQIP, strip EXIF, embed IPTC/XMP, DB transaction |
| `image-jsonld-graph.service.ts`        | Build `@graph` chained : Organization + WebSite + WebPage + BreadcrumbList + ImageObject + Subject (Service/Course/Event/Article) selon module                                                                  |
| `image-seo.service.ts`                 | Build ImageObject 40+ champs (§6 du prompt) — null-safe                                                                                                                                                         |
| `image-attribute-validator.service.ts` | Validators alt/caption/description/metaTitle/metaDescription/ogTitle/ogDescription/aiSummary (§2.5bis) + reroll Claude max 2 fois                                                                               |
| `image-taxonomy-detector.service.ts`   | Auto-tag module/subModule/targetEntity depuis translations + Claude fallback                                                                                                                                    |
| `image-bank-client.ts`                 | API publique : `getHeroImageForPage`, `trackUsage`, `getImagesBySubject`, `searchImages`                                                                                                                        |
| `image-watermark.service.ts`           | Watermark on-the-fly via Sharp `composite`                                                                                                                                                                      |
| `pii-redaction-image.service.ts`       | (optionnel V1.5) Strip GPS supplémentaire + ofuscation                                                                                                                                                          |
| `image-sitemap.service.ts`             | Génère sitemap-images-fr/en.xml Google 1.1                                                                                                                                                                      |
| `image-indexnow.service.ts`            | Ping Bing + Yandex + (optionnel Baidu) sur publish                                                                                                                                                              |
| `image-bing-api.service.ts`            | Bing URL Submission API (10k/jour)                                                                                                                                                                              |
| `image-analytics.service.ts`           | (V1.5) ROI AEO/GEO dashboard                                                                                                                                                                                    |
| `image-bulk-import.service.ts`         | Parse CSV + dispatch async workers                                                                                                                                                                              |
| `image-pHash.service.ts`               | (V1.5) pHash via `sharp-phash`                                                                                                                                                                                  |

### C.3 — Workers BullMQ (`src/server/queue/workers/`, 3 nouveaux)

| Worker                           | Job                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `image-bank-enrich-worker.ts`    | Async post-import : detect target_countries, Claude translate FR→EN, Claude auto-`aiSummary`, recalc seoScore, auto-publish si seuil |
| `image-bank-import-worker.ts`    | Async > 5 MB : pipeline import lourd                                                                                                 |
| `image-bank-translate-worker.ts` | Claude FR→EN ou EN→FR pour translations manquantes                                                                                   |

### C.4 — Admin console (15 sous-pages)

Structure attendue `src/app/[locale]/(admin)/[adminPrefix]/image-bank/` :

| Sous-page                 | Fonction                                                                   |
| ------------------------- | -------------------------------------------------------------------------- |
| `page.tsx` (overview)     | Dashboard : counters, seoScore moy, latest uploads, top embedded           |
| `library/page.tsx`        | Liste + grid + filtres                                                     |
| `library/[id]/page.tsx`   | Édition image (translations FR+EN, taxonomy, SEO, metadata, variants)      |
| `upload/page.tsx`         | Drag&drop upload + queue progress                                          |
| `bulk-import/page.tsx`    | Wizard CSV : preview, validation, dry-run, commit                          |
| `taxonomy/page.tsx`       | Édition SSOT modules/subModules (lecture seule UI — édition via code)      |
| `categories/page.tsx`     | CRUD ImageCategory                                                         |
| `tags/page.tsx`           | CRUD ImageTag                                                              |
| `usage-logs/page.tsx`     | Logs embed + download (filtres, export CSV)                                |
| `analytics/page.tsx`      | Top images, top referrers, cite-rate AEO, conversion via image             |
| `quality/page.tsx`        | Images flagged `requiresHumanReview` (validators échoués)                  |
| `seo-audit/page.tsx`      | Audit score par image (75 items checklist §22)                             |
| `sitemap-status/page.tsx` | Statut sitemaps + IndexNow + Bing API + last submit                        |
| `licensing/page.tsx`      | Vue d'ensemble licences (count par type) + takedown requests               |
| `settings/page.tsx`       | Quotas Claude, AVIF effort sync/async, watermark default, retention policy |

### C.5 — Composants admin (`src/components/admin/image-bank/`, 0 → ~12 requis)

`ImageUploadDropzone`, `ImageGridCard`, `ImageEditForm`, `TaxonomyPicker`, `KeywordsEditor`, `LicensePicker`, `BulkImportWizard`, `BulkImportPreview`, `UsageLogsTable`, `SEOAuditCard`, `AnalyticsROIChart`, `SitemapStatusCard`.

### C.6 — Pages publiques (`src/app/[locale]/galerie/`, 0 → 6 requis)

| Page                           | Path                                        |
| ------------------------------ | ------------------------------------------- |
| Index galerie                  | `galerie/page.tsx`                          |
| Hub interventions              | `galerie/interventions-formations/page.tsx` |
| Hub audits                     | `galerie/audits/page.tsx`                   |
| Hub implementations            | `galerie/implementations/page.tsx`          |
| Détail image                   | `galerie/[slug]/page.tsx`                   |
| Télécharger (watermark on-fly) | `galerie/[slug]/telecharger/page.tsx`       |

### C.7 — Composants publics (`src/components/sections/image-bank/`)

`GalleryGrid`, `GalleryFilters`, `ImageHero`, `ImageMetadataPanel`, `ImageDownloadCTA`, `RelatedImages`, `ImageUsagePagesList`, `ImageEmbedCode`.

### C.8 — Injection métier sur pages services

Patch ~30 pages métier (`/fr/interventions/*`, `/fr/audit/*`, `/fr/implementation/*` + `/par-ville/[ville]/*`) pour appeler `getHeroImageForPage` et émettre JSON-LD `Service.image`. **Critique pour cross-référence subjectOf §3.5 du prompt.**

### C.9 — Sitemap-images Google 1.1

| Route                                    | Détail                                                         |
| ---------------------------------------- | -------------------------------------------------------------- |
| `src/app/sitemap-images-fr.xml/route.ts` | Generate Google Image Sitemap 1.1 (FR) — stub-aware build-time |
| `src/app/sitemap-images-en.xml/route.ts` | Idem EN                                                        |
| Patch `src/app/sitemap.ts`               | Référence les 2 nouveaux sub-sitemaps dans le sitemap-index    |

### C.10 — Tests (`tests/image-bank/`)

| Niveau         | Cible                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Unit           | Validators (alt, caption, metaTitle, etc.), Sharp variants, JSON-LD builders, taxonomy detector, watermark, pHash. ~30 specs. |
| Integration    | DB CRUD ImageAsset, workers BullMQ, sitemap-images generation, IndexNow ping. ~15 specs.                                      |
| E2E Playwright | Upload admin → publish → galerie public → embed code → download. Click-depth invariants. Hreflang round-trip. ~10 specs.      |

Couverture cible : ≥ 80 % par fichier.

### C.11 — Scripts npm (`package.json`)

```
image-bank:seed
image-bank:bulk-import
image-bank:audit-frontend
image-bank:audit-backend
image-bank:audit-wiring
image-bank:audit-routes
image-bank:audit-slugs
image-bank:audit-hreflang
image-bank:validate-sitemap
image-bank:audit-indexation
image-bank:audit-e2e
image-bank:isolation-check
image-bank:check-perfection
```

### C.12 — Docs (`docs/image-bank/`, 0 fichiers → 6 requis)

`README.md` (overview stack) · `pipeline.md` (Sharp workflow) · `admin-guide.md` (15 sous-pages) · `faq.md` · `takedown.md` (DMCA + RGPD erasure) · `audit-e2e-howto.md`.

### C.13 — ADRs (`docs/adr/`)

| ADR                    | Sujet                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| ADR 0027 (proposition) | Architecture image-bank (stack, choix Sharp + BullMQ + Postgres, decisions) |
| ADR 0028 (proposition) | AGENTS.md vs lighthouserc.json résolution (Option A)                        |

### C.14 — Skill bump

`.claude/skills/axionia-image-bank/SKILL.md` v1.1 → v1.2 (✋ path inaccessible — clarification Will requise, cf. GAP-26).

### C.15 — Master prompt bump

`_AUDIT/PROMPT-IMAGE-BANK-MASTER-2026.md` v1.0 → v1.1 (changelog : alignement v1.1 audit-autopilote + GAPs émergents 21-28).

### C.16 — Tag git `v1.0-image-bank`

Sur main après vert sur tous gates (`pnpm typecheck && pnpm test && pnpm test:e2e --grep image-bank && pnpm lhci && pnpm image-bank:audit-e2e`).

## Sommaire effort

| Catégorie                                      | Effort estimé |
| ---------------------------------------------- | ------------- |
| C.1 Prisma (8 tables + migrations + index GIN) | 8h            |
| C.2 Services backend (15+)                     | 60h           |
| C.3 Workers (3)                                | 20h           |
| C.4 Admin (15 sous-pages)                      | 35h           |
| C.5 Composants admin (~12)                     | 15h           |
| C.6 Pages publiques (6)                        | 25h           |
| C.7 Composants publics (~8)                    | 10h           |
| C.8 Injection métier (~30 pages)               | 15h           |
| C.9 Sitemap-images                             | 5h            |
| C.10 Tests (~55 specs)                         | 35h           |
| C.11 Scripts npm + CI gates                    | 8h            |
| C.12 Docs (6)                                  | 10h           |
| C.13 ADRs (2)                                  | 4h            |
| C.14-15 Skill bump + master bump               | 4h            |
| C.16 Tag git + release notes                   | 1h            |
| **TOTAL livraison V1 perfection 2026**         | **~255h**     |

Avec **risques + reroll** (validators échouent, perf gates ratent, refactors imprévus) : **300-400h plausibles**. C'est ~2 mois temps plein.

## Conclusion Phase 1

L'inventaire confirme la **trajectoire greenfield V1**. Aucun raccourci possible — toutes les briques sont nouvelles. Recommandation : voir `99-rapport-final.md` pour décision de scoping (livrer par sprint ou en plusieurs sessions).
