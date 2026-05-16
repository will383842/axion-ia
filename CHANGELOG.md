# Changelog Axion-IA

Tous les changements notables du sous-repo `axionia/` sont consignés ici.

Format inspiré de [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/) ; versionnage [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) à partir de la première release stable (Sprint 22 — déploiement prod).

## [Unreleased]

### Added — Image Bank V1 (Sprint 1-7) — 2026-05-16

Branche `feat/image-bank-v1`, commits `842cd3e → 4cdfbe4` (8 commits, ~8200 LOC).

- **Schema Prisma** (842cd3e) — 10 tables (Country + 9 image-bank core) + 25 indexes (4 GIN + tsvector FTS) + FK `onDelete` explicites + seeds REST Countries (249 pays) + 5 catégories + 10 tags. Migrations idempotentes (`IF NOT EXISTS`).
- **Services TS** (842cd3e) — 10 services (`image-bank.service`, `image-import.service` Sharp pipeline, `image-seo.service` JSON-LD + score, `image-country-detector`, `image-translation` Claude Sonnet 4.6 vision, `image-seo-enrichment`, `image-watermark`, `image-attribute-validator` 8 validators, `image-taxonomy-detector`, `image-jsonld-graph` @graph 6 entités) + SSOT `taxonomy.ts` + helper `src/lib/image-utils.ts` (27 exports Sharp).
- **Admin UI** (eb03310) — 15 sub-pages (overview + library + upload + quality + 10 stubs Sprint 2.x) + AdminCommandPalette 9 entrées + ImageUploadDropzone WCAG 2.2 + 3 Server Actions (upload, publish, translate).
- **Public pages** (b7dbd3e) — 6 routes (`/galerie` index + `[slug]` detail + `[slug]/telecharger` download route handler + 3 hubs interventions-formations/audits/implementations) + JSON-LD @graph chained 6 entités + hreflang FR/EN + EXIF GPS strip RGPD + rate-limit Redis 10/min/IP par `ipHash` SHA-256.
- **Sitemap + IndexNow** (8682a57) — Sub-sitemaps `images-{fr,en}.xml` Google Image Sitemap 1.1 (namespace `xmlns:image`) + intégration `sitemap-index.xml` + IndexNow `collectImageBankUrls()` cap 1000 + segment FR=galerie / EN=gallery.
- **Workers BullMQ** (cc012f4) — 4 workers (enrich, import, translate, crons) pattern `email-worker` + retry/backoff (`enqueueXxx()` helpers).
- **Perf gates** (f42fe98) — `/galerie` + `/gallery` ajoutés `lighthouserc.json` + size-limit bucket 75 KB gz/route.
- **ADR 0027** (263f9b6) — Architecture image-bank V1 (statut Accepted, 5 décisions STOP & ASK, cloisonnement strict, Web Vitals gate LCP ≤ 1800ms / INP ≤ 80ms / CLS ≤ 0.05, roadmap V1.5 pHash + JPEG XL + CF Polish + dashboard ROI + IPTC/XMP + Naver + AVIF effort 9).
- **Documentation** (263f9b6) — `docs/image-bank/README.md` (overview + pipelines + env vars + activation workers + RGPD section).

### Added — Image Bank V1 — Patches post-audit (2026-05-16)

- **P0-1 RGPD art. 17 (droit à l'effacement)** — Server Action `forgetIpHashAction` + page admin `/image-bank/usage-logs` fonctionnelle (recherche par `ipHash` SHA-256 + suppression définitive `ImageUsageLog` + `ImageDownloadLog` + audit trail `ActivityLog` action `rgpd.image_bank.forget_ip_hash`).
- **P1-2 + P1-4** — Workers activation `src/server/queue/worker.ts` + retry/backoff config via `src/server/image-bank/queues.ts` (4 enqueue helpers : `enqueueEnrich`, `enqueueImport`, `enqueueTranslate`, `enqueueCrons`).
- **P1-3** — AdminSidebar groupe `image-bank` ajouté (9 items) — UX friction résolue, navigation cohérente avec content-gen group.
- **P1-5** — `Sentry.captureException()` ajouté dans les 4 workers image-bank (parité content-gen + email-worker à harmoniser Sprint 5.x).
- **P1-6a + P1-6b** — Detail page `[slug]` : `og:image` + `alternates.languages` (hreflang FR/EN/x-default).
- **P1-8** — `image_categories`, `image_category_translations`, `image_tags`, `image_tag_translations` : ajout `created_at` + `updated_at` (audit trail lookup tables).
- **P1-9** — Documentation rollback SQL Prisma migrations (commentaire UP/DOWN procedure).
- **P1-10** — Schema docstring slug strategy (canonique `ImageAsset.slug` vs per-lang `ImageAssetTranslation.slug`).
- **P1-S-1** — X handle naming corrigé `Axion-IA` (cohérence brand `image-jsonld-graph.service.ts`).
- **P2-SITEMAP-1** — Early-exit `stub.invalid` explicite dans sub-sitemaps `images-{fr,en}.xml/route.ts` (cohérence doctrine `knowledge-rss.ts`).

### Audit V1 Verification 2026-05-16

- Audit complet livré dans `_AUDIT/IMAGE-BANK-V1-VERIFICATION-2026-05-16/` (14 fichiers).
- Score brut **909/1000** → après patches post-audit ci-dessus : **~960/1000** 🟢 GO PROD (P0 RGPD résolu).
- Backlog résiduel : P1-1 tests Vitest (12-16h, reporté Sprint 1.5), MIX-001 + GAP-25 refactor services (P1, 5-8h, reporté Sprint 1.5).
- Backlog V1.5 (~10-15h) : AEO/GEO perfection (abstract/isBasedOn/mentions/contentLocation), UI Pagination+Filters galerie, hard delete fichiers storage > 90j, Plausible events `gallery_view`/`image_download`/`image_embed`, Bing URL Submission API direct, sub-sitemap pagination > 50K.

### Fixed

- Stabilisation prod 2026-05-09 : CSP soft mode (drop nonce+strict-dynamic, commit `b31d0c8`), pivot sitemap → sitemap-index (commit `6b7c669`), correction REDIS_URL (typo `7O` → `70`), purge buildkit cache 51 GB (cause OOM build), purge cache Cloudflare. Site stable, healthcheck `redis: ok`.

### Added

- DOC-SYNC V14 (2026-05-07) : matrice diff code ↔ docs + 5 sorties JSON (`_AUDIT/sync-*.json`) + `_AUDIT/sync-snapshot.md` + 9+ docs synchronisées. Cf. `_AUDIT/DOC-SYNC-REPORT-V14.md`.
- ADR 0005 — Navigation mega-menu (status: proposed) — issue de l'audit Header & Navigation 2026.
- ADR 0006 — pSEO villes/régions FR (status: proposed) — engagement scale + pipeline éditorial 80/20 LLM/Will.

### Sprints livrés

- **Sprint 14.9** (audit Header & Navigation 2026) — 2026-05-07.
- **Sprint 14.8** (AEO/GEO 2026 perfection) — commits `eda574b`, `5d9d527`, `c884acc`, `fd91518` step A 76% → 95%.
- **Sprint 14.7** (Visual rhythm A+B + 6 hero schemas + 17 pages + ADR 0004 typography v3.1) — commit `dbc39b3`.
- **Sprint 14.6** (Espace presse `/presse` + `content/press.ts`) — commit `38879bc`.
- **Sprint 14.5** (Pivot doctrine v3 « Editorial Premium Light » + ADR 0002) — 22 commits `5942d2f` → `941a8e1`.

### Changed

- `_AUDIT/02b-mapping-pages.md` v1 → v2 : 75 templates → 64 routes HEAD ; Module 2 Audit refactor (`/audit/{flash,process,strategique-pme,strategique-eti,demande}`) ; nouvelles pages éditoriales documentées.
- `axionia-package/docs/_DECISIONS-FINALES.md` : section ADRs ratifiés depuis 2026-05-06 ajoutée ; mention « formation banni » levée (ADR 0003) ; Next.js 15 → 16.2.4.
- `_AUDIT/PROMPT-CODAGE.md` : Sprint 6 réactualisé (refactor module Audit) + annexe Sprints 14.5 → 14.9 livrés.
- `_AUDIT/02-PLAN.md` : annexe Sprints intermédiaires livrés.
- 5 skills `axionia-architecture`, `axionia-content-models`, `axionia-seo-aeo`, `axionia-design`, `axionia-stack` : encart « SYNC 2026-05-07 (DOC-SYNC V14) » avec état HEAD.

### Removed

- ~~Mot « formation » banni partout~~ — gate CI retiré par ADR 0003 (2026-05-07). **Convention éditoriale 2026-05-08 (ADR 0008) supersedes** : « formation » doit être remplacé par « intervention coaching » partout (copy / slug / commit / meta / JSON-LD / content / seeds). Pas de gate CI ré-ajouté.

### Added (2026-05-08)

- ADR 0008 — Vocabulaire : « formation » → « intervention coaching » (`axionia/docs/adr/0008-vocabulary-intervention-coaching.md`). Sweep résiduel sur `src/content/*.ts` + `messages/*.json` à programmer Sprint 15+.

### Sprints 14.10 → 14.10.8 (2026-05-08 → 2026-05-12)

- **Sprint 14.10** — `pricing.ts` SSOT centralisation tarifs + sous-tiers Essentielle/Approfondie.
- **Sprint 14.10.5** — pricing zéro hardcode (8 helpers `formatAmount`/`getEntryLabel`, 30 fichiers migrés, ADR pricing).
- **Sprint 14.10.7** — refonte taxonomique `/interventions` en 4 familles (Collectives × 4 paliers durée / Individuel / Dirigeants / Conférence). SSOT `interventions-taxonomy.ts`. ADR 0011.
- **Sprint 14.10.8** — slug `/audit/cible` remplace `/audit/process`, 301 redirect.

### Sprints 15-23 (M8 backend + M9 admin + M10 tests + M11 deploy) — 2026-05-09

- **M8 backend** (Sprints 15-19) — DB Postgres + Prisma 5 + auth.js v5 + workers BullMQ + 8 Server Actions.
- **M9 admin** — 14 sections admin Tiptap + AdminCommandPalette + roles RBAC.
- **M10 tests** — vitest unit + Playwright E2E 5 projects cross-browser + axe-core a11y CI guard.
- **M11 deploy** — Coolify + Caddy 2 + Hetzner CPX32 → CPX42 rescale (2026-05-14) + GitHub Actions auto-deploy via API Coolify.

### Sprint 24 (RGPD + OWASP) — 2026-05-09

- 10 P1 fixés (3 OWASP + 3 RGPD code + 3 INTEGRATION) en 5 commits.
- Feature annulation booking complète, helper `adminPath()`, Tiptap JSON+text, CSP nonce/COEP/JWT revocation, sous-processeurs FR+EN, RGPD erase actions + `/api/gdpr-export` + retention-purge cron.

### Sprint 24.1 — 2026-05-09

- PII minimisation Telegram (ADR 0010 Option A) + helper `pii-redaction.ts` + 14 sites Telegram patchés (118 → 127 tests).
- 6 artefacts cutover prêts : DPA-REGISTER + CHECKLIST-CUTOVER (28 cases / 9 phases) + generate-prod-secrets.sh + 4 templates DPO.

### Cloudflare Phase 5 — 2026-05-09

- DNS orange, SSL Full strict, HSTS 12mo preload, HTTP/3, Brotli auto, 5 Cache Rules, Bot Fight ON + AI Scrapers OFF (AEO/GEO friendly).
- +25 pts reliability. DNSSEC reporté.

### Stabilisation prod — 2026-05-09

- CSP soft mode (drop nonce+strict-dynamic), sitemap pivot vers sitemap-index, fix REDIS_URL typo, purge buildkit 51 GB, purge cache Cloudflare.
- Site 100 % UP, healthcheck `redis: ok`.

### KB V4 (Sprints KB-1 → KB-20) — 2026-05-13 → 2026-05-14

- 8 migrations Prisma bundle KB V4 : init schema + factory types + pgvector embeddings + source tracking + ingest requests + seo cache + audit_log + annotations/collections.
- Skill content-gen migré megapack + master prompt v2.5 (KbDocument/KbChunk obsolètes → KnowledgeEntry réel) + WebVitalSample + 3 alertes Telegram.

### Booking V1 (Sprint X.1 → X.20) — 2026-05-13

- 22 colonnes étendues sur Booking + tables auxiliaires (BookingTransition, BookingOption, etc.).
- Stripe + state-machine + parcours B devis qualifié + cadrage + devis/NDA + emails + self-service magic-link + géo OSM + legal RGPD + funnel UTM.
- 11 sprints partiels — branch `feature/booking-v1` (non mergée main, DocuSeal X.3 + BullMQ X.12 + admin UI X.8-X.14 manquent).
- Tests 149 → 286.

### Sprint S0 + S0bis — 2026-05-14

- **S0** : Audit pré-implémentation 173/200 NEAR-GO → post-S0 ~182/200 GO. Q13 Manon résolu (option 4 portrait IA disclosed).
- **S0bis** : Harmonisation skill content-gen V4 KB ; master prompt v2.5.

### Tag v1.0.3-content-gen — 2026-05-14

- 7 commits + tag pushé. Audit 328 → 354/410 🟢 GO PROD CONDITIONAL.
- Fixes : plagiarism + intent validator wirés + GenerationLog publish + Speakable FAQ + Web Vitals monitor worker + AdminCommandPalette + sitemap split news/faq + auto kill-switch cost cap cascade. 818 tests verts.

### Audit méta-certification finale — 2026-05-15

- 22 agents / 6 phases / 24 livrables `_AUDIT/META-CERT-2026-05-15/` (10 190 lignes).
- Score factuel 1255.5/1600 (78.5 %) 🟠 NO-GO transitoire ; projeté post-correctif 1392.5/1600 (87 %) 🟡 GO CONDITIONAL.

### Sprint correctif méta-cert (12 batches) — 2026-05-15

- **Batch 1** `0f68a2b` — Clarity removal (initial) + legal.ts transferts hors-UE clarifiés + sitemap exclusions `/mes-donnees/export` + `/reserver` + lint gsc-smoke fix.
- **Batch 2** `363cbbe` (mergé Google Indexing) — composant `AiContentDisclaimer` sur 4 routes factory + page `/transparence` + ADR 0024 AI Act classification + JSON-LD AI Act fields (creator + disambiguatingDescription + usageInfo + speakable).
- **Batch 3** `1897050` — Mitigation SSRF (`ssrf-safe-fetch.ts` helper + 2 callers kb-ingest + rss-fetch). Allowlist IP privée RFC 1918 + loopback 127/8 + AWS metadata 169.254/16 + IPv4-mapped IPv6 + ULA fc00::/7. `redirect: "manual"` + cap profondeur 5.
- **Batch 5** `e570928` — Sentry release tracking explicite 3 inits + `alertTier3Stagnant` câblée dans `content-tier-lifecycle-worker`.
- **Batch 6** `519d190` — Drop 4 deps prod unused (motion, p-limit, axios, zustand) + README sync.
- **Batch 7** `9bf1a5c` — Clarity compliance complète via CMP banner consent (`CookieConsent` + `Clarity` gated, `useAnalyticsConsent` via `useSyncExternalStore` pattern React 19) + entry sous-processeurs + legal.ts § cookies enrichi + DPA-REGISTER ligne 15 Microsoft.
- **Batch 8** `9146546` — Idempotency booking submit (OWASP A04) — migration `Booking.idempotencyKey @unique` partiel + UUID v4 client-side au mount BookingForm + check server action.
- **Batch 9** `54163fa` — PII at-rest AES-256-GCM (OWASP A02) — helper `pii-crypto.ts` + env var `PII_ENCRYPTION_KEY` + wrapping 6 sites Submission.create + decryptPii dans `enqueueClientEmail` + ADR 0025.
- **Batch 10** `b8bb684` — Content-monitoring worker câble 3 alertes Telegram ready-to-call (alertQueueStuck via Redis snapshots + alertSoft404Detected via HEAD sampling + alertIndexationStagnant via KeywordTracking heuristique). Cron horaire xx:15.
- **Batch 11** `4d9efc3` — DOWN.md 14 migrations (couverture 12.5 % → 100 %) + HEALTHCHECK Docker.worker (pgrep tsx + interval 30s + retries 3).
- **Batch 12** (en cours) — CHANGELOG 17 sprints retard rattrapés (ce commit).

### Action humaines pending (post-batches)

- Will signe DPA Microsoft online (Clarity)
- Will set `PII_ENCRYPTION_KEY` Coolify env + archive 1Password
- Will set `BACKUP_ENCRYPTION_PASSPHRASE` 1Password + papier
- Will exécute DR drill R22 SSH
- Will signe 5+3 DPA (Hetzner papier, CF online, OpenAI ZDR, Anthropic, Perplexity, Unsplash, Voyage, Stripe)
- Will complète `CRON-VPS-INVENTORY.md` via SSH `crontab -l`

---

## Sprints 0-14 (récapitulatif)

Sprints livrés du 2026-05-06 au 2026-05-07 (cf. mémoire `axionia_progress.md` pour détail).

- **Sprint 14** (M7 — pages erreurs, sitemap dynamique, IndexNow) — commit `1135136`.
- **Sprint 11-13** (M5 — calendrier maison, RoiSimulator, forms multi-step) — commits `5a5ac6e`, `d6b9983`, `c3d748b`.
- **Sprint 10** (M6 — pages légales OÜ estonienne) — commit `9cc70d7`.
- **Sprint 9** (M6 — transversales `/a-propos` `/contact` `/faq` `/blog` `/centre-aide`) — commit `c99d66a`.
- **Sprint 8** (M6 — cas concrets) — commit `c99d66a`.
- **Sprint 7** (M4 — Module 3 Implementation 10 pages) — commit `f7bb430`.
- **Sprint 6** (M4 — Module 2 Audit, refactoré 2026-05-07) — commit `2dcad8b` puis refactor.
- **Sprint 5** (M4 — Module 1 Interventions 6 pages) — commit `2dcad8b`.
- **Sprint 4** (M2 — 11 composites sections) — commit `062b8df`.
- **Sprint 3** (M2 — 22 atoms UI shadcn customisés) — commit `5fd1dda`.
- **Sprint 2** (M3 — i18n next-intl + Header/Footer + sitemap + robots + llms.txt) — commit `8200548`.
- **Sprint 1** (M2 — design tokens Webflow Blue + Manrope/Inconsolata) — commit `fe000c6`.
- **Sprint 0** (M1 — Next.js 16.2.4 + Auth.js v5 beta + sous-repo Git + verify:all green) — commit `f52a2b4`.

> **Note** : ce skeleton initial sera étendu Sprint 21 avec sections `[Major.Minor.Patch] - YYYY-MM-DD` une fois les premières releases taguées (Sprint 22 cible).
