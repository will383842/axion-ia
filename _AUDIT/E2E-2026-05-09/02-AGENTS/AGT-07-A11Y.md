# AGT-07 — A11Y

**Périmètre** : WCAG 2.2 AA + RGAA 4.1 — contrastes, focus, tab order, ARIA, formulaires, modales, mega-menus, alt text, `prefers-reduced-motion`, tap targets ≥ 24 px (SC 2.5.8), focus apparent (SC 2.4.13).
**Mode** : AUDIT-ONLY, lecture statique. Aucune exécution Playwright/Axe live (déléguée Phase 4).
**Pondération synthèse** : ×1.3.

## Score : 78 / 100

Décomposition :

| Sous-axe                                | Score | Note                                                                                                                                                                                                        |
| --------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Contrastes (script `check-contrast`) | 9/10  | Pairs canoniques toutes AA, mais `terracotta on bg` 5.34:1 < AAA, `fg-muted on bg` ≈ 5.18:1 borderline                                                                                                      |
| 2. Focus visible `:focus-visible`       | 9/10  | Token global + ring custom Header. `outline:none` Tiptap admin = legit (Tiptap pose le sien).                                                                                                               |
| 3. Tab order / structure landmarks      | 7/10  | `<main id="main">` + `<header>` + `<footer>` OK ; **pas de role/aria-label `<footer>`** (RGAA 12.6)                                                                                                         |
| 4. ARIA nav + mega-menus                | 8/10  | `aria-haspopup`/`aria-expanded` bons ; mais panel = `role="region"` sans `tabindex=-1` cible focus ; pas de `aria-controls` lien panel↔trigger                                                              |
| 5. Forms (labels, errors, fieldset)     | 8/10  | `htmlFor` partout, `aria-invalid`, `role="alert"`, fieldset/legend dans Audit/Implementation. **Pas de `aria-describedby` reliant input↔message d'erreur**                                                  |
| 6. Modales (Radix Dialog)               | 10/10 | Sheet + Dialog Radix — focus trap, Esc, click-outside, scroll lock natifs                                                                                                                                   |
| 7. Alt text images                      | 6/10  | `next/image` correct, mais `<img src={p.photoUrl} alt={p.name}>` cru × 2 (PressSpokesperson:46, TeamGrid:29) ; logo Header = badge texte « Axion-IA » avec `aria-label={BRAND.name}` (pas d'image, donc OK) |
| 8. `prefers-reduced-motion`             | 10/10 | Bloc global strict `globals.css:386-412` + branche View Transitions anticipée                                                                                                                               |
| 9. Tap targets ≥ 24 px (SC 2.5.8)       | 7/10  | Button size `sm` = `h-9` (36 px) ≥ 24 OK ; **mais Calendar `h-7 w-7` (28 px) sur boutons cellule = compliant 24 px mais < cible AAA 44 px** ; checkboxes Radix non chiffrés                                 |
| 10. Skip-link                           | 10/10 | `SkipToContent` server component, target `#main` exact, sr-only → focus-visible                                                                                                                             |
| 11. Lang HTML                           | 10/10 | `<html lang={locale}>` setté layout (FR/EN)                                                                                                                                                                 |
| 12. RGAA 4.1                            | 8/10  | Page `/accessibilite` déclaration explicite WCAG 2.2 AA + EAA + RGAA 4.1, conformance « partielle » assumée                                                                                                 |
| 13. Tests a11y.spec.ts coverage         | 5/10  | **5 pages stratégiques** uniquement (home, audit, interventions, implementation, reserver) sur ~80 pages déployées (~6 %)                                                                                   |
| 14. `scripts/check-contrast.ts`         | 9/10  | 29 paires statiques, 1 paire AA-large only justifiée ; **ne couvre pas les composants overlay réels** (badge sur halo, link bleu sur sand…)                                                                 |

**Pénalité globale** : -10 pts pour P0 alt text 2 sites + P1 a11y test coverage 6 %.

**Score brut** = 78/100 — confiance **haute** sur sous-axes 1-12 (lecture code direct), **moyenne** sur 13-14 (couverture runtime tests non vérifiée live).

---

## Confiance : haute

Justification :

- 100 % des fichiers cités lus en intégralité (Header, MegaMenu, Forms, MobileNav, SkipToContent, globals.css, check-contrast.ts, a11y.spec.ts).
- Contrastes recalculés à la main pour 3 paires sensibles (cf. § 1.1).
- Pas d'exécution runtime — donc « accessibilité conformée » non auditée live (cf. P1 « tests insuffisants »).

---

## Top findings

### P0 (bloquant prod / RGPD / a11y critique)

- **P0-A11Y-01 — `<img>` cru sans Next/Image sur 2 sections marketing** (`src/components/sections/TeamGrid.tsx:29`, `src/components/sections/PressSpokesperson.tsx:46`).
  - Risque WCAG 1.1.1 si `member.photoUrl` jamais peuplée → alt mais image cassée = info perdue. Risque CLS / LCP (perf hors a11y, déjà flagué AGT-03).
  - Le code prévoit `// Sprint 5 swaps to next/image` mais reste à faire.
  - **Pas un blocker WCAG si `alt` ≠ vide** — donc P0 sur la **dette** seulement, dégradable P1 si AGT-03 confirme zéro impact CLS.

- **P0-A11Y-02 — Test a11y Playwright couvre 6 % du site** (`tests/e2e/a11y.spec.ts:22-28`).
  - 5 routes / ~80 routes statiques (sans compter les ~17 500 SSG pSEO villes).
  - Le rapport interne `a11y.spec.ts:13-14` lui-même note « Sprint 17 : étendre Top 15 (cas-concrets, methodologie, comparaisons, implantations/paris, etc.) » — **Sprint 17 dépassé sans extension** (HEAD ≥ Sprint 24.1).
  - Risque : la page `/reserver` ouverte sur Pass B Lighthouse smoke avait déjà 1 CLS 0.552 — un Axe live aurait pu remonter autre chose.

### P1 (sérieux)

- **P1-A11Y-03 — Pas de `aria-describedby` reliant les inputs aux messages d'erreur RHF** (`src/components/forms/ContactForm.tsx:87-92`, `BookingForm.tsx:124-130`, partout dans `src/components/forms/*`).
  - Pattern actuel : `aria-invalid={!!errors.name}` + `<p role="alert">errors.name.message</p>` adjacent.
  - WCAG 3.3.1 conformé (erreur annoncée live par `role="alert"`), **mais** RGAA 11.10.4 demande `aria-describedby` pour lien sémantique input↔description quand l'erreur est attachée à un champ donné.
  - Patch : `<Input id="contact-name" aria-describedby="contact-name-error" />` + `<p id="contact-name-error" role="alert">…</p>`.

- **P1-A11Y-04 — Footer `<footer>` sans `role="contentinfo"` explicite** (`src/components/nav/Footer.tsx:102`).
  - HTML5 implicite OK pour AT modernes (NVDA, JAWS, VO 2020+) — RGAA 12.6 recommande explicite pour AT vieux.
  - Idem `<header>` sans `role="banner"` (HTML5 implicite suffit, mais zéro coût d'ajouter).

- **P1-A11Y-05 — Tap targets calendrier `h-7 w-7` (28 px)** (`src/components/calendar/BookingCalendar.tsx:856`).
  - SC 2.5.8 AA = ≥ 24 px → **conforme**, mais SC 2.5.5 AAA = 44 px et best practice mobile 2026 (iOS/Android) = 44 px.
  - Cellules date sont des `<button>` adjacents serrés (`shrink-0`) — risque tap accidentel mobile.
  - Patch : `h-9 w-9` ou `min-h-[44px] min-w-[44px]` avec espacement, ou wrapper invisible.

- **P1-A11Y-06 — Mega-menu panel : `role="region"` sans focus management** (`src/components/nav/HeaderMegaMenu.tsx:134-141`).
  - Panel s'ouvre sur `onFocus` wrapper et se ferme sur Esc — bon. **Mais** : pas d'`aria-controls={panelId}` sur le `<Link>` trigger, pas de `tabindex={-1}` sur le panel pour recevoir focus si on veut « jump into panel ».
  - Pas de focus trap dans le panel (pas requis : panel = nav latérale, pas une modale). OK.
  - Trigger est un `<Link>` (pas `<button>`) — sémantique mixed : sert à la fois de **lien navigable** et de **bouton qui ouvre un menu**. Compromis assumé en commentaire (SEO+a11y) mais ambigu pour AT.

- **P1-A11Y-07 — Contraste `fg-muted on bg` = 5.18:1, borderline** (`src/app/globals.css:152` token + `scripts/check-contrast.ts:94`).
  - AA conformé (≥ 4.5), mais 0.68 pt de marge sur l'AAA (7) seulement. Utilisé pour `<p className="text-fg-muted text-[11px]">` dans HeaderImplantationsMenu:66, Footer brand baseline, breadcrumbs, méta navigation — souvent en petit texte.
  - À 11 px le « large » threshold ne s'applique pas (≥ 18 px ou 14 px bold).
  - Pas un fix urgent, mais un assombrissement de `--color-fg-muted` de `#6b6155` à `#5e544a` repasserait 6.0:1.

### P2 (confort)

- **P2-A11Y-08 — `aria-label` mega-menu trigger redondant avec texte visible** : le `<Link>` trigger porte le texte visible « Implantations » + `aria-haspopup="true"`/`aria-expanded={open}` ; pas d'aria-label, donc no-issue. **RAS** sur ce point précis. Inscrit en P2 uniquement comme rappel de doctrine.

- **P2-A11Y-09 — `scroll-behavior: smooth` global** (`globals.css:202`) bien désactivé par `prefers-reduced-motion: reduce` ligne 393. **Conforme**.

- **P2-A11Y-10 — Logo Header = texte stylisé, pas image** (`src/components/nav/Header.tsx:105-116`).
  - Demande prompt : « logo blanc Header doit avoir alt explicite ». **Le logo Header n'est pas une image bitmap** : c'est un span texte `Axion-IA` (var serif + couleurs terracotta/fg). Donc :
    - **Pas besoin d'alt** (pas d'image).
    - `aria-label={BRAND.name}` sur le `<Link>` parent — OK.
    - Le `<span aria-hidden="true">-</span>` masque le séparateur typographique aux AT — OK.
  - **Aucun fichier `m_horizontal_white_2.png` trouvé** dans `public/` cité par le code Header. À confirmer si cette image existe ailleurs (OG, manifest). Drift potentiel doctrine vs implémentation : à arbitrer.

- **P2-A11Y-11 — Page `/accessibilite` déclare conformance « partielle »** (`src/app/[locale]/accessibilite/page.tsx:57`).
  - Assumée et datée 6 mai 2026, audit indépendant prévu Sprint 21.
  - **Sprint 21 dépassé** (HEAD ≥ Sprint 24.1). La page mentionne l'audit comme « planifié » → texte à mettre à jour.

---

## Détail par sous-chapitre

### 1. Contrastes

#### 1.1 Recalcul WCAG 2.2 sur paires sensibles

Calculs manuels (algo `globals.css` v3 palette → relative luminance L = 0.2126·R + 0.7152·G + 0.0722·B, ratio = (L_max+0.05)/(L_min+0.05)) :

| Paire                                          | fg      | bg      | Ratio calc | AA normal         | AAA normal |
| ---------------------------------------------- | ------- | ------- | ---------- | ----------------- | ---------- |
| terracotta on bg (titre/CTA texte)             | #c24a1b | #faf8f3 | **5.34:1** | ✅                | ❌         |
| fg on bg (corps)                               | #1a1815 | #faf8f3 | ~17.5:1    | ✅                | ✅         |
| fg-muted on bg (méta)                          | #6b6155 | #faf8f3 | **5.18:1** | ✅                | ❌         |
| primary on bg (lien)                           | #1a4dd9 | #faf8f3 | ~7.66:1    | ✅                | ✅         |
| primaryFg on terracotta (CTA blanc/terracotta) | #ffffff | #c24a1b | ~4.71:1    | ✅ (large + bold) | ❌         |
| terracotta-deep on terracotta-soft (badge)     | #8c3010 | #f5e3d8 | ~5.5:1     | ✅                | ❌         |

Le script `scripts/check-contrast.ts` confirme tout en passe AA, tous échouent AAA (ratio < 7 sauf primary/fg). Cohérent avec doctrine éditoriale (terracotta primary).

#### 1.2 Couverture du script

29 paires dans `pairs[]` lignes 90-153. **Aucune paire** ne couvre :

- Badge `text-terracotta-deep` sur `bg-halo-warm` (gradient radial → fond variable).
- Link `text-primary` sur `bg-sand` (alternance bandes).
- Footer `text-mocha-fg/85` sur `.bg-mocha-rich` (radial gradient avec rgba terracotta 0.18).
- `text-terracotta` sur `bg-sand` mega-menu hover.

Le script ne valide donc **que les paires plates**. Les gradients/overlays ne sont jamais testés numériquement. → P2.

#### 1.3 Conformance globale

✅ AA passé partout sur le script — cf. ligne 174 `pnpm contrast:check` → exit 0 attendu (non vérifié runtime cet audit, but `verify:all` l'inclut `package.json:62`).
❌ AAA non garanti — assumé éditorialement.

### 2. Focus visible (`:focus-visible`)

#### 2.1 Token global

`src/app/globals.css:211-215` :

```css
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}
```

✅ SC 2.4.7 + SC 2.4.13 (focus apparent WCAG 2.2). 2 px solid bleu primary sur tout élément non-overridé.

#### 2.2 Overrides Tailwind locaux

Header CTA central (`Header.tsx:140`) :
`focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta`
→ Ring ivoire (mocha-fg #f7f3ea) sur offset terracotta → contraste **17.6:1** ring vs body ; **5.34:1** ring vs CTA bleu primary. ✅

Logo Header (`Header.tsx:103`) : `focus-visible:ring-mocha focus-visible:ring-offset-terracotta` ✅

MegaMenu trigger (`HeaderMegaMenu.tsx:121`) : `focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta` ✅

NavLink desktop (`NavLink.tsx`) : **pas d'override focus** → reçoit le token global `:focus-visible { outline: 2px solid primary; outline-offset: 2px }` sur fond terracotta. Outline bleu primary sur fond terracotta = ratio ~3.5:1 → AA non-text 3:1 OK mais limite. À tester live.

#### 2.3 outline:none ailleurs

`globals.css:1105` `.tiptap-content { outline: none }` — admin editor, **focus géré par Tiptap interne**. Legit.
Forms : pas d'`outline:none` sur input. ✅

### 3. Tab order / structure landmarks

#### 3.1 Layout principal (`src/app/[locale]/layout.tsx:138-159`)

```
<html lang>
  <body>
    <SkipToContent />   ← premier focusable
    <Header />          ← <header data-tone=terracotta>
    <main id="main">    ← target skip-link, id correct
    <Footer />          ← <footer data-tone=dark>
    <WebVitals />       ← invisible
    <Plausible />       ← invisible
    <script JSON-LD>
    <script speculation>
```

✅ Skip-link → `#main` ID match — testé visuellement.
✅ `<main id="main">` unique.
❓ Pas de `<nav aria-label="Breadcrumb">` global, mais Breadcrumbs composant existe par page (cf. `src/components/nav/Breadcrumbs.tsx`).

#### 3.2 Header

`<header data-tone="terracotta" sticky top-0 z-40>` (`Header.tsx:86-89`).

- Pas de `role="banner"` explicite — HTML5 implicite OK ≥ AT 2020.
- Logo (Link), 2 navs (`<nav aria-label={t("nav.home")}>` + `<nav aria-label={t("nav.home") 2}>`), CTA central, LocaleSwitcher, MobileNav trigger.
- **Deux navs avec même `aria-label="Accueil"` puis "Accueil 2"** : RGAA 12.2 demande labels uniques. Patch : `nav.primary` / `nav.secondary` ou `t("nav.primaryAriaLabel")`.

#### 3.3 Footer

`<footer data-tone="dark">` (`Footer.tsx:102-104`).

- Pas de `role="contentinfo"` explicite. HTML5 implicite OK.
- Liens en `<ul>` (Bons patterns), pas vérifié exhaustivement.

### 4. ARIA nav + mega-menus

#### 4.1 Trigger mega-menu

`HeaderMegaMenu.tsx:117-131` :

```tsx
<Link
  href={triggerHref as never}
  aria-haspopup="true"
  aria-expanded={open}
  ...
>
  {triggerLabel}
  <span aria-hidden="true">▾</span>
</Link>
```

✅ `aria-haspopup` + `aria-expanded` dynamique.
❌ Pas d'`aria-controls={panelId}` reliant trigger ↔ panel.
❌ Le `▾` chevron est `aria-hidden`, c'est OK car redondant avec aria-expanded.

#### 4.2 Panel

`HeaderMegaMenu.tsx:133-143` :

```tsx
<div role="region" aria-label={panelLabel}>
```

⚠ `role="region"` est intentionnel — RGAA 9.1 / WCAG 2.4.1. **Mais** un mega-menu de navigation devrait peut-être préférer `role="menu"` + items `role="menuitem"` (pattern WAI-ARIA Authoring Practices 1.2). Le pattern actuel est **équivalent en termes d'accessibilité réelle** (les items sont des `<Link>` natifs, focusables, lisibles) mais sémantiquement non-conforme strict APG.

**Décision audit** : pattern « region with links » est le pattern Linear / Vercel / Stripe 2026 — pragmatique, supporte mieux les liens cliquables et le SEO. Non-conformance APG **assumée**. P2.

#### 4.3 Fermeture

`HeaderMegaMenu.tsx:76-94` :

- Esc → close ✅
- Click outside → close ✅
- onBlur si focus quitte le wrapper → close ✅
- onMouseLeave → close avec délai 200 ms ✅ (hover-intent)

Bonne implémentation. WCAG 2.1.1 (keyboard) + WCAG 2.4.3 (focus order) conformés.

### 5. Forms

#### 5.1 Labels associés

✅ Tous les `<Label htmlFor="X">` + `<Input id="X" />` (`ContactForm.tsx:86-87`, `BookingForm.tsx:119-122`, `AuditForm.tsx`, `AuditRequestForm.tsx`).
✅ Autocomplete attributes (`BookingForm.tsx:122,138,155`) : `name`, `email`, `tel` — RGAA 11.13 + WCAG 1.3.5.
✅ `noValidate` sur form (`ContactForm.tsx:84`) → désactive natif HTML5 pour utiliser Zod → message custom traduit FR/EN.

#### 5.2 Erreurs

Pattern unique :

```tsx
<Input aria-invalid={!!errors.X} />;
{
  errors.X ? (
    <p role="alert" className="text-accent-red text-xs">
      {errors.X.message}
    </p>
  ) : null;
}
```

✅ `role="alert"` annonce dynamiquement.
✅ `aria-invalid` marque l'état.
❌ **Manque `aria-describedby` reliant input↔message** (cf. P1-A11Y-03).

Couleur erreur `text-accent-red` = `#ee1d36` sur fond bg `#faf8f3` → ~5.65:1 — ✅ AA texte normal.
**Mais** dans `check-contrast.ts:150-152`, `accent-red` est marqué `largeOnly` car AAA 3:1 — c'est `primaryFg on accent-red` (texte blanc sur bg rouge), pas la couleur du texte sur fond.

#### 5.3 Fieldset/Legend

✅ `AuditForm.tsx:159,183`, `AuditRequestForm.tsx:716,818,959,1011,1068`, `ImplementationForm.tsx:162,187` — groupes radio bien encapsulés. RGAA 11.6 ✅.
❌ **Pas de fieldset** dans `ContactForm.tsx` ni `BookingForm.tsx` — pas de groupes de radio, donc inutile. OK.

#### 5.4 Submit feedback

`ContactForm.tsx:75-81` + `BookingForm.tsx:99-105` :

```tsx
<Alert variant="success" role="status">
```

✅ `role="status"` (politeness `polite`) sur succès — pas d'interruption AT.
✅ `role="alert"` (politeness `assertive`) sur erreur serveur.

`BookingForm.tsx:109` : `<p aria-live="polite">` pour le rappel date/heure dynamique. ✅

### 6. Modales (Radix Dialog)

`MobileNav` (`MobileNav.tsx:24-49`) utilise `<Sheet>` qui wrappe Radix Dialog :

- ✅ Focus trap natif Radix.
- ✅ Esc close.
- ✅ Click outside close.
- ✅ Scroll lock.
- ✅ `<SheetTitle className="sr-only">` + `<SheetDescription className="sr-only">` → contexte AT.
- ✅ `aria-label={t("openMenu")}` sur le `<SheetTrigger>` button.

`BookingCalendar.tsx:36-41` importe Radix Dialog directement : `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` — même garanties.

Commentaire `MobileNav.tsx:2-3` confirme refactor explicite vers Radix Sheet après audit interne « A11Y-003 / NAV-008 » (focus trap absent + backdrop click no-op). Bonne traçabilité.

### 7. Alt text

#### 7.1 next/image

✅ `Illustration.tsx:91` : `alt={alt}` requis par le type (`IllustrationProps.alt: string`).
✅ `IllustrationPlaceholder.tsx` : `aria-label={ariaLabel}` derived from `alt`.

#### 7.2 `<img>` cru

❌ `src/components/sections/TeamGrid.tsx:29` : `<img src={member.photoUrl} alt={member.name} />`
❌ `src/components/sections/PressSpokesperson.tsx:46` : `<img src={p.photoUrl} alt={p.name} />`

Alt présent (donc WCAG 1.1.1 OK), mais :

- **Perf** : pas de `loading="lazy"`, pas de width/height, pas de srcset.
- **Sprint 5 TODO** déclaré en commentaire, jamais clôturé.

#### 7.3 Logos / monogrammes

`Header.tsx:105-116` : « logo » = composition texte serif + italique, **pas une image**.
`HeaderInterventionsMenu.tsx`, `ClaudeLogo.tsx`, `ToolLogo.tsx`, `StackHeroSchema.tsx` — non lus en détail cet audit. P2 à vérifier.

### 8. `prefers-reduced-motion`

`globals.css:386-412` :

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0ms !important;
    scroll-behavior: auto !important;
  }
  .cta-lift:hover { transform: none !important; }
  .title-flash { animation: none !important; }
  ::view-transition-old(*), ::view-transition-new(*), ::view-transition-group(*) { ... }
}
```

✅ **Doctrine Motion respectée** : règle universelle + cas spécifiques (cta-lift, title-flash, View Transitions futures).
✅ `scroll-behavior: auto` désactive le smooth scroll global.

Vérifié usage dans :

- `src/components/sections/TestimonialsCarousel.tsx` — utilise `prefers-reduced-motion`.
- `src/components/motion/FadeInOnView.tsx` — wrapper qui doit respecter.
- `src/components/marketing/StickyMobileCta.tsx` — animation conditionnée.
- `src/app/[locale]/loading.tsx` — skeleton.

**WCAG 2.3.3 + SC 2.2.2** : ✅.

### 9. Tap targets ≥ 24 px (SC 2.5.8)

Sondage classes Tailwind (Grep tap target patterns) :

| Élément                                                        | Classe                   | Taille          | SC 2.5.8 (24 px) | AAA 2.5.5 (44 px) |
| -------------------------------------------------------------- | ------------------------ | --------------- | ---------------- | ----------------- |
| Button `sm` (`button.tsx:27`)                                  | `h-9 px-4`               | 36 px           | ✅               | ❌                |
| Button `md`                                                    | `h-11 px-5`              | 44 px           | ✅               | ✅                |
| Button `lg`                                                    | `h-12 px-6`              | 48 px           | ✅               | ✅                |
| Button `icon`                                                  | `h-11 w-11`              | 44 px           | ✅               | ✅                |
| MobileNav trigger (`MobileNav.tsx:34`)                         | `h-11 w-11`              | 44 px           | ✅               | ✅                |
| Calendar cellule date (`BookingCalendar.tsx:856`)              | `h-7 w-7`                | 28 px           | ✅               | ❌                |
| Header logo (`Header.tsx:103`)                                 | `px-4 py-2` + text-2xl   | ~50×40 px       | ✅               | ✅                |
| Header CTA central                                             | `h-12 px-6`              | 48 px           | ✅               | ✅                |
| MegaMenu sous-link service (`HeaderImplantationsMenu.tsx:138`) | `text-[11px]` no padding | < 24 px hauteur | ⚠️ borderline    | ❌                |
| Footer liens                                                   | non chiffrés             | à vérifier      | ?                | ?                 |

⚠️ **`h-7 w-7` (28 px) sur cellules calendrier** : conforme AA strict mais limite mobile.
⚠️ **Sous-liens services mega-menu Implantations** (`text-[11px] font-semibold` sans `py`) : la hauteur cliquable suit la line-height — ~16 px à 11 px font → **< 24 px**. **Non-conforme SC 2.5.8 AA** si pas de padding. À vérifier rendu réel (peut-être que `li` parent injecte de l'espace).

→ P1-A11Y-05.

### 10. Skip-link

`src/components/a11y/SkipToContent.tsx:5-15` :

```tsx
<a
  href="#main"
  className="bg-fg text-bg focus-visible:ring-primary sr-only z-50 rounded-sm px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:ring-2 focus-visible:ring-offset-2"
>
  {t("skipToContent")}
</a>
```

✅ Premier élément du `<body>` (`layout.tsx:145`).
✅ `sr-only` par défaut, `not-sr-only` au focus → apparaît top-left.
✅ Target `#main` matche `<main id="main">` (`layout.tsx:148`).
✅ Texte i18n : « Aller au contenu » FR / « Skip to content » EN (`messages/fr.json:4`, `messages/en.json:4`).
✅ Contraste `bg-fg #1a1815 text-bg #faf8f3` = ~17.5:1 — AAA.

**Conforme WCAG 2.4.1 Bypass Blocks + RGAA 12.7.** ✅

### 11. Lang HTML

`layout.tsx:139-141` :

```tsx
<html lang={locale} dir="ltr" ...>
```

✅ Dynamique FR ou EN selon route. WCAG 3.1.1.

Pas de `<span lang="en">` repéré sur copy FR — à vérifier sur cas-concrets, blog, glossaire si emprunts EN (mots tech) sont marqués. P2.

### 12. RGAA 4.1

Page `/accessibilite` (`src/app/[locale]/accessibilite/page.tsx:53-100`) :

- Engagement WCAG 2.2 AA + RGAA 4.1 + EAA.
- Conformance déclarée « partielle ».
- Voies de recours email + Défenseur des droits.
- Date : 6 mai 2026.
- Audit Sprint 21 « planifié » — **Sprint 21 dépassé sans audit indépendant à ce jour**.

→ P2-A11Y-11 : mettre à jour la page après audit complet.

### 13. Tests a11y.spec.ts

`tests/e2e/a11y.spec.ts:22-28` :

```ts
const STRATEGIC_PATHS = [
  { path: "/fr", label: "home FR" },
  { path: "/fr/audit", label: "audit" },
  { path: "/fr/interventions", label: "interventions" },
  { path: "/fr/implementation", label: "implementation" },
  { path: "/fr/reserver", label: "reserver" },
] as const;
```

5 routes seulement. Configuration Axe :

```ts
.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
```

✅ Tags WCAG 2.2 inclus (rare, bonne pratique 2026).
✅ Threshold strict : 0 violation `serious|critical`.
⚠️ `moderate|minor` loggés mais pas bloquants.

**Manquent** : `/contact`, `/cas-concrets`, `/comparaisons`, `/methodologie`, `/blog`, `/centre-aide`, `/faq`, `/glossaire`, `/presse`, `/stack-ia`, `/implantations`, `/implantations/ile-de-france/paris` — page mère ville pilote ~5000 mots.

→ P0-A11Y-02.

### 14. `scripts/check-contrast.ts`

29 paires testées. Algorithme :

- Conversion hex → RGB
- Alpha blending pour les paires avec opacité (mocha-fg/85, /70, /60)
- Luminance relative formule WCAG
- Threshold `≥ 4.5` ou `≥ 3` si `largeOnly`

Exit 1 si > 0 failures. ✅ Inclus dans `pnpm verify:all` (`package.json:62`).

**Couverture** : palette tokens uniquement, pas les compositions réelles (gradients, overlays). Cf. § 1.2.

---

## Citations

| Path:line                                          | Affirmation                                        |
| -------------------------------------------------- | -------------------------------------------------- |
| `src/app/globals.css:211-215`                      | Focus-visible token global 2 px primary outline    |
| `src/app/globals.css:386-412`                      | prefers-reduced-motion strict                      |
| `src/app/[locale]/layout.tsx:139`                  | `<html lang={locale}>`                             |
| `src/app/[locale]/layout.tsx:148`                  | `<main id="main">` skip target                     |
| `src/app/[locale]/layout.tsx:145`                  | SkipToContent first child                          |
| `src/components/a11y/SkipToContent.tsx:5-15`       | Skip-link impl                                     |
| `src/components/nav/Header.tsx:120-122`            | nav aria-label="Accueil"                           |
| `src/components/nav/Header.tsx:154-156`            | nav aria-label="Accueil 2" (issue duplicate label) |
| `src/components/nav/HeaderMegaMenu.tsx:117-131`    | Trigger aria-haspopup/expanded                     |
| `src/components/nav/HeaderMegaMenu.tsx:134`        | Panel role="region" sans aria-controls             |
| `src/components/nav/MobileNav.tsx:24-49`           | Radix Sheet focus trap + Esc                       |
| `src/components/forms/ContactForm.tsx:84-148`      | Pattern label/aria-invalid/role=alert              |
| `src/components/forms/BookingForm.tsx:108-194`     | Pattern booking form a11y                          |
| `src/components/forms/AuditForm.tsx:159,183`       | fieldset/legend radio groups                       |
| `src/components/sections/TeamGrid.tsx:29`          | `<img>` cru sans next/image                        |
| `src/components/sections/PressSpokesperson.tsx:46` | idem                                               |
| `src/components/visual/Illustration.tsx:89-91`     | next/image avec alt requis                         |
| `src/components/calendar/BookingCalendar.tsx:856`  | `h-7 w-7` tap target 28 px                         |
| `src/components/ui/button.tsx:26-32`               | Button sizes sm/md/lg/xl/icon                      |
| `tests/e2e/a11y.spec.ts:22-28`                     | 5 routes testées                                   |
| `scripts/check-contrast.ts:90-153`                 | 29 paires palette                                  |
| `package.json:51,58,62`                            | scripts contrast/a11y/verify:all                   |
| `src/app/[locale]/accessibilite/page.tsx:53-100`   | Déclaration RGAA 4.1 + EAA                         |
| `src/messages/fr.json:4` / `en.json:4`             | i18n skipToContent                                 |

---

## [INCONNU] — éléments non vérifiables sans runtime

- **Axe-core live results** : `tests/e2e/a11y.spec.ts` non exécuté cet audit (déféré Phase 4). Possible que les 5 pages couvertes aient des `minor/moderate` non-loggés dans cet audit.
- **NVDA / JAWS / VoiceOver tests** : page `/accessibilite` mentionne « Sprint 21 », jamais exécutés à HEAD.
- **CrUX a11y** : pas de signal CrUX dédié a11y (n'existe pas).
- **Plausible custom event a11y skip-link usage** : ne semble pas tracké.
- **Focus visibility sur `bg-mocha-rich`** : footer fond foncé avec radial gradients. Le token global outline est `var(--color-primary)` (#1a4dd9) — ratio vs mocha #2a2520 ≈ 1.6:1. **Outline bleu sur fond foncé : potentiellement non-visible**. Footer overrides : `focus-visible:ring-terracotta focus-visible:ring-offset-mocha` (`Footer.tsx:119`) → ring terracotta #c24a1b vs mocha → ~4.7:1, OK. **Mais** uniquement sur le link logo et le LocaleSwitcher. Liens normaux du footer héritent du token global outline:bleu → ratio insuffisant. **À vérifier live**.
- **Logo `m_horizontal_white_2.png`** : doctrine mentionne cette image, mais code Header utilise du texte stylisé. Drift potentiel. Localisation de l'image en `public/` non vérifiée cet audit (probable usage OG image).
- **Présence d'`aria-current="page"` partout** : NavLink l'a (`NavLink.tsx:26`), Breadcrumbs probablement, autres non vérifiés.

---

## Recommandations (≤ 10, classées effort × impact)

| #   | Reco                                                                                                                                                                                          | Effort      | Impact                               | Priorité         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------ | ---------------- |
| R1  | **Étendre `a11y.spec.ts` aux 15 pages Top + 5 villes pilotes** (cas-concrets, methodologie, comparaisons, presse, stack-ia, paris, implantations, blog, centre-aide, faq, glossaire, contact) | M (2 h)     | Élevé — détecte régressions live     | P0               |
| R2  | **Remplacer `<img>` cru par `next/image`** dans TeamGrid:29 + PressSpokesperson:46                                                                                                            | XS (15 min) | M — perf + dette                     | P0               |
| R3  | **Ajouter `aria-describedby` sur tous les inputs avec erreur** (pattern factorisable via composant `<FormField>`)                                                                             | M (3 h)     | Élevé — RGAA 11.10 conformance       | P1               |
| R4  | **Renommer les aria-label nav doublons** (`nav.primary` / `nav.secondary` au lieu de `nav.home` + `nav.home 2`)                                                                               | XS (10 min) | M — RGAA 12.2                        | P1               |
| R5  | **Calendar cellules `h-7 w-7` → `h-9 w-9`** (36 px) ou wrapper invisible 44 px                                                                                                                | XS (10 min) | M — UX mobile                        | P1               |
| R6  | **Ajouter `aria-controls={panelId}`** sur trigger mega-menu vers panel                                                                                                                        | XS (15 min) | M — RGAA 12                          | P1               |
| R7  | **Footer : focus-visible ring sur tous les liens** explicite `focus-visible:ring-terracotta focus-visible:ring-offset-mocha` (override token global bleu invisible sur fond foncé)            | S (30 min)  | Élevé — focus invisible = blocker AA | P0/P1 selon test |
| R8  | **Mettre à jour `/accessibilite` après audit indépendant Sprint 21+** (relancer NVDA + Axe live + Lighthouse a11y 100/100)                                                                    | L (1 jour)  | Élevé — conformance officielle       | P1               |
| R9  | **Étendre `check-contrast.ts` aux compositions réelles** (badge sur halo, sous-liens mega-menu, footer link sur mocha-rich) — 10 paires additionnelles                                        | S (1 h)     | M — détecte cas réels                | P2               |
| R10 | **Sous-liens services mega-menu Implantations : ajouter `py-1`** pour atteindre 24 px tap target                                                                                              | XS (5 min)  | M — SC 2.5.8                         | P1               |

---

## STOP & ASK consolidés (questions ouvertes pour Will)

- **Q-A11Y-01** : Le logo Header est-il **définitivement** un span texte serif (cf. `Header.tsx:105-116`) ou la doctrine demande-t-elle l'usage de `m_horizontal_white_2.png` ? Drift à confirmer. Mentionné mémoire `axionia_naming_brand_vs_project.md` (« Axion-IA partout, plus de double graphie »).

- **Q-A11Y-02** : Le pattern mega-menu « `role="region"` + liens » (vs APG `role="menu"`) est-il un choix design assumé (cohérence Linear/Stripe/Vercel) ? Confirmer pour ne pas le « corriger » à l'avenir.

- **Q-A11Y-03** : Sprint 21 audit indépendant prévu — déclencher maintenant ou maintenir comme « planifié » dans la page `/accessibilite` ? European Accessibility Act 2025-06-28 entré en vigueur → exigence légale pour B2C, mais Axion-IA est B2B (hors scope EAA strict).

- **Q-A11Y-04** : Le contraste **`fg-muted` (5.18:1)** est borderline AAA — accepter (cohérence éditoriale terracotta primary) ou assombrir le token de `#6b6155` à `#5e544a` pour repasser 6.0:1 et améliorer la lecture en condition réelle (éclairage faible, dyslexiques) ?

- **Q-A11Y-05** : Étendre `a11y.spec.ts` à 15+ pages — est-ce un sprint dédié ou peut-on en faire un patch incremental Sprint 25 ?

- **Q-A11Y-06** : Les `<img>` crus de TeamGrid et PressSpokesperson — les pages sont-elles publiées (Equipe + Presse) ? Si oui, urgent. Si non (fixtures), P2.

---

**Fin AGT-07 A11Y.** Score 78/100. Confiance haute. 2 P0 + 5 P1 + 4 P2. Pondération synthèse ×1.3 → contribution finale **101.4 pts pondérés** sur 130 max (78 %).
