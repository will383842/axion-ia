# 🔬 PROMPT FRONTEND AUDIT V14-2026 — Axion-IA · Vérification bout-en-bout post-Sprints 0-14

> **Version 1.0 · 2026-05-07** · audit unifié pré-backend
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (sous-repo Next.js 16).
> Sortie principale : `_AUDIT/AUDIT-FRONTEND-V14-2026.md` + 7 annexes A→G + JSON deltas machine-readable.
> Durée estimée : 60-90 min (5 agents parallèles + agent principal).
>
> 📌 **Lire d'abord [`_AUDIT/SYNC-NOTICE-2026-05-07.md`](./SYNC-NOTICE-2026-05-07.md)** : ce prompt parle de « 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) » dans certains passages alors que HEAD `fd91518` a 64 routes ; module Audit refactoré ; ban formation levé ; etc.

---

## 🎯 SCOPE

Audit **transition Sprint 14 → Sprint 15** (porte de sortie frontend / porte d'entrée backend).
Consolide les 4 prompts existants (`SPRINT-AUDIT`, `FRONTEND-DEEP-CHECK`, `VERIFICATION-FINALE Pass A`, `CHECKPOINT 34 critères`) **sans les remplacer** pour les audits futurs ciblés. Pour cet audit-ci, **lance celui-ci uniquement**.

### Cible exacte

- 15 sprints livrés : Sprint 0 (`f52a2b4`) → Sprint 14 (`1135136`) + 5 phases polish frontend-deep-check (`01c5a59` → `f2ea1e6`) + nouvelle direction visuelle commitée 2026-05-07 (`365d707` → `c9a8a92` → `941a8e1` au minimum, vérifier `git log` pour le HEAD réel).
- 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) de `_AUDIT/02b-mapping-pages.md` (~170-220 routes FR + EN).
- État courant du repo : working copy **clean** (tous les changements commités). La doctrine visuelle actuellement commitée fait foi — l'audit la prend comme référence interne **sans imposer** d'autre source de vérité externe (les ADR 0001 Webflow et 0002 Editorial v3 sont des artefacts historiques de l'évolution de la doctrine, pas des contraintes).

### Hors scope

- Backend (Sprints 15-23 à venir).
- Choix de la nouvelle direction visuelle (décision Will, pas un audit).
- Tests de pénétration (`OWASP ZAP`, `nuclei`) — Sprint 21.
- Tests de charge (`k6`, soak test) — Sprint 21.

---

## 🧠 RÔLE & POSTURE

Tu es **lead frontend reviewer indépendant** (double casquette UX + ingénieur senior Next.js 16/React 19). Tu n'as ni codé ce projet ni participé aux sprints. Tu n'as pas à juger la doctrine visuelle (Will l'a déjà arbitrée). Ta mission :

1. **Vérifier que les Sprints 0-14 sont solides** (DoD croisée commit-par-commit).
2. **Vérifier que le frontend est complet** (64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md), navigation, formulaires, calendrier, ROI, pages système).
3. **Vérifier que tout est harmonisé** (composants, copy FR/EN, JSON-LD, hreflang, code quality, doctrine **interne** — sans imposer de référence externe).
4. **Vérifier les meilleures pratiques 2026** (Next 16.2.4, React 19.2, View Transitions, PPR, Speculation Rules, React Compiler, RUM, Trusted Types, OWASP ASVS 5.0).
5. **Vérifier SEO + AEO + GEO 2026** (3 disciplines distinctes, chapitres dédiés).
6. **Détecter** l'état dual commit (v1) / working copy (v3 partiel) et lister les fichiers à statuer.

**Posture** : pixel-perfect, comportement-perfect, factuel, lecture seule. Le moindre flash, le moindre layout shift, le moindre lien orphelin, la moindre clé i18n manquante = finding.

**Aucune correction dans ce prompt** — diagnostic exhaustif uniquement.

---

## 📚 SOURCES DE VÉRITÉ

### Code source

1. `axionia/` (sous-repo Git Next.js 16) — code à auditer.
2. `git log --oneline` Sprints 0-14 + polish (15 commits).
3. `git diff` working copy actuelle vs `HEAD` (à mesurer en live — la direction visuelle est figée et commitée depuis `941a8e1+` 2026-05-07, **pas rejetée**). Working copy résiduelle = WIP (ex: page presse pré-commit) à signaler sans bloquer.

### Documentation projet

4. `_AUDIT/02-PLAN.md` — jalons M1-M11.
5. `_AUDIT/02b-mapping-pages.md` — **64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) uniques** (référence completeness).
6. `_AUDIT/00-fiches-lecture.md` — 16 contradictions Phase 0.
7. `_AUDIT/01s-skills-deep-audit.md` + 6 annexes A→F — règles skills.
8. `_AUDIT/PROMPT-CODAGE.md` — DoD attendue par sprint (sections `SPRINT 0` à `SPRINT 14`).
9. `axionia/SESSION_LOG.md` — DoD déclarée par sprint.
10. `axionia/CHANGELOG.md` — historique versions.
11. `axionia/package.json` — stack verrouillée (Next 16.2.4, Auth.js v5 beta, etc.).
12. `axionia/.github/workflows/*.yml` — gates CI configurés.
13. `axionia/docs/adr/*.md` — Architecture Decision Records.
14. `Navigation-Complete-Axion-IA.md` — sitemap exhaustif + user flows.
15. `Wireframes-Briefs-Axion-IA/00-08*.md` — 9 wireframes-briefs (référence visuelle de chaque page).

### Skills

16. 18 skills `axionia-*` cadenassés dans `axionia-package/.claude/skills/`.
17. 22 LOCKs sur skills génériques (`axionia-package/.claude/skills/CHANGELOG-LOCKS.md`).

### Décisions

18. `axionia-package/docs/_DECISIONS-FINALES.md` — décisions verrouillées 06/05/2026.
19. `axionia-package/docs/_NO-STRIPE.md` — interdiction Stripe Phase 1.
20. `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 — bible projet.

### Doctrine visuelle — état 2026-05-07 (post-itérations Will)

- **ADR 0001 Webflow** = doctrine **historique** sous laquelle Sprints 0-14 ont été initialement codés (commits `fe000c6` → `f2ea1e6`).
- **Nouvelle doctrine commitée** (commits `365d707` → `941a8e1` minimum) = direction visuelle actuellement en place, **fait foi**. Caractérisée notamment par : `titleEm` serif italique sur les hero (12+ pages dynamiques + standalone), Header avec couleur figée terracotta (scroll-aware retiré).
- L'audit **prend la doctrine commitée comme référence interne** : extrait les tokens effectivement utilisés dans `globals.css` + composants, vérifie la cohérence transverse (pas un seul fichier qui dévie du pattern majoritaire), signale les anti-patterns (hex hardcodés, polices résiduelles non chargées, `bg-white` natif si la doctrine utilise une autre surface canvas).

---

## ⚖️ RÈGLES DU JEU

1. **Mode auto** — exécute, ne demande pas. Sauf STOP & ASK final.
2. **LECTURE SEULE STRICT** — aucune modification du code, aucun commit, aucun stash. Cet audit ne corrige pas, il diagnostique. Outils autorisés : `git log`, `git show`, `git diff`, `git status`, `git ls-tree`, `pnpm ls`, `pnpm typecheck`, `pnpm lint`, `pnpm test --run`, `pnpm build`, `pnpm start` (read endpoints only). Outils interdits : `git reset`, `git rebase`, `git push`, `git restore`, `git stash`, `rm`, modifications fichiers.
3. **Multi-agents en parallèle** quand les chapitres sont indépendants (cf. § DISPATCH).
4. **Citations obligatoires** : `file_path:line_number` pour chaque finding + commit hash réel pour DoD croisée + commande/URL/test pour reproduction.
5. **Verdict tri-état par critère** : ✅ conforme · ⚠️ partiel/dette assumée documentée · ❌ manquant.
6. **Priorisation** :
   - **P0** — bloquant Sprint 15 ou production (doit être corrigé avant de passer au backend).
   - **P1** — majeur, à planifier en parallèle Sprint 15.
   - **P2** — mineur, post-launch acceptable.
   - **P3** — cosmétique, polish phase finale.
7. **Working copy v3** : signalée mais **pas auditée comme doctrine de référence**. L'audit travaille sur l'état du repo tel qu'il est et signale les incohérences.
8. **Aucune commande destructive** — voir liste interdite ci-dessus.

---

## 🤖 DISPATCH MULTI-AGENTS (1 message, 5 Agent calls en parallèle)

| Agent               | Subagent        | Mission                                                                                                                                                                                                                       |
| ------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AGT-DOD**         | Explore         | **Partie A** — DoD croisée Sprints 0-14 (3 sous-tranches S0-4, S5-9, S10-14 + polish). Croiser PROMPT-CODAGE attendue ↔ SESSION_LOG déclarée ↔ git show réelle.                                                               |
| **AGT-COVERAGE**    | Explore         | **Partie B chap. 1-3** — 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) vs build, navigation profonde (Header/Footer/Drawer/Breadcrumbs/LocaleSwitcher/Skip/Speculation/View Transitions), pages programmatiques.   |
| **AGT-QUALITY**     | general-purpose | **Partie B chap. 4-7** — A11Y WCAG 2.2 AA (axe + keyboard + screen readers), perf CWV (LCP/INP/CLS/TTFB/bundle/fonts/images), cross-browser matrix (Playwright Chromium+WebKit+Firefox + 4 mobiles), tests Vitest+Playwright. |
| **AGT-SEO-AEO-GEO** | Explore         | **Partie C** — SEO classique + AEO 2026 (citability LLMs) + GEO 2026 (E-E-A-T, brand mentions, entity optim, training-dataset-friendly markup).                                                                               |
| **AGT-COHERENCE**   | general-purpose | **Partie D** — Cohérence transverse (composants dupliqués, copy FR/EN harmonisée, JSON-LD cohérents, anti-banni, code quality, working copy state, doctrine interne sans référence externe).                                  |

L'agent principal pendant ce temps exécute **Partie E** (best practices 2026 Next 16.2 / React 19.2 / experimental flags) + **Chapitres transverses T1-T10** + agrégation finale.

---

# 📋 PARTIE A — DoD croisée Sprints 0-14 (3 agents Explore parallèles)

> Délégué à **AGT-DOD**.

### A.1 — Méthode (appliquée à chaque sprint N ∈ {0..14})

- **DoD attendue** : extraire de `_AUDIT/PROMPT-CODAGE.md` la section `### SPRINT N` — chaque critère numéroté + chaque fichier nommé + chaque test exigé.
- **DoD déclarée** : `axionia/SESSION_LOG.md` + `axionia/CHANGELOG.md` — commit hash, date, livrables annoncés, reports.
- **DoD réelle** : `git show --stat <commit>` + `git ls-tree -r <commit>` + lecture fichiers critiques.
- **Croisement** :

| #   | Critère DoD attendue | Déclaré SESSION_LOG | Réel git | Verdict  | Priorité |
| --- | -------------------- | ------------------- | -------- | -------- | -------- |
| 1   | …                    | …                   | …        | ✅/⚠️/❌ | P0/P1/P2 |

### A.2 — Tranches d'analyse parallèle

- **A.2.1 — Sprints 0-4** (`f52a2b4`, `fe000c6`, `8200548`, `5fd1dda`, `062b8df`) : toolchain + tokens v1 Webflow + i18n + atoms + sections.
- **A.2.2 — Sprints 5-9** (`2dcad8b`, `f7bb430`, `c99d66a`) : 3 modules produits (Interventions/Audit/Implémentation) + cas concrets + 5 transversales.
- **A.2.3 — Sprints 10-14 + polish** (`9cc70d7`, `c3d748b`, `d6b9983`, `5a5ac6e`, `1135136`, `01c5a59`→`f2ea1e6`) : légales + forms + ROI + calendrier + système/SEO + 5 phases polish frontend-deep-check.

### A.3 — Sortie partielle

Annexes machine-readable :

- `_AUDIT/AUDIT-FRONTEND-V14-A1.md` (Sprints 0-4)
- `_AUDIT/AUDIT-FRONTEND-V14-A2.md` (Sprints 5-9)
- `_AUDIT/AUDIT-FRONTEND-V14-A3.md` (Sprints 10-14 + polish)
- `_AUDIT/AUDIT-FRONTEND-V14-deltas.json` (deltas par sprint)

### A.4 — Verdict Partie A

GO si 0 P0 + ≤ 5 P1 cumulés sur les 15 commits. Sinon NO-GO Sprint 15.

---

# 🧩 PARTIE B — Audit qualité bout-en-bout (frontend + tests)

## B.1 — Smoke run end-to-end (agent principal)

- `pnpm install` propre depuis lockfile.
- `pnpm typecheck` 0 erreur (TS strict++ : `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`).
- `pnpm lint` 0 erreur, 0 warning (ESLint + jsx-a11y + @typescript-eslint/strict-type-checked).
- `pnpm format:check` 0 diff.
- `pnpm test --run` 71 tests verts (cible Sprint 14, voir SESSION_LOG).
- `pnpm build` succès complet sans warning.
- `pnpm start` répond 200 sur `/`, `/fr`, `/en`, redirect par défaut OK.
- 0 warning console au chargement (DevTools).
- 0 warning Next.js (`next dev` propre).

## B.2 — Inventaire & completeness 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) (AGT-COVERAGE)

Pour **chaque** template du `_AUDIT/02b-mapping-pages.md` :

- URL FR + EN existe (HTTP 200 build local).
- Composant respecte le wireframe-brief associé (cf. `Wireframes-Briefs-Axion-IA/`).
- `generateMetadata` présent (title + description + canonical + alternates hreflang FR/EN/x-default).
- JSON-LD présent et valide (Schema.org Validator API).
- `<Breadcrumbs>` présent (sauf accueil) + JSON-LD `BreadcrumbList`.
- OG image dynamique 1200×630 fonctionne (`/api/og?...`).
- Aucun `'use client'` non justifié (commentaire `// use-client: <raison>`).
- Routes orphelines (build mais pas dans mapping) → P1 (lister).
- Routes manquantes (mapping mais pas dans build) → **P0**.

Script `scripts/check-route-coverage.ts` fait foi.

## B.3 — Navigation profonde (AGT-COVERAGE)

### B.3.A · Header desktop (≥ lg / 992px)

- 5 items : Logo · Interventions · Audit · Implémentation · Cas concrets · CTA central · LocaleSwitcher.
- Aucun dropdown.
- État actif : underline ou indicator 2px sous `pathname`.
- Sticky : header colle au scroll, fond opaque dès `scrollY > 8`, transition 250ms.
- Logo cliquable → retour accueil.
- CTA primaire `translate-x-[6px]` au hover (test Playwright transform CSS).
- Tab order : Logo → 4 liens → CTA → LocaleSwitcher.
- Tous les liens via next-intl, prefetch par défaut.
- Aucun `'use client'` sur Header (sauf composant scroll/mobile justifié).

### B.3.B · Header mobile (< lg)

- Hamburger 44×44 minimum.
- `<Sheet>` plein écran : 4 liens stacked + CTA + LocaleSwitcher + mentions OÜ + téléphone + email.
- `aria-modal="true"`, focus trapped, `Escape` ferme, hamburger devient X.
- Backdrop click ferme.
- Animation slide-in 250ms (désactivée `prefers-reduced-motion`).
- Pas de scroll lock du body cassé.
- Switcher langue clic ferme drawer puis change locale.

### B.3.C · Footer 5 zones

- Identité, Services, Ressources, Entreprise, Légal.
- Bandeau bas : copyright + LocaleSwitcher + lien sitemap.
- Tous liens internes via next-intl, externes avec `rel="noopener noreferrer"` + `target="_blank"` annoncé sr-only.
- 0 lien mort (`linkinator`).

### B.3.D · Breadcrumbs

- Présent sur **toutes** les pages sauf accueil.
- JSON-LD `BreadcrumbList` automatique.
- Liens cliquables sauf dernier (`aria-current="page"`).
- Tronqués mobile (max 3 items + ellipsis si trop long).

### B.3.E · Skip-to-content

- `<a href="#main">` premier focusable, `sr-only focus:not-sr-only`.

### B.3.F · LocaleSwitcher

- Server Component (pas de `'use client'`).
- FR ↔ EN sur toutes les pages, conserve le path traduit.
- Cookie mémorisé 1 an.

### B.3.G · Liens internes

- `linkinator` 0 broken link.
- Tous via `<I18nLink>` (next-intl).
- `prefetch` par défaut (Next.js 16 auto).
- 0 `<a href>` brut sauf externes.

### B.3.H · Speculation Rules + View Transitions

- `<script type="speculationrules">` présent dans `<head>`, eagerness `moderate`.
- Hover sur card listing → prerender déclenché (Network DevTools).
- View Transitions API active : navigation listing → produit fait fade-cross douce. Désactivé en `prefers-reduced-motion`.

### B.3.I · États de navigation

- Page courante highlight dans Header.
- Sous-pages d'un module highlight le module parent.
- Filtre cas concrets actif highlight URL-driven.
- Onglets `<Tabs>` synchronisés avec hash URL.

### B.3.J · Scroll behavior

- Scroll smooth via CSS, désactivé en reduced-motion.
- Anchor links : offset header sticky correctement.
- Hash history préservée au back/forward.
- Pas de jump au mount.

### B.3.K · Keyboard order global

- Skip-to-content → Logo → Header items → CTA → LocaleSwitcher → Main → Footer.
- Aucun `tabindex > 0`.
- Focus visible toujours.

### B.3.L · Pages programmatiques

- `/blog/categorie/[slug]`, `/blog/tag/[slug]`, `/blog/auteur/[slug]` (3 + 3 + 2).
- `/cas-concrets/secteur/[slug]` (3).
- `/faq/[slug]` (5 — commit `f708440`). `/faq/categorie/[slug]` n'existe **pas** sur disque 2026-05-07 (pas dans `routing.pathnames`).
- `/centre-aide/[slug]` (FR) / `/help/[slug]` (EN), `/centre-aide/categorie/[slug]` (FR) / `/help/category/[slug]` (EN) (6 + 6 — commit `f708440`).
- `/temoignages/[slug]` (2).
- `/comparaisons/[slug]` (2).
- Toutes 200, breadcrumbs, hreflang, JSON-LD, OG.

## B.4 — Accessibilité WCAG 2.2 AA (AGT-QUALITY)

- `pnpm a11y:audit` (axe-core + pa11y) sur 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) : 0 violation AA.
- Test keyboard manuel : 15 pages, ordre logique, pas de piège.
- Lecteurs d'écran : NVDA + VoiceOver iOS + Narrator sur Hero, Form audit, FAQ, Calendrier, Simulateur ROI, Drawer mobile.
- Touch targets ≥ 44×44 (linter custom).
- Contraste body ≥ 4.5:1 AA (idéal ≥ 7:1 AAA).
- `prefers-reduced-motion: reduce` désactive **toutes** animations.
- Pas d'`aria-*` sur `<button>` / `<a>` natifs.
- Form errors : `role="alert"` + `aria-live`.
- Lang attribute correct.
- `<main>` unique avec `id="main"`.
- Headings hiérarchie h1→h6 cohérente.
- Images `alt` non vide ou `alt=""` décoratives.
- `<picture>` AVIF/WebP/JPEG fallback OK.

## B.5 — Performance / Core Web Vitals (AGT-QUALITY)

- Lighthouse mobile ≥ 95 sur 30 URLs (perf/SEO/a11y/best-practices).
- Lighthouse desktop ≥ 98 sur 10 pages critiques.
- LCP ≤ 2.5s mobile (≤ 1.8s pages produit), ≤ 1.5s desktop.
- INP ≤ 200ms.
- CLS ≤ 0.1.
- TTFB ≤ 600ms.
- FCP ≤ 1.8s mobile.
- TBT ≤ 200ms.
- Bundle JS first load ≤ 100 KB par page produit, ≤ 80 KB pages texte.
- CSS ≤ 50 KB par page (Tailwind purgé).
- Fonts total ≤ 100 KB woff2, `display: swap`.
- Images : AVIF servi, WebP fallback. Total ≤ 800 KB par page.
- LCP image `fetchPriority="high"` + `priority` Next/Image.
- Below-fold `loading="lazy"` + `decoding="async"`.
- PPR static shell + Suspense boundaries (`next build --profile`).
- React Compiler activé (`experimental.reactCompiler`).
- View Transitions activées (`experimental.viewTransition`).
- Speculation Rules `eagerness="moderate"`.
- RUM web-vitals beacon endpoint reçoit des métriques.

## B.6 — Cross-browser & cross-device matrix (AGT-QUALITY)

- Playwright suite verte sur :
  - Chromium · Firefox · WebKit (desktop)
  - iPhone 14 Pro · iPhone SE · Pixel 7 · Samsung S22 (mobile)
- Viewports : 360 / 479 / 768 / 992 / 1280 / 1440 / 1920.
- Visual regression : diffs < 0.1 % vs baselines.
- iOS Safari 17+ : View Transitions, AVIF, `<dialog>`, CSS `@container`, `font-display: swap` OK.
- Android Chrome : Speculation Rules supportés.
- Test offline / lent (3G slow) : skeletons rendus, pas de page blanche.

## B.7 — Tests Vitest + Playwright (AGT-QUALITY)

- Vitest coverage ≥ 70 % (cible Sprint 14, sera ≥ 80 % Sprint 21) sur `src/components/`, `src/lib/`.
- Playwright ≥ 60 scénarios × 4 navigateurs = 240+ runs.
- Visual regression : 100 % baselines stables (0 diff inattendu).
- a11y axe-core dans Playwright passe sur 30 pages.
- Tests couvrent : nav Header desktop+mobile, LocaleSwitcher, Drawer, Skip, filtres URL-driven, 5 forms golden+errors, calendrier, simulateur ROI, recherche, 404+500.

---

# 🌐 PARTIE C — SEO + AEO + GEO 2026 (chapitre dédié, AGT-SEO-AEO-GEO)

## C.1 — SEO classique 2026

- `pnpm seo:audit` 0 erreur.
- Sitemap multilingue valide W3C : `<xhtml:link rel="alternate" hreflang="fr|en|x-default">` sur **chaque** entry.
- Robots.txt valide, allow par défaut, disallow `/admin*` et `/api/*` sauf `/api/indexnow` et `/api/og`.
- `<link rel="alternate" hreflang>` sur **chaque** page (FR ↔ EN + x-default).
- Pathnames traduits cohérents (FR canon).
- Canonical absolu (jamais relatif).
- Sitemap soumis Google Search Console + Bing Webmaster (placeholder en dev, vrai en prod).
- Semantic HTML : un seul `<h1>` par page, hiérarchie h1→h6 cohérente.
- Internal linking density : ≥ 3 liens contextuels par page produit/blog/cas.
- 30 pages échantillon validées Google Rich Results Test.
- `<title>` 50-60 chars, `<meta description>` 140-160 chars, `<meta robots>` corrects.
- OG images 1200×630 sur 30 pages, Twitter cards `summary_large_image`.
- 0 broken link interne (`linkinator`).
- 0 redirect chain > 1 hop.
- 404 personnalisée per locale.

## C.2 — AEO 2026 (Answer Engine Optimization)

### C.2.A · Artefacts pour LLMs

- `llms.txt` valide (cf. axionia-seo-aeo) — racine site.
- `llms-full.txt` valide (version étendue avec sections enrichies).
- `/api/og` génère dynamiquement OG images (Vercel OG ou équivalent).
- `IndexNow` ping post-build automatique vers Bing/Yandex.
- RSS feeds blog + cas-concrets + FAQ valides W3C.
- JSON Feed alternatif `/blog/feed.json` si requis.

### C.2.B · Structured data exhaustifs

- `Organization` global (logo, sameAs LinkedIn/YouTube, contactPoint, address).
- `WebSite` global avec `SearchAction` potentialAction.
- `BreadcrumbList` automatique sur toutes pages sauf accueil.
- `Service` ou `Product` sur chaque page produit (3 modules × 21 pages).
- `Article` + `Author` (`Person`) sur chaque article blog.
- `FAQPage` + `Question` + `Answer` sur `/faq` et FAQ inline pages produit.
- `Review` + `aggregateRating` sur cas concrets (si ratings).
- `Offer` avec `price`, `priceCurrency`, `priceValidUntil`, `availability` sur pages prix (Essentielle 490€, audits, implémentations).
- `DefinedTermSet` + `DefinedTerm` sur glossaire si présent.
- `WebPage` `speakable` markup sur pages éligibles voice search.
- Validés Schema.org Validator API + Google Rich Results Test.

### C.2.C · Blocs réponse directe (direct-answer)

- En-tête de chaque page produit/blog/cas/FAQ : bloc 40-80 mots structure question-réponse, citable telle quelle par un LLM.
- Format : `<div class="aeo-direct-answer" itemscope itemtype="https://schema.org/Answer">` + Q claire + A factuelle + sources.
- Density : ≥ 1 bloc par page + Q&A pairs supplémentaires en milieu de page.

### C.2.D · Citability test 2026 (manuel ou scripté)

Interroger sur 10 questions cibles :

1. « cabinet IA premium France »
2. « audit IA entreprise PME »
3. « intervention IA opérationnelle journée »
4. « formation IA équipes » (intent uniquement)
5. « implémentation chatbot IA RAG »
6. « cabinet IA Europe UE » (le terme « OÜ estonienne » est purgé du marketing copy 2026-05-07)
7. « ROI projet IA mesurable » (le terme « 90 jours » est purgé du marketing copy 2026-05-07)
8. « simulateur ROI intelligence artificielle »
9. « audit IA dirigeants ETI »
10. « Axion-IA avis cabinet »

Sur **5 moteurs LLM 2026** :

- **Perplexity** (Pro + free)
- **ChatGPT search** (GPT-4o + GPT-5)
- **Claude** (web search via Brave / direct)
- **Google AI Overview** + **AI Mode** (gemini-2)
- **Mistral Le Chat** (Pro)
- _(bonus : Bing Copilot, You.com, Brave Search Summarizer)_

Tableau de citation : URL citée, snippet rendu, position, qualité de la formulation. Si Axion-IA n'apparaît dans aucun → P1 sur le chapitre AEO, sinon documenter le baseline pour comparaison Pass B.

## C.3 — GEO 2026 (Generative Engine Optimization)

### C.3.A · E-E-A-T signals (Experience, Expertise, Authoritativeness, Trust)

- **Author bylines** sur articles blog : `Person` schema avec `jobTitle`, `worksFor`, `sameAs` (LinkedIn pro), `knowsAbout`.
- **Bio expert** sur page À propos avec credentials, années d'expérience, références.
- **Last-modified date** sur tout contenu éditorial (blog, cas, FAQ, help).
- **Sources & citations** sur cas concrets (méthodologie, données chiffrées avec source).
- **Trust signals** : RGPD strict, hébergement UE, DPO joignable, mentions légales complètes (`legal.ts` conserve droit estonien + AKI + TVA EE — obligatoires). Marketing copy purgé de « OÜ estonienne » / « Tallinn » 2026-05-07 (cf. SESSION_LOG).
- **Reviews / témoignages** authentiques avec `Person` photo + role + company réels (pas stock photos).

### C.3.B · Brand mentions & co-citation

- **Brand consistency** : « Axion-IA » écrit identiquement partout (jamais « Axion IA », « Axionia », « Axion-IA » mélangés). Vérifier copy + alt + meta + structured data.
- **Co-citation entities** : pages mentionnent les bons partenaires/écosystème (Hetzner, Cloudflare, OÜ Estonia) qui renforcent l'autorité.
- **Knowledge panel hints** : `Organization.sameAs` pointe vers profils officiels (LinkedIn, GitHub si applicable, Crunchbase, e-Business Register estonien).

### C.3.C · Entity-based optimization

- **Entity disambiguation** : `Organization.identifier` avec registrikood estonien.
- **Topic clustering** : pages reliées par `mainEntity` cohérent (ex: toutes pages module 1 partagent `Service.serviceType="AI Consulting"`).
- **Wikidata / Wikipedia** : pas obligatoire mais présence souhaitée (à différer si pas de notabilité).

### C.3.D · Training-dataset-friendly markup

- Contenu **lisible sans JS** (SSR/SSG strict, pas de hydration-only content).
- Sémantique HTML5 stricte : `<article>`, `<section>`, `<aside>`, `<nav>`, `<header>`, `<footer>`, `<main>`.
- Microdata `itemscope itemtype` cohérent avec JSON-LD (double signal).
- `<meta name="generator" content="Next.js">` propre.
- Pas de paywall ni `noai`/`noimageai` meta (sauf décision business).
- `robots.txt` allow `GPTBot`, `ClaudeBot`, `CCBot`, `PerplexityBot`, `Mistral-User` (à valider avec Will — consentement crawling LLMs).

### C.3.E · Authority signals

- **Pillar pages** identifiées : `/interventions`, `/audit`, `/implementation`, `/cas-concrets`, `/blog`, `/centre-aide`.
- Chaque pillar a ≥ 5-10 sub-pages reliées sémantiquement.
- Internal linking respecte la hiérarchie pillar → sub-pages → cross-links.
- TF-IDF maillage : pages produit ne se cannibalisent pas mutuellement (audit avec `screaming-frog` ou équivalent).

## C.4 — Verdict Partie C

- **SEO** : Lighthouse SEO ≥ 95 sur 30 URLs, 0 broken link, 0 erreur Search Console (placeholder).
- **AEO** : `llms.txt` + `llms-full.txt` + 6+ types JSON-LD validés + blocs direct-answer présents + citability baseline documentée sur 5 LLMs × 10 questions.
- **GEO** : E-E-A-T signals présents sur ≥ 80 % des pages éditoriales, brand consistency 100 %, training-dataset-friendly markup 100 %.

---

# 🔗 PARTIE D — Cohérence transverse (AGT-COHERENCE)

## D.1 — Composants & code DRY

- Aucun composant dupliqué (ex. 2 versions de `<Button>` ou `<Card>`).
- Tous les partagés dans `src/components/ui/` ou `src/components/sections/`.
- Pas de copie de code entre pages identiques.
- `src/lib/` exposé uniquement ce qui est utilisé.
- Imports relatifs longs (`../../../`) → 0, alias `@/` partout.
- Files orphelines (non importées) : audit `dpdm` / `knip` / `ts-prune`.

## D.2 — Copy & i18n harmonisée

- `pnpm i18n:check` 0 erreur (parité FR/EN stricte).
- 0 string hardcodée hors `messages/*.json` (script AST scan).
- Vocabulaire cohérent : « cabinet », « intervention », « accompagnement », « opérationnel ». Banni : « formation »/« formateur »/« former » (sauf intent SEO whitelisted).
- 0 « SIREN »/« SIRET »/« RCS » (anti-siren).
- Axion-IA OÜ mentionnée correctement sur les pages **légales uniquement** (`legal.ts` : droit estonien, AKI, TVA EE — obligatoires). Marketing copy purgé 2026-05-07 ; toute occurrence résiduelle « OÜ estonienne » / « Tallinn » / « Estonie » / « 90 jours » hors `legal.ts` = P1.
- Tonalité homogène (ne pas mélanger ton « startup B2C » et « cabinet B2B »).
- Capitalization : « Axion-IA » écrit identiquement (jamais « Axion IA », « Axionia », « Axion-IA »).
- Espaces insécables FR (`&nbsp;`) avant `:`, `;`, `?`, `!`, `»`, après `«`, autour de `–`.

## D.3 — JSON-LD cohérence transverse

- `Organization` global identique sur toutes pages (logo URL, sameAs, contactPoint).
- `WebSite` global cohérent.
- `BreadcrumbList` items dans le même ordre que la nav.
- Prix dans `Offer` cohérents avec affichage UI (490€ Essentielle, etc.).
- `inLanguage` correctement renseigné sur chaque schéma.
- `@id` URLs cohérentes entre pages (pour graph linking).

## D.4 — Anti-banni grep

- `formation\|formateur\|former\|formé` → 0 hors intent SEO whitelisted.
- `siren\|siret\|rcs\b` → 0.
- `#[0-9a-fA-F]{3,8}\b` hors `globals.css` et tokens → 0.
- `'use client'` sans commentaire `// use-client: <raison>` → 0.
- `stripe\|paddle\|lemon\|payplug\|mollie` → 0.
- `resend\|mailchimp\|sendgrid\|brevo` → 0.
- `vercel\|netlify\|render\.com\|fly\.io` (hors mention historique) → vérifier contexte.

## D.5 — Doctrine **interne cohérence** (référence = HEAD commité)

> ⚠️ Cet audit prend la doctrine commitée à HEAD comme référence implicite. Il ne juge pas la qualité visuelle (décision Will). Il vérifie la **cohérence interne** : aucune page ne doit dévier du pattern majoritaire utilisé par les autres.

- **Tokens utilisés** : extraire de `globals.css` la liste exhaustive des tokens CSS variables (`--color-*`, `--text-*`, `--radius-*`, `--shadow-*`). Croiser avec les usages effectifs dans `src/`.
- **Tokens orphelins** : tokens déclarés mais non utilisés → P3 (ménage).
- **Hex hardcodés** : compter les hex hors `globals.css`. Liste à plat avec localisation. P0 si > 0 (token doit exister + être utilisé).
- **Polices chargées** : lister les fonts via `next/font/google` (Layout) + variables CSS dans `globals.css` (`--font-sans`, `--font-serif`, `--font-mono`). Vérifier qu'il y a parité entre fonts chargées et fonts référencées.
- **Cohérence visuelle inter-page** : extraire le pattern majoritaire (ex : 90 % des pages utilisent `bg-bg` comme canvas) → toute déviation > 10 % minoritaire = finding (P1 si visible, P2 sinon).
- **Variants Button** : compter les variants effectivement utilisés vs déclarés. Variants déclarés non utilisés → P3.
- **`bg-*` utility usage** : table top 20 classes utilitaires. Détecter outliers (1 page utilise une couleur unique non partagée).
- **Eyebrow patterns** : recenser distribution des patterns eyebrow utilisés. Doit être homogène — s'il y en a 2 patterns (ex: `bg-primary/10` v1 + dot indicator v3) coexistant → P1 dette de migration.
- **`titleEm` usage** : si le pattern `titleEm` (serif italique) est utilisé sur certains heroes, vérifier qu'il est utilisé sur **toutes** les pages éditoriales attendues (cf. commits `c9a8a92` + `365d707` qui ont étendu le pattern à 12 pages — vérifier qu'il n'en manque pas).
- **Header pattern** : couleur figée vs scroll-aware — vérifier que le pattern commité (`941a8e1` = couleur figée terracotta) est cohérent sur toutes les routes.

## D.6 — Working copy state

- `git status` : si vide → ✅ working copy clean, audit travaille sur HEAD propre.
- Si non vide → lister les fichiers modifiés non commités, classer par type d'impact (tokens visuels / structure / copy / logique), recommander conservation / branche / discard. **Ne pas exécuter** — Will décide.

## D.7 — Code quality

- TODO/FIXME/HACK/XXX : `grep -rE "TODO|FIXME|HACK|XXX" src/` — chacun avec ticket associé ou supprimé.
- `console.log` résiduels prod : `grep -r "console\." src/` (toléré dans `src/lib/logger.ts`).
- Complexité cyclomatique : `eslint-plugin-sonarjs` ≤ 15 par fonction.
- Imports circulaires : `madge --circular src/`.
- `any` non justifié : 0.
- `@ts-ignore` sans commentaire raison + ticket : 0.
- Dead code : `ts-prune` ou `knip` rapport.

---

# 🚀 PARTIE E — Best practices 2026 (agent principal)

## E.1 — Stack 2026 verrouillée

- `next@16.2.4` (vérifier `package.json`).
- `react@^19.2`.
- `next-intl@^3` (ou `^4` si Sprint 2 a migré).
- `motion@^11`.
- `@auth/core@5` beta (`next-auth@5.0.0-beta.31` ou +).
- TypeScript ≥ `5.6` strict++.
- Tailwind v4 (`@import "tailwindcss"`).
- `pnpm@^9`.

## E.2 — Next.js 16 features 2026

- **Partial Prerendering** activé (`experimental.ppr = 'incremental'`) sur pages produit.
- **React Compiler** activé (`experimental.reactCompiler = true`) — vérifier 0 `useMemo`/`useCallback` manuels résiduels (signal d'antipattern post-React 19).
- **View Transitions API** (`experimental.viewTransition = true`) — actives entre listing et page produit.
- **`useCache` directive** si applicable (Next.js 16 `'use cache'`).
- **Speculation Rules** (`<script type="speculationrules">` eagerness moderate) sur cards listing.
- **`searchParams` + `params` async** (Next 15+ requirement, vérifier sur 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md)).
- **`metadata` API** (pas `<Head>` legacy).
- **Server Actions** stubs présents pour Sprint 17 backend (5 forms).
- **`fetch` Web standard** côté server (pas `axios` côté server).
- **`next/image`** + `priority`/`fetchPriority="high"` sur LCP images.
- **`next/font/google`** pour toutes polices, pas de `<link>` Google Fonts manuel.

## E.3 — React 19.2 patterns 2026

- **Server Components** par défaut (`'use client'` justifié uniquement).
- **`use()` hook** si applicable pour Suspense data.
- **`useActionState`** sur forms multi-step.
- **`useOptimistic`** si applicable (forms instantanés).
- **`<Suspense>` boundaries** sur sections lourdes (calendrier, simulateur ROI, listings).
- **`useFormStatus`** dans buttons submit.
- **Asset Loading** API si applicable.
- **`ref` en prop** (React 19 unifié, plus de `forwardRef` pour les nouveaux composants).

## E.4 — Sécurité 2026 (statique uniquement, sans backend)

- **CSP strict** avec nonce dynamique (`script-src 'nonce-X' 'strict-dynamic'`).
- **Trusted Types** activé (`require-trusted-types-for 'script'`).
- **HSTS 1 an + preload** (`max-age=31536000; includeSubDomains; preload`).
- **X-Frame-Options DENY**.
- **Referrer-Policy** strict-origin-when-cross-origin.
- **Permissions-Policy** : camera/mic/geolocation/payment/usb/midi/sync-xhr none.
- **COOP same-origin**, **CORP same-origin**, **COEP require-corp** si applicable.
- **`gitleaks`** 0 fuite.
- **`pnpm audit`** 0 high/critical.
- **`semgrep`** règles OWASP 0 finding bloquant.
- **`codeql`** (GitHub natif) 0 alerte high.
- **Dependabot/Renovate** config + auto-merge sur patches verts.
- 0 clé API / token / mot de passe en dur.
- `securityheaders.com` (test local via ngrok/local-tunnel) → A+ obligatoire.

## E.5 — Observabilité prête pour backend

- `web-vitals` beacon endpoint reçoit des métriques (`/api/vitals` Edge runtime).
- Sentry stub configuré (DSN env, ready pour activation prod).
- OpenTelemetry instrumenté côté Node (ready pour OTLP export).
- Plausible script tag dans `<head>` via env (vraie intégration Sprint 14 confirmée).
- Logs Pino structuré JSON, trace_id/span_id présents (ready).

## E.6 — CI Gates 2026

- 5 GitHub Actions Gates (A per-commit, B per-PR, C per-merge, D nightly, E per-release).
- 4 anti-grep en pre-commit (formation, siren, hex, use-client).
- `pnpm i18n:check` + `pnpm zod:check` + `pnpm contrast:check` + `pnpm radius:check`.
- Husky 9 + commitlint Conventional Commits + lint-staged.
- OIDC GitHub Actions (pas de secrets long-lived).
- Branch protection rules sur `main`.

---

# 🔍 CHAPITRES TRANSVERSES (agent principal)

### T1. Cohérence SESSION_LOG ↔ git

Chaque sprint déclaré livré a un commit identifiable. Aucun commit orphelin sauf hotfixes documentés.

### T2. Cohérence stack

`package.json` matche `_DECISIONS-FINALES.md`. 0 deps fantômes. 0 deps interdites (`resend`, `mailchimp`, `@stripe/*`, `@vercel/*` non-cli, etc.).

### T3. Gates CI exhaustifs

Tous les scripts custom + workflows GitHub présents et fonctionnels.

### T4. ADR cohérents

- ADR 0001 stack-initial présent dans `axionia/docs/adr/`.
- Tout autre ADR créé en cours de route doit être numéroté séquentiellement, format Michael Nygard.
- ✅ ADR 0002 design-pivot-editorial-v3 **accepté et commité** (HEAD 2026-05-07, direction visuelle figée `941a8e1+` : titleEm serif italique terracotta + Header terracotta). ADR 0004 typography-baseline-upgrade-v3-1 a affiné le baseline à 18/15 px (2026-05-07). **Note** : deux fichiers ADR portent le numéro 0002 dans `docs/adr/` (`0002-design-direction-editorial-premium.md` + `0002-design-pivot-editorial-v3.md`) — duplication à signaler.

### T5. Mapping pages 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md)

Compter routes effectives `app/[locale]/` vs `02b-mapping-pages.md`. Lister manquants/orphelins.

### T6. 16 contradictions Phase 0

Pour chacune : neutralisée / résiduelle / acceptée. Toute résiduelle dans le code → P0.

### T7. Skills `axionia-*`

18 skills attendus, présence et chargement correct dans SESSION_LOG. Détection skills cités mais absents.

### T8. Conventional Commits + Husky

`git log --oneline` tous au format `type(scope): description`. `.husky/` actif.

### T9. Bundle / size

`size-limit` configuré. Pages produit ≤ 100 KB JS first load. `pnpm bundle:analyze` rapport HTML disponible.

### T10. Couverture tests progressive

Sprint 0 Vitest configuré, Sprint 4 ≥ 50 %, Sprint 14 cible 70 %. Vérifier réel via `coverage/coverage-summary.json`.

---

# 📊 SORTIE — `_AUDIT/AUDIT-FRONTEND-V14-2026.md`

Structure imposée :

```markdown
# AUDIT FRONTEND V14-2026 — Axion-IA

- Date : 2026-MM-DD
- Auditeur : Claude Opus 4.7 (1M context)
- Working directory : C:\Users\willi\Documents\Projets\Axion-IA\axionia
- Commit audité : <sha HEAD> (+ working copy résiduelle WIP à mesurer en live)
- Branche : <branch>

## 1. Verdict global Sprint 14 → Sprint 15

- [ ] GO ✅ — Sprint 15 backend peut démarrer
- [ ] GO avec réserves ⚠️ — corrections P1 à planifier en parallèle
- [ ] NO-GO ❌ — corrections obligatoires avant Sprint 15

## 2. Compteurs

- P0 (bloquants) : N
- P1 (majeurs) : N
- P2 (mineurs) : N
- P3 (cosmétiques) : N
- Templates couverts : N / 75
- Routes générées : N FR + N EN
- Findings totaux : N
- Conformité globale : N %

## 3. Findings P0

| ID | Titre | Partie/chap | Fichier:ligne | Reproduction | Impact | Action proposée |
|...|

## 4. Findings P1, P2, P3

[...]

## 5. Tableau DoD croisée Sprints 0-14 (résumé)

| Sprint | Jalon | Commit | DoD attendue | Déclarée | Réelle | Écarts | Verdict |
| ------ | ----- | ------ | ------------ | -------- | ------ | ------ | ------- |

## 6. Tableau couverture par template

| Template | URL FR | URL EN | Metadata | JSON-LD | Breadcrumbs | OG  | A11y | Lighthouse | Verdict |
| -------- | ------ | ------ | -------- | ------- | ----------- | --- | ---- | ---------- | ------- |

[75 lignes]

## 7. Audit navigation (synthèse)

3.A Header desktop · 3.B Header mobile · 3.C Footer · 3.D Breadcrumbs · 3.E Skip · 3.F LocaleSwitcher · 3.G Liens · 3.H Speculation+ViewTransitions · 3.I États · 3.J Scroll · 3.K Keyboard · 3.L Pages programmatiques.

## 8. Métriques chiffrées

| Métrique                  | Cible    | Mesuré | OK  |
| ------------------------- | -------- | ------ | --- |
| Lighthouse mobile médian  | ≥ 95     | ...    |     |
| Lighthouse desktop médian | ≥ 98     | ...    |     |
| LCP mobile p75            | ≤ 2.5s   | ...    |     |
| INP p75                   | ≤ 200ms  | ...    |     |
| CLS p75                   | ≤ 0.1    | ...    |     |
| Bundle JS first load max  | ≤ 100 KB | ...    |     |
| Coverage Vitest           | ≥ 70 %   | ...    |     |
| Playwright runs           | ≥ 240    | ...    |     |
| axe violations            | 0        | ...    |     |
| 0 broken link             | 0        | ...    |     |
| Headers grade (local)     | A+       | ...    |     |

## 9. SEO/AEO/GEO 2026 snapshot

### 9.A SEO Lighthouse

[scores 30 URLs]

### 9.B AEO citability test (5 LLMs × 10 questions)

| Question | Perplexity | ChatGPT | Claude | Google AIO | Mistral |
| -------- | ---------- | ------- | ------ | ---------- | ------- |

[10 lignes]

### 9.C GEO E-E-A-T scorecard

| Signal                  | Présence | Qualité | Action |
| ----------------------- | -------- | ------- | ------ |
| Author bylines          | ✅/❌    | ...     | ...    |
| Last-modified dates     | ...      | ...     | ...    |
| Trust signals OÜ/RGPD   | ...      | ...     | ...    |
| Brand consistency       | ...      | ...     | ...    |
| Entity disambiguation   | ...      | ...     | ...    |
| Training-dataset markup | ...      | ...     | ...    |
| Pillar pages structure  | ...      | ...     | ...    |

## 10. Cohérence transverse

- Composants : N dupliqués trouvés.
- Copy : N strings hardcodées hors i18n.
- JSON-LD : N incohérences inter-pages.
- Doctrine interne : N hex hardcodés, distribution polices, distribution `bg-*`.
- Working copy : 31 fichiers, classification par type d'impact.

## 11. Best practices 2026

- Next 16 features : ☐ PPR ☐ Compiler ☐ ViewTransitions ☐ Speculation Rules ☐ async params.
- React 19.2 patterns : ☐ Server Components ☐ useActionState ☐ Suspense boundaries.
- Sécurité : ☐ CSP nonce ☐ Trusted Types ☐ HSTS ☐ headers A+.

## 12. Recommandations

- **Avant Sprint 15** : [P0 obligatoires]
- **Pendant Sprint 15** : [P1 en parallèle]
- **Phase polish** : [P2-P3]
- **Choix doctrine visuelle** : doctrine figée HEAD 2026-05-07 (commit `941a8e1+`, ADR 0002 Editorial Premium Light v3 + ADR 0004 typography baseline 18/15). Pas d'overhaul UI prévu.
- **Working copy** : doctrine v3 commitée HEAD `941a8e1+` 2026-05-07 (non plus en working copy). Si une working copy résiduelle WIP existe (ex: page presse), décision Will sur commit / branche / discard (non bloquant pour Sprint 15 backend).

## 13. Annexes

- A — DoD croisée Sprints 0-4 (`AUDIT-FRONTEND-V14-A1.md`)
- B — DoD croisée Sprints 5-9 (`AUDIT-FRONTEND-V14-A2.md`)
- C — DoD croisée Sprints 10-14 + polish (`AUDIT-FRONTEND-V14-A3.md`)
- D — Couverture 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) détaillée (`AUDIT-FRONTEND-V14-templates.md`)
- E — SEO/AEO/GEO 2026 détaillé (`AUDIT-FRONTEND-V14-seo-aeo-geo.md`)
- F — Cohérence transverse + working copy state (`AUDIT-FRONTEND-V14-coherence.md`)
- G — Best practices 2026 + métriques chiffrées (`AUDIT-FRONTEND-V14-bp2026.md`)
- Deltas machine-readable : `AUDIT-FRONTEND-V14-deltas.json`

## 14. Validation Will

- ☐ OUI démarre Sprint 15
- ☐ CONTINUE avec réserves listées
- ☐ STOP, on corrige avant
- ☐ STOP, autre raison à préciser (la doctrine visuelle est figée HEAD 2026-05-07)
```

---

# ▶️ DÉMARRAGE

Confirme en 5 lignes que tu as lu ce prompt. Charge les sources de vérité (15 docs + 18 skills `axionia-*`). Lance les **5 agents en parallèle (1 message)** :

- AGT-DOD (DoD croisée 3 tranches)
- AGT-COVERAGE (64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) + nav profonde)
- AGT-QUALITY (a11y + perf + cross-browser + tests)
- AGT-SEO-AEO-GEO (3 chapitres dédiés)
- AGT-COHERENCE (transverse + working copy + doctrine interne)

Pendant ce temps, l'agent principal exécute Partie E (best practices 2026) + chapitres transverses T1-T10.

À la fin, **agrège** tout dans `_AUDIT/AUDIT-FRONTEND-V14-2026.md` + 7 annexes A→G + JSON deltas.

Renvoie à Will (≤ 200 mots) :

- Verdict global GO/NO-GO Sprint 15
- Compteurs P0/P1/P2/P3
- Top 5 findings P0
- Snapshot SEO/AEO/GEO (1 ligne par discipline)
- Recommandation working copy v3
- Question fermée : « OUI démarre Sprint 15 / CONTINUE avec réserves / STOP corrections / STOP doctrine »
