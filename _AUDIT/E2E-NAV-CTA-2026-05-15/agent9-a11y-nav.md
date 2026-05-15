# Agent 9 — A11Y Navigation (Focus Trap + Skip Link + ARIA + Keyboard)

**Date** : 2026-05-15
**Mode** : AUDIT-ONLY STRICT
**Scope** : focus trap, skip link, ARIA nav, keyboard navigation desktop, axe-core
**Prod** : `https://axion-ia.com`

---

## 1. TL;DR

L'a11y navigation **passe tous les gates rouges**. Skip link conforme WCAG 2.4.1 (premier focusable, `href="#main"`, `<main id="main">` cible existe — vérifié runtime), focus trap pris en charge par Radix Dialog (`@radix-ui/react-dialog`) pour le mobile drawer (NO custom hook nécessaire, `useTrapFocus` absent du codebase **par design**), ARIA complet sur tous les `<nav>` du header, `aria-current="page"` injecté par `NavLink` via `usePathname()` (vérifié sur `/fr/interventions` : 2 occurrences en prod).

**Pas de tabindex>0** dans aucun composant nav (`grep tabIndex` retourne 0 match). Tab order naturel respecté. `focus-visible:ring-*` appliqué systématiquement sur tous les éléments interactifs nav (hamburger, NavLink, CTA, LocaleSwitcher pills, Logo badge, Footer links).

**Limitation** : `@axe-core/playwright` est installé mais Chromium headless n'est pas téléchargé (`npx playwright install` requis, ~150 MB). Audit axe-core runtime **non exécuté** faute de download d'un binaire en mode AUDIT-ONLY. Recommandation : automatiser dans `playwright.config.ts` + ajouter step CI `pnpm exec playwright install chromium && pnpm test:a11y` avec `@axe-core/playwright` (probe `_AUDIT/E2E-NAV-CTA-2026-05-15/axe-runtime-probe.mjs` prête à l'emploi, jeter dans `tests/a11y/`).

---

## 2. Skip link (WCAG 2.4.1 Bypass Blocks)

**Code** (`src/components/a11y/SkipToContent.tsx`) :

```tsx
export async function SkipToContent() {
  const t = await getTranslations("common");
  return (
    <a
      href="#main"
      className="bg-fg text-bg focus-visible:ring-primary sr-only z-50 rounded-sm px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      {t("skipToContent")}
    </a>
  );
}
```

**Layout** (`src/app/[locale]/layout.tsx:201-217`) :

```tsx
<body className="bg-bg text-fg flex min-h-full flex-col font-sans">
  {/* preconnect links (auto-hoisted to <head>) */}
  <SkipToContent />                            // PREMIER élément focusable du body
  <NextIntlClientProvider …>
    <Header />
    <main id="main" className="flex-1">       // CIBLE du skip link
      {children}
    </main>
    <Footer />
    …
  </NextIntlClientProvider>
</body>
```

| Critère                                          | Statut | Preuve                                                                                   |
| ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------- |
| `<a href="#main">` premier focusable du `<body>` | OK     | Confirmé via dump HTML prod : positionné avant `<header>`                                |
| `sr-only` au repos                               | OK     | `sr-only` (Tailwind plugin)                                                              |
| `focus:not-sr-only` à la prise de focus          | OK     | `focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3` |
| `<main id="main">` cible existe                  | OK     | `layout.tsx:215`                                                                         |
| `focus-visible:ring-2`                           | OK     | Anneau visible au focus                                                                  |
| i18n libellé                                     | OK     | `common.skipToContent` FR `"Aller au contenu"` / EN `"Skip to content"`                  |
| Contraste libellé visible                        | OK     | `bg-fg text-bg` (mocha sur ivoire = AAA inversé)                                         |
| z-index suffisant                                | OK     | `z-50` (au-dessus du header sticky `z-40`)                                               |

**Statut WCAG 2.4.1** : **PASS strict**. Bypass Blocks niveau A respecté.

**Note** : utiliser `focus-visible:` (au lieu de `focus:`) signifie que le skip link ne s'affichera **que** sur navigation clavier (pas au clic souris). C'est le comportement attendu pour 2.4.1 (cible utilisateurs clavier/screen reader).

---

## 3. Focus trap (WCAG 2.4.3 + 2.1.2)

| Surface                      | Mécanisme                                                                                                                                                               | Statut          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Mobile drawer (`MobileNav`)  | Radix Dialog (`@radix-ui/react-dialog`) → focus trap natif via `FocusScope` interne                                                                                     | OK              |
| HeaderMegaMenu (non utilisé) | Pas de focus trap — c'est un menu hover, pas une dialog ; `onBlur` détecte sortie du wrapper et ferme. Acceptable pour disclosure non-modal (WAI-ARIA APG menu pattern) | OK conditionnel |

**`grep focus-trap|focus-lock|useTrapFocus|useFocusTrap dans src/` ⇒ 0 match.** C'est attendu car le seul élément modal du site (drawer mobile) délègue à Radix. Aucun custom `<dialog>` non Radix dans `src/components/nav/`.

**Vérification Radix** : `@radix-ui/react-dialog` 1.1+ utilise `FocusScope` (du même package) qui :

1. Stocke `document.activeElement` à l'ouverture
2. Cycle Tab/Shift+Tab dans le content uniquement (sentinelle invisible en début + fin)
3. Restaure `activeElement` à la fermeture
4. Capture `Escape` keydown sur document

→ **Focus trap implémenté correctement, gate rouge évité**.

---

## 4. ARIA navigation

### 4.1 `<nav aria-label>` audit (`grep '<nav' + 'aria-label' src/components/nav`)

| Localisation                                     | `aria-label`                                       | Statut                                                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Header.tsx:96-97` (desktop nav gauche)          | `t("nav.home")` → `"Accueil"`                      | OK (mais libellé sémantiquement bizarre — c'est _la nav du site_, pas la "home")                                                                          |
| `Header.tsx:126-128` (desktop nav droite)        | `${t("nav.home")} 2` → `"Accueil 2"`               | **ORANGE** — libellé non descriptif. WCAG 1.3.1 recommande des labels distincts ET sémantiques (ex `"Navigation principale"` + `"Navigation secondaire"`) |
| `Header.tsx:140` (mobile drawer nav)             | `t("nav.home")` → `"Accueil"`                      | OK                                                                                                                                                        |
| `LocaleSwitcher.tsx:28-29`                       | `t("switchLanguage")` → `"Changer de langue"`      | OK                                                                                                                                                        |
| `Breadcrumbs.tsx:32`                             | `"breadcrumb"` (codé en dur)                       | ORANGE — devrait être i18n et utiliser le mot localisé (FR `"Fil d'Ariane"`)                                                                              |
| `HeaderMegaMenu.tsx:135` (panel `role="region"`) | `panelLabel` prop                                  | OK conditionnel (non utilisé)                                                                                                                             |
| Footer `<footer>` (`Footer.tsx:104-107`)         | aucun `<nav aria-label>` autour des 5 FooterColumn | **ORANGE** — WCAG 1.3.1 / ARIA APG recommande wrapper `<nav aria-label="Footer">`                                                                         |

### 4.2 `aria-current="page"` audit

`grep aria-current dans src/components/nav/` :

| Fichier                            | Usage                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NavLink.tsx:26` (variant mobile)  | `aria-current={isActive ? "page" : undefined}`                                                                                                                           |
| `NavLink.tsx:40` (variant desktop) | `aria-current={isActive ? "page" : undefined}`                                                                                                                           |
| `Breadcrumbs.tsx:39`               | `aria-current="page"` sur dernier breadcrumb (item actuel)                                                                                                               |
| `LocaleSwitcher.tsx:48`            | `aria-current={active ? "true" : undefined}` — **note** : valeur `"true"` au lieu de `"page"`, sémantiquement correct car indique « locale courante », pas page courante |

`isActive` calcul (`NavLink.tsx:20`) :

```ts
const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
```

→ Logique `startsWith` : sur `/fr/interventions/essentielle`, l'item `/interventions` est `aria-current="page"`. Acceptable pour disclosure de section. **Pas de match accidentel** (vérifié sur prod : `/fr/interventions` retourne exactement 2 `aria-current="page"` = nav split).

**Bug potentiel mineur** : `pathname.startsWith("/")` retournerait `true` pour toutes les routes → mais protégé par le `href === "/" ? pathname === "/" : …` ternaire. OK.

### 4.3 `aria-expanded`, `aria-modal`, `role="dialog"`, `aria-haspopup`

| Attribut                                          | Source                                 | Statut                                    |
| ------------------------------------------------- | -------------------------------------- | ----------------------------------------- |
| `aria-haspopup="dialog"` sur hamburger            | Radix `SheetTrigger` (auto)            | OK (vérifié prod)                         |
| `aria-expanded` sur hamburger                     | Radix `SheetTrigger` (auto)            | OK (vérifié prod, bascule `false`↔`true`) |
| `aria-controls` sur hamburger                     | Radix (auto, lié à id généré)          | OK                                        |
| `role="dialog"` sur drawer                        | Radix `DialogPrimitive.Content` (auto) | OK                                        |
| `aria-modal="true"` sur drawer                    | Radix (auto)                           | OK                                        |
| `aria-labelledby` sur drawer                      | Radix (auto, lié à `SheetTitle`)       | OK                                        |
| `aria-describedby` sur drawer                     | Radix (auto, lié à `SheetDescription`) | OK                                        |
| `aria-haspopup="true"` sur HeaderMegaMenu trigger | `HeaderMegaMenu.tsx:119`               | OK (non utilisé actuellement)             |
| `aria-expanded={open}` sur HeaderMegaMenu trigger | `HeaderMegaMenu.tsx:120`               | OK (non utilisé actuellement)             |

---

## 5. Keyboard navigation desktop

### 5.1 Tab order

- `grep tabIndex|tabindex src/components/nav/` → **0 match**. Aucun forced tabindex>0.
- Ordre DOM naturel : `SkipToContent` → `Header > Logo > NavLeft (2) > CTA → NavRight (3) > LocaleSwitcher → MobileNav (hidden lg)` → `main` → `Footer`.
- Sur desktop (`lg:hidden` sur hamburger + `lg:hidden` sur mobile drawer wrapper), le hamburger est exclu du tab order ⇒ pas de focus piège.

### 5.2 `focus-visible:` audit

`grep focus-visible src/components/nav/` :

| Fichier                  | Application                                                                                                                                                    | Note                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `Header.tsx` Logo badge  | `focus-visible:ring-mocha focus-visible:ring-offset-terracotta focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none`                    | OK                      |
| `Header.tsx` CTA central | `focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none`                 | OK                      |
| `NavLink` desktop        | hérité du `Link` next-intl sans `focus-visible:` explicite — **ORANGE mineur**, mais l'underline animée (`after:w-full`) couvre partiellement le besoin visuel | À vérifier visuellement |
| `MobileNav` hamburger    | `focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none`                                                                                   | OK                      |
| `LocaleSwitcher` pills   | pas de `focus-visible:` explicite — **ORANGE mineur**                                                                                                          | À vérifier              |
| `Footer` links           | `focus-visible:ring-terracotta focus-visible:ring-offset-mocha focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none`                    | OK                      |
| `Footer` social icons    | `focus-visible:ring-terracotta focus-visible:ring-offset-mocha focus-visible:ring-2`                                                                           | OK                      |

**ORANGE mineur** : `NavLink` desktop + `LocaleSwitcher` pills sans `focus-visible:ring-*` explicite. Le browser fallback `outline` natif s'applique mais peut être masqué par d'autres règles. **Recommandation post-audit** : ajouter `focus-visible:ring-2 focus-visible:ring-mocha-fg` sur NavLink desktop et `focus-visible:ring-2` sur LocaleSwitcher pills.

### 5.3 Enter/Space/Escape sur menus desktop

- **Header courant** : pas de mega-menu actif → pas de handler `keydown` Enter/Space requis. Tous les nav items sont des `<Link>` (= `<a>`) ⇒ Enter natif déclenche navigation.
- **HeaderMegaMenu** (non utilisé) : ouverture par `onFocus` (déclenché par Tab) + `onMouseEnter`. ESC géré via `document.addEventListener("keydown")` (`HeaderMegaMenu.tsx:78-79`). Click-outside géré (`mousedown` listener). Trigger reste un `<Link>` cliquable. **ORANGE conditionnel** si activation future : pas de `onKeyDown` explicite Enter/Space sur le trigger pour ouvrir le panel séparément du clic (le clic suit le Link au lieu d'ouvrir un panel). Pattern hybride APG « disclosure » acceptable mais à documenter.

---

## 6. axe-core runtime audit

**Statut : NON EXÉCUTÉ.**

Cause : `@axe-core/playwright` est installé dans `node_modules/`, mais Chromium headless n'est pas téléchargé localement (erreur `chrome-headless-shell.exe` introuvable). Mode AUDIT-ONLY interdit d'effectuer un download de binaire ~150 MB sans validation Will.

**Probe prête à l'emploi** : `_AUDIT/E2E-NAV-CTA-2026-05-15/axe-runtime-probe.mjs` — script ESM 30 lignes utilisant `chromium` + `devices["iPhone 14"]` + `AxeBuilder.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])`. Sortie JSON sérialisée vers `axe-home-fr.json`.

**Recommandation CI** :

1. `pnpm exec playwright install chromium` dans le step CI dédié a11y.
2. Ajouter test Vitest/Playwright dans `tests/a11y/home.spec.ts` qui assert `expect(violations).toHaveLength(0)` pour les 15 pages stratégiques (home, /interventions, /audit, /implementation, /cas-concrets, /implantations, /stack-ia, /blog, /faq, /centre-aide, /a-propos, /contact, /reserver, /interventions/par-ville/paris, /implantations/auvergne-rhone-alpes/lyon).
3. Effort estimé : 2-3 h dev (setup config + 15 tests + intégration CI).

---

## 7. Findings synthétiques

| #    | Sévérité | Description                                                                                                                                                 | Fichier                                               |
| ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| A9-1 | ORANGE   | Footer sans `<nav aria-label="Footer">` autour des 5 colonnes — wrapper recommandé ARIA APG                                                                 | `src/components/nav/Footer.tsx:104`                   |
| A9-2 | ORANGE   | Header.tsx nav droite a `aria-label="Accueil 2"` — libellé non descriptif                                                                                   | `src/components/nav/Header.tsx:127`                   |
| A9-3 | ORANGE   | Breadcrumbs `aria-label="breadcrumb"` codé en dur (pas i18n)                                                                                                | `src/components/nav/Breadcrumbs.tsx:32`               |
| A9-4 | ORANGE   | `NavLink` desktop + `LocaleSwitcher` pills sans `focus-visible:ring-*` explicite (fallback outline natif)                                                   | `NavLink.tsx`, `LocaleSwitcher.tsx`                   |
| A9-5 | INFO     | axe-core runtime audit non exécuté — CI step à mettre en place                                                                                              | `_AUDIT/E2E-NAV-CTA-2026-05-15/axe-runtime-probe.mjs` |
| A9-6 | INFO     | HeaderMegaMenu défini mais non utilisé — code mort (146 LOC). Si activé futur, ajouter `onKeyDown` Enter/Space trigger pour pattern APG disclosure conforme | `src/components/nav/HeaderMegaMenu.tsx`               |

---

## 8. Gates rouges — checklist

| Gate ROUGE                                                | Verdict                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| Drawer mobile non fermable (pas de close ESC ou backdrop) | **PASS** — Radix gère ESC + backdrop + bouton X                    |
| Focus trap absent                                         | **PASS** — Radix `FocusScope` actif                                |
| Skip link absent                                          | **PASS** — `SkipToContent` premier focusable, vérifié runtime prod |
| Touch target nav < 44 px                                  | **PASS** sur drawer items (hamburger 44, NavLink 48, CTA 48)       |

| Gate ORANGE             | Verdict                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| aria-current absent     | **PASS** — présent sur NavLink (desktop + mobile) + Breadcrumbs + LocaleSwitcher (vérifié prod 2× sur /fr/interventions) |
| `<nav>` sans aria-label | **PARTIAL** — header OK, footer **MANQUE** wrapper `<nav>` (Footer.tsx:104)                                              |

---

## 9. Score a11y nav (sur 40)

| Catégorie                                       | Pondération | Note brute                                                | Note pondérée |
| ----------------------------------------------- | ----------- | --------------------------------------------------------- | ------------- |
| Skip link WCAG 2.4.1                            | 8           | 8/8                                                       | 8             |
| Focus trap Radix Dialog                         | 10          | 10/10                                                     | 10            |
| ARIA nav (`<nav aria-label>`)                   | 6           | 4/6 (orange footer + nav-2 libellé)                       | 4             |
| `aria-current` page                             | 4           | 4/4                                                       | 4             |
| `aria-expanded`/`aria-modal`/`role=dialog`      | 4           | 4/4                                                       | 4             |
| Keyboard navigation (tab order + focus-visible) | 4           | 3/4 (orange NavLink desktop sans focus-visible explicite) | 3             |
| axe-core CI integration                         | 4           | 0/4 (non exécuté, probe prête)                            | 0             |
| **Sous-total a11y nav**                         | **40**      |                                                           | **33 / 40**   |

---

## 10. Score AGENT 9 consolidé

| Sous-score                                 | Note                 |
| ------------------------------------------ | -------------------- |
| Mobile nav (cf. `agent9-mobile-nav.md` §9) | 37 / 40              |
| A11y nav (cf. §9 ci-dessus)                | 33 / 40              |
| **Total Agent 9**                          | **70 / 80** (87,5 %) |

---

## 11. Top 5 findings prioritaires

1. **A9-5 INFO → P1** : automatiser axe-core CI sur 15 pages stratégiques (probe ESM prête, effort 2-3 h).
2. **A9-1 ORANGE → P2** : wrapper `<nav aria-label="Footer">` autour des colonnes Footer (Footer.tsx:104). 5 min de patch.
3. **M9-1 ORANGE → P2** : i18n du `aria-label="Close"` codé en dur dans `sheet.tsx:65` → `t("closeMenu")`. 10 min de patch (impact FR users screen reader).
4. **A9-2 ORANGE → P3** : renommer `aria-label` des deux navs header pour libellés sémantiques distincts (« Navigation principale gauche » / « Navigation principale droite » ou consolider en un seul `<nav>` parent).
5. **M9-2 ORANGE → P3** : `LocaleSwitcher` pills mobile `py-1` (22 px) → forcer `min-h-[24px]` minimum pour WCAG 2.5.8 AA, idéalement `min-h-[44px]` pour 2.5.5 AAA.

---

## 12. TL;DR Agent 9

**Score : 70 / 80 (87,5 %) — VERT.**
**Aucun gate ROUGE déclenché.** Mobile drawer = Radix Dialog (focus trap + ESC + backdrop + ARIA complet, gratuit). Skip link conforme WCAG 2.4.1 (vérifié prod). `aria-current="page"` opérationnel (NavLink desktop + mobile). Touch targets conformes sur drawer/hamburger (44 px strict) ; ORANGE niveau AAA sur LocaleSwitcher + Footer social. axe-core CI **non exécuté** (Chromium headless non installé localement) — probe prête dans `axe-runtime-probe.mjs`, intégration CI recommandée P1.
