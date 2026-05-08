# 🔬 PROMPT PAGE AUDIT PERFECT 2026 — AxionIA · Audit per-page exhaustif

> 📌 **Lire d'abord [`_AUDIT/SYNC-NOTICE-2026-05-07.md`](./SYNC-NOTICE-2026-05-07.md)** pour les évolutions HEAD `fd91518` (64 routes, doctrine v3, ban formation levé).
>
> **Version 1.0 · 2026-05-07** · audit page-par-page perfection extrême
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
> Scope : **1 page** (laser) ou **N pages** (batch même catégorie)
> Sortie : `_AUDIT/PAGE-AUDIT-<slug>.md` (1 par page) + scorecard global si batch.
> Durée : 20-40 min par page (selon complexité).

---

## 🎯 USAGE

### Mode 1 — Une seule page (laser focus)

> `Exécute _AUDIT/PROMPT-PAGE-AUDIT-PERFECT-2026.md sur la page /interventions/essentielle (FR + EN). Audit exhaustif 100 critères 2026. Sortie _AUDIT/PAGE-AUDIT-interventions-essentielle.md.`

### Mode 2 — Batch (plusieurs pages d'une même catégorie)

> `Exécute _AUDIT/PROMPT-PAGE-AUDIT-PERFECT-2026.md sur les 5 pages module Audit (/audit + /audit/flash + /audit/process + /audit/strategique-pme + /audit/strategique-eti + /audit/demande). Audit exhaustif. Sortie 5 fichiers _AUDIT/PAGE-AUDIT-audit-*.md + scorecard consolidée _AUDIT/PAGE-AUDIT-batch-audit.md.`

### Mode 3 — Top 15 pages stratégiques (gros chantier)

> `Exécute _AUDIT/PROMPT-PAGE-AUDIT-PERFECT-2026.md sur les 15 pages stratégiques listées dans le prompt. Audit exhaustif 100 critères × 15 pages. 5 agents parallèles (3 pages chacun). Sortie 15 fichiers _AUDIT/PAGE-AUDIT-*.md + scorecard consolidée _AUDIT/PAGE-AUDIT-top15.md. Verdict perfection/excellent/correct/insuffisant par page + Top P0/P1 cumulés.`

---

## 🧠 RÔLE & POSTURE

Tu es **auditeur senior frontend perfection 2026** — double casquette UX + ingénieur Next.js 16/React 19 + spécialiste SEO/AEO/GEO + expert E-E-A-T. Tu n'as pas codé ce projet. Tu prends une page et tu vérifies **100 critères** sans complaisance.

**Posture** : exigeance maximale. Une page « parfaite 2026 » coche les 100 critères. Tout score < 95/100 = points d'amélioration documentés. Lecture seule strict — diagnostic uniquement.

**Standards 2026** :

- Google Search Essentials 2026 + E-E-A-T Q1 2026 update
- Schema.org 27.0+
- Core Web Vitals (LCP/INP/CLS) seuils Google 2026
- WCAG 2.2 AA strict
- Next.js 16.2 + React 19.2 patterns
- llms.txt v0.1 proposed standard
- AEO citability moteurs LLM 2026 (Perplexity, ChatGPT search, Claude, Google AIO/AI Mode, Mistral Le Chat)

---

## 📚 SOURCES DE VÉRITÉ (pour chaque page)

1. **Code page** : `axionia/src/app/[locale]/<route>/page.tsx`.
2. **Code détail** si dynamique : `axionia/src/app/[locale]/<route>/[slug]/page.tsx`.
3. **Content** : `axionia/src/content/<module>.ts`.
4. **Composants utilisés** : suivre les imports.
5. **Build local** : `pnpm build` puis `pnpm start` → `http://localhost:3000/<locale>/<route>`.
6. **Doctrine v3** : `axionia/Design.md` v3 + `globals.css` HEAD.
7. **Référence qualité** : `/interventions` HEAD (post-refonte 2026-05-07).
8. **02b-mapping-pages.md** : DoD wireframe attendue pour la page.

---

## ⚖️ RÈGLES DU JEU

1. **Mode auto** — exécute, ne demande pas.
2. **Lecture seule strict** — `git`, `Read`, `Grep`, `Glob`, `pnpm build/start`, `WebFetch` validators externes.
3. **Citations obligatoires** : `file_path:line_number` pour chaque finding.
4. **Score par critère** : 0 (absent/cassé) / 1 (insuffisant) / 2 (acceptable) / 3 (parfait).
5. **Score page final** : moyenne pondérée /100. Verdict :
   - ≥ 95 = **PERFECTION 2026** ✅
   - 85-94 = **EXCELLENT** (polish)
   - 70-84 = **BON** (corrections P1)
   - < 70 = **INSUFFISANT** (refonte/sprint correctif)
6. **Priorisation findings** : P0 (bloquant prod) / P1 (majeur) / P2 (mineur) / P3 (cosmétique).

---

# 📋 LES 100 CRITÈRES (10 catégories × 10 critères)

## CATÉGORIE 1 — SEO technique (10 critères)

1. `<title>` 50-60 caractères, mot-clé principal en première position, unique sur le site.
2. `<meta description>` 140-160 caractères, value-prop + soft CTA, unique sur le site.
3. `<link rel="canonical">` **absolu HTTPS** (jamais relatif), self-referencing.
4. `<link rel="alternate" hreflang="fr|en|x-default">` cohérent avec sitemap.
5. `<meta name="robots" content="index, follow">` (ou directives spécifiques justifiées).
6. URL kebab-case, sans paramètres tracking dans canonical, profondeur ≤ 4.
7. `<meta name="viewport" content="width=device-width, initial-scale=1">`.
8. Sitemap inclut la page (vérifier `git show HEAD:src/app/sitemap.ts`).
9. Lazy loading correct (`loading="lazy"` below-fold + `priority` LCP).
10. 0 broken link interne (test crawl) + 0 redirect chain > 1 hop.

## CATÉGORIE 2 — SEO contenu (10 critères)

11. **Un seul `<h1>`** par page, mot-clé principal + différenciateur.
12. Hiérarchie h1→h6 cohérente, pas de saut (jamais h1 → h3).
13. Body word count adapté : pillar ≥ 1500, produit 800-1500, transversale 500-1000.
14. Densité mot-clé principal 1-2 % (pas stuffing).
15. Mots-clés sémantiques (LSI) présents (champ lexical du sujet).
16. Lisibilité Flesch FR/EN ≥ 60 (paragraphes courts, phrases simples).
17. Listes `<ul>`/`<ol>` + tableaux `<table>` pour scannabilité.
18. Images : `alt` descriptif, filename SEO-friendly, AVIF/WebP, dimensions explicites.
19. Internal links contextuels ≥ 3 par page (anchors descriptifs, jamais « cliquez ici »).
20. Pas de duplicate content vs autres pages du site (cannibalization audit).

## CATÉGORIE 3 — JSON-LD (10 critères)

21. Schema spécifique au type de page présent (`Service`/`Product`/`Article`/`FAQPage`/`WebPage`/etc.).
22. `BreadcrumbList` JSON-LD présent (sauf accueil) avec items dans le même ordre que la nav.
23. `Organization` global cohérent avec autres pages (logo, sameAs, address, contactPoint).
24. `inLanguage` correctement renseigné (`fr-FR` ou `en-US`).
25. `@id` URLs absolues HTTPS, cohérentes pour graph linking inter-schémas.
26. Si page produit : `Offer` avec `price`, `priceCurrency`, `priceValidUntil`, `availability`.
27. Si page éditoriale : `Article` + `Author` (`Person`) + `Publisher` + `dateModified`.
28. Si FAQ inline : `FAQPage` + `Question` + `acceptedAnswer` (`Answer`).
29. Validés via Schema.org Validator API (WebFetch test).
30. Validés via Google Rich Results Test (WebFetch test).

## CATÉGORIE 4 — AEO (Answer Engine Optimization) (10 critères)

31. **Direct-answer block** 40-80 mots en haut de page, format question-réponse citable.
32. Mot-clé principal en début du direct-answer.
33. Différenciateur clair dans le direct-answer (« cabinet européen », « ROI mesurable », « PME/ETI », etc. — purge 2026-05-07 : éviter « OÜ estonienne » / « 90 jours » dans le marketing copy ; ces termes restent uniquement dans `legal.ts`).
34. Q&A pairs supplémentaires en milieu de page (≥ 3 sections h2 formulées en question).
35. Réponses courtes scannables (listes, étapes numérotées, tableaux).
36. **Speakable markup** présent (`<meta name="speakable-css-selector">` ou JSON-LD `speakable`).
37. Page référencée dans `llms.txt` (si pillar) ou `llms-full.txt` (si éditorial).
38. RSS feed inclut la page si applicable (blog/cas/FAQ/presse).
39. Itemscope microdata `Question`/`Answer` cohérent avec JSON-LD (double signal).
40. **Citability test 5 LLMs** sur le mot-clé principal de la page → AxionIA cité au moins 1× sur 5 (baseline minimal).

## CATÉGORIE 5 — GEO (Generative Engine Optimization) + E-E-A-T (10 critères)

41. **Experience signal** : first-hand experience documenté (cas concret méthodologie réelle, pas générique).
42. **Expertise signal** : si page éditoriale → `Person` author byline avec `jobTitle` + `worksFor` + `sameAs` LinkedIn.
43. **Authoritativeness signal** : citations externes/sources/références si applicable.
44. **Trust signal** : mentions légales/contractuelles AxionIA OÜ (droit estonien, AKI, TVA EE) **uniquement sur pages légales** (`legal.ts`) — purgé du marketing copy 2026-05-07. Pour les autres pages : email RGPD + signaux UE/cabinet européen acceptables.
45. **Brand consistency** : « AxionIA » écrit identiquement (jamais « Axion IA », « Axionia », « Axion-IA »).
46. **NAP consistency** : Name + Address + Phone identiques sur la page et footer.
47. **dateModified** présent et cohérent (signal Google QDF — Query Deserves Freshness).
48. **Author attribution** sur articles blog/cas (Person schema avec photo + bio + sameAs).
49. **Témoignages authentiques** si présents (Person + role + company réels, pas Lorem).
50. **Training-dataset-friendly markup** : SSR strict (contenu lisible sans JS via `curl <url>`).

## CATÉGORIE 6 — Performance Core Web Vitals 2026 (10 critères)

51. **LCP** ≤ 2.5s mobile (≤ 1.8s pour pages produit), ≤ 1.5s desktop.
52. **INP** ≤ 200ms (Google 2026 standard).
53. **CLS** ≤ 0.1.
54. **TTFB** ≤ 600ms.
55. **FCP** ≤ 1.8s mobile.
56. **Bundle JS first load** ≤ 100 KB (page produit) ou ≤ 80 KB (page texte).
57. **CSS first load** ≤ 50 KB (Tailwind purgé).
58. **LCP image** : `fetchPriority="high"` + Next/Image `priority` + AVIF servi.
59. **Below-fold images** : `loading="lazy"` + `decoding="async"` + dimensions explicites.
60. **Lighthouse mobile score** ≥ 95 sur perf/SEO/a11y/best-practices.

## CATÉGORIE 7 — Accessibilité WCAG 2.2 AA (10 critères)

61. **axe-core** 0 violation level AA.
62. **Keyboard navigation** : ordre logique, pas de piège focus, skip-to-content fonctionne.
63. **Screen reader** : NVDA + VoiceOver iOS testés (Hero, CTA, forms si présents).
64. **Touch targets** ≥ 44×44 partout.
65. **Contraste** : body ≥ 4.5:1 AA (idéal ≥ 7:1 AAA).
66. **`prefers-reduced-motion: reduce`** désactive toutes animations/transitions.
67. Pas d'`aria-*` redondant sur `<button>`/`<a>` natifs.
68. Form errors (si forms présents) : `role="alert"` + `aria-live`.
69. `<main>` unique avec `id="main"` + skip-link `<a href="#main">`.
70. Hierarchie headings respectée + `<picture>` AVIF/WebP/JPEG fallback OK.

## CATÉGORIE 8 — Doctrine v3 cohérence (10 critères)

71. **Surfaces** : `bg-bg` ivoire `#faf8f3` canvas, `bg-paper` blanc cards, `bg-sand` alternance, `bg-mocha` premium. **0 noir pur** (`#000`/`#080808`/`#0a0a0a`).
72. **Primary** Editorial Blue `#1a4dd9` unique pour CTA primaires/links/focus ring.
73. **Terracotta** `#c24a1b` unique accent éditorial (`em.editorial`, dot indicator hero, divider footer).
74. **Sage** `#7a8870` sur Module Cas concrets (substitut éditorial du green v1).
75. **3 polices** uniquement : Manrope + Fraunces + Inconsolata (0 résiduelle Inter/Geist/etc.).
76. **Type scale v3** : display 7rem si hero principal, label-up tracking 0.16em.
77. **Hero pattern** : `titleEm` italique terracotta sur mot identitaire + eyebrow avec dot indicator couleur module.
78. **Halos signature** : `bg-halo-warm` sur Hero `home`/`module`, `bg-halo-cool` en alternance.
79. **Animation** `translate-x-[6px]` au hover sur tous CTA primaires + `prefers-reduced-motion` respecté.
80. **0 hex hardcodé** hors `globals.css` (anti-hex grep passe), tokens consommés via Tailwind utility.

## CATÉGORIE 9 — i18n & UX (10 critères)

81. Toutes chaînes via `useTranslations`/`getTranslations` (0 hardcodé).
82. Parité FR/EN namespace cohérent (`pnpm i18n:check` 0 erreur).
83. Traduction EN sémantique (pas mot-à-mot mécanique).
84. Pathnames typés via `next-intl` `routing.ts` (FR canon + EN traduit).
85. Espaces insécables FR avant `:`, `;`, `?`, `!`, `»` + après `«`.
86. Mobile-first vérifié (test 360px → 1920px).
87. CTAs cohérents (réservation, contact, calendrier) avec micro-copy claire.
88. Densité contenu ≥ niveau référence `/interventions` (sauf légales acceptables minimal).
89. Sections proof présentes si applicable (témoignages, cas, métriques).
90. Anti-objection / anti-fear pour pages module (rassurer différents niveaux maturité).

## CATÉGORIE 10 — Best practices Next.js 16 / React 19 / 2026 (10 critères)

91. **Server Component** par défaut, `'use client'` justifié par commentaire `// use-client: <raison>`.
92. **`generateMetadata`** présent et async, retourne title + description + alternates hreflang + OG.
93. **`params` async** (Next 15+ requirement) : `interface Props { params: Promise<{...}> }`.
94. **`searchParams` async** si page utilise filtres URL-driven.
95. **Speculation Rules** prefetch sur cards listing (`<script type="speculationrules">`).
96. **View Transitions API** active (`experimental.viewTransition: true`).
97. **PPR** static shell + Suspense boundaries (page produit).
98. **React Compiler** activé (pas de `useMemo`/`useCallback` manuels — antipattern post-React 19).
99. **`<Suspense>`** boundaries sur sections lourdes (calendrier, simulateur, listings).
100.  **OG image dynamique** `/api/og?...` 1200×630 testée et fonctionnelle.

---

# 📊 SORTIE PAR PAGE — `_AUDIT/PAGE-AUDIT-<slug>.md`

```markdown
# Audit Page — <route> — Perfection 2026

- Date : 2026-MM-DD
- Auditeur : Claude Opus 4.7 (1M context)
- URL FR : http://localhost:3000/<route-fr>
- URL EN : http://localhost:3000/<route-en>
- Fichier source : `axionia/src/app/[locale]/<route>/page.tsx`
- Commit audité : <sha HEAD>

## 1. Verdict

- [ ] PERFECTION 2026 ✅ (score ≥ 95/100)
- [ ] EXCELLENT ⚠️ (score 85-94/100, polish)
- [ ] BON ⚠️ (score 70-84/100, corrections P1)
- [ ] INSUFFISANT ❌ (score < 70/100, refonte requise)

## 2. Score global : XX/100

| Catégorie                           | Score  | /30      |
| ----------------------------------- | ------ | -------- |
| 1. SEO technique                    | XX     | /30      |
| 2. SEO contenu                      | XX     | /30      |
| 3. JSON-LD                          | XX     | /30      |
| 4. AEO                              | XX     | /30      |
| 5. GEO + E-E-A-T                    | XX     | /30      |
| 6. Performance CWV                  | XX     | /30      |
| 7. Accessibilité WCAG               | XX     | /30      |
| 8. Doctrine v3                      | XX     | /30      |
| 9. i18n & UX                        | XX     | /30      |
| 10. Best practices Next 16/React 19 | XX     | /30      |
| **TOTAL**                           | **XX** | **/300** |

## 3. Findings P0 (bloquants)

| #   | Critère | Constat | Fichier:ligne | Action proposée | Effort |
| --- | ------- | ------- | ------------- | --------------- | ------ |

## 4. Findings P1, P2, P3

[idem]

## 5. Détail des 100 critères

### Catégorie 1 — SEO technique

| #   | Critère              | Score 0-3 | Note                                                       | Localisation |
| --- | -------------------- | --------- | ---------------------------------------------------------- | ------------ |
| 1   | `<title>` 50-60c     | 3         | "Cabinet IA opérationnel · ROI mesurable · AxionIA" 52c ✅ | page.tsx:42  |
| 2   | `<meta description>` | 2         | 158c, manque CTA implicite                                 | page.tsx:43  |
| ... | ...                  | ...       | ...                                                        | ...          |

[idem pour catégories 2 à 10]

## 6. Recommandations actionables (par effort)

### Quick wins (≤ 30 min)

- [Liste]

### Polish (30 min - 2h)

- [Liste]

### Refonte partielle (2-6h)

- [Liste]

### Refonte majeure (> 6h)

- [Liste]

## 7. Comparaison avec /interventions (référence qualité)

| Dimension | /interventions | Cette page | Écart |
| --------- | -------------- | ---------- | ----- |

## 8. Validation Will

- ☐ OUI les corrections P0+P1 sont alignées
- ☐ CONTINUE on fait juste les P0
- ☐ STOP scope refonte trop large
```

---

# 📊 SORTIE BATCH (si N pages) — `_AUDIT/PAGE-AUDIT-batch-<categorie>.md`

```markdown
# Batch Audit — <catégorie> — Perfection 2026

- Pages auditées : N
- Date : 2026-MM-DD

## 1. Scorecard consolidée

| Page           | SEO tech | SEO contenu | JSON-LD | AEO | GEO | Perf | A11y | Doctrine | i18n/UX | BP 2026 | TOTAL   | Verdict   |
| -------------- | -------- | ----------- | ------- | --- | --- | ---- | ---- | -------- | ------- | ------- | ------- | --------- |
| /interventions | 30       | 28          | 30      | 27  | 25  | 28   | 30   | 30       | 28      | 29      | 285/300 | EXCELLENT |
| /audit         | ...      | ...         | ...     | ... | ... | ...  | ...  | ...      | ...     | ...     | .../300 | ...       |

## 2. Top P0 cumulés (toutes pages)

[Liste classée par priorité]

## 3. Patterns récurrents

- N pages ont le même problème X → recommandation globale
- N pages excellent sur Y → exemples à dupliquer

## 4. Plan de refontes priorisé

[Sprint correctif XS / S / M / L]

## 5. Question fermée

- OUI on refond les P0 dans cet ordre
- CONTINUE on patch juste les P0 critiques
- STOP scope frontend perfection clos, on passe à Sprint 15
```

---

# ▶️ DÉMARRAGE

1. **Confirme** : indique la liste exacte des pages auditées (Mode 1 / 2 / 3) en 5 lignes.
2. **Charge** : sources de vérité + référence qualité `/interventions` HEAD + Design.md v3.
3. **Pour chaque page** :
   - Lire `page.tsx` + content + composants importés.
   - `pnpm build` puis `curl http://localhost:3000/<route>` pour HTML rendu.
   - Évaluer les 100 critères avec score 0-3 + note + localisation.
   - Générer `_AUDIT/PAGE-AUDIT-<slug>.md`.
4. **Si Mode batch ou Mode 3** : générer scorecard consolidée + recommandations cumulées.
5. **Renvoie à Will (≤ 250 mots)** :
   - Verdict global (perfection / excellent / bon / insuffisant).
   - Score moyen sur N pages.
   - Top 5 findings P0 cumulés.
   - Top 3 quick wins (< 30 min chacun).
   - Question fermée : « OUI corrections P0 / CONTINUE quick wins / STOP scope ».

---

# 📋 ANNEXE — TOP 15 PAGES STRATÉGIQUES (Mode 3)

À auditer en priorité (80/20 du trafic + conversion + autorité E-E-A-T) :

| #   | Route FR                     | Route EN                    | Catégorie    | Pourquoi prioritaire                                    |
| --- | ---------------------------- | --------------------------- | ------------ | ------------------------------------------------------- |
| 1   | `/`                          | `/`                         | Home         | Première impression + Organization global               |
| 2   | `/interventions`             | `/interventions`            | Listing M1   | Référence qualité (post-refonte)                        |
| 3   | `/interventions/essentielle` | `/interventions/essential`  | Page phare   | Conversion 490€                                         |
| 4   | `/audit`                     | `/audit`                    | Listing M2   | Module 2 entry point                                    |
| 5   | `/audit/strategique-pme`     | `/audit/strategic-pme`      | Page produit | Audit cœur de cible PME (pyramide 4 niveaux 2026-05-07) |
| 6   | `/implementation`            | `/implementation`           | Listing M3   | Module 3 entry point                                    |
| 7   | `/implementation/ia-custom`  | `/implementation/custom-ai` | Premium      | Page implem premium                                     |
| 8   | `/cas-concrets`              | `/case-studies`             | Listing      | Proof + filtres                                         |
| 9   | `/cas-concrets/<slug-fort>`  | `/case-studies/<slug>`      | Détail       | Cas authority-building                                  |
| 10  | `/a-propos`                  | `/about`                    | Transverse   | **E-E-A-T autorité** + bio Will                         |
| 11  | `/contact`                   | `/contact`                  | Transverse   | ContactPage + conversion                                |
| 12  | `/blog`                      | `/blog`                     | Listing      | AEO éditorial                                           |
| 13  | `/faq`                       | `/faq`                      | Transverse   | FAQPage massif AEO                                      |
| 14  | `/reserver`                  | `/book`                     | Booking      | Conversion calendrier                                   |
| 15  | `/presse`                    | `/press`                    | Transverse   | (quand créée) Autorité GEO max                          |

Optionnel : `/roi`, `/centre-aide`, `/glossaire` selon priorités Will.

---

**Note méthodologique** : pour les pages dynamiques `[slug]` (cas-concrets, blog, articles), auditer **1 instance représentative** par catégorie (la plus vue ou la plus stratégique). Les autres seront vérifiées par sample dans l'audit transversal SEO/AEO/GEO 2026.
