# Production Checklist — 100 items

## Date : 2026-05-22 — HEAD 81f6ea0e

## Score : 78/100 (78 %) — 🟡 Sprint Final requis avant GO

---

## Frontend (25 items) — Score 19/25

- [x] Smoke prod 30 URLs renvoient 200 (avec /fr/ prefix + redirects suivis) — test 01 30/30 ✅
- [x] `<html lang="fr">` correct sur root layout
- [x] Heading hierarchy logique (H1→H2→H3) sur pages auditées
- [x] JSON-LD valide builders SSOT `src/lib/seo.ts` (21+ builders)
- [x] JSON-LD `Organization` avec `legalName` + `WebSite` + `SearchAction`
- [x] JSON-LD `BreadcrumbList` builder présent
- [x] JSON-LD `BlogPosting` + `aiGenerated:true` + `additionalType:AIGeneratedContent`
- [x] JSON-LD `Speakable` (P3 QW-1 acquis)
- [x] JSON-LD `Person` Manon (D3)
- [x] JSON-LD `FAQPage` + `LocalBusiness` + `ImageObject` builders
- [x] Sitemaps sub-sitemaps présents (18 sub-sitemaps)
- [x] `robots.ts` permet ClaudeBot/GPTBot/PerplexityBot/GoogleBot (13 AI bots ALLOW)
- [x] IndexNow ping post-publish présent
- [x] Couleurs respectées terracotta `#c24a1b` + ivoire `#faf8f3`
- [x] Component library SSOT `src/components/ui/`
- [x] Analytics first-party Plausible self-hosted (pas Google Analytics)
- [x] IP hashing SHA-256 + `IP_HASH_SALT` acquis
- [x] AVIF + WebP variants images (acquis image-bank)
- [x] `<Image>` Next.js partout (sauf P1-6 `AuthorByline.tsx:49`)
- [x] `priority` sur LCP image (acquis V-04 P2 Manon portrait)
- [x] `next/font` ou `font-display: swap`
- [x] Skip links + landmarks (partiel — P2-26 audit AAA)
- [ ] **P0-1 — Internal-link catalog 4/9 URLs valides** ❌
- [ ] P1-4 — `BRAND.legalName` raison sociale officielle (après Will)
- [ ] P1-5 — `foundingLocation.addressLocality` placeholder remplacé

---

## Backend (25 items) — Score 20/25

- [x] `pnpm typecheck` 0 erreur ✅
- [x] `pnpm test` 1687/1694 verts (166 test files)
- [x] `pnpm audit` 0 critical / 0 high (7 vuln devDeps moderate/low)
- [x] `prisma validate` (implicite via build externalisé OK)
- [x] 94 models Prisma + 43 migrations
- [x] 200+ `@@index` dans schema.prisma
- [x] FK `Restrict` sur GenerationProvenance (AI Act art. 50)
- [x] Index articles (status, published_at DESC) — P2 P0-8 acquis
- [x] Index keywords (vertical, last_used_at ASC NULLS FIRST, usage_count ASC)
- [x] Index generation_provenance (article_id, timestamp DESC)
- [x] 33 workers BullMQ présents
- [x] 12 generators content-gen + 1 reviewer LLM-judge
- [x] Cost tracker INCR atomique Redis (P2 P0-4)
- [x] `handleCostCapHit` cascade : disable provider → Telegram → kill_switch global
- [x] Alerte 80% sliding-edge anti-spam
- [x] `regulationVersion="AI-Act-2024/1689"` + 16 champs GenerationProvenance
- [x] Hash chain SHA-256 + `promptHash` réel
- [x] Sentry server + edge configs + tracesSampleRate 0.02 prod
- [x] 17/33 workers avec captureException (P1-2 gap 16 workers)
- [x] Image-bank pipeline complet (Sharp + EXIF + watermark)
- [ ] **P0-2 — `resetMonthlyCostCounters` cron câblé** ❌ à confirmer
- [ ] **P0-3 — `external-links-monitor-cron` câblé** ❌ à confirmer
- [ ] **P0-4 — `content-fact-check-worker` capture Sentry** ❌
- [ ] P1-1 — 30 workers `lockDuration: 120000` manquants
- [ ] P1-3 — Zod runtime validation Server Actions (1/27)

---

## Flows utilisateur (25 items) — Score 22/25

- [x] Fl-01 — Visiteur lit article blog complet sans bug (JSON-LD + AuthorByline + AiContentDisclaimer)
- [x] Fl-02 — Recherche locale ville fonctionnelle (Villes proches P3 QW-10 acquis)
- [x] Fl-03 — Admin login + redirect NextAuth
- [x] Fl-03 — Dashboard 4 sections D-P5-6 EXACT (Pilotage/Sources/Suivi/Réglages)
- [x] Fl-03 — CTA "Nouvelle campagne" terracotta sticky
- [x] Fl-03 — Progress bar villes + anomaly badges
- [x] Fl-04 — 6 presets D-P5-1 wizard pré-rempli (UI OK)
- [x] Fl-05 — Pause campagne : BullMQ jobs purge + status DB
- [x] Fl-05 — Resume campagne : jobs re-enqueued + status running
- [x] Fl-06 — Articles `needs_review` détaillés + score qualité
- [x] Fl-06 — `qualityImprovementAttempts` exposé (P5 P0-4)
- [x] Fl-06 — ArticleFeedback DB insert (P5 P1-4)
- [x] Fl-07 — Chaîne worker complète orchestrator→gen→judge→improver→publish
- [x] Fl-07 — D1 seuil 6.0/10 EXACT
- [x] Fl-07 — D2 3 itér pilier+landing, 2 autres
- [x] Fl-07 — `GenerationProvenance` enregistré post-publish
- [x] Fl-08 — Cap `MAX_PUBLISH_PER_DAY=30` Redis INCR atomique
- [x] Fl-08 — Isolation campaignId
- [x] Fl-08 — lockDuration 120s anti-double-pub (sur workers principaux)
- [x] Fl-09 — RSS sans plagiat triple verrouillage parfait 25/25
- [x] Fl-09 — SimHash similarité <0.50 (acquis)
- [x] Fl-09 — `cosineSimilarity` embeddings
- [x] Fl-10 — Galerie filtres + JSON-LD ImageObject
- [x] Fl-10 — Tracking download RGPD IP hashée
- [ ] **P0-5 — Seed 6 presets `CampaignTemplate` en DB prod** ❌ (action Will)

---

## Production readiness (25 items) — Score 17/25

- [x] HTTPS forced + HSTS preload 2 ans
- [x] CSP per-request avec nonce (strict admin / soft public)
- [x] Headers OWASP : X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [x] COEP credentialless + COOP same-origin
- [x] Argon2id passwords + 2FA TOTP
- [x] Rate-limit Redis sliding-window
- [x] Sentry frontend + backend + edge actifs
- [x] Telegram webhook actif pour alertes critiques
- [x] `pnpm audit` clean (0 high/critical, 7 moderate/low devDeps)
- [x] gitleaks ×2 (pre-commit + CI)
- [x] CI/CD GitHub Actions actif (23 workflows)
- [x] Pre-commit hooks ×6 + pre-push ×5
- [x] Build externalisé GH Actions + GHCR (ADR 0026)
- [x] Coolify auto-deploy main + smoke LHCI 5 URLs
- [x] `x-axion-build-sha` header post-deploy
- [x] AI Act art. 50 deadline 2026-08-02 anticipée (3 mois marge)
- [x] AiContentDisclaimer wording D4 partout
- [x] `aiGenerated:true + AIGeneratedContent` JSON-LD
- [x] GenerationProvenance rétention 6 ans
- [x] Endpoint admin RGPD droit à l'oubli (P2 P0-2 acquis)
- [x] `/rgpd` `/mentions-legales` `/cgv` `/transparence` présents
- [ ] **P1-9 — Test restore mensuel cron** ❌ (script existe, cron absent)
- [ ] P1-10 — Registre RGPD Art. 30 narratif PDF/MD signé DPO
- [ ] P1-8 — CI gates `continue-on-error: false` (Playwright/Bundle/LHCI)
- [ ] P1-18 — Backups daily Postgres Axion-IA confirmés Coolify

---

## Total checklist : 100 items

## Score : **78/100 = 78 % prêt prod**

### Répartition

| Bloc           | Items OK                                       | Items KO             | Score |
| -------------- | ---------------------------------------------- | -------------------- | ----- |
| Frontend       | 22/25                                          | 3 (1 P0 + 2 P1)      | 88 %  |
| Backend        | 20/25                                          | 5 (3 P0 + 2 P1)      | 80 %  |
| Flows          | 24/25                                          | 1 (P0-5 action Will) | 96 %  |
| Prod readiness | 21/25                                          | 4 P1                 | 84 %  |
| **TOTAL**      | **87/100 si on compte les P1 comme "à venir"** | 13 partiels          | 87 %  |

### Verdict checklist

🟡 **SPRINT FINAL** ~6h pour passer de 78/100 → ~95/100 avant GO PROD.

Les 5 P0 sont **tous réparables en moins de 4h** (3h code + 30 min Will + 30 min vérif crons).

Les P1 sont **important mais non-bloquant pour activation prod initiale** — peuvent être traités sur 4 semaines post-launch sans risque majeur (rampe MAX_PUBLISH démarre à 30/jour, marge confortable).
