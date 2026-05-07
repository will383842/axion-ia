# Design.md — AxionIA · Doctrine visuelle v3 « Editorial Premium Light »

> **Source de vérité visuelle officielle** depuis 2026-05-06.
> Dernière synchro avec le code : **2026-05-07** (sweep complet `globals.css` + `button.tsx` + `Section.tsx` + `Container.tsx` + `Footer.tsx` + `ProductHero.tsx`).
> Supersedes la direction Webflow-inspired v1 (cf. `docs/adr/0001-design-direction-webflow.md`).
> Références ADR : `docs/adr/0002-design-pivot-editorial-v3.md`, `docs/adr/0003-button-system-v3.md` (si existant), `docs/adr/0004-typography-baseline-18-15.md`.
> Implémentation tokens : `src/app/globals.css` (directive `@theme`).

---

## 1. Positionnement visuel

**Cabinet IA opérationnel premium B2B** pour PME/ETI européennes (DSI, dirigeants, RH, opérationnels).

Référents visuels assumés : **Anthropic**, **Mistral**, **OpenAI**, **Stripe Press**, éditeurs éditoriaux à signature serif italique.

Anti-références : SaaS B2C grand public, dashboards techniques type Linear/Notion, sites « agence digitale » multicolores.

**Mots-clés directeurs** : éditorial, calme, opérationnel, pas de noir pur, italique terracotta en signature, surfaces ivoire chaud.

---

## 2. Palette canon

### 2.1 — Surfaces (4 tons éditoriaux, sans noir)

| Token                | Hex       | Usage                                             |
| -------------------- | --------- | ------------------------------------------------- |
| `--color-bg`         | `#faf8f3` | Canvas par défaut — ivoire chaud                  |
| `--color-paper`      | `#ffffff` | Cards, sections de contraste, modales             |
| `--color-sand`       | `#f0e9da` | Sections « intermissions », alternance Hero       |
| `--color-sand-deep`  | `#e6dcc4` | Bordures fortes, badges éditoriaux                |
| `--color-mocha`      | `#2a2520` | Sections premium (Footer, CTA dark) — PAS du noir |
| `--color-mocha-soft` | `#3d362f` | Gradients mocha → mocha-soft                      |
| `--color-mocha-fg`   | `#f7f3ea` | Texte sur fonds mocha                             |

### 2.2 — Foreground (texte sur surfaces claires)

| Token              | Hex       | Usage                                                   |
| ------------------ | --------- | ------------------------------------------------------- |
| `--color-fg`       | `#1a1815` | Texte principal — anthracite-brun (PAS noir)            |
| `--color-fg-soft`  | `#524b41` | Texte secondaire (descriptions, captions longs)         |
| `--color-fg-muted` | `#6b6155` | Texte tertiaire (eyebrow, dates, métadonnées) — WCAG AA |

> **Note 2026-05-07** : `fg-muted` a été assombri de `#80766a` → `#6b6155` pour passer WCAG AA sur paper et sand (cible 4.5:1 minimum). Toute référence à `#80766a` dans la doc ou le code est obsolète.

### 2.3 — Accent primary (Editorial Blue)

| Token                   | Hex       | Usage                                      |
| ----------------------- | --------- | ------------------------------------------ |
| `--color-primary`       | `#1a4dd9` | CTA primaire **unique**, links, focus ring |
| `--color-primary-hover` | `#0f3aae` | Hover CTA primaire                         |
| `--color-primary-fg`    | `#ffffff` | Texte sur primary                          |
| `--color-primary-soft`  | `#e8efff` | Halo très doux fond d'icônes, badges info  |

> **Règle stricte** : `#1a4dd9` est **la seule couleur** autorisée sur un CTA primaire (button bg, link underline, focus ring). Aucune autre couleur ne joue ce rôle. Confirmé par grep CI.

### 2.4 — Accent éditorial (terracotta brique)

| Token                     | Hex       | Usage                                                              |
| ------------------------- | --------- | ------------------------------------------------------------------ |
| `--color-terracotta`      | `#c24a1b` | Italiques signature `em.editorial`, divider footer, CTA dark hover |
| `--color-terracotta-soft` | `#f5e3d8` | Halo terracotta très doux (badges accent, illustrations)           |
| `--color-terracotta-deep` | `#8c3010` | Hover sur fonds clairs, focus ring sur fonds mocha                 |

> Le terracotta est l'accent **éditorial** : jamais sur un CTA primaire, toujours en signature (italique serif, dot indicator hero, divider, hover éditorial).

### 2.5 — Accent doux (vert sauge)

| Token               | Hex       | Usage                                                 |
| ------------------- | --------- | ----------------------------------------------------- |
| `--color-sage`      | `#5e6c54` | Module Cas concrets, badges proof, indicateurs succès |
| `--color-sage-soft` | `#e6ebe2` | Halo doux fonds de cards proof                        |

> Le sage **remplace** le `#00d722` v1 (trop SaaS) tout en conservant le mapping ADR 0001 « Module Cas concrets = vert ». **Note 2026-05-07** : valeur assombrie de `#7a8870` → `#5e6c54` pour atteindre WCAG AA 5.0:1 sur paper. L'ancienne valeur `#7a8870` est obsolète.

### 2.6 — Module-color mapping (CONSERVÉ depuis ADR 0001)

| Module                             | Accent         | Token                             |
| ---------------------------------- | -------------- | --------------------------------- |
| Module 1 Interventions             | Editorial Blue | `--color-primary` `#1a4dd9`       |
| Module 2 Audit                     | Orange         | `--color-accent-orange` `#ff6b00` |
| Module 3 Implémentation            | Purple         | `--color-accent-purple` `#7a3dff` |
| Cas concrets                       | Sage           | `--color-sage` `#5e6c54`          |
| Stack / accent secondaire (legacy) | Green          | `--color-accent-green` `#00d722`  |
| Blog / transversales               | Neutral        | —                                 |
| Légal                              | Neutral        | —                                 |

> **Discipline 1 couleur par section** : un module n'utilise son accent que sur les badges, l'eyebrow dot, l'illustration. Le CTA primaire reste **toujours** Editorial Blue. Aucune section ne combine 3+ couleurs.

> **Note sur les tokens `--color-accent-*`** : les accents `orange`, `purple`, `green`, `pink`, `yellow`, `red` sont définis dans `globals.css` sous le bloc « Compatibilité v1/v2 » mais sont **toujours load-bearing** (utilisés par `ProductHero.tsx`, `Hero.tsx`, `Eyebrow.tsx`, `badge.tsx`, `alert.tsx`, formulaires, calendrier — 14 fichiers au 2026-05-07). Ne pas les supprimer sans audit transverse.

### 2.7 — Tokens sémantiques (alerts, badges)

| Token             | Hex       | Mapping                           |
| ----------------- | --------- | --------------------------------- |
| `--color-success` | `#5e7050` | Vert sauge sombre (cohérent sage) |
| `--color-warning` | `#c24a1b` | = `--color-terracotta`            |
| `--color-error`   | `#b8341c` | Brique rouge (alerts critiques)   |
| `--color-info`    | `#1a4dd9` | = `--color-primary`               |

> Mapping volontairement sobre : pas de jaune/orange criards. Le terracotta sert à la fois d'accent éditorial **et** de warning (cohérence chromatique).

### 2.8 — Borders & dividers

| Token                     | Hex       | Usage                                       |
| ------------------------- | --------- | ------------------------------------------- |
| `--color-border`          | `#e5ddc8` | Bordures par défaut (cards, inputs)         |
| `--color-border-strong`   | `#c8bda0` | Focus ring sur fond clair, dividers marqués |
| `--color-border-on-mocha` | `#4a4239` | Bordures sur fonds mocha                    |

> Alias compat v1 : `--color-border-hover` = `--color-border-strong`, `--color-gray-300` = `#c8bda0`. Encore référencés dans certains composants legacy.

---

## 3. Typographie

### 3.1 — Familles

| Famille                | Variable       | Usage                                                       |
| ---------------------- | -------------- | ----------------------------------------------------------- |
| **Manrope** (sans)     | `--font-sans`  | Body, UI, eyebrow uppercase, navigation, forms              |
| **Fraunces** (serif)   | `--font-serif` | Titres éditoriaux (h1 home, hero), signature `em.editorial` |
| **Inconsolata** (mono) | `--font-mono`  | Technique, code, prix `tnum`, métriques chiffrées           |

Fallbacks : sans → `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui` ; serif → `"Iowan Old Style", Palatino, P052, serif` ; mono → `ui-monospace, SFMono-Regular, Menlo`.

### 3.2 — Échelle (mobile-first, scale clamp pour fluide)

> **v3.1 — 2026-05-07** : baseline corps montée de 16 → 18 px et `text-sm` 14 → 15 px pour s'aligner sur Anthropic (référence doctrinale, Design.md §1) et sortir du ressenti « tout petit sauf hero ». Voir ADR 0004 et `_AUDIT/AUDIT-TYPOGRAPHY-2026.md`. Tailwind v4 defaults `text-base` et `text-sm` sont **explicitement overridés dans `@theme`** ; tout le code consomme `text-base` (= `--text-base` = 18 px), `text-sm` (= `--text-sm` = 15 px), etc.

| Token             | Taille                      | Line-height | Letter-spacing  | Famille                     | Usage                         |
| ----------------- | --------------------------- | ----------- | --------------- | --------------------------- | ----------------------------- |
| `--text-display`  | **7 rem (112 px)**          | 0.96        | -0.04em         | serif Fraunces              | token statique fallback       |
| `--text-section`  | 4 rem (64 px)               | 1.04        | —               | serif ou sans selon section | h2 section heading            |
| `--text-sub`      | 2.25 rem (36 px)            | 1.20        | —               | sans                        | h3                            |
| `--text-feature`  | 1.5 rem (24 px)             | 1.30        | —               | sans                        | feature card title            |
| `--text-lead`     | **1.4375 rem (23 px)** v3.1 | 1.50        | —               | sans                        | description hero / lead intro |
| `--text-body`     | **1.125 rem (18 px)** v3.1  | 1.70        | -0.005em        | sans                        | body (= `text-base` Tailwind) |
| `--text-base`     | **1.125 rem (18 px)** v3.1  | 1.70        | -0.005em        | sans                        | override Tailwind default     |
| `--text-sm`       | **0.9375 rem (15 px)** v3.1 | 1.55        | —               | sans                        | override Tailwind default     |
| `--text-label-up` | 0.8125 rem (13 px)          | 1.30        | **0.16em**      | sans uppercase              | eyebrow, label form           |
| `--text-caption`  | **0.9375 rem (15 px)** v3.1 | 1.55        | —               | sans                        | caption, metadata             |
| `--text-badge-up` | 0.75 rem (12 px)            | 1.20        | uppercase       | sans                        | badge inline                  |
| `--text-micro-up` | 0.625 rem (10 px)           | 1.30        | 0.1em uppercase | sans                        | micro-label                   |

**Mesure de ligne cible** : 60-75 ch confort. Avec body 18 px : `max-w-2xl` (672 px) ≈ 75 ch ✓ ; éviter `max-w-3xl` (≈ 85 ch) sur les paragraphes éditoriaux longs.

**Ratio hero/body** : doctrine v3.1 vise ~6.2× (display max 112 px / body 18 px). Médiane benchmark 2026 = 4.4×.

> **⚠ Hero h1 = utility `.display-editorial`, pas le token `--text-display`** : la classe `.display-editorial` (appliquée automatiquement par `<Section titleAs="h1">`) utilise `clamp(3rem, 9vw, 7rem)` + `letter-spacing: -0.035em` (fluide). Le token `--text-display` (statique 7 rem / -0.04em) sert uniquement de fallback hors-utility. **Ne pas confondre.**

### 3.3 — Signature éditoriale `em.editorial`

Classe globale dans `globals.css` :

```css
em.editorial {
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--color-terracotta);
  font-weight: 500;
}
```

Utilisation : mise en exergue d'un mot dans un titre serif. Ex :

> _L'intelligence artificielle <em class="editorial">qui produit</em> du ROI mesurable en 90 jours._

### 3.4 — Eyebrow signature

- Pas de fond coloré (rupture v1 où eyebrow avait un bg primary 10%).
- Texte uppercase, taille `--text-label-up`, tracking 0.16em, color `--color-fg-muted`.
- **Dot indicator** 6×6 px en couleur module devant le texte (`mr-3 inline-block h-1.5 w-1.5 rounded-full bg-{module-color}`).

---

## 4. Radius

| Token           | v3        | Usage                                 |
| --------------- | --------- | ------------------------------------- |
| `--radius-xs`   | 2 px      | Inputs hairline, focus ring           |
| `--radius-sm`   | 4 px      | Buttons, badges, inputs               |
| `--radius-md`   | **8 px**  | Cards UI, modales                     |
| `--radius-lg`   | **12 px** | Cards éditoriales standard            |
| `--radius-xl`   | **20 px** | Cards hero, surfaces premium          |
| `--radius-2xl`  | **28 px** | Hero blocks, sections premium isolées |
| `--radius-full` | 9999 px   | Avatars, dots, pills                  |

> **Règle** : `border-radius > 12 px` autorisé seulement sur Hero blocks et cards éditoriales premium (xl/2xl). Linter `pnpm radius:check` passe.

---

## 5. Shadows — cascade 5 couches ton chaud

```css
--shadow-card:
  rgba(42, 37, 32, 0) 0px 84px 24px, rgba(42, 37, 32, 0.02) 0px 54px 22px,
  rgba(42, 37, 32, 0.05) 0px 30px 18px, rgba(42, 37, 32, 0.08) 0px 13px 13px,
  rgba(42, 37, 32, 0.09) 0px 3px 7px;
```

3 niveaux exposés :

- `--shadow-subtle` — éléments légers (badges, popovers fins).
- `--shadow-card` — cards par défaut (5 couches).
- `--shadow-elevated` — modales, hero floating, popovers majeurs.

Bonus : `--shadow-inset-soft: inset 0 1px 0 0 rgba(255,255,255,0.6)` pour cards éditoriales sur sand.

---

## 6. Halos signature

Trois utility classes :

```css
.bg-halo-warm {
  background-color: var(--color-bg);
  background-image:
    radial-gradient(at 92% 8%, rgba(194, 74, 27, 0.1) 0px, transparent 55%),
    radial-gradient(at 8% 92%, rgba(26, 77, 217, 0.06) 0px, transparent 60%);
}

.bg-halo-cool {
  background-color: var(--color-sand);
  background-image:
    radial-gradient(at 88% 88%, rgba(26, 77, 217, 0.08) 0px, transparent 55%),
    radial-gradient(at 12% 12%, rgba(122, 136, 112, 0.06) 0px, transparent 50%);
}

.bg-mocha-rich {
  background-color: var(--color-mocha);
  background-image:
    radial-gradient(at 80% 20%, rgba(194, 74, 27, 0.18) 0px, transparent 55%),
    radial-gradient(at 20% 80%, rgba(26, 77, 217, 0.14) 0px, transparent 55%);
}
```

Usage : Hero `home`/`module` par défaut → `bg-halo-warm`. Sections d'alternance → `bg-halo-cool`. Sections premium / Footer → `bg-mocha-rich` (gradient terracotta + primary radial sur fond mocha). Jamais 2 halos collés sans section neutre entre.

> **Important** : `<Section tone="mocha">` applique `bg-mocha-rich` (la version gradient), **pas** `bg-mocha` plat. De même `<Footer>` utilise `bg-mocha-rich`. Le token plat `bg-mocha` n'est utilisé qu'en cas de besoin explicite d'aplat (rare).

---

## 7. Animation signature

- `--ease-out-webflow: cubic-bezier(0.16, 1, 0.3, 1)` — easing identitaire (conservé du v1).
- `--duration-fast: 150ms`, `--duration-base: 250ms`, `--duration-slow: 400ms`.
- **Classe canonique `.cta-lift`** (signature v3) :
  ```css
  .cta-lift {
    transition:
      transform var(--duration-base) var(--ease-out-webflow),
      box-shadow var(--duration-base) var(--ease-out-webflow),
      background-color var(--duration-base) var(--ease-out-webflow);
  }
  .cta-lift:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card);
  }
  ```
- Animation `.title-flash` (pulse 800ms terracotta) sur les titres de calendrier qui changent — déclenchée par changement d'intervention.
- **`prefers-reduced-motion: reduce`** désactive **toutes** animations + transitions globalement (media query CSS dans `globals.css`), et neutralise les `transform` de hover.

> **Note migration 2026** : la signature v1 « slide latéral » (`translateX(6px)`) a été remplacée par « lift vertical » (`translateY(-2px)` + shadow growth) pour aligner sur la doctrine éditoriale (Stripe Press, Anthropic). Le commentaire dans `button.tsx` documente la transition.

---

## 8. Breakpoints & Container

### 8.1 — Breakpoints (CONSERVÉS depuis v1)

| Token | Min-width | Cible    |
| ----- | --------- | -------- |
| `xs`  | 479 px    | Mobile L |
| `md`  | 768 px    | Tablet   |
| `lg`  | 992 px    | Desktop  |
| `xl`  | 1280 px   | Wide     |

### 8.2 — Container (v3 — élargi vs v1)

`<Container>` (`src/components/layout/Container.tsx`) :

- **Max-width : `1520 px`** (vs 1280 px en v1). Plus aéré sur grands écrans tout en restant cadré.
- **Padding responsive progressif** : `16 / 24 / 40 / 64 px` (mobile / sm / lg / xl) — vs `16/24/32/48` v1.
- Classe : `mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-10 xl:px-16`.
- Polymorphe via prop `as` (`div` par défaut, accepte `section`, `article`, etc.).

> **Toute page doit passer par `<Container>`**. Les heros qui ont besoin de full-bleed background utilisent `<Section>` (qui contient `<Container>` en interne) avec décoration positionnée en `absolute inset-0`.

---

## 9. Selection & Focus

### Selection

```css
::selection {
  background: var(--color-terracotta);
  color: var(--color-mocha-fg);
}
```

Signature éditoriale : sélection en terracotta plutôt que primary.

### Focus visible

```css
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}
```

Sur fonds mocha : `outline: 2px solid var(--color-terracotta)`.

---

## 10. Surfaces & sections — règles d'alternance

Ordre conseillé sur une page longue (home, module listing) :

1. **Hero** — `bg-halo-warm` (ivoire + halos chauds).
2. **Trust bar** — `bg-bg` neutre.
3. **Modules / Features** — `bg-paper` blanc pur (contraste).
4. **Métriques** — `bg-halo-cool` (sand + halos froids).
5. **Méthode** — `bg-bg` neutre.
6. **Cas concrets** — `bg-sand` (pause éditoriale).
7. **ROI / proof** — `bg-bg` neutre.
8. **Témoignages** — `bg-sand-deep` léger.
9. **FAQ** — `bg-bg` neutre.
10. **CTA Block** — `bg-mocha-rich` (clôture premium, gradient terracotta + primary).
11. **Footer** — `bg-mocha-rich` (continuité CTA).

> **Règle** : jamais 3 sections consécutives de la même surface. Alterner `bg-bg` ↔ `bg-paper` ↔ `bg-sand` pour rythme visuel. Les blocs sombres (CTA Block, Footer) utilisent **`bg-mocha-rich`** (gradient), pas `bg-mocha` plat.

---

## 11. Composants signature

### Button — 7 variants (v3 final)

Implémentation : `src/components/ui/button.tsx` (cva). Toutes les variants utilisent `cta-lift` au hover (sauf `link`). Focus ring Tailwind : `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`.

| Variant       | Classes principales                                                                                     | Usage                                              |
| ------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `primary`     | `bg-primary text-primary-fg hover:bg-primary-hover cta-lift`                                            | CTA primaire **unique** par section                |
| `secondary`   | `bg-fg text-bg hover:bg-mocha cta-lift`                                                                 | CTA secondaire sombre (ex : « En savoir + »)       |
| `ghost`       | `text-fg hover:bg-sand cta-lift`                                                                        | Liens-action discrets                              |
| `outline`     | `border border-border-strong text-fg bg-paper/60 hover:bg-paper hover:border-fg cta-lift backdrop-blur` | CTA tertiaire éditorial sur surfaces claires       |
| `terracotta`  | `bg-terracotta text-mocha-fg hover:bg-terracotta-deep cta-lift`                                         | CTA éditorial signature (rare, hors pages produit) |
| `link`        | `text-primary underline-offset-4 hover:underline`                                                       | Lien inline mis en valeur                          |
| `destructive` | `bg-error text-primary-fg hover:opacity-90 cta-lift`                                                    | Actions destructives (rare, surtout admin)         |

**Tailles** : `sm` (h-9), `md` (h-11, défaut), `lg` (h-12), `xl` (h-14), `icon` (h-11 w-11).
**Shapes** : `rounded` (rounded-md, défaut formulaires) ou `pill` (rounded-full, défaut marketing via `<Cta>`).

**Focus ring** : `--color-primary` 2px + offset 2px sur fonds clairs. Sur fond mocha (`[data-tone="dark"]` wrapper), focus ring devient `--color-terracotta`.

> **Doctrine** : un CTA primaire **unique** par section, toujours en variant `primary` (Editorial Blue). Le variant `terracotta` est réservé aux signatures éditoriales rares (PressKit, signature footer). Le variant `dark` historique a été remplacé par `secondary` (qui est désormais sombre par défaut).

### Section / Hero — composant central

`<Section>` est le composant **canonique** pour toutes les sections de page (heros et sous-sections). Il porte 6 tones (`canvas | paper | sand | halo-warm | halo-cool | mocha`), gère eyebrow + dot terracotta + `titleEm` italic-editorial automatiquement, et applique `display-editorial` Fraunces géant quand `titleAs="h1"` est passé (avec décoration SVG `PageHeroDecoration` automatique : anneaux concentriques + halos + particules).

- **Page hero canonique** : `<Section titleAs="h1" tone="halo-warm" eyebrow="…" title="…" titleEm="…" description="…" />`. WCAG 2.4.6 enforced — chaque page a exactement un h1.
- **Hero manuel équivalent** (audit, interventions, cas-concrets, /audit/demande, /reserver) : section custom 2-cols avec `bg-halo-warm`, `display-editorial`, eyebrow + dot terracotta, `<h1>` Fraunces + italic terracotta. Permet d'embarquer un `HeroSchema` SVG narratif à droite. Les classes restent strictement les mêmes que celles que `<Section>` aurait appliquées.
- **Composant `<Hero>`** (`components/sections/Hero.tsx`) : variante alternative pré-câblée avec dot indicator + accent + titleEm. Utilisé sur les pages dev `/sections` ; les pages publiques préfèrent `<Section titleAs="h1">` ou hero manuel.

### Templates partagés

- `<ProductPageTemplate>` (Module 1/2/3, ~18 pages produits) : prop `isFr` **requise** (sinon FR leak sur EN sur fallbacks/bloc `ReserveBigCta`). Hérite alternance auto paper → sand → mocha → canvas → mocha.
- `<LegalPageTemplate>` (6 pages legal/policy) : prop `isFr` **requise**. Hero halo-warm h1 sobre (pas de `titleEm` — choix éditorial pour lisibilité juridique) + body paper sans-serif max-w-3xl.

### ProductHero — pages produit

`src/components/sections/ProductHero.tsx`. Hero produit signature :

- `bg-halo-warm` + `border-l-4` accent latéral + halo accent `before:bg-{accent}/20`.
- 4 accents possibles : `primary` (défaut), `purple` (Module 3), `orange` (Module 2), `green` (legacy/stack secondaire).
- Title Fraunces serif `clamp(2.5rem, 6vw, 5rem)` + `titleEm` italic terracotta optionnel.
- Slot `heroSchema` (Sprint Visual Rhythm 2026) pour SVG narratif à droite en lg+.
- Bloc AEO `answer` : 40-80 mots citables par LLMs, en body sans-serif.

### Footer

`src/components/nav/Footer.tsx`. Référence éditoriale Linear / Anthropic / Stripe / Vercel.

- Wrapper `data-tone="dark"` + `bg-mocha-rich` (gradient terracotta + primary, pas `bg-mocha` plat).
- Strip terracotta 1px en haut (`bg-terracotta/40` divider signature).
- **Logo** : « Axion » en `font-serif` medium + tiret muted + « IA » en `font-serif italic` couleur `text-terracotta-soft`. Taille `text-xl`.
- **Tagline** : `font-serif` `text-sm leading-snug`, max-w-xs, ex : « Le cabinet IA _qui vous fait gagner_. » avec `text-terracotta-soft italic` sur la portion italique.
- **Layout** : flex+grid combo (brand fixed-width 256 px à gauche, 4 colonnes link `flex-1` à droite). Évite le piège JIT `grid-cols-12` quand `--breakpoint-sm` n'est pas défini.
- **Links** : `text-mocha-fg/85 hover:text-terracotta-soft transition` + focus ring terracotta avec offset mocha.
- **Bottom strip** : single-line desktop, `text-xs text-mocha-fg/65`, séparé par `border-border-on-mocha border-t pt-5`. Contient © OÜ, EU hosting, RGPD, sitemap, locale switcher.
- Form newsletter (si présent) : adapté automatiquement par les selectors `[data-tone="dark"] input` dans `globals.css` (background ivoire-on-mocha, focus terracotta-soft).

### Card

- Radius par défaut `--radius-lg` (12 px).
- Shadow `--shadow-subtle` au repos, `--shadow-card` au hover.
- Border `--color-border` 1px.
- Cards éditoriales premium : radius `--radius-xl` (20 px).

---

## 12. Anti-patterns interdits (linter CI)

- `#000000`, `#0a0a0a`, `#080808` — pas de noir pur, utiliser `--color-fg` (`#1a1815`) ou `--color-mocha` (`#2a2520`).
- `#ffffff` en bg principal — utiliser `--color-bg` (`#faf8f3`). Le blanc pur est réservé à `--color-paper`.
- `font-family: Inter, Geist, Newsreader, Helvetica` — bannis. Seuls Manrope, Fraunces, Inconsolata.
- `border-radius` en valeur littérale > 12 px hors hero blocks autorisés.
- `box-shadow` ton-froid `rgba(0,0,0,…)` — utiliser tokens shadows v3 ton chaud uniquement.
- `bg-primary 10%` en eyebrow — eyebrow doit être texte sur fond, pas bg coloré.

---

## 13. Conformité a11y

Contrastes WCAG calculés sur les paires les plus fréquentes (valeurs hex à jour 2026-05-07) :

- `--color-fg` (`#1a1815`) sur `--color-bg` (`#faf8f3`) : **~14.0:1** (AAA tous textes).
- `--color-fg-soft` (`#524b41`) sur `--color-bg` : **~7.2:1** (AAA tous textes).
- `--color-fg-muted` (`#6b6155`) sur `--color-bg` : **~5.9:1** (AA body, AAA texte large). **Mise à jour 2026-05-07** suite à l'assombrissement du token.
- `--color-fg-muted` sur `--color-paper` (`#ffffff`) : **~5.6:1** (AA body).
- `--color-fg-muted` sur `--color-sand` (`#f0e9da`) : **~5.4:1** (AA body).
- `--color-primary` (`#1a4dd9`) sur `--color-bg` : **~7.4:1** (AAA texte large, AA body).
- `--color-terracotta` (`#c24a1b`) sur `--color-bg` : **~4.8:1** (AA texte large uniquement — italiques signature, pas du body).
- `--color-sage` (`#5e6c54`) sur `--color-paper` : **~5.0:1** (AA body). **Mise à jour 2026-05-07** suite à l'assombrissement (`#7a8870` → `#5e6c54`).
- `--color-mocha-fg` (`#f7f3ea`) sur `--color-mocha` (`#2a2520`) : **~12.5:1** (AAA tous textes).
- `--color-terracotta-soft` (`#f5e3d8`) sur `--color-mocha` : **~10.6:1** (AAA) — utilisé pour links footer hover et logo.

> Linter `pnpm contrast:check` passe sur 12+ paires testées. Toute nouvelle paire couleur/texte doit passer **AA body (4.5:1)** au minimum, sauf signature éditoriale (terracotta italique) qui reste AA texte large.

---

## 14. Implémentation

Tokens CSS variables : `src/app/globals.css` directive `@theme`.
Tailwind v4 consomme via classes utilitaires (`bg-bg`, `text-fg`, `text-fg-muted`, `bg-mocha`, `text-mocha-fg`, `text-terracotta`, `bg-sand`, etc.).

Fichiers de référence :

- `src/components/layout/Container.tsx` — **max-w 1520**, padding 16/24/40/64 px (mobile/sm/lg/xl). Polymorphe via prop `as`.
- `src/components/layout/Section.tsx` — composant central : 6 tones (`canvas | paper | sand | halo-warm | halo-cool | mocha`), eyebrow + dot terracotta + titleEm italic-editorial, auto `display-editorial` + `PageHeroDecoration` (anneaux + halos + particules SVG) quand `titleAs="h1"`. `tone="mocha"` rend `bg-mocha-rich`.
- `src/components/sections/ProductPageTemplate.tsx` — orchestrateur Module 1/2/3 (alternance auto paper → sand → mocha → canvas → mocha). **Prop `isFr` requise**.
- `src/components/sections/LegalPageTemplate.tsx` — pages legal/policy. **Prop `isFr` requise**. Hero h1 sobre (sans titleEm) + body sans-serif max-w-3xl.
- `src/components/sections/ProductHero.tsx` — hero produit avec `border-l-4` accent + halo accent latéral. 4 accents : `primary | purple | orange | green`. Slot `heroSchema` pour SVG narratif.
- `src/components/sections/Hero.tsx` — variant alternative dot indicator + accent + titleEm (pages dev / cas spéciaux).
- `src/components/marketing/Cta.tsx` — wrapper `<Link>` ou `<a target="_blank">` qui passe par `<Button shape="pill">` (rounded-full) + tracking `data-cta`.
- `src/components/ui/button.tsx` — **7 variants v3** : `primary`, `secondary`, `ghost`, `outline`, `terracotta`, `link`, `destructive`. 5 tailles, 2 shapes.
- `src/components/nav/Header.tsx` — sticky + scroll behavior + mega-menus.
- `src/components/nav/Footer.tsx` — `bg-mocha-rich` + brand fixed-width + 4 colonnes flex-1 (services, resources, company, legal) + slim bottom strip.

**Règle parité** : toute nouvelle page doit utiliser `<Section titleAs="h1" tone="halo-warm">` ou un hero manuel reproduisant strictement les mêmes classes (`bg-halo-warm` + `display-editorial` + dot terracotta + italic-editorial). Toute string visible utilisateur doit être localisée FR/EN — `i18n:check` enforce la parité des clés.

---

## 15. Évolutions futures (hors scope ADR 0002)

- Mode sombre éditorial (mocha en bg principal, ivoire en fg) — différé Phase 2.
- Variante palette « hiver » (sage plus prononcé) — différé selon retours.
- Police titres serif alternative (Source Serif 4) — à benchmarker contre Fraunces post-launch.
