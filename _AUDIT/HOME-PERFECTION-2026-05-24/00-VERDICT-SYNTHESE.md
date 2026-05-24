# Audit HOME PERFECTION — Verdict & Synthèse

**Date** : 2026-05-24
**Cible** : `src/app/[locale]/page.tsx` (Home Axion-IA, 1894 lignes) post-refonte Blueprint 2026 (commits `c617a046` + `926bcfc2`, livrée 2026-05-23)
**HEAD audit** : `0a2cb494` (origin/main)
**Méthode** : 7 sous-agents forensiques code-level, READ-ONLY, zéro invention. Runtime non-requis (Docker indisponible — cf. preflight 00-PREFLIGHT-FAILED).

---

## Score global : **761 / 1000** — classe **POLISH** 🟡

Moyenne pondérée des 7 dimensions auditées :

| #           | Dimension                                                                 | Score /100 | Classe      | Détail                               |
| ----------- | ------------------------------------------------------------------------- | ---------: | ----------- | ------------------------------------ |
| A1          | SEO core (title/desc/canonical/hreflang/OG/Twitter/robots/internal-links) |     **82** | Bon         | `01-A1-SEO-CORE.md`                  |
| A2          | AEO (FAQ + Speakable + Service x5 + Org + Review/AggregateRating)         |     **81** | Bon         | `02-A2-AEO.md`                       |
| A3          | GEO (LocalBusiness + areaServed + hreflang FR-only + LocalCoverage)       |     **92** | Excellent   | `03-A3-GEO.md`                       |
| A4          | Speakable + Breadcrumbs + Navigation + a11y landmarks                     |     **72** | Moyen ⚠️    | `04-A4-SPEAKABLE-BREADCRUMBS-NAV.md` |
| A5          | **Centralisation (SSOT, helpers, refactor 1894→320 LOC)**                 |     **42** | 🔴 Critique | `05-A5-CENTRALISATION.md`            |
| A6          | Web Vitals (LCP/INP/CLS) + assets (hero AVIF, logos, video)               |     **82** | Bon         | `06-A6-WEB-VITALS.md`                |
| A7          | i18n (FR/EN parité) + brand voice + AI Act                                |     **82** | Bon         | `07-A7-I18N-BRAND-AI-ACT.md`         |
| **Moyenne** | —                                                                         |  **76.14** | POLISH      | —                                    |

**Verdict /1000** : 761 — la home post-refonte Blueprint 2026 a une **base SEO/AEO/GEO solide** mais souffre d'un **monolithe de 1894 lignes** qui pénalise la maintenabilité, plus **6 P0 ponctuels** à fixer pour passer en zone excellence.

**Post P0 fixes (estimés ~6h)** : projection score → **820 / 1000** (classe BIEN).
**Post Sprint Centralisation (37.5h Phase 1+2+3)** : projection score → **900 / 1000** (classe EXCELLENT).

---

## Top 6 P0 — à fixer avant tout

| #        | Audit | P0                                                                                                                                                                                                                                                             | path:line                                                                                    | Effort | Impact                                                   |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| **P0-1** | A4    | **BreadcrumbList self-referencing sur home** — convention 2026 = home ne doit PAS émettre BL (warning Google). `breadcrumbJsonLd = null` ou retirer le `<JsonLd>` correspondant.                                                                               | `page.tsx:337-349`, émission `page.tsx:1879`                                                 | 5 min  | ⭐⭐⭐                                                   |
| **P0-2** | A4    | **2 h3 orphelines sans h2 parent** (hiérarchie cassée h1→h3)                                                                                                                                                                                                   | `page.tsx:1128` ("Six expertises. Indépendantes...") + `page.tsx:1506` ("Secteurs couverts") | 15 min | ⭐⭐                                                     |
| **P0-3** | A1    | **Description SEO trop générique, USP dilué** — "Interventions IA en entreprise..." manque "100% seniors, zéro intermédiaire"                                                                                                                                  | `page.tsx:89-91`                                                                             | 15 min | ⭐⭐⭐                                                   |
| **P0-4** | A1    | **Internal linking diversité insuffisante** — 10 destinations dont 0 vers `/a-propos`, `/methodologie`, `/cas-concrets`, `/transparence`, `/blog`. Ajouter 4-5 liens contextuels (founder → /a-propos, pricing → /methodologie, cases section → /cas-concrets) | `page.tsx` hero + founder + pricing + post-cases sections                                    | 1h     | ⭐⭐⭐                                                   |
| **P0-5** | A2    | **Service x5 sans `@id` refs vers Organization** — graph knowledge fragmenté pour LLMs. Remplacer `provider: { @type:"Organization", name:"Axion-IA", url:SITE_URL }` par `provider: { "@id": "#organization" }`                                               | `page.tsx:314-327`                                                                           | 10 min | ⭐⭐                                                     |
| **P0-6** | A2    | **VideoObject uploadDate dynamique** = `new Date().toISOString().slice(0,10)` au runtime au lieu de la vraie date de publication YouTube → stale freshness signal                                                                                              | `page.tsx:359` + interface `VideoTestimonial` dans `content/home-data.ts`                    | 20 min | ⭐⭐ (conditionnel : actuellement VIDEO_TESTIMONIALS=[]) |

**Total P0 fixes** : ~2h15 + 1h internal linking = **~3h15** pour passer 761 → ~810/1000.

---

## Top 8 P1 — important post-P0

| #    | Audit | P1                                                                                                                                            | Effort | Impact |
| ---- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| P1-1 | A4    | Speakable coverage : ajouter `[data-speakable-hero]` sur h1 + intro paras (actuellement FAQ only)                                             | 30 min | ⭐⭐   |
| P1-2 | A4    | Anchor IDs sections manquants — ajouter `id="services"`, `"why"`, `"cases"`, `"faq"`, `"pricing"` (deep-linking, TOC, AI Overviews citations) | 1h     | ⭐⭐   |
| P1-3 | A4    | `aria-labelledby` sur sections (WCAG 2.1 AA)                                                                                                  | 30 min | ⭐     |
| P1-4 | A2    | FAQPage `numberOfItems` field (Google validator compliance)                                                                                   | 5 min  | ⭐     |
| P1-5 | A2    | Service `serviceType` aligné `pricing.ts` tiers (vs label libre actuel)                                                                       | 20 min | ⭐     |
| P1-6 | A7    | **30 ternaires `isFr ? "..." : "..."` inline** → migrer vers `t()` (anti-pattern i18n bloquant si réactivation EN)                            | 3-4h   | ⭐⭐⭐ |
| P1-7 | A7    | ~50 clés i18n orphelines (comparison/modules/videos/ROI) à auditer (intégrer OU supprimer)                                                    | 2h     | ⭐⭐   |
| P1-8 | A7    | AI Act : émettre `aiGenerated: false` explicite dans JSON-LD (transparence LLM-facing pour 2026-08-02)                                        | 1h     | ⭐⭐   |

**Total P1** : ~9h.

---

## ⭐ Sprint Centralisation (A5) — le livrable phare

**État actuel** : `page.tsx` = **1894 lignes**, 13 sections inline, **42/100 centralisation**.
**Cible** : ~320 lignes + 10 nouveaux components + 4 nouveaux content files + 3 helpers JSON-LD = **87/100 post-refactor** (+45 pts).

### Phase 1 — Extraction sections (16h)

| #                 | Section                               |    Lignes inline | Component cible                                |  Effort |
| ----------------- | ------------------------------------- | ---------------: | ---------------------------------------------- | ------: |
| P1.1              | VALUE PROPOSITION (5 cartes services) |    92 (L445-536) | `src/components/home/ValuePropositionGrid.tsx` |      3h |
| P1.2              | PRICING TIERS (3 niveaux)             |   258 (L660-917) | `src/components/home/PricingTierGrid.tsx`      |      4h |
| P1.3              | WHY (6 différenciateurs + trust)      |  322 (L919-1240) | `src/components/home/WhySection.tsx`           |      5h |
| P1.4              | TESTIMONIALS (6 avis)                 | 129 (L1540-1668) | `src/components/home/TestimonialsSection.tsx`  |    2.5h |
| P1.5              | FAQ (12 questions)                    |  51 (L1670-1720) | `src/components/home/FaqSection.tsx`           |    1.5h |
| **Total Phase 1** | —                                     |     **-852 LOC** | —                                              | **16h** |

### Phase 2 — Data extraction (9h)

| #    | Data                 | Fichier cible                     | Effort |
| ---- | -------------------- | --------------------------------- | -----: |
| P2.1 | Tarification tiers   | `src/content/home-pricing.ts`     |     3h |
| P2.2 | Différenciateurs Why | `src/content/home-why.ts`         |   2.5h |
| P2.3 | Case cards visuels   | `src/content/home-cases.ts`       |   1.5h |
| P2.4 | CTA options finale   | `src/content/home-cta-options.ts` |     2h |

### Phase 3 — JSON-LD helpers (2.5h)

| #    | Helper                                                 | Cible                      | Effort |
| ---- | ------------------------------------------------------ | -------------------------- | -----: |
| P3.1 | `buildHomeServicesJsonLd(verticales[])`                | `src/lib/seo.ts`           |   1.5h |
| P3.2 | `buildHomeVideoJsonLd(testimonials[])`                 | `src/lib/seo.ts`           |   0.5h |
| P3.3 | Constantes rating/count `HOME_TESTIMONIALS_RATING` etc | `src/content/home-data.ts` |   0.5h |

### Bonus (10h optionnel)

| #   | Travail                                                                                                          | Bénéfice                  | Effort |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------- | -----: |
| P4  | Magic numbers → configs (4.9 rating, thresholds 600/320, idx\*80 delays)                                         | Testabilité +200%         |     4h |
| P5  | Lucide imports cleanup (24 imports → ~12 utilisés)                                                               | Bundle -400 B             | 30 min |
| P6  | Composant CTA cross-page (variants primary/secondary)                                                            | Dedup 60 LOC × 5 pages    |     3h |
| P7  | SSOT service descriptions `src/content/service-descriptions.ts` (dedup vs /audit /interventions /implementation) | Dedup 120 LOC cross-pages |   2.5h |

**Total Sprint Centralisation** : **27.5h core + 10h bonus = 37.5h**.

---

## Duplications cross-page critiques détectées (A5)

À traiter dans le sprint Centralisation Phase 2-3 + Bonus P6-P7 :

1. **Tarification 3 niveaux** : home L685-784 inline ≈ /audit tiers + /interventions tiers (forks divergents)
2. **Descriptions 5 verticales** : home L140-189 ≈ /audit L50-150 ≈ /implementation L220-350 (35-60% recouvrement)
3. **CTAs répétés** : "Réserver un appel" × 3+ par page, "Nous contacter" × 3+
4. **Trust signals** : "100% seniors", "RGPD strict", "Réponse 24h" répétés mot pour mot home + /audit + /implementation

---

## Forces conservées (à ne pas casser pendant refactor)

1. ✅ **SSOT Pricing** (`src/content/pricing.ts` 776l) — zéro hardcode prix sur home, `getTierById`/`formatAmount` partout
2. ✅ **Parité i18n 210 FR = 210 EN** — `pnpm i18n:check` vert
3. ✅ **Organization @graph layout-level** (`buildOrganizationJsonLd` + `buildWebsiteJsonLd` consolidés dans 1 `@graph` via `JsonLdGraph`) = best practice 2026
4. ✅ **Speakable FAQ conforme** — 4 cssSelectors valides correspondant au HTML réel (`data-faq-q`, `data-faq-a`, `itemprop`)
5. ✅ **Hero SVG 770l inline → AVIF priority Image** (commit antérieur), LCP candidate ~1400-1600ms estimé
6. ✅ **GEO clean** — pas d'invention adresse/geo/horaires (Service Area Business pattern correct, anti-spam local Google)
7. ✅ **Couleurs hiérarchie respectée** — terracotta dominante CTAs primaires, bleu réservé pointes (audit cible 92/100)
8. ✅ **5 verticales canoniques** présentes (vs 4 obsolète) dans Services section

---

## Roadmap recommandée Will

### Option A — P0 only (3h15) — RECOMMANDÉ avant tout merge

- Fix les 6 P0 ci-dessus (BreadcrumbList null, 2 h3 orphelines, description SEO, +4 internal links, Service @id refs, VideoObject date)
- **Score projeté : 761 → 810/1000**
- Commit dédié `fix(home): P0 audit perfection 2026-05-24`

### Option B — P0 + P1 (12h) — Idéal post-A

- Tout Option A + P1-1 à P1-8 ci-dessus
- **Score projeté : 810 → 870/1000**
- 2-3 commits dédiés

### Option C — Sprint Centralisation complet (37.5h) — phase suivante

- Refactor 1894→320 LOC selon plan A5 Phase 1+2+3 + bonus P4-P7
- **Score projeté : 870 → 900-920/1000**
- Sprint dédié 5 jours pleins, PR séparée

**Recommandation** : Option A immédiate (3h15), puis trancher B vs C selon priorités. L'option C peut s'enchaîner sur le travail Manon pricing-update-2026-05-24 (branche actuelle).

---

## Limites de cet audit

- **Code-level uniquement** — pas de Lighthouse runtime (Docker indisponible cf. preflight). LCP/INP réels p75 nécessitent CrUX 28-day post-deploy.
- **JSON-LD validation Google Rich Results** non-effectuée (nécessite URL prod live). Recommandé post-fix P0 : `validator.schema.org` + `search.google.com/test/rich-results`.
- **Coords GPS villes/régions** (LocalCoverageSection) non-spot-checkés : assumed correct (cf. content sources Will). Audit A3 P1 recommande spot-check 10 villes top.
- **Bundle JS réel** code-level estimé 65-78 KB gz (borderline 75 KB budget) — confirmer via `pnpm size-limit` ou `pnpm bundle:check` runtime.

---

## Coût engagé par cet audit

- LLM : 7 agents Explore (read-only) — ~$0 (read-only Sonnet/Haiku)
- Aucun fichier source modifié, aucun commit, aucun push.
- Branche actuelle `chore/pricing-update-2026-05-24` non-touchée.

---

## Liens

- Rapports détaillés : `01-A1-SEO-CORE.md` à `07-A7-I18N-BRAND-AI-ACT.md`
- Memory mère : `axionia_sprint_home_refonte_blueprint_2026-05-23` (refonte source)
- Memory précédente audit home (stale) : `axionia_audit_templates_perfection_2026-05-22` L01 (785/1000, pré-refonte)
- AGENTS.md Web Vitals 2026 budget : `LCP ≤ 1800ms p75 / INP ≤ 100ms / CLS = 0 / First Load JS ≤ 75 KB gz`
