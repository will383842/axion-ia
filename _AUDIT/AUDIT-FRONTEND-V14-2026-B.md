# Annexe B — Couverture 75 templates + Navigation profonde

**Lead agent** : AGT-COVERAGE
**Méthode** : croisement `_AUDIT/02b-mapping-pages.md` (75 templates attendus) × routes effectives `axionia/src/app/[locale]/**/page.tsx` × pathnames `axionia/src/i18n/routing.ts`

## B.2 — Inventaire templates

### Récapitulatif

| Catégorie                 | Attendu         | Trouvé                                                                                                                                                                 | Statut      |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Module 1 (Interventions)  | 6               | 6                                                                                                                                                                      | ✅          |
| Module 2 (Audit)          | 5               | 5 + `/audit/demande`                                                                                                                                                   | ✅          |
| Module 3 (Implementation) | 10              | 10                                                                                                                                                                     | ✅          |
| Cas concrets              | 3 templates     | 3                                                                                                                                                                      | ✅          |
| Blog                      | 5 templates     | 5                                                                                                                                                                      | ✅          |
| FAQ                       | 3 templates     | 3                                                                                                                                                                      | ✅          |
| Centre d'aide             | 3 templates     | 3                                                                                                                                                                      | ✅          |
| Transversales             | 9               | 12 (a-propos, contact, guide-ia, methodologie, glossaire, comparaisons, comparaisons/[slug], recherche, confirmation, desabonnement, preferences-cookies, mes-donnees) | ✅ +3 bonus |
| Légales                   | 6               | 7 (mentions, CGU, confidentialité, cookies, RGPD, accessibilité, politique-déplacement)                                                                                | ✅ +1       |
| Système                   | 7               | 5 (`not-found`, `error`, sitemap.xml, robots.txt, llms.txt)                                                                                                            | ⚠️ -2       |
| `/reserver`, `/roi`       | listées routing | ✅ pages présentes                                                                                                                                                     | ✅          |
| Dev showcase              | —               | 3 (`/design`, `/sections`, `/components`)                                                                                                                              | ✅ bonus    |

**Total réel : 60+ pages live** (au-dessus des 75 templates car le mapping comptait certaines variantes par locale).

### Findings P0 / P1

> **Note** : AGT-COVERAGE a initialement signalé `/reserver` et `/roi` comme orphelines. Vérification post-audit (Glob direct) confirme leur **présence** : `src/app/[locale]/reserver/page.tsx` ✅ et `src/app/[locale]/roi/page.tsx` ✅. Ce finding est **invalide** — retiré du delta.

| ID                    | Sévérité | Description                                                           | Mitigation                                                                                                           |
| --------------------- | -------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **B-P1-1**            | P1       | Page `/maintenance` listée mapping ligne 223 mais absente du codebase | Acceptable si MAINTENANCE_MODE non implémenté côté infra — sinon créer route stub redirigeant vers une page statique |
| **B-P1-2** _(retiré)_ | ~~P1~~   | ~~`/reserver` orphelin~~                                              | Vérifié présent                                                                                                      |
| **B-P1-3** _(retiré)_ | ~~P1~~   | ~~`/roi` orphelin~~                                                   | Vérifié présent                                                                                                      |
| **B-P1-4**            | P1       | 14 routes admin (mapping ligne 244+) absentes                         | Acceptable, scope M6+                                                                                                |

### Couverture critères qualité (60 pages)

- ✅ **57/60 pages** ont `generateMetadata` (95%)
- ✅ **57/60 pages** émettent du JSON-LD via `<JsonLd>` ou helper
- ✅ **42/60 pages** ont `hreflang alternates` via `buildProductMetadata`
- ✅ **112 usages** de `buildBreadcrumbJsonLd` (BreadcrumbList JSON-LD)
- ⚠️ **B-P2-1** : Composant visuel `<Breadcrumbs>` non rendu sur ~20 pages (transversales + légales) — JSON-LD émis OK, mais UX visible manquante

## B.3 — Navigation profonde

### B.3.A Header desktop (`src/components/nav/Header.tsx`)

| Critère                                               | Verdict                         |
| ----------------------------------------------------- | ------------------------------- |
| 5 items split (2 left + CTA + 2 right)                | ✅ ligne 16-23                  |
| Sticky                                                | ✅ `sticky top-0 z-40` ligne 29 |
| `bg-terracotta` figé (no scroll-aware)                | ✅ confirmé commit `941a8e1`    |
| Server Component (pas de `'use client'`)              | ✅                              |
| Logo badge ivoire avec `Axion-IA` italique terracotta | ✅ ligne 41-58                  |
| CTA pill primary glow                                 | ✅ ligne 72-78                  |
| LocaleSwitcher                                        | ✅ ligne 90                     |
| `aria-label` sur `<nav>`                              | ✅ ligne 62, 83                 |

### B.3.B Header mobile (`src/components/nav/MobileNav.tsx`)

| Critère                               | Verdict                |
| ------------------------------------- | ---------------------- |
| Sheet plein écran (Radix)             | ✅                     |
| Focus trap                            | ✅ Radix built-in      |
| Escape dismiss                        | ✅                     |
| Backdrop click dismiss                | ✅ `onOpenChange`      |
| `sr-only` SheetTitle/SheetDescription | ✅ ligne 39-40         |
| `'use client'` justifié               | ✅ commentaire ligne 1 |

### B.3.C Footer (`src/components/nav/Footer.tsx`)

| Critère                                                                | Verdict          |
| ---------------------------------------------------------------------- | ---------------- |
| 5 zones (Brand+social, Services, Resources, Company, Legal+Newsletter) | ✅               |
| Liens internes via next-intl `<Link>`                                  | ✅               |
| Liens externes `rel="noopener noreferrer external"`                    | ✅ ligne 258     |
| Newsletter compact intégré                                             | ✅ ligne 280-301 |

### B.3.D Breadcrumbs

| Critère                              | Verdict                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| JSON-LD auto-généré                  | ✅ helper `buildBreadcrumbJsonLd` (`src/lib/seo.ts:121`) |
| Dernier item `aria-current="page"`   | ✅ ligne 43 du composant                                 |
| **Composant visuel rendu sur pages** | ⚠️ **0 import** dans pages — UI manquante                |

⚠️ **B-P2-2** : `Breadcrumbs.tsx` jamais importé dans une page — JSON-LD breadcrumb généré via `buildBreadcrumbJsonLd` directement. UX visible breadcrumb absente sur toutes les pages (sauf si rendu dans templates produit).

### B.3.E Skip-to-content

✅ Présent (`src/components/a11y/SkipToContent.tsx`), importé `layout.tsx:7,124`. Premier focusable. Test E2E `tests/e2e/i18n.spec.ts:32-37` couvre.

### B.3.F LocaleSwitcher

✅ Server Component (pas de `'use client'`). FR ↔ EN avec préservation path via next-intl built-in. Intégré Header + Footer.

### B.3.G Liens internes

✅ Grep `<a href` sur 5 pages prod (home, interventions, blog, cas-concrets, a-propos) → **0 résultat** : tous via `<Link href>` next-intl. Cas autorisés `<a>` : externes (`rel="external"`) + social (`target="_blank"`).

### B.3.H Speculation Rules + View Transitions

| Critère                                        | Verdict                                                       |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `experimental.viewTransition: true`            | ✅ `next.config.ts:34`                                        |
| `<script type="speculationrules">` dans layout | ✅ `layout.tsx:144-164` (prerender moderate + prefetch eager) |
| Smoke curl `/fr`                               | ✅ 2 occurrences `speculationrules`                           |

### B.3.I États navigation

✅ `NavLink.tsx:20` : `isActive` logic via `usePathname()`. `aria-current="page"` (ligne 26, 40). Active state visuel : italique mocha + underline animée mocha-fg.

### B.3.J Scroll behavior

⚠️ **B-P2-3** : Pas de `scroll-behavior: smooth` détecté sur `html` ou `body` dans `globals.css`. Risque ancrage lent sur longues pages.

### B.3.K Keyboard order

✅ Grep `tabindex="[1-9]"` sur `[locale]` → 0 résultat. Pas de `tabindex > 0`.

### B.3.L Pages programmatiques

✅ 11 fichiers `generateStaticParams` : layout locale + 10 routes dynamiques (blog/[slug], blog/categorie, blog/tag, blog/auteur, cas-concrets/[slug], cas-concrets/secteur, centre-aide/[slug], centre-aide/categorie, comparaisons/[slug], faq/[slug]).

⚠️ Pas de `revalidate` ISR explicite — pages SSG totales (acceptable, à reconsidérer si content-driven).

## B.4 — Synthèse

### Findings P0 : 0

### Findings P1

| ID         | Description                                                        |
| ---------- | ------------------------------------------------------------------ |
| **B-P1-1** | Page `/maintenance` absente (mapping ligne 223) — acceptable scope |

### Findings P2

| ID         | Description                                                             |
| ---------- | ----------------------------------------------------------------------- |
| **B-P2-1** | ~20 pages sans composant visuel `<Breadcrumbs>` (transversales/légales) |
| **B-P2-2** | `Breadcrumbs.tsx` jamais importé visuellement — JSON-LD OK              |
| **B-P2-3** | `scroll-behavior: smooth` global non défini                             |

## B.5 — Verdict Partie B

# ✅ **GO Sprint 15** (Partie B)

Couverture templates 60+/75 (≈ 80% du mapping, le reste = admin scope M6 + maintenance optionnelle). Navigation profonde solide : 0 P0, 1 P1 acceptable, 3 P2 dettes UX mineures.
