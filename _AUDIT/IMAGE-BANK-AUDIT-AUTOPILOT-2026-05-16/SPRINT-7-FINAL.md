# Image-bank V1 — Sprint 7 FINAL (livré 2026-05-16)

## État

✅ **Sprints 1 → 7 livrés en autopilot sur branche `feat/image-bank-v1`** (local, 0 push).

7 commits :

| #   | Commit    | Sprint                                              | Fichiers |
| --- | --------- | --------------------------------------------------- | -------- |
| 1   | `842cd3e` | 1 Foundations (schema + services + isolation)       | 28       |
| 2   | `eb03310` | 2 Admin UI (15 sub-pages + actions + palette)       | 24       |
| 3   | `b7dbd3e` | 3 Public pages (galerie + detail + hubs + download) | 7        |
| 4   | `8682a57` | 4 Sitemap + IndexNow                                | 5        |
| 5   | `cc012f4` | 5 Workers (enrich + import + translate + crons)     | 4        |
| 6   | `f42fe98` | 6 Perf (lighthouse + size-limit gates galerie)      | 2        |
| 7   | `263f9b6` | 7 Finalisation (retention + ADR 0027 + docs)        | 3        |

**Total : 69 fichiers, +8 044 lignes.**

## Gates verts en local

- `pnpm typecheck` ✅ (strict + exactOptionalPropertyTypes)
- `pnpm lint` ✅ (0 errors, 126 warnings pré-existants console)
- `pnpm image-bank:isolation-check` ✅ (1527 fichiers, 0 violation)
- `pnpm use-client:check` ✅ (toutes directives justifiées)
- `pnpm prisma:generate` ✅ (10 nouveaux modèles)

## Gates en attente humaine (Docker / DB / prod requis)

- `pnpm db:up` + `pnpm prisma migrate deploy` (migrations Country + image-bank tables)
- `pnpm image-bank:seed` (Country REST API + categories + tags)
- `pnpm test` (suite Vitest existante, à augmenter Sprint 1.x)
- `pnpm lhci` (Lighthouse CI sur `/galerie` + `/gallery`, requiert images seedées)
- `pnpm test:e2e --grep image-bank` (Playwright admin + public, requiert DB live)

## Livrables clés

### Schema Prisma (10 tables nouvelles)

- `Country` (REST Countries API seeded)
- `ImageAsset` + 50+ colonnes (SEO, geo, license, taxonomie, AI flags, pHash)
- `ImageAssetTranslation` (FR + EN miroir)
- `ImageCategory` + `ImageCategoryTranslation`
- `ImageTag` + `ImageTagTranslation` + `ImageAssetTag`
- `ImageUsageLog` (RGPD ip_hash)
- `ImageDownloadLog` (rétention 12 mois)
- `ImageImportBatch` (audit trail CSV)
- GIN indexes + FTS tsvector via `migrations_fts/`

### Services (11 + 1 SSOT)

- `image-bank.service.ts` (CRUD)
- `image-import.service.ts` (Sharp variants + LQIP)
- `image-seo.service.ts` (JSON-LD + score)
- `image-country-detector.service.ts`
- `image-translation.service.ts` (Claude vision)
- `image-seo-enrichment.service.ts`
- `image-watermark.service.ts` (Sharp composite)
- `image-attribute-validator.service.ts` (8 validators)
- `image-taxonomy-detector.service.ts`
- `image-jsonld-graph.service.ts` (@graph chained 6 entités)
- `taxonomy.ts` (SSOT modules + sous-modules + axes)
- `src/lib/image-utils.ts` (helpers Sharp partagés content-gen + image-bank)

### UI

- **Admin** : 15 sub-pages sous `/[adminPrefix]/image-bank/*` (5 implémentées, 10 stubs Sprint 2.x)
- **Public** : 6 routes sous `/galerie/*` (index, [slug], download, 3 hubs)
- **Composants** : ImageUploadDropzone, EmbedCodeButton, GalleryGrid, AdminStubPage
- **AdminCommandPalette** : 9 entries image-bank ajoutées (⌘K)

### Workers BullMQ (4 + extension)

- `image-bank-enrich-worker.ts` (queue `image-bank-enrich`)
- `image-bank-import-worker.ts` (queue `image-bank-import`)
- `image-bank-translate-worker.ts` (queue `image-bank-translate`)
- `image-bank-crons-worker.ts` (dispatcher mutualisé)
- `retention-purge-worker.ts` ÉTENDU : purge `image_usage_logs` +
  `image_download_logs` 12 mois RGPD

### Sitemap + IndexNow

- `/sitemaps/images-fr.xml` + `/sitemaps/images-en.xml` (Google Image Sitemap 1.1)
- `/sitemap-index.xml` patché pour référencer les 2 sub-sitemaps
- `scripts/indexnow-ping.ts` patché : `collectImageBankUrls()` lit DB
  best-effort (skip si `DATABASE_URL=stub.invalid`)

### Performance

- `lighthouserc.json` : `/fr/galerie` + `/en/gallery` ajoutées (18 URLs)
- `package.json` size-limit : bucket `/galerie/**` + `/gallery/**` 75 KB gz/route

### Documentation

- `docs/adr/0027-image-bank-architecture.md` (ADR Accepted, 5 décisions défauts)
- `docs/image-bank/README.md` (overview, quick-start, pipelines, gates, RGPD)
- TODO Sprint 7.x : pipeline.md, admin-guide.md, faq.md, takedown.md

## Décisions défauts autopilote appliquées

| #   | Question     | Décision                                               |
| --- | ------------ | ------------------------------------------------------ |
| 1   | Storage dev  | Local `public/image-bank/`                             |
| 2   | EN miroir V1 | Oui (Claude translate worker)                          |
| 3   | Watermark    | Optionnel per-image + on-the-fly Sharp composite       |
| 4   | License enum | Éditable admin, défaut CC BY 4.0                       |
| 5   | AI-generated | Autorisé avec sourceType + aiModel + JSON-LD isBasedOn |

## Backlog explicite Sprint 2.x → 7.x (non-bloquant V1 merge)

- **Sprint 1.x** : tests unitaires Vitest > 80% coverage services image-bank
- **Sprint 2.x** : 10 sous-pages admin stubs → impl complète
  (LibraryGrid avancé, ImageEditForm Tiptap, TaxonomyPicker,
  BulkImportWizard, SEOAuditCard, AnalyticsROIChart)
- **Sprint 2.x** : Server Actions delete/update-metadata/bulk-import
  - tests E2E Playwright admin DB live
- **Sprint 3.x** : tests E2E publiques (LCP validation, JSON-LD Rich Results)
- **Sprint 5.x** : activation workers en prod via `src/server/queue/worker.ts`
  (après QA staging Redis + Prisma + ANTHROPIC_API_KEY)
- **Sprint 5.x** : tests intégration cycle complet upload → enrich → translate
- **Sprint 6.x** : `pnpm lhci` run live sur `/galerie/[slug]` (images seedées)
- **Sprint 7.x** : docs pipeline.md, admin-guide.md, faq.md, takedown.md
- **Sprint 8 V1.5** : pHash, JPEG XL, CF Polish, dashboard ROI, IPTC XMP,
  Naver Webmaster, AVIF effort 9 async

## Actions humaines requises avant prod

1. **Docker DB local** : `pnpm db:up` + `pnpm prisma migrate deploy`
2. **Seed** : `pnpm image-bank:seed`
3. **Env Coolify prod** : confirmer `IP_HASH_SALT`, `IMAGE_AUTO_PUBLISH_SCORE`,
   `RETENTION_IMAGE_LOGS_MONTHS` sont set (déjà set 2026-05-15)
4. **Storage prod Hetzner** : créer mount `/data/image-bank/` (action SSH)
5. **B3 watermark logo** : déposer `public/watermarks/axion-ia-watermark.png`
   (sinon fallback texte Sharp)
6. **Activer workers** : patcher `src/server/queue/worker.ts` après QA staging

## STOP & ASK Will

✋ **Push + PR à valider** :

```bash
cd axionia
git push -u origin feat/image-bank-v1
gh -R will383842/axion-ia pr create \
  --title "feat(image-bank): V1 perfection 2026 (Sprint 1-7)" \
  --body "Voir _AUDIT/IMAGE-BANK-AUDIT-AUTOPILOT-2026-05-16/SPRINT-7-FINAL.md"
```

Will valide la PR sur GitHub avant merge sur `main`. Une fois mergée :

```bash
git -C axionia tag v1.0-image-bank
git -C axionia push origin v1.0-image-bank
```
