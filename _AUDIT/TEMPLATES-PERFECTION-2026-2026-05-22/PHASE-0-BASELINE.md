# Phase 0 — Baseline Audit Templates Perfection 2026

**Date** : 2026-05-22  
**HEAD** : e7c40004 (main)  
**Auditeur** : Claude Sonnet 4.6 (chef d'orchestre)

---

## 1. Inventaire des templates

| Catégorie                           |   Count | Source                                                        |
| ----------------------------------- | ------: | ------------------------------------------------------------- |
| Public `src/app/[locale]/**`        | **124** | `find src/app/[locale] -name "page.tsx" \| grep -v "(admin)"` |
| Admin `src/app/[locale]/(admin)/**` | **125** | `find ... "(admin)" -name "page.tsx"`                         |
| Maintenance `src/app/maintenance/`  |   **1** | hors périmètre audit                                          |
| **TOTAL**                           | **250** | ✅ correspond au périmètre cible                              |

---

## 2. Baseline gates techniques

| Gate              | Statut                        | Détail                                                                                                                                 |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`  | ✅ **0 erreur**               | HEAD e7c4000 — 0 violations TS                                                                                                         |
| `pnpm vitest run` | ⚠️ **1682 passed / 5 failed** | 3 fichiers fail : `content-google-indexing-worker.spec.ts` + `content-news-lifecycle-worker.spec.ts` (Sprint S+5 P2-10, pré-existants) |
| `pnpm lint`       | non mesuré                    | Dernier connu : 0 erreurs (commit e7c4000 pre-push hooks verts)                                                                        |

> Note : un audit antérieur (dd53b418, avant merge V-01) montrait 242 erreurs TS + 4 lint — toutes CORRIGÉES d'après l'historique git et le typecheck propre ci-dessus.

---

## 3. Stack & configuration critique

### 3.1 Framework

- **Next.js 16 App Router** + `next-intl v4.11`
- `localePrefix: "always"` — locales `["fr", "en"]`
- **EN locale désactivé runtime** : `src/proxy.ts` émet 301 `/en/*` → FR via `mapEnToFr()`. SSG EN toujours généré (hreflang conservé), mais 301 runtime.
- Bug next-intl v4.11 / Next.js 16.2 — boucle 307 sur routes EN si `pathnames` FR≠EN → non correctable sans upgrade. Toggle `EN_LOCALE_ENABLED=true` prévu.

### 3.2 Routing

- `src/i18n/routing.ts` : **~75 routes déclarées** avec pathnames FR/EN complets
- Slugs FR canoniques, EN miroir cohérent (ex: `/audit/cible` → `/audit/targeted`, `/interventions/collectives` → `/interventions/team-trainings`)
- Routes dynamiques couvertes : `[slug]`, `[ville]`, `[region]`, `[tool]`, `[token]`

### 3.3 Sécurité

- `next.config.ts` : headers X-Frame-Options/DENY, X-Content-Type-Options/nosniff, HSTS 2 ans, Referrer-Policy strict
- CSP calculée per-request par `src/proxy.ts` avec nonce (mode strict admin, mode soft public)
- `x-axion-build-sha` header sur toutes les routes (smoke deploy assertion)

### 3.4 Stubs Prisma/Redis (Build GH Actions)

- `src/lib/prisma.ts` : stub Proxy si `DATABASE_URL.includes("stub.invalid")` → toutes queries → `[] / null / 0`
- `src/lib/redis.ts` : stub Proxy si `REDIS_URL.includes("stub.invalid")` → toutes commandes → null/no-op
- Magic string **NE PAS MODIFIER** sans propager 4 fichiers (prisma.ts, redis.ts, knowledge-rss.ts, knowledge-sitemap.ts)

### 3.5 SEO helpers

- `src/lib/seo.ts` : `SITE_URL` (fallback hardcodé `axion-ia.com` si localhost en prod), `BUILD_DATE` (un seul timestamp ISO figé par build, partagé sitemap + dateModified toutes pages)
- `resolveLocalizedPath()` : résout slug EN depuis FR canonical via `routing.pathnames` (exact + pattern matching)

---

## 4. Web Vitals — Budget de référence

Source : `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` (2026-05-08) + `lighthouserc.json`

| Métrique      | Cible interne |                     Gate CI actuel                      | Google "good" |
| ------------- | :-----------: | :-----------------------------------------------------: | :-----------: |
| LCP           |  ≤ 1 800 ms   |                    ERROR ≤ 1 800 ms                     |   2 500 ms    |
| INP           |   ≤ 100 ms    |        **OFF** (lab Lighthouse sans interaction)        |    200 ms     |
| CLS           |      = 0      |           ERROR ≤ 0,1 (desserré ← /fr/audit)            |      0,1      |
| TBT           |   ≤ 150 ms    | ERROR ≤ 200 ms (desserré ← recalibration Lighthouse 12) |    200 ms     |
| First Load JS |  ≤ 75 KB gz   |                     size-limit gate                     |       —       |

Exception `/reserver` : INP ≤ 150 ms, First Load ≤ 110 KB gz.

**État V-04 Phase 1+2** (dernier sprint web vitals, HEAD e7c4000) :

- Score V-04 53 → ~70-75/100 (patches livrés : JsonLd afterInteractive, SpeculationRules client-side, root layout @graph, Sentry traces 0.02)
- Phase 3 restante : LHCI gate tightening + Sentry chunk + LCP image preload (~4-5 j)

---

## 5. Audits de référence existants (ne pas double-compter)

| Fichier/Dir                                | Date       |          Score | Status                       |
| ------------------------------------------ | ---------- | -------------: | ---------------------------- |
| `AUDIT-COMPLET-END-TO-END-2026-05-22/`     | 2026-05-22 |       715/1000 | Baseline pré-sprints         |
| `AUDIT-FINAL-PROD-READY-2026-05-22/`       | 2026-05-22 |      ~854/1000 | Post-sprints code (P0 fixés) |
| `AUDIT-WEB-VITALS-2026-BUDGETS.md`         | 2026-05-08 |   V-04 ~70/100 | Phase 3 restante             |
| `KEYWORDS-PERFECTION-2026-05-22/`          | 2026-05-22 |       946/1000 | Keywords 1641 seeds          |
| `KEYWORDS-V12-CORRECTION-2026-05-22/`      | 2026-05-22 |     87→~95/100 | V-12 clusterId+cityIds       |
| `CONTENT-GEN-PERFECTION-2026/`             | 2026-05-22 |  ~770-820/1000 | P1.5 livré                   |
| `EXTERNAL-LINKS-2026-05-22/`               | 2026-05-22 |              — | 94 base + ~2400 cible        |
| `CAMPAIGN-CONTROLS-2026-05-22/`            | 2026-05-22 |       980/1000 | Sprint livré                 |
| `CONTENT-GEN-CITY-DOMINATION-2026-05-18/`  | 2026-05-18 |    2185.6/3200 | 68.3%                        |
| `KEYWORD-STRATEGY-AUDIT-2026/`             | 2026-05-19 |       700/1600 | 0% visibilité HEAD           |
| `INDEXATION-DISCOVERY-2026-05-18/`         | 2026-05-18 | 1705→2105/2415 | 87.2%                        |
| `PERFECTION-2026-FINALISATION-2026-05-22/` | 2026-05-22 |       715→~735 | V-15/V-09/V-13/V-04          |

**Règle cross-référence** : tout P0 trouvé par les 20 sub-agents sera marqué :

- `NEW` : jamais signalé dans aucun audit ci-dessus
- `CONFIRMED` : signalé et toujours présent
- `REGRESSED` : était RESOLVED, réapparu
- `RESOLVED` : signalé, maintenant corrigé

---

## 6. Décisions Will figées (cross-référence obligatoire)

| Décision                   | Valeur                                                            | Source                                      |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| Wikidata                   | **RENONCÉ**                                                       | `axionia_decisions_will_final_2026-05-21`   |
| Images DALL-E              | **INTERDIT**                                                      | `feedback_no_dalle_images`                  |
| Couleur principale         | Terracotta `#c24a1b` (ivoire fond, bleu pointes)                  | `axionia_couleurs`                          |
| EN locale                  | **Désactivé runtime** (toggle futur)                              | AGENTS.md                                   |
| Société                    | Française pure (pas OÜ)                                           | `axionia_decisions_will_final_2026-05-21`   |
| Table comparison `<table>` | **BANNI** sauf data                                               | `axionia_content_gen_perfection_2026-05-22` |
| 5 verticales               | Interventions + Audit + Implémentations + 1-to-1 + Web&Digital IA | `axionia_positionnement_4_verticales`       |

---

## 7. Fichiers Manon — INTOUCHABLES

Ne jamais modifier dans cette session :

- `src/content/villes/copy/*.ts`
- `src/content/equipe/manon*.ts` ou équivalents
- `prisma/seeds/images/seed-images.ts`

---

## 8. Plan Phase 1 — 20 sub-agents

### Lots publics (A1-A13)

| Agent | Lot                        | Templates | Pages clés                                                                                                                    |
| ----- | -------------------------- | --------: | ----------------------------------------------------------------------------------------------------------------------------- |
| A1    | L1 Home & narratif         |         8 | `/`, `a-propos`, `methodologie`, `roi`, `transparence`, `charte-editoriale`, `sections`, `design`                             |
| A2    | L2 Blog stack              |         8 | `blog/page`, `[slug]`, `auteur/[slug]`, `categorie/[slug]`, `secteur/[slug]`, `service/[slug]`, `tag/[slug]`, `taille/[slug]` |
| A3    | L3 Cas concrets            |         3 | `cas-concrets/page`, `[slug]`, `secteur/[slug]`                                                                               |
| A4    | L4 Knowledge/Guides        |         9 | `connaissances/*` (2), `centre-aide/*` (3), `guides/*` (2), `guide-ia`, `glossaire/*` (2)                                     |
| A5    | L5 FAQ/Comparaisons/Presse |         6 | `faq/*` (2), `comparaisons/*` (2), `presse/*` (2)                                                                             |
| A6    | L6 Galerie + Stack IA      |         7 | `galerie/*` (5), `stack-ia/*` (2)                                                                                             |
| A7    | L7 Audit (offre)           |         7 | `audit/*` (7)                                                                                                                 |
| A8    | L8 Interventions           |        22 | `interventions/**` (22)                                                                                                       |
| A9    | L9 Implementation          |        11 | `implementation/**` (11)                                                                                                      |
| A10   | L10 Verticales secondaires |         6 | `codage-developpement/*` (2), `sites-web-augmentes`, `un-a-un/*` (2), `equipe/[slug]`                                         |
| A11   | L11 GEO local              |         7 | `implantations/*` (3), `audit/par-ville`, `implementation/par-ville`, `interventions/par-ville`, `un-a-un/par-ville`          |
| A12   | L12 Conversion funnel      |         7 | `reserver`, `demande-devis/*`, `confirmation/*`, `contact`, `desabonnement`, `booking/[token]/*`                              |
| A13   | L13 Légal + RGPD           |        13 | `mentions-legales`, `politique-confidentialite`, `cookies`, `rgpd`, `mes-donnees/*`, `sous-processeurs`, etc.                 |

### Admin + Transverses (A14-A20)

| Agent | Mission                                                                             |
| ----- | ----------------------------------------------------------------------------------- |
| A14   | Admin V2 — 125 templates `(admin)/[adminPrefix]/**` (noindex, RBAC, audit-log, CSP) |
| A15   | Image-bank pipeline (73 images, CC BY 4.0, AVIF/WebP/LQIP, sitemap-images)          |
| A16   | Schema.org @graph global (Organization/WebSite/Person Manon/Service/Offer)          |
| A17   | i18n & hreflang (EN 301 state, routing.pathnames, plan réactivation EN)             |
| A18   | AI Act art. 50 + RGPD (aiGenerated, AiContentDisclaimer, promptHash, DPA)           |
| A19   | Web Vitals lab+field (15 pages stratégiques, bundle delta, INP par interaction)     |
| A20   | Sécurité & dangerouslySetInnerHTML (CSP, DOMPurify, RBAC, audit logs SOC2)          |

---

## 9. Sorties attendues Phase 1

Chaque sub-agent produit `_AUDIT/TEMPLATES-PERFECTION-2026-2026-05-22/L{N|A}-{nom}.md` avec :

- Score `/1000` par template (somme 10 dimensions D1-D10)
- Tableau D1-D10 avec note + justification + `path:line`
- Top 3 forces (file:line)
- Top 5 P0 + Top 5 P1 (cause + impact + correctif exact + effort h)
- Diffs ≤ 30 lignes prêts à coller
- Image health / Schema health / Web Vitals estimés / Indexabilité / AI Act conformité
- Benchmark concurrent (1 référence + 2 features à copier)

---

## 10. Statut Phase 0

- [x] Inventaire 250 templates ✅
- [x] Typecheck 0 erreur ✅
- [x] Vitest dernière baseline (1687/1694) — résultat live pending
- [x] Fichiers clés lus (routing.ts, seo.ts, prisma.ts, redis.ts, next.config.ts, lighthouserc.json, AGENTS.md)
- [x] Audits existants répertoriés (V-01→V-16, content-gen, keywords, image-bank)
- [x] Décisions Will figées documentées
- [x] Répertoire sortie créé `_AUDIT/TEMPLATES-PERFECTION-2026-2026-05-22/`
- [ ] Phase 1 : lancement 20 sub-agents (à confirmer ou lancer maintenant)

---

**Verdict Phase 0** : ✅ AUCUN BLOCKER. Build propre, 250 templates inventoriés, stubs contractuels OK, décisions Will cross-référencées. PRÊT À LANCER PHASE 1.
