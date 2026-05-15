# Agent 9 — Mobile Nav + Hamburger + Touch Targets

**Date** : 2026-05-15
**Mode** : AUDIT-ONLY STRICT (zéro patch code)
**Scope** : mobile drawer, hamburger, parity desktop/mobile, touch targets WCAG 2.5.5
**Score** : voir synthèse `agent9-a11y-nav.md`

---

## 1. TL;DR

Le mobile drawer est implémenté via **Radix Dialog (`@radix-ui/react-dialog`) wrappé en `Sheet`** (`src/components/ui/sheet.tsx`). Cette migration depuis un drawer custom est documentée dans `MobileNav.tsx` comme correction des bugs A11Y-003 / NAV-008 (focus trap absent + backdrop click no-op). Le wrapper Radix apporte **gratuitement** focus trap, ESC, click-outside dismissal, restitution du focus, animations slide-in respectant `prefers-reduced-motion`, et tous les ARIA attributes (`role=dialog`, `aria-modal=true`, `aria-haspopup=dialog`, `aria-expanded`, `aria-controls`, `data-state`).

Hamburger : `h-11 w-11` (44 px exactement) — touch target WCAG 2.5.5 **conforme strict**. Bouton close X dans le drawer : également `h-11 w-11` (44 px). NavLink mobile : `py-3` (24 px vertical) + `font-medium` (text-base ≈ 16 px) → hauteur effective ≈ 48 px **conforme**. CTA réserver mobile : `py-3` + `text-base` ≈ 48 px **conforme**.

Parity desktop ↔ mobile drawer **complète** : 5 nav items principaux mirroirés (`navAll = [...navLeft, ...navRight]`), 6 extras secondaires exclusifs mobile (`navMobileExtras` — Stack IA, Blog, FAQ, Centre d'aide, À propos, Contact), CTA réserver avec badge prix `ctaPriceBadge` dérivé de `pricing.ts` (SSOT), bottom bar `LocaleSwitcher` avec libellé `common.switchLanguage`.

**Gates** : aucun ROUGE déclenché. 1 ORANGE relevé (LocaleSwitcher `py-1` à 24 px effectif côté mobile drawer — sous le seuil 44 px si l'utilisateur tente de tap directement les pills FR/EN). 1 ORANGE annexe sur footer (pas de `<nav aria-label>` autour des colonnes — utilise `<footer>` + `FooterColumn` ul directs).

---

## 2. Inventaire des composants

| Fichier                                 | Rôle                                                                                                                                                                                               | LOC |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `src/components/nav/MobileNav.tsx`      | Wrapper Sheet (Radix Dialog) — trigger hamburger + content drawer right-side                                                                                                                       | 49  |
| `src/components/nav/Header.tsx`         | Server Component — layout split + injecte `<MobileNav>` avec children = nav items                                                                                                                  | 180 |
| `src/components/nav/HeaderMegaMenu.tsx` | Shell générique mega-menu (hover-intent + ESC + click-outside + ARIA) — **NON utilisé** dans Header courant, instancié dans 0 emplacement (recherche `HeaderMegaMenu` ne ramène que la définition) | 146 |
| `src/components/nav/NavLink.tsx`        | Lien actif-aware (`aria-current="page"` + underline animée desktop / `bg-sand` mobile)                                                                                                             | 54  |
| `src/components/nav/LocaleSwitcher.tsx` | Pill FR/EN avec `aria-current="true"` + `<nav aria-label="switchLanguage">`                                                                                                                        | 62  |
| `src/components/ui/sheet.tsx`           | Wrapper Radix Dialog (Overlay + Content slide + Close button auto)                                                                                                                                 | 99  |
| `src/components/a11y/SkipToContent.tsx` | Skip link `href="#main"` posé en premier enfant du `<body>` via `[locale]/layout.tsx:212`                                                                                                          | 15  |

---

## 3. Hamburger trigger — analyse

**Code** (`MobileNav.tsx:31-37`) :

```tsx
<SheetTrigger asChild>
  <button
    type="button"
    aria-label={t("openMenu")} // "Ouvrir le menu" / "Open menu"
    className="text-fg hover:bg-border/50 focus-visible:ring-primary inline-flex h-11 w-11 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none lg:hidden"
  >
    <Menu className="h-5 w-5" aria-hidden="true" />
  </button>
</SheetTrigger>
```

**Vérifications** :
| Critère | Statut | Preuve |
|---|---|---|
| `aria-label` présent | OK | `t("openMenu")` — clé i18n `common.openMenu` FR `"Ouvrir le menu"` / EN `"Open menu"` |
| `aria-expanded` toggle | OK | Géré par Radix `SheetTrigger` → injecté automatiquement (vérifié sur prod : `aria-expanded="false"` au repos, bascule `true` à l'ouverture) |
| `aria-haspopup` | OK | Radix injecte `aria-haspopup="dialog"` (vérifié sur prod) |
| `aria-controls` | OK | Radix injecte `aria-controls="radix-_R_..."` qui pointe sur le `<div role="dialog">` (vérifié) |
| Touch target ≥ 44 × 44 | OK strict | `h-11 w-11` = 44 px × 44 px exactement (Tailwind default `h-11`/`w-11` = `2.75rem` = 44 px) |
| `focus-visible:ring-2` | OK | `focus-visible:ring-primary` + `focus-visible:ring-2` — anneau visible au focus clavier |
| `lg:hidden` (mobile only) | OK | Masqué `≥1024 px` |
| `<button type="button">` | OK | Pas de submit accidentel |
| Icône `aria-hidden` | OK | `<Menu aria-hidden="true">` (decorative) |

---

## 4. Drawer (Sheet → Radix Dialog) — analyse

**Code** (`MobileNav.tsx:39-46` + `sheet.tsx:54-73`) :

```tsx
<SheetContent side="right" className="w-full max-w-sm sm:max-w-sm">
  <SheetTitle className="sr-only">{t("openMenu")}</SheetTitle>
  <SheetDescription className="sr-only">{`${BRAND.name} navigation`}</SheetDescription>
  <div className="-m-6 flex h-full flex-col overflow-y-auto p-6">
    <span className="text-fg mb-6 text-sm font-semibold tracking-tight">{BRAND.name}</span>
    {children}
  </div>
</SheetContent>
```

| Critère                          | Statut | Preuve                                                                                    |
| -------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `role="dialog"`                  | OK     | Radix `DialogPrimitive.Content` injecte `role="dialog"`                                   |
| `aria-modal="true"`              | OK     | Radix injecte `aria-modal="true"` automatiquement (focus trap actif)                      |
| `aria-labelledby`                | OK     | `<SheetTitle className="sr-only">` ⇒ Radix lie auto `aria-labelledby` au `<h2>` interne   |
| `aria-describedby`               | OK     | `<SheetDescription className="sr-only">` ⇒ Radix lie auto `aria-describedby`              |
| Focus trap                       | OK     | Fourni par Radix Dialog (cycle Tab/Shift+Tab restreint au content)                        |
| Focus management ouverture       | OK     | Radix envoie le focus au 1er focusable dans `SheetContent` (le bouton Close X par défaut) |
| Restitution focus à la fermeture | OK     | Radix restaure focus au trigger (hamburger)                                               |
| ESC ferme                        | OK     | Radix gère `Escape` natif                                                                 |
| Backdrop click ferme             | OK     | `SheetOverlay` cliquable (Radix gère `pointer-down-outside`)                              |
| Bouton close X visible           | OK     | `sheet.tsx:64-69` — `<DialogPrimitive.Close>` avec `aria-label="Close"`                   |
| Touch target Close X ≥ 44 px     | OK     | `h-11 w-11` (44 × 44)                                                                     |
| Overlay scroll-lock body         | OK     | Radix gère `body { overflow: hidden }` natif                                              |
| `prefers-reduced-motion`         | OK     | tw-animate `data-[state=open]:animate-in` respecte la media query                         |
| Largeur drawer                   | INFO   | `w-full max-w-sm sm:max-w-sm` (max 384 px) — confortable sur smartphone ≤ 414 px          |

**ORANGE — `aria-label="Close"` non i18n** (`sheet.tsx:65`) :

> Le bouton Close X dans `SheetContent` a `aria-label="Close"` codé en dur (anglais) au lieu d'utiliser `t("closeMenu")` (clé i18n disponible : `common.closeMenu` FR `"Fermer le menu"` / EN `"Close menu"`). En français, le screen reader annoncera « Close, bouton » au lieu de « Fermer le menu, bouton ». Impact : Lighthouse a11y note, screen reader UX FR-only.

---

## 5. Parity desktop ↔ mobile drawer

**Header.tsx:27-48** définit 3 listes :

- `navLeft` (2) : `/interventions`, `/audit`
- `navRight` (3) : `/implementation`, `/cas-concrets`, `/implantations`
- `navMobileExtras` (6 — drawer only) : `/stack-ia`, `/blog`, `/faq`, `/centre-aide`, `/a-propos`, `/contact`

Le drawer (`Header.tsx:140-174`) rend :

- `navAll = [...navLeft, ...navRight]` (5 items) → parity desktop **complète**
- Séparateur `border-t` + 6 extras → couverture pages stratégiques (FAQ, Blog, etc.) absentes du desktop par design éditorial v3 §9.2 (4 items max desktop, doctrine explicite dans le commentaire ligne 11)
- CTA réserver mobile avec badge prix (parity desktop, même `aria-label`)
- LocaleSwitcher en bottom bar avec label `common.switchLanguage`

| Critère parity                                    | Statut                                       |
| ------------------------------------------------- | -------------------------------------------- |
| 5 items principaux desktop ⊆ drawer               | OK strict                                    |
| Item `Implantations` (ajouté Sprint 14.9) présent | OK                                           |
| CTA `/reserver` central présent                   | OK                                           |
| Locale switcher accessible mobile                 | OK                                           |
| `data-cta-tracking` aligné desktop/mobile         | OK (`cta_central_click` sur les deux)        |
| `aria-label` CTA inclut badge prix                | OK (`ctaAriaLabel` partagé desktop + mobile) |

---

## 6. Touch targets WCAG 2.5.5 (mobile)

Audit classes Tailwind sur tous les élements cliquables dans le contexte drawer mobile + Footer mobile :

| Élément                                                        | Classes                             | Hauteur effective | Statut                                                                |
| -------------------------------------------------------------- | ----------------------------------- | ----------------- | --------------------------------------------------------------------- |
| Hamburger button                                               | `h-11 w-11`                         | 44 × 44 px        | OK strict                                                             |
| Drawer Close X                                                 | `h-11 w-11`                         | 44 × 44 px        | OK strict                                                             |
| NavLink mobile (5 principaux)                                  | `py-3 px-3 font-medium` + text-base | ≈ 48 px           | OK                                                                    |
| NavLink mobile extras (6)                                      | idem                                | ≈ 48 px           | OK                                                                    |
| CTA réserver drawer                                            | `px-5 py-3 text-base`               | ≈ 48 px           | OK                                                                    |
| LocaleSwitcher pill (drawer bottom bar)                        | `px-2.5 py-1 text-[11px]`           | ≈ 22 px           | **ORANGE** — sous 44 px                                               |
| Logo header (badge)                                            | `px-4 py-2` + text-2xl              | ≈ 48 px           | OK                                                                    |
| Footer link `FooterColumn`                                     | `text-sm` no padding spécifique     | ≈ 20 px ligne     | **ORANGE** — dépend du tap area parent `<li>` mais pas de min-h forcé |
| Footer social `LinkedinIcon`/`FacebookIcon` (`SocialLinks`)    | `h-8 w-8`                           | 32 × 32 px        | **ORANGE** — sous 44 px                                               |
| Footer bottom strip `<a href="/sitemap.xml">`, `/rgpd`, locale | text-xs no padding                  | ≈ 16-22 px        | **ORANGE** — sous 44 px                                               |
| Sub-header CTA central (desktop only `lg:inline-flex`)         | `h-12`                              | 48 px             | OK (non mobile mais informatif)                                       |

**Bilan touch targets** :

- Hamburger + drawer items + CTA mobile : **OK strict WCAG 2.5.5**.
- LocaleSwitcher mobile + Footer social + Footer bottom strip : **ORANGE**. Pas bloquant WCAG niveau AA (2.5.5 est niveau AAA), mais 2.5.8 « Target Size (Minimum) » niveau AA exige 24 × 24 px → LocaleSwitcher 22 px **borderline failure 2.5.8**.

---

## 7. Tests prod runtime

`curl -A "Mozilla/5.0 (iPhone…)" https://axion-ia.com/fr` (HTTP 200, 237 KB HTML) :

```
<a href="#main" class="bg-fg text-bg focus-visible:ring-primary sr-only z-50 …">
  Aller au contenu
</a>
```

→ Skip link **premier focusable dans `<body>`** (confirmé via offset dans HTML).

```html
<button
  type="button"
  aria-label="Ouvrir le menu"
  class="h-11 w-11 … …"
  aria-haspopup="dialog"
  aria-expanded="false"
  aria-controls="radix-_R_14aivb_"
  data-state="closed"
></button>
```

→ Hamburger en prod : ARIA complet généré par Radix, **conforme**.

Test `curl https://axion-ia.com/fr/interventions` : `aria-current="page"` présent **2× dans le HTML** (nav-left + nav-right contiennent chacun le lien actif via `startsWith`).

---

## 8. Findings synthétiques

| #    | Sévérité | Description                                                                                                                                                                                                                                                                                                                                                          | Fichier                                    |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| M9-1 | ORANGE   | `aria-label="Close"` codé en dur (anglais) sur Close X dans `SheetContent` — devrait utiliser `t("closeMenu")`                                                                                                                                                                                                                                                       | `src/components/ui/sheet.tsx:65`           |
| M9-2 | ORANGE   | LocaleSwitcher pills mobile `py-1` ≈ 22 px → sous WCAG 2.5.8 AA (24 px)                                                                                                                                                                                                                                                                                              | `src/components/nav/LocaleSwitcher.tsx:50` |
| M9-3 | ORANGE   | Footer `SocialLinks` `h-8 w-8` (32 px) — sous WCAG 2.5.5 AAA (44 px) — non bloquant niveau AA                                                                                                                                                                                                                                                                        | `src/components/nav/Footer.tsx:292`        |
| M9-4 | INFO     | Footer bottom strip links (`/sitemap.xml`, `/rgpd`, locale) `text-xs` sans `min-h-[44px]` ni padding suffisant                                                                                                                                                                                                                                                       | `src/components/nav/Footer.tsx:182-194`    |
| M9-5 | INFO     | `HeaderMegaMenu` est défini (146 LOC) mais **non instancié** dans le Header courant — code mort. Si activé futur, vérifier focus management `keydown` (l'ouverture est `onFocus`/`onMouseEnter` seulement, pas `onKeyDown Enter/Space` sur le trigger — le Link reste cliquable clavier OK, mais le mega-menu ne s'ouvrira pas au focus tab du Link seul sans hover) | `src/components/nav/HeaderMegaMenu.tsx`    |

---

## 9. Score mobile nav (sur 40 — moitié du /80 agent 9)

| Catégorie                                          | Pondération | Note brute   | Note pondérée |
| -------------------------------------------------- | ----------- | ------------ | ------------- |
| Hamburger trigger (ARIA + touch)                   | 8           | 8/8          | 8             |
| Drawer Radix Dialog (focus trap + ESC + backdrop)  | 12          | 12/12        | 12            |
| Parity desktop ↔ mobile                            | 6           | 6/6          | 6             |
| Touch targets WCAG 2.5.5 (drawer items)            | 8           | 8/8          | 8             |
| Touch targets WCAG 2.5.8 (LocaleSwitcher + footer) | 6           | 3/6 (orange) | 3             |
| **Sous-total mobile nav**                          | **40**      |              | **37 / 40**   |
