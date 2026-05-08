# 🔬 PROMPT FRONTEND DEEP-CHECK — AxionIA · Audit avant kickoff backend

> 📌 **Lire d'abord [`_AUDIT/SYNC-NOTICE-2026-05-07.md`](./SYNC-NOTICE-2026-05-07.md)** — HEAD `fd91518` (post-Sprint 14.5-14.9). Le chiffre canonique est désormais 64 routes templates et le module Audit est refactoré (`/audit/{flash, process, strategique-pme, strategique-eti, demande}`).
>
> Version 2.0 · 2026-05-06 (soir) — aligné doctrine **Editorial Premium Light v3** (cf. ADR 0002).
> À lancer **entre Sprint 14 et Sprint 15** (porte de sortie frontend / porte d'entrée backend).
> Distinct de `PROMPT-VERIFICATION-FINALE.md` qui couvre fullstack — celui-ci est **laser-focalisé frontend + navigation**.
>
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (sous-repo Next.js 16).
> Sortie : `_AUDIT/VERIF-FRONTEND-DEEP.md` + 8 annexes spécialisées.
>
> ⚠️ **Pivot doctrinal v1 → v3** acté le 2026-05-06 : ADR 0001 Webflow-inspired **superseded** par ADR 0002 Editorial Premium Light. Source de vérité visuelle = `axionia/Design.md` v3 + `axionia/docs/adr/0002-design-pivot-editorial-v3.md`. Toute mention « Webflow Blue », « palette Webflow », « Manrope-only » dans les .docx archivés ou skills hors-scope = **obsolète**.

---

## RÔLE

Tu es **lead frontend reviewer** indépendant, double casquette UX + ingénieur. Tu n'as pas codé ce projet. Tu reçois un site supposé fini côté frontend (Sprint 14 livré). Ta mission : **traquer toute imperfection visible ou comportementale**, démontrer que la navigation est **parfaite**, que tous les croisements sont cohérents, et donner un GO/NO-GO sec pour le démarrage backend.

**Posture** : pixel-perfect, comportement-perfect, pas de complaisance. Le moindre flash, le moindre layout shift, le moindre lien orphelin = finding.

---

## SKILLS À CHARGER OBLIGATOIREMENT (dans cet ordre)

1. `axionia-core` — règles non négociables.
2. `axionia-architecture` — arborescence canon.
3. `axionia-design` — doctrine **v3 Editorial Premium Light** (canon visuel — ⚠️ si le SKILL.md référence encore Webflow Blue/Manrope-only, considérer ADR 0002 + `axionia/Design.md` v3 prioritaires).
4. `axionia-mobile-first` — mobile-first absolu.
5. `axionia-anti-spa` — Server Components par défaut, anti `'use client'`.
6. `axionia-i18n` — FR/EN strict, hreflang, pathnames traduits.
7. `axionia-a11y` — WCAG 2.2 AA.
8. `axionia-seo-aeo` — JSON-LD, sitemap, llms.txt, blocs réponse directe.
9. `axionia-performance` — budgets perf, CWV.
10. `axionia-testing` — Vitest + Playwright + a11y axe + visual regression.
11. **`frontend-design`** (Anthropic) — review qualité design, anti AI-slop. ⚠️ LOCK-03 actif : filtrer toute suggestion contraire à `axionia-design`.
12. **`ui-ux-pro-max`** — 50 styles, 99 UX guidelines, palettes, font pairings, charts. ⚠️ LOCK-02 actif : filtrer toute suggestion contraire à `axionia-design`.
13. `verification-before-completion` — méthodologie checklist exhaustive.
14. `web-design-guidelines` (Vercel Labs) — référence supplémentaire (LOCKée).

---

## SOURCES DE VÉRITÉ

- `_AUDIT/02b-mapping-pages.md` — **64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) uniques** (référence completeness).
- `_AUDIT/02-PLAN.md` — DoD jalons.
- `Navigation-Complete-AxionIA.md` — sitemap exhaustif + user flows + états spéciaux.
- `Wireframes-Briefs-AxionIA/00-08*.md` — 9 wireframes-briefs (référence visuelle de chaque page).
- **`axionia/Design.md` v3** — doctrine **Editorial Premium Light** (canon visuel actif depuis 2026-05-06).
- **`axionia/docs/adr/0002-design-pivot-editorial-v3.md`** — décision pivot v3 (supersedes 0001).
- `axionia/docs/adr/0001-design-direction-webflow.md` — superseded, conservé pour traçabilité historique des sprints 0-14 livrés sous v1.
- `AxionIA_Dossier_FINAL_ABSOLU_v10.1/Design.md` — **OBSOLÈTE** (Webflow v1, archivé).
- `axionia-package/docs/_DECISIONS-FINALES.md` — décisions stack.
- Skills `axionia-*` (18) — règles attendues dans le code.

---

## DISPATCH MULTI-AGENTS (1 message, 6 Agent calls en parallèle)

| Agent            | Subagent        | Focus exclusif                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AGT-NAV**      | Explore         | Navigation parfaite : Header, Footer, Drawer mobile, Breadcrumbs, LocaleSwitcher, prefetch, transitions, états actifs, scroll behavior, keyboard order, links morts                                                                                                                                                                                                                                                                               |
| **AGT-COVERAGE** | Explore         | 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) vs build : routes générées, manquants, orphelines, hreflang, JSON-LD, OG image                                                                                                                                                                                                                                                                                                           |
| **AGT-DESIGN**   | Explore         | Conformité **doctrine v3 Editorial** : palette ivoire/sand/mocha/terracotta/sage `#5e6c54`, primary `#1a4dd9`, accent terracotta `#c24a1b`, **pas de noir pur** (`#000`/`#080808` = finding), serif Fraunces sur titres + signature `em.editorial`, halos `bg-halo-warm`/`bg-halo-cool`, radius xs→2xl (xl/2xl autorisés sur hero), shadows ton chaud `rgba(42,37,32,…)`, animation `translate-x-[6px]`, breakpoints 479/768/992/1280, max-w 1280 |
| **AGT-A11Y**     | general-purpose | WCAG 2.2 AA : axe-core sur 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md), keyboard nav, screen readers, contrastes, touch targets, prefers-reduced-motion                                                                                                                                                                                                                                                                              |
| **AGT-PERF**     | general-purpose | Bundle, CWV, fonts, images AVIF/WebP, PPR, View Transitions, Speculation Rules, RUM beacon                                                                                                                                                                                                                                                                                                                                                        |
| **AGT-I18N-SEO** | Explore         | Parité FR/EN, hreflang, pathnames traduits, JSON-LD validés, sitemap, robots, llms.txt, RSS, AEO citability test                                                                                                                                                                                                                                                                                                                                  |

L'agent principal pendant ce temps : chapitres 1, 2, 7, 11 ci-dessous.

---

## CHAPITRES DEEP-CHECK (24 chapitres frontend uniquement)

### 1. Smoke run end-to-end

- `pnpm install` propre depuis `package-lock.json` ou `pnpm-lock.yaml`.
- `pnpm typecheck` 0 erreur.
- `pnpm lint` 0 erreur.
- `pnpm build` succès complet sans warning.
- `pnpm start` lance l'app — `localhost:3000` répond 200.
- `/fr` HTTP 200, `/en` HTTP 200, `/` redirige vers `/fr` (ou langue navigateur).
- Aucun warning console au chargement (DevTools).
- Aucun warning Next.js (`next dev` propre).

### 2. Inventaire & completeness — 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md)

> Délégué à **AGT-COVERAGE**.

- Pour **chaque** template du `02b-mapping-pages.md` :
  - URL FR + EN existe (HTTP 200 build local).
  - Composant respecte le wireframe-brief associé.
  - `generateMetadata` présent (title + description + canonical + alternates hreflang FR/EN/x-default).
  - JSON-LD présent et valide (Schema.org Validator API).
  - `<Breadcrumbs>` (sauf accueil).
  - OG image dynamique 1200×630 fonctionne (`/api/og?...`).
  - Aucun `'use client'` non justifié.
- **Routes orphelines** (build mais pas dans mapping) → soit ajouter au mapping soit supprimer.
- **Routes manquantes** → P0 absolu.
- Script `scripts/check-route-coverage.ts` fait foi.

### 3. NAVIGATION — audit profond (chapitre central)

> Délégué à **AGT-NAV** (priorité absolue de cet audit).

#### 3.A · Header desktop (≥ lg / 992px)

- 5 items : Logo · Interventions · Audit · Implémentation · Cas concrets · CTA central « Réserver une intervention · 490 € » · LocaleSwitcher FR·EN.
- Aucun dropdown.
- État actif : underline ou indicator 2px sous l'item correspondant à `pathname`.
- Sticky : header colle au scroll, fond opaque dès `scrollY > 8`, transition 250ms.
- Logo cliquable → retour accueil.
- CTA primaire `translate-x-[6px]` au hover (test Playwright transform CSS).
- Tab order : Logo → 4 liens → CTA → LocaleSwitcher.
- Tous les liens via next-intl, prefetch par défaut.
- Aucun `'use client'` sur Header lui-même (sauf composant scroll/mobile justifié).

#### 3.B · Header mobile (< lg)

- Hamburger 44×44 minimum.
- `<Sheet>` plein écran : 4 liens stacked + CTA + LocaleSwitcher + mentions OÜ + téléphone + email.
- `aria-modal="true"`, focus trapped, `Escape` ferme, hamburger devient X.
- Backdrop click ferme.
- Animation slide-in 250ms (désactivée `prefers-reduced-motion`).
- Pas de scroll lock du body cassé (test scroll dans drawer + scroll body bloqué).
- Switcher langue clic ferme drawer puis change locale.

#### 3.C · Footer 5 zones

- Identité (logo + baseline + adresse OÜ + langues).
- Services (3 modules + cas concrets).
- Ressources (Blog, Guide, FAQ, Help, llms.txt, sitemap).
- Entreprise (À propos, Contact, Calendrier, Newsletter).
- Légal (6 pages légales).
- Bandeau bas : copyright + LocaleSwitcher + lien sitemap.
- Tous liens internes via next-intl, externes avec `rel="noopener noreferrer"` + `target="_blank"` annoncé sr-only.
- Aucun lien mort (cf. AGT-COVERAGE).

#### 3.D · Breadcrumbs

- Présent sur **toutes** les pages sauf accueil.
- JSON-LD `BreadcrumbList` automatique.
- Liens cliquables sauf dernier (`aria-current="page"`).
- Visuellement séparés par `/` ou `›` (cohérence sur toutes pages).
- Tronqués mobile (max 3 items + ellipsis si trop long).

#### 3.E · Skip-to-content

- `<a href="#main">Aller au contenu</a>` premier focusable, `sr-only focus:not-sr-only`.
- Test Tab depuis URL bar → 1ʳᵉ touche Tab focus skip-link → Enter saute au `<main>`.

#### 3.F · LocaleSwitcher

- Server Component (pas de `'use client'`).
- FR ↔ EN sur toutes les pages.
- Conserve le path (`/fr/interventions/essentielle` ↔ `/en/services/essential`).
- Test E2E : depuis 5 pages random, switcher + retour, pas de flash, pas de redirect en cascade.
- Cookie mémorisé 1 an.

#### 3.G · Liens internes

- `linkinator` 0 broken link.
- Tous les liens internes via `<I18nLink>` (next-intl).
- `prefetch` par défaut (Next.js 16 auto).
- Aucun lien `<a href>` brut sauf externes.
- `rel="external noopener"` sur externes.

#### 3.H · Speculation Rules + View Transitions

- `<script type="speculationrules">` présent dans `<head>`, eagerness `moderate`.
- Test Network DevTools : hover sur card listing → prerender déclenché.
- View Transitions API active : navigation listing → produit fait fade-cross douce. Désactivé en `prefers-reduced-motion`.

#### 3.I · États de navigation

- Page courante highlight dans Header.
- Sous-pages d'un module highlight le module parent.
- Catégories blog actives highlight.
- Filtre cas concrets actif highlight.
- Onglets `<Tabs>` synchronisés avec hash URL (`#section`).

#### 3.J · Scroll behavior

- Scroll smooth via CSS (`scroll-behavior: smooth`) désactivé en reduced-motion.
- Anchor links (`#section`) : offset header sticky correctement.
- Hash history préservée au back/forward.
- Pas de jump au mount.

#### 3.K · Keyboard order global

- Skip-to-content → Logo → Header items → CTA → LocaleSwitcher → Main content → Footer.
- Aucun `tabindex > 0` (anti-pattern).
- `tabindex="-1"` uniquement sur éléments programmatiquement focusables.
- Focus visible toujours (jamais `outline: none` sans replacement).

#### 3.L · Pages programmatiques

- `/blog/categorie/[slug]` : test 3 catégories.
- `/blog/tag/[slug]` : test 3 tags.
- `/blog/auteur/[slug]` : test 2 auteurs.
- `/cas-concrets/secteur/[slug]` : test 3 secteurs.
- `/faq/[slug]` : test 5 questions (commit `f708440` — pages dédiées indexables, RSS découvrable). `/faq/categorie/[slug]` n'existe **pas** sur disque 2026-05-07 (pas dans `routing.pathnames`) — listée en backlog.
- `/centre-aide/[slug]` (FR) / `/help/[slug]` (EN) + `/centre-aide/categorie/[slug]` (FR) / `/help/category/[slug]` (EN) : test 6 articles + 6 catégories (commit `f708440`).
- `/temoignages/[slug]` : test 2 témoignages.
- `/comparaisons/[slug]` : test 2.
- Toutes répondent 200, ont breadcrumbs, hreflang, JSON-LD.

### 4. Doctrine v3 Editorial Premium Light (ADR 0002, supersedes 0001)

> Délégué à **AGT-DESIGN**. Source de vérité : `axionia/Design.md` v3 + `globals.css`.

#### 4.A · Palette canon

- **Editorial Blue `#1a4dd9`** (token `--color-primary`) est l'**unique** couleur de CTA primaire (button bg, link underline, focus ring sur fond clair). Grep + visuel sur 30 pages.
- **Terracotta brique `#c24a1b`** (token `--color-terracotta`) est l'**unique** accent éditorial : italiques signature `em.editorial`, dot indicator hero, divider footer, hover éditorial. Jamais sur CTA primaire.
- **Mocha `#2a2520`** (token `--color-mocha`) sur sections premium (Footer, CTA dark) — **PAS de noir pur**. Tout `#000000`/`#0a0a0a`/`#080808` détecté = **P0**.
- **Surfaces ivoire chaud** `#faf8f3` (`--color-bg`) en canvas par défaut. **Blanc pur `#ffffff`** réservé à `--color-paper` (cards, sections de contraste). Tout `bg-white` natif = **P1** (utiliser `bg-paper` ou `bg-bg`).
- **Sand** `#f0e9da` / `#e6dcc4` pour sections d'alternance.
- **Sage `#5e6c54`** sur Module Cas concrets (assombri 2026-05-06 pour WCAG AA 5.0:1 sur paper, remplace `#00d722` v1).
- Module-color mapping conservé : Module 1 = primary blue, Module 2 = orange `#ff6b00`, Module 3 = purple `#7a3dff`, Cas concrets = sage. Aucune section ne combine 3+ couleurs.

#### 4.B · Typographie

- **3 familles** : Manrope (`--font-sans`, body/UI), **Fraunces** (`--font-serif`, h1 home + hero éditorial + signature `em.editorial`), Inconsolata (`--font-mono`, prix tnum/code).
- Aucune autre police chargée. Tout Inter / Geist / Newsreader / Helvetica / Source Serif / etc. dans le bundle = **P0**.
- Type scale v3.1 (ADR 0004 baseline upgrade 2026-05-07) : `--text-display: 7rem` (112px lh 0.96), `--text-section: 4rem`, `--text-sub: 2.25rem`, `--text-lead: 1.4375rem` (23px), `--text-body: 1.125rem` (18px) lh 1.7, `--text-base: 1.125rem` (18px override Tailwind), `--text-sm: 0.9375rem` (15px override Tailwind), `--text-label-up: 0.8125rem` tracking **0.16em** (était 0.10em en v1).
- Eyebrow signature : pas de fond coloré, **dot indicator** 6×6px en couleur module devant le texte. Tout eyebrow avec `bg-primary/10` style v1 = **P2** (à migrer).
- Signature `em.editorial` rendue serif italique terracotta — vérifier au moins 1 occurrence par page produit/home/cas concrets.

#### 4.C · Radius & shadows

- Échelle radius v3 : `xs:2 / sm:4 / md:8 / lg:12 / xl:20 / 2xl:28 / full:9999`.
- `border-radius > 12px` autorisé **uniquement** sur hero blocks et cards éditoriales premium (xl/2xl). Linter `pnpm radius:check` passe.
- Shadows ton chaud `rgba(42,37,32,…)` cascade 5 couches. Tout shadow ton-froid `rgba(0,0,0,…)` détecté hors `globals.css` legacy compat = **P1**.
- Bonus `--shadow-inset-soft` pour cards éditoriales sur sand.

#### 4.D · Halos & animation

- `bg-halo-warm` (radial-gradient terracotta + bleu très doux) sur Hero `home`/`module` par défaut.
- `bg-halo-cool` (sand + blue + sage subtil) sur sections d'alternance.
- Jamais 2 halos collés sans section neutre entre.
- Animation signature `translate-x-[6px]` au hover sur **tous** les CTA primaires (test Playwright transform CSS).
- `prefers-reduced-motion: reduce` désactive **toutes** animations + transitions globalement.

#### 4.E · Selection & focus

- `::selection` rendue terracotta+mocha-fg (signature éditoriale, rupture v1 où selection était primary).
- `:focus-visible` outline 2px primary sur fonds clairs, **terracotta sur fonds mocha**.

#### 4.F · Anti-patterns interdits

- Tout `#000`/`#0a0a0a`/`#080808` en dur = **P0**.
- Tout `bg-white` (`#fff`) en bg de section principale (utiliser `bg-bg` `#faf8f3` ou `bg-paper`) = **P1**.
- Toute police hors Manrope/Fraunces/Inconsolata dans le bundle = **P0**.
- Toute eyebrow avec fond coloré v1 = **P2**.
- Tout shadow ton-froid hardcodé `rgba(0,0,0,…)` hors `globals.css` = **P1**.
- Tout token `--color-*`, `--space-*`, `--radius-*`, `--shadow-*` utilisé via valeur littérale plutôt que via Tailwind utility = **P2**.

#### 4.G · Breakpoints (conservés depuis v1)

- `xs:479 / md:768 / lg:992 / xl:1280`.
- `<Container>` max-w 1280 sur tous les containers.
- 3 sections consécutives de la même surface (`bg-bg`, `bg-paper`, `bg-sand`) → **P3** (rythme à corriger).

### 5. Anti-banni (grep)

- `formation\|formateur\|former\|formé` → 0 résultat hors intent SEO whitelisted (`axionia-core` autorise mot-clé SEO `formation IA` en intent uniquement).
- `siren\|siret\|rcs\b` → 0.
- `#[0-9a-fA-F]{3,8}\b` hors `globals.css` et tokens → 0.
- `'use client'` sans commentaire `// use-client: <raison>` → 0.
- `stripe\|paddle\|lemon\|payplug\|mollie` → 0.
- `resend\|mailchimp\|sendgrid\|brevo` → 0.
- `vercel\|netlify\|render\.com\|fly\.io` (hors mention historique) → vérifier contexte.

### 6. i18n & SEO/AEO

> Délégué à **AGT-I18N-SEO**.

- `pnpm i18n:check` 0 erreur (parité FR/EN).
- Aucune string hardcodée hors `messages/*.json` (script AST scan).
- Hreflang sur **chaque** page : FR ↔ EN + x-default.
- Pathnames traduits cohérents.
- Sitemap multilingue valide W3C.
- robots.txt valide.
- llms.txt + llms-full.txt valides.
- IndexNow ping post-build automatique.
- 30 pages échantillon validées Google Rich Results Test.
- OG images 1200×630 sur 30 pages.
- Twitter cards `summary_large_image`.
- Blocs réponse directe AEO (40-80 mots) sur pages produit.
- RSS feeds blog + cas + FAQ valides.
- Semantic HTML : un seul `<h1>`, hiérarchie h1→h6 cohérente.
- **AEO citability test** : interroger Perplexity, ChatGPT, Claude, Google AIO sur 10 questions cibles → tableau de citation.

### 7. Performance / CWV

> Délégué à **AGT-PERF**.

- Lighthouse mobile ≥ 95 sur 30 URLs (perf/SEO/a11y/best-practices).
- Lighthouse desktop ≥ 98 sur 10 URLs critiques.
- LCP ≤ 2.5s mobile (≤ 1.8s pages produit), ≤ 1.5s desktop.
- INP ≤ 200ms.
- CLS ≤ 0.1.
- TTFB ≤ 600ms.
- FCP ≤ 1.8s mobile.
- TBT ≤ 200ms.
- Bundle JS first load ≤ 100 KB par page produit.
- CSS ≤ 50 KB.
- Fonts total ≤ 100 KB woff2.
- Images : AVIF servi, WebP fallback. Total ≤ 800 KB.
- LCP image `fetchPriority="high"`.
- Below-fold `loading="lazy"` + `decoding="async"`.
- PPR static shell + Suspense boundaries (`next build --profile`).
- React Compiler activé.
- View Transitions activées.
- Speculation Rules `eagerness="moderate"`.
- RUM web-vitals beacon reçoit des métriques.

### 8. Accessibilité WCAG 2.2 AA

> Délégué à **AGT-A11Y**.

- `pnpm a11y:audit` (axe-core + pa11y) sur 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) : 0 violation AA.
- Test keyboard manuel : 15 pages, ordre logique, pas de piège, skip-link OK.
- Lecteurs d'écran : NVDA + VoiceOver iOS + Narrator sur Hero, Form audit, FAQ, Calendrier, Simulateur ROI, Drawer mobile.
- Touch targets ≥ 44×44 (linter custom).
- Contraste body ≥ 4.5:1 AA (idéal ≥ 7:1 AAA).
- `prefers-reduced-motion: reduce` désactive **toutes** animations.
- Pas d'`aria-*` sur `<button>` / `<a>` natifs.
- Form errors : `role="alert"` + `aria-live`.
- Lang attribute correct.
- `<main>` unique avec `id="main"`.
- Headings hiérarchie respectée.
- Images `alt` non vide ou `alt=""` décoratives.
- `<picture>` AVIF/WebP/JPEG fallback OK.

### 9. Anti-SPA & Server Components

- Tous les Server Components par défaut.
- `'use client'` justifié par commentaire `// use-client: <raison>` au-dessus.
- Aucun fetch dans `useEffect` côté client.
- `generateMetadata` sur **chaque** page.
- Layout `[locale]` Server Component avec hreflang + JSON-LD globaux.
- Pas de `dynamic({ ssr: false })` non justifié.

### 10. Cross-browser & cross-device matrix

- Playwright suite verte sur :
  - Chromium · Firefox · WebKit (desktop)
  - iPhone 14 Pro · iPhone SE · Pixel 7 · Samsung S22
- Viewports : 360 / 479 / 768 / 992 / 1280 / 1440 / 1920.
- Visual regression : diffs < 0.1 % vs baselines.
- iOS Safari 17+ : View Transitions, AVIF, `<dialog>`, CSS `@container`, `font-display: swap` OK.
- Android Chrome : Speculation Rules supportés.
- Test offline / lent (3G slow Network throttling) : skeletons rendus, pas de page blanche.

### 11. Tests Vitest + Playwright + visual regression

- Vitest coverage ≥ 80 % sur `src/components/`, `src/lib/`.
- Playwright ≥ 60 scénarios × 4 navigateurs = 240+ runs.
- Visual regression : 100 % baselines stables (0 diff inattendu).
- a11y axe-core dans Playwright passe sur 30 pages.
- Tests couvrent :
  - Navigation Header desktop + mobile.
  - LocaleSwitcher.
  - Drawer mobile (open/close keyboard + click).
  - Skip-to-content.
  - Filtres cas concrets / blog catégorie / FAQ.
  - 5 forms golden path + erreurs validation.
  - Calendrier (sélection date + créneau).
  - Simulateur ROI (slider + calcul).
  - Recherche globale (query + résultats).
  - 404 + 500.

### 12. Forms (stub backend, frontend complet)

- 5 forms multi-step : audit 5 étapes, implémentation 4 étapes, contact, newsletter, réservation.
- React Hook Form + Zod schemas dans `src/lib/schemas/forms.ts`.
- `useActionState` Next.js 15+ pour bouton submit.
- Persistance Zustand entre étapes (volatile).
- Cloudflare Turnstile sur tous les forms publics.
- Indicateur d'étape (`aria-current="step"`).
- Erreurs `role="alert"` + `aria-live`.
- Bouton « Précédent » garde l'état.
- `beforeunload` warn sur dirty.
- Confirmation page `/confirmation/[type]` rend récap.
- Honeypot anti-bot.

### 13. Calendrier & Simulateur ROI

- `<HouseCalendar>` : navigation mois prev/next, sélection date → liste créneaux → confirmation.
- A11y : flèches clavier, aria-label dates, live region annonces.
- Simulateur ROI : sliders avec aria-valuetext, résultats live region, CTA pré-rempli.
- Intégrés sur `/interventions`, `/audit`, `/implementation` + pages dédiées `/reserver` et `/roi`.

### 14. Composants atomiques & composites

- `<Button>` variants : `primary` (Editorial Blue `#1a4dd9`), `secondary` (paper + border + sand hover), `ghost` (transparent + sand hover), `dark` (mocha + mocha-fg + terracotta-soft border hover), `outline`, `link`, `destructive`. Tailles sm/md/lg/xl. `asChild` OK. Loading spinner OK.
- `<Input>` / `<Textarea>` / `<Select>` / `<Checkbox>` / `<RadioGroup>` / `<Switch>` / `<Slider>`.
- `<Card>` border 1px `--color-border`, radius 4-8px, `--shadow-card` 5-couches au hover.
- `<Badge>` blue-tinted bg 10 % opacity, radius 4px, weight 550, uppercase 12.8px.
- `<Alert>` variants neutral/accent/success/warning/danger.
- `<Tabs>`, `<Accordion>`, `<Tooltip>`, `<Dialog>` natif `<dialog>`, `<Sheet>`, `<Popover>`.
- `<Eyebrow>` uppercase auto.
- `<Price>`, `<Cta>`, `<Stat>`, `<TestimonialCard>`, `<CaseStudyCard>`, `<ArticleCard>`, `<FaqAccordion>`.
- `<Hero>` variants accueil/module/produit/transverse.
- `<FeatureGrid>`, `<ProcessSteps>`, `<TestimonialsCarousel>`, `<CaseStudiesShowcase>`, `<FaqBlock>`, `<CtaBlock>`, `<MetricsRow>`, `<TimelineBlock>`, `<TeamGrid>`, `<TrustBar>`.
- Page `/_components` (dev only) rend tout, 0 axe violation.

### 15. Routes système

- 404 `/_not-found` par locale avec liens utiles.
- 500 `/error` Client Component minimal.
- `/maintenance` page statique env-flag.
- `/desabonnement?token=...` landing One-Click Unsub.
- `/preferences-cookies`.
- `/mes-donnees` (RGPD).
- robots.txt, sitemap.xml, llms.txt, llms-full.txt valides.

### 16. Anti-doublons composants

- Aucun composant dupliqué (ex. 2 versions de `<Button>` ou `<Card>`).
- Tous les composants partagés dans `src/components/ui/` ou `src/components/sections/`.
- Pas de copie de code entre pages identiques (DRY).

### 17. ESLint + TS strict++

- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` actifs.
- Aucun `any` non justifié.
- Aucun `@ts-ignore` sans commentaire raison + ticket.
- 0 warning ESLint.

### 18. Bundle analyzer

- `pnpm bundle:analyze` rapport HTML.
- Pas de chunk > 200 KB.
- Pas de duplication de lib (multiple versions).
- Lazy-loaded chunks pour pages lourdes (admin, simulateur, calendrier).

### 19. Documentation frontend

- README.md à jour avec commands.
- ADR 0001 design respecté.
- Storybook ❌ non requis (cf. décision), mais page `/_design`, `/_components`, `/_sections` (dev only) live.
- Comments dans le code uniquement où le « pourquoi » est non évident.

### 20. Régression vs Sprint précédents

- SESSION_LOG.md cohérent.
- CHANGELOG.md à jour.
- Comparer Lighthouse historique : 0 régression > 5 points.
- Comparer bundle : pas d'augmentation > 10 % sans justif.
- Comparer baselines visual regression : 0 diff inattendu.

### 21. Conformité skills (échantillonnage)

> Délégué à **AGT-DESIGN** + **AGT-NAV** (cohérence multi-skills).

- Pour chaque skill `axionia-*` impacté frontend (12) :
  - Échantillonner 5 fichiers de code qui devraient le respecter.
  - Vérifier que les règles du SKILL.md sont effectivement appliquées.
  - Lister écarts → P1.

### 22. Production-ready frontend (sans backend)

- `pnpm build` réussit en mode prod.
- `pnpm start` mode prod : aucune erreur, perf identique à dev mesurée.
- Headers `next.config.ts` produit CSP + HSTS + X-Frame + Referrer + Permissions + COOP + CORP.
- Test securityheaders.com (build local exposé temporairement via ngrok ou local-tunnel pour scan) → A+.
- 0 erreur Sentry sur 1h d'utilisation manuelle test.
- 0 erreur console sur 75 pages parcourues.

### 23. UX walkthrough manuel par Will (obligatoire)

- Will parcourt 15 pages au clavier uniquement (Tab/Shift+Tab/Enter/Escape).
- Will parcourt 10 pages en mobile DevTools 360px.
- Will parcourt 10 pages avec NVDA ou VoiceOver actif.
- Will switch FR ↔ EN sur 5 pages.
- Will soumet 1 form de chaque type (5 forms) en mode happy-path + 1 erreur validation.
- Will utilise calendrier + simulateur ROI.
- Will valide visuellement la doctrine **v3 Editorial** : palette ivoire/sand/mocha/terracotta/primary, signature serif italique terracotta, halos chauds/froids, animations subtiles, modules accentués.
- **Validation positionnement** : Will confirme que la doctrine v3 porte bien le positionnement « cabinet IA premium B2B » (le pivot ADR 0002 visait précisément à résoudre la tension surveillée par ADR 0001 § Conséquences).
- Will note tout ce qui cloche → finding au rapport.

### 24. Verdict GO/NO-GO backend

**Critères de GO** (tous doivent être verts) :

- 0 finding P0.
- ≤ 5 findings P1 documentés avec ticket.
- 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) livrés.
- Lighthouse mobile médian ≥ 95.
- 0 violation axe.
- 0 broken link.
- Doctrine **v3 Editorial Premium Light** respectée à 100 % (zéro noir pur, zéro police hors Manrope/Fraunces/Inconsolata, primary `#1a4dd9` + accent terracotta `#c24a1b` consistants).
- Will valide UX walkthrough.

**Si UN seul critère rouge** : NO-GO, on corrige avant Sprint 15.

---

## RAPPORT FINAL — `_AUDIT/VERIF-FRONTEND-DEEP.md`

```markdown
# Rapport Frontend Deep-Check — AxionIA

- Date : 2026-XX-XX
- Auditeur : Claude Opus 4.7 + 6 agents parallèles
- Sprint audité : Sprint 14 livré, candidat porte d'entrée backend
- Commit : <sha>
- Branche : <branch>

## 1. Verdict GO/NO-GO backend

- [ ] GO ✅ — Sprint 15 backend peut démarrer
- [ ] GO avec réserves ⚠️ — corrections P1 à planifier en parallèle backend
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

| ID | Titre | Chapitre | Fichier:ligne | Reproduction | Action |
|...|

## 4. Findings P1, P2, P3

...

## 5. Tableau de couverture par template

| Template       | URL FR | URL EN | Metadata | JSON-LD | Breadcrumbs | OG  | A11y | Lighthouse | Verdict |
| -------------- | ------ | ------ | -------- | ------- | ----------- | --- | ---- | ---------- | ------- |
| /interventions | ...    | ...    | ✅       | ✅      | ✅          | ✅  | 0    | 98/100     | OK      |

| ...75 lignes...

## 6. Audit navigation détaillé (chapitre central)

- 3.A Header desktop : ...
- 3.B Header mobile : ...
- 3.C Footer : ...
- 3.D Breadcrumbs : ...
- 3.E Skip-to-content : ...
- 3.F LocaleSwitcher : ...
- 3.G Liens internes : ...
- 3.H Speculation Rules + View Transitions : ...
- 3.I États navigation : ...
- 3.J Scroll behavior : ...
- 3.K Keyboard order global : ...
- 3.L Pages programmatiques : ...

## 7. Métriques chiffrées

| Métrique | Cible | Mesuré | OK |
|...|

## 8. AEO citability snapshot

| Question | Perplexity | ChatGPT | Claude | Google AIO |
|...|

## 9. Annexes

- A — Liste exhaustive 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) (`VERIF-FRONTEND-A-templates.md`)
- B — Audit navigation détaillé (`VERIF-FRONTEND-B-navigation.md`)
- C — Audit doctrine v3 Editorial Premium Light (`VERIF-FRONTEND-C-doctrine.md`)
- D — Audit a11y (`VERIF-FRONTEND-D-a11y.md`)
- E — Audit performance (`VERIF-FRONTEND-E-perf.md`)
- F — Audit i18n + SEO + AEO (`VERIF-FRONTEND-F-i18n-seo.md`)
- G — Tableau visual regression diffs (`VERIF-FRONTEND-G-visual.md`)
- H — Cross-browser matrix (`VERIF-FRONTEND-H-cross-browser.md`)

## 10. Recommandations

- Avant Sprint 15 :
- Pendant Sprint 15+ (corrections en parallèle) :
- Phase 2 (post-launch) :

## 11. Validation Will

- ☐ OUI démarre Sprint 15
- ☐ CONTINUE avec réserves listées
- ☐ STOP, on corrige avant
```

---

## DÉMARRAGE

Confirme en 5 lignes. Charge les 14 skills. Lance les 6 agents en parallèle (1 message). Pendant ce temps, exécute chapitres 1, 2, 17, 18, 22 toi-même. À la fin, agrège tout dans `_AUDIT/VERIF-FRONTEND-DEEP.md` + 8 annexes. Renvoie à Will : **verdict GO/NO-GO** + Top 5 findings P0 + question fermée « OUI démarre Sprint 15 / CONTINUE avec réserves / STOP corrections ».
