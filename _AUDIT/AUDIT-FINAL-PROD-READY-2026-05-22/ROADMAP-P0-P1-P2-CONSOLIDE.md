# Roadmap consolidée P0/P1/P2 — Audit final pré-prod AxionIA
## Date : 2026-05-22
## HEAD audité : 81f6ea0e (axionia/) — e7c40004 (parent)
## Score global : 854/1000 — 🟡 SPRINT FINAL

**Total items : 56 (5 P0 + 22 P1 + 29 P2)**

---

## 🔴 P0 BLOQUANTS PROD (action immédiate avant launch)

| # | Item | Bloc | Zone code | Effort | Risque si non-fait |
|---|------|------|-----------|--------|---------------------|
| **P0-1** | **Internal-link catalog 4/9 URLs cassées** — `/audits`, `/interventions-formations`, `/implementations`, `/tarifs` n'existent pas ; vraies routes = `/audit`, `/interventions`, `/implementation` ; `/tarifs` à supprimer. `injectInternalLinks()` est appelé par tous les generators → chaque nouvel article publié injecte ~4 liens 404. | Frontend (F-07) | `src/server/content-gen/links/internal-link-catalog.ts:20-83` | **20 min** | 🔴 Pénalité Google HCU dès rampe activée, AEO dégradé, mauvaise UX immédiate |
| **P0-2** | **`resetMonthlyCostCounters()` cron non câblé dans `bootRepeatableJobs()`** — si confirmé, cap mensuel jamais reset → kill-switch global permanent après le 1ᵉʳ mois prod = arrêt total content-gen. À CONFIRMER en priorité absolue. | Backend (B-06) | `src/server/queue/boot-repeatable-jobs.ts` + `src/server/content-gen/lib/cost-tracker.ts` | **1h** | 🔴 OUTAGE TOTAL content-gen à J+30, plus aucun article publié |
| **P0-3** | **`external-links-monitor-cron` non visible dans `bootRepeatableJobs()`** — Sprint External Links Database livré 2026-05-22 (mémoire) mais rotation HEAD check mensuel peut être inerte. À confirmer. | Backend (B-08) | `src/server/queue/boot-repeatable-jobs.ts` + `src/server/queue/workers/external-links-monitor-worker.ts` | **30 min** | 🟠 Sprint inerte, liens externes non rotés, audit qualité dégradé |
| **P0-4** | **`content-fact-check-worker.ts` sans `captureWorkerError`** — Perplexity outage = silent fail console only. Worker chokepoint Sentry-aveugle alors que le fact-check est gating de publish pour AI Act art. 50. | Backend (B-01) | `src/server/queue/workers/content-fact-check-worker.ts:204` | **15 min** | 🟠 Outages Perplexity invisibles, claims non vérifiés silencieusement |
| **P0-5** | **Action Will pendante : seeder 6 presets `CampaignTemplate` en DB prod** — sans seed, UI utilise `FALLBACK_PRESETS` statique sans `id` Prisma → flow `useTemplate` ne peut pas pré-remplir wizard. | Flow (Fl-04) | DB prod (Will action) | **30 min Will** | 🔴 Flow création campagne preset cassé en prod (D-P5-1 violé) |

**Total P0 : 5 items, effort cumulé ~2h35 code + 30 min Will**

---

## 🟠 P1 IMPORTANTS (1-4 semaines post-launch)

| # | Item | Bloc | Effort | Impact business |
|---|------|------|--------|------------------|
| P1-1 | **30/33 workers sans `lockDuration` explicite** → fallback BullMQ 30s, risque double-exec sur LLM/Perplexity >30s (cap MAX_PUBLISH violable, AI Act audit trail dupliqué) | Backend (B-01) | 2h | 🟠 Risque double-pub AI Act |
| P1-2 | **Sentry coverage 17/33 workers** — gap sur fact-check, image-bank-*, monitoring, RSS-fetch, GSC-sync. Outages silencieux | Backend (B-01 + B-09) | 2h | 🟠 MTTR dégradé prod |
| P1-3 | **Server Actions content-gen sans Zod runtime validation** — 1/27 fichiers utilise `z.object`. TS-only confiance sur endpoints réseau | Backend (B-02) | 4h | 🟠 Risque injection inputs non validés |
| P1-4 | **`BRAND.legalName="Axion-IA"` placeholder** — D7 société française tranchée mais raison sociale officielle (SAS/SASU + SIREN) pas propagée. JSON-LD Organization incomplet | Frontend (F-06) | 30 min (après décision Will) | 🟠 Signal SEO Local/Legal incomplet |
| P1-5 | **Placeholder `[Ville — France]` dans Organization JSON-LD** `src/lib/seo.ts:408` — `foundingLocation.address.addressLocality` non remplacé en prod | Frontend (F-06) | 15 min | 🟠 Signal SEO Local incomplet |
| P1-6 | **`AuthorByline.tsx:49` utilise `<img>` HTML brut** au lieu de `<Image>` Next — CLS risque, LCP dégradé sur articles | Frontend (F-04) | 15 min | 🟠 Web Vitals dégradés sur 100% articles |
| P1-7 | **LHCI cible CLS relâchée 0→0.1 et TBT 150→200ms** vs doctrine AGENTS.md ; INP non lab-testé | Frontend (F-05) | 30 min config + audit | 🟠 Web Vitals 2026 sous cible |
| P1-8 | **CI gates `continue-on-error: true`** sur Playwright + Bundle delta + LHCI + Gate C Docker smoke — contrat AGENTS.md non factuellement enforced | Prod-readiness (Pr-05) | 1h | 🟠 Régressions Web Vitals/bundle non bloquantes en PR |
| P1-9 | **Test restore mensuel non chronométré** — script `scripts/restore-postgres-test.sh` existe, doctrine §15 inscrite, mais cron `restore-drill-monthly.yml` absent. RTO/RPO non chiffrés | Prod-readiness (Pr-04) | 2h | 🟠 DR non prouvé, RGPD art. 32 |
| P1-10 | **Registre RGPD Art. 30 narratif absent** — ActivityLog DB couvre techniquement mais CNIL attend PDF/MD daté/signé DPO | Prod-readiness (Pr-02) | 3h | 🟠 Risque audit CNIL |
| P1-11 | **Corpus ADRs non centralisé** — 3 ADRs filesystem vs 27+ référencés en mémoire. ADR 0009/0026 cités code mais introuvables glob | Prod-readiness (Pr-09) | 4h | 🟠 Onboarding nouveau dev dégradé |
| P1-12 | **JSON-LD `@graph` pages villes incomplet** — 4 schémas vs 8 demandés ; manque BreadcrumbList/Organization explicites à ce niveau (probablement hérités layout, à confirmer) | Flow (Fl-02) | 1h | 🟠 SEO Local sous-optimisé |
| P1-13 | **QualityV2 dashboard n'agrège pas `qualityImprovementAttempts` distribution** | Flow (Fl-06) | 1h | 🟢 Monitoring qualité dégradé |
| P1-14 | **Pas de global-lock par primary keyword inter-campagnes** ; rate-limit gen=10/min global non par-campagne | Flow (Fl-08) | 2h | 🟠 Double-pub possible inter-campagnes même keyword |
| P1-15 | **Vérifier explicitement `factCheckQueue.add()` post-publish** dans `content-publish-worker.ts` — mentionné en commentaire mais grep non concluant | Flow (Fl-07) | 30 min audit | 🟠 Fact-check potentiellement non déclenché |
| P1-16 | **`revalidate = 0` sur `/galerie/page.tsx:214`** — décision UX/perf à valider (60s suggéré) | Flow (Fl-10) | 15 min | 🟢 Perf galerie dégradée |
| P1-17 | **Lighthouse mobile non lab-testé** — pas de gate mobile dans `lighthouserc.json` | Frontend (F-03) | 1h | 🟠 Web Vitals mobile cibles non gated |
| P1-18 | **Backups daily Postgres** — vérifier que le cron Storage Box Hetzner est actif Coolify (acquis 2026-05-17 Axion CRM Pro pour `axion-crm-pro` mais à confirmer Axion-IA) | Prod-readiness (Pr-04) | 1h | 🔴 Backups potentiellement absents |
| P1-19 | **`pnpm audit` 7 vuln (toutes devDeps, 0 high/critical)** — vitest/vite/esbuild/lhci-cli updates à pousser | Prod-readiness (Pr-01) | 1h | 🟢 Hygiène déps |
| P1-20 | **`prisma migrate status` non testé en mode AUDIT-ONLY** — vérifier no drift prod | Backend (B-03) | 30 min | 🟠 Drift prod possible |
| P1-21 | **GSC + Bing WMT submissions sitemaps** à vérifier (acquis 2026-05-13 mais sub-sitemaps ajoutés depuis) | Frontend (F-08) | Will action 30 min | 🟢 Découverte sitemaps dégradée |
| P1-22 | **Cookies banner Klaro/Tarteaucitron/cookieyes** — confirmer présence si cookies non-essentiels | Frontend (F-10) | 1h | 🟠 RGPD si Plausible/Clarity active |

**Total P1 : 22 items, effort cumulé ~27h**

---

## 🟡 P2 POLISH (backlog 3-6 mois)

| # | Item | Bloc | Effort | Impact |
|---|------|------|--------|--------|
| P2-1 | Tests E2E Playwright étendus (smoke parcours visiteur + admin) | Pr-08 | 8h | 🟢 |
| P2-2 | Mutation testing Stryker sur workers content-gen | Pr-08 | 8h | 🟢 |
| P2-3 | Coverage thresholds CI ratchet 80%→85% sur modules critiques | Pr-08 | 2h | 🟢 |
| P2-4 | Dashboards Grafana custom (vs admin dashboard maison) | Pr-06 | 8h | 🟢 |
| P2-5 | UptimeRobot/BetterStack monitoring externe | Pr-06 | 1h | 🟢 |
| P2-6 | Schémas archi Mermaid (workers chain, content-gen pipeline) | Pr-09 | 4h | 🟢 |
| P2-7 | API documentation OpenAPI/Swagger (si APIs publiques étendues) | Pr-09 | 8h | 🟢 |
| P2-8 | Onboarding nouveau dev README enriched (10-30 min lecture) | Pr-09 | 2h | 🟢 |
| P2-9 | Partial Prerendering (PPR) Next.js 16 activation expérimentale | Pr-10 | 4h | 🟢 |
| P2-10 | Streaming SSR Suspense boundaries finest-grain | Pr-10 | 4h | 🟢 |
| P2-11 | React 19 `use()` hook adoption progressive (vs `useState` legacy) | Pr-10 | 4h | 🟢 |
| P2-12 | Privacy Sandbox compliance (Topics API rejection) | Pr-10 | 2h | 🟢 |
| P2-13 | Image Bank galerie filters UX polish (acquis sprint S+5) | Fl-10 | 3h | 🟢 |
| P2-14 | Section "Articles connexes" UI uplift (similar/related) | Fl-01 | 3h | 🟢 |
| P2-15 | Cas concrets/cas-clients page : structured data Service additionnel | Fl-01 | 2h | 🟢 |
| P2-16 | `/presse/[slug]` JSON-LD NewsArticle datePublished ratchet 48h Google News | Fl-01 | 1h | 🟢 |
| P2-17 | Edge runtime pour `/api/contact` + `/api/booking` (latence) | B-02 | 2h | 🟢 |
| P2-18 | RUM Web Vitals custom (vs PSI weekly seul) | Pr-06 | 4h | 🟢 |
| P2-19 | Refresh `OFFRE-CLIENT-AXION-IA.md` + `PRESENTATION-CLIENT-AXION-IA.md` post-launch | Pr-09 | 2h | 🟢 |
| P2-20 | Lazy-load Sentry chunk (V-04 Phase 3 reporté) | F-05 | 1h | 🟢 |
| P2-21 | LCP image preload `<link rel="preload">` sur 5 pages hero | F-05 | 1h | 🟢 |
| P2-22 | `optimizePackageImports` ratchet 15→25 packages | Pr-07 | 1h | 🟢 |
| P2-23 | Cache-Control headers HIT rate >85% via CF Workers KV (vs 80% actuel) | Pr-07 | 4h | 🟢 |
| P2-24 | Brotli 11 build-time partout (acquis Sprint Perfection) — extend assets non-HTML | Pr-07 | 2h | 🟢 |
| P2-25 | Component library SSOT screenshot tests (régression visuelle) | F-09 | 6h | 🟢 |
| P2-26 | Skip links + landmark roles audit complet WCAG 2.2 AAA | F-04 | 4h | 🟢 |
| P2-27 | Pages villes ratchet 39→120 indexables (planning Manon parallèle) | Fl-02 | 6h | 🟢 |
| P2-28 | Voice search SEO conversation snippets ratchet | Fl-01 | 4h | 🟢 |
| P2-29 | AI Overviews / SGE answer cards optimization | Fl-01 | 4h | 🟢 |

**Total P2 : 29 items, effort cumulé ~108h**

---

## ✅ ITEMS OK (vue d'ensemble — top 30 forces)

1. ✅ AI Act art. 50 quasi-exemplaire (Pr-03 22/25) — disclaimer + JSON-LD + GenerationProvenance 16 champs hash-chaînée 6 ans
2. ✅ Pipeline content-gen E2E robuste (Fl-07 24/25 + Fl-09 25/25) — orchestrator → LLM judge → quality-improver → publish → IndexNow
3. ✅ RSS sans plagiat parfait 25/25 — triple verrouillage (system prompt + Jaccard 5-gram + gate inversé)
4. ✅ Sécurité multi-couche (Pr-01 20/25) — Argon2id + 2FA TOTP + rate-limit Redis + CSP per-request nonce + HSTS preload 2 ans + gitleaks ×2
5. ✅ CI/CD mature (Pr-05 22/25) — 24 workflows + Gate A 12 vérifs + Gate D Prisma + build externalisé GHCR + 11 hooks
6. ✅ SEO/JSON-LD de classe entreprise (F-06 23/25) — 21+ builders SSOT, 1377 lignes seo.ts
7. ✅ Sitemaps + robots exceptionnels (F-08 24/25) — 18 sub-sitemaps DB-aware + 13 AI bots ALLOW + IndexNow
8. ✅ Architecture admin V2 solide (F-02 22/25) — 125 routes + Auth.js v5 + ADMIN_URL_PREFIX secret + shell V2 permanent
9. ✅ Privacy first-party rigoureuse (F-10 21/25) — Plausible self-hosted + zero GA + Clarity gaté + IP SHA-256
10. ✅ Cost tracker kill-switch atomique (B-06 21/25) — cascade complète + audit trail + alerte 80%
11. ✅ Provenance AI Act robuste (B-07 22/25) — `regulationVersion="AI-Act-2024/1689"`, FK Restrict, promptHash réel
12. ✅ DB Postgres + Prisma optimisé (B-03 22/25) — 200+ @@index, 94 modèles, 43 migrations
13. ✅ Redis + queues clean (B-04 21/25) — cost tracker INCR atomique + cleanup automatique
14. ✅ External APIs intégration (B-05 20/25) — Anthropic + OpenAI + Voyage AI + Perplexity + GSC + IndexNow + Telegram
15. ✅ Cron jobs documentés (B-08 22/25) — daily embeddings + brand voice drift + weekly Monday 8h reporting
16. ✅ Image-bank pipeline (B-10 23/25) — Sharp variants + EXIF/XMP/IPTC + watermark + 4 sub-sitemaps
17. ✅ Admin dashboard 4 sections exact (Fl-03 24/25) — Pilotage/Sources/Suivi/Réglages (D-P5-6)
18. ✅ Création campagne preset (Fl-04 24/25) — 6 presets D-P5-1, wizard pré-rempli
19. ✅ Pause/resume campagne (Fl-05 24/25) — BullMQ jobs purge + status DB
20. ✅ Multi-campagnes parallèles (Fl-08 23/25) — concurrency + isolation campaignId + cap Redis global
21. ✅ Galerie + download tracking (Fl-10 24/25) — IP hashée RGPD
22. ✅ Best practices 2026 (Pr-10 22/25) — Next.js 16 RSC + Server Actions + Edge middleware + TS strict
23. ✅ Tests coverage (Pr-08 21/25) — 1687/1694 vitest verts, 163 fichiers de tests
24. ✅ Monitoring + alertes (Pr-06 21/25) — Sentry server+edge+client + Telegram + LHCI + PSI weekly
25. ✅ Cookieless future (F-10 21/25) — Plausible self-hosted EU, IP hashing systémique
26. ✅ Smoke prod 30/30 URLs ✅ (test 01)
27. ✅ Performance Web Vitals (F-05 20/25) — LCP/INP/CLS cibles documentées, bundle ≤75KB target
28. ✅ Maillage interne hors catalog (F-07 16/25) — composant SuggestedContent + ArticleTOC + Villes proches
29. ✅ UX brand cohérent (F-09 22/25) — terracotta primary + ivoire fond + composants UI SSOT
30. ✅ Décisions Will figées D-W1/D-P5/D1-D5 toutes retrouvées EXACT dans le code

---

## 🎯 Recommandation FINALE

### Sprint Final ~6h autopilot (recommandé)

**Plan optimal** :

1. **P0-1** (20 min) : Fix `src/server/content-gen/links/internal-link-catalog.ts` — `/audits`→`/audit`, `/interventions-formations`→`/interventions`, `/implementations`→`/implementation`, supprimer `/tarifs` ou créer la route
2. **P0-2 + P0-3** (1h30) : Câbler `resetMonthlyCostCounters` (cron `0 0 1 * *`) + `external-links-monitor-cron` dans `bootRepeatableJobs()` + tests
3. **P0-4** (15 min) : Ajouter `captureWorkerError` dans `content-fact-check-worker.ts:204`
4. **P0-5** (action Will 30 min) : `pnpm prisma db seed --filter campaign-templates` ou équivalent
5. **P1 ratchet bundle 3h** :
   - 30 workers manquants : `lockDuration: 120000`
   - 16 workers manquants : `captureWorkerError`
   - CI gates strict : `continue-on-error: false` sur Playwright/Bundle/LHCI
   - `BRAND.legalName` raison sociale officielle (après décision Will)
   - `AuthorByline.tsx:49` `<img>`→`<Image>`
   - LHCI cibles CLS 0.1→0.05 + TBT 200→150
6. **Re-audit léger ~1h** :
   - Re-run tests 01 (smoke), 13 (RSS), 14 (cost kill-switch)
   - Vérif `bootRepeatableJobs()` log
   - `pnpm vitest run`

**Effort total : ~6h autopilot + 30 min Will**

### Calendrier rampe MAX_PUBLISH (D-W1) après GO

| J+ | MAX_PUBLISH_PER_DAY | Monitoring |
|---|---|---|
| J+0 | 30 | Sentry + cost tracker + IndexNow ping rate |
| J+1 | 50 | GSC indexation rate + AiContentDisclaimer présence sur articles publiés |
| J+3 | 100 | Cost cap 80% alert + qualité moyenne llm-judge |
| J+7 | 200 | Bundle delta + LHCI gates + Brand voice drift |
| J+14 | 300 | Backup restore drill (P1-9 livré entre-temps) |
| J+30 | 500 | Vérif resetMonthlyCostCounters cron firing (P0-2 livré) |

---

## Référence

- **40 rapports détaillés** : `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/agents/{frontend,backend,flows,prod-readiness}/*.md`
- **15 tests fonctionnels** : `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/tests-results/test-{01..15}-*.md` + `pnpm-audit-summary.md`
- **Verdict global** : `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/VERDICT-AUDIT-FINAL-PROD-READY.md`
- **Checklist 100 items** : `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/PRODUCTION-CHECKLIST.md`
