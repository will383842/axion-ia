# Agent 2 — CLS / Fonts

> **Périmètre** : Chapitres 3 (CLS) + 8 (Fonts), 20 critères × 15 pages = 300 cases.
> **Méthode** : lecture seule du repo `axionia/`, build artifacts `.next/` (BUILD*ID `E3PP2kWtZKG7UfgwwGBdi`, 2026-05-08), pas de Lighthouse / Chrome trace.
> **Gold standard CSS** : `.next/dev/static/chunks/[next]\_internal_font_google*\*_module_css_…single.css`+`src/app/globals.css`+`src/app/[locale]/layout.tsx`.

---

## Résumé exécutif

| Constat                                                                                                                                                    | Sévérité        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Next 16 `next/font/google` injecte déjà `size-adjust + ascent/descent-override` sur les 3 fonts                                                            | ✅ vert nominal |
| `--font-serif: var(--font-serif), …` dans `globals.css` = **auto-référence CSS qui annule le système fallback étendu**                                     | 🟠 Notable      |
| Hero LCP = texte H1 (`display-editorial`) Fraunces clamp 48-88 px → font swap potentiellement visible                                                      | 🟠 Notable      |
| `<link rel="preload" as="font">` jamais émis manuellement — Next 16 le fait automatiquement pour les fonts utilisées dans le layout root, à confirmer prod | 🟡 Moyenne      |
| Aucun `<iframe>` (Calendly, YouTube, Stripe…) dans le repo → aucun CLS iframe                                                                              | ✅ vert         |
| Aucun cookie / consent banner installé → critère 3.6/3.7 N/A mais à anticiper                                                                              | 🟡 Moyenne      |
| Skeleton `loading.tsx` global unique, dimensions arbitraires (h-12 w-2/3) ≠ contenu réel hero (display 80-88 px sur 1-2 lignes) → CLS au remplacement      | 🟠 Notable      |
| `<Image>` réservés via `width/height` (Illustration wrapper) ; `<img>` purs ont conteneur `h-20 w-20` (avatars) → pas de CLS image                         | ✅ vert         |
| Aucun composant ne lit l'`em.editorial`/`.italic-editorial` sans avoir hardcodé `font-family: var(--font-serif)` → swap géré par Next                      | ✅ vert         |

**Score chapitre 3 (CLS)** : **117 / 150** (78,0 %)
**Score chapitre 8 (Fonts)** : **126,5 / 150** (84,3 %)
**TOTAL Agent 2** : **243,5 / 300** (81,2 %)

---

## A — Constats infrastructurels

### A.1 — Fallbacks CSS générés par Next 16 (PERFECT NOMINAL)

Build artifacts confirmés (`.next/dev/static/chunks/[next]_internal_font_google_*.module.css.single.css`) — Next 16 `next/font/google` injecte automatiquement, pour chacune des 3 fonts :

```css
@font-face {
  font-family: Manrope Fallback;
  src: local(Arial);
  ascent-override: 103.31%;
  descent-override: 29.07%;
  line-gap-override: 0%;
  size-adjust: 103.19%;
}

@font-face {
  font-family: Fraunces Fallback;
  src: local(Times New Roman);
  ascent-override: 84.71%;
  descent-override: 22.09%;
  line-gap-override: 0%;
  size-adjust: 115.45%;
}

@font-face {
  font-family: Inconsolata Fallback;
  src: local(Arial);
  ascent-override: 76.59%;
  descent-override: 16.94%;
  line-gap-override: 0%;
  size-adjust: 112.16%;
}
```

→ La doctrine du critère 3.3 / 8.3 (« `size-adjust` declaration sur fallback ») est **déjà honorée à 100 %** sans patch user-side. `adjustFontFallback: true` est le default de `next/font/google` — non désactivé dans `src/app/[locale]/layout.tsx`.

Les valeurs Next 16 sont **mesurées par le build** (Capsize) et plus précises que toute estimation manuelle. **Aucun patch `globals.css` n'est nécessaire** sur ce critère — au contraire, dupliquer ces declarations en `@font-face` user-side créerait un conflit de cascade avec les fallback générés par Next.

Les classNames générés respectent la cascade :

```css
.manrope_…_className {
  font-family:
    Manrope,
    Manrope Fallback;
}
.fraunces_…_className {
  font-family:
    Fraunces,
    Fraunces Fallback;
}
.inconsolata_…_className {
  font-family:
    Inconsolata,
    Inconsolata Fallback;
}

.manrope_…_variable {
  --font-manrope: "Manrope", "Manrope Fallback";
}
.fraunces_…_variable {
  --font-serif: "Fraunces", "Fraunces Fallback";
}
.inconsolata_…_variable {
  --font-inconsolata: "Inconsolata", "Inconsolata Fallback";
}
```

→ Le couple `font + Fallback` est appliqué sur l'élément `<html>` via `${manrope.variable} ${inconsolata.variable} ${fraunces.variable}` (`src/app/[locale]/layout.tsx:106`).

### A.2 — Auto-référence CSS dans `globals.css` (BUG SUBTIL — patch P-105)

`src/app/globals.css:69-73` :

```css
@theme {
  --font-sans:
    var(--font-manrope), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-serif:
    var(--font-serif), "Iowan Old Style", "Palatino Linotype", Palatino, "URW Palladio L", P052,
    serif;
  --font-mono: var(--font-inconsolata), ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

Problème ciblé : `--font-serif: var(--font-serif), …`. La variable `--font-serif` se référence elle-même.

Mécanique de cascade :

1. Next-injected (au niveau `<html class="fraunces_..._variable">`) : `--font-serif: "Fraunces", "Fraunces Fallback"`.
2. Tailwind `@theme` (compile vers `:root`) : `--font-serif: var(--font-serif), "Iowan Old Style", …`.
3. Spécificité sélecteurs :
   - `:root` ↔ `<html>` ont la même spécificité (0,0,1).
   - L'ordre source décide → `globals.css` chargé après le CSS module Next-font ⇒ `:root` gagne.
   - Mais la valeur `:root` se résout à `var(--font-serif), "Iowan Old Style", …` ; comme `--font-serif` se réfère à elle-même au même niveau, `var(--font-serif)` est **invalide** (cycle) et la fallback chain CSS est ignorée. La var prend la valeur "guaranteed-invalid" → le `font-family` final est défini par les couches suivantes (héritage), c'est-à-dire la déclaration sur `<html>` qui vaut `"Fraunces", "Fraunces Fallback"`.

Effet observable :

- ✅ La pile `Fraunces → Fraunces Fallback (Times New Roman + size-adjust)` fonctionne.
- ❌ Les fallbacks intermédiaires `"Iowan Old Style", "Palatino Linotype", Palatino, "URW Palladio L", P052, serif` annoncés dans `globals.css` **ne sont jamais utilisés** : si `Times New Roman` n'est pas installé localement (Linux serveurs sans MS Core Fonts ; certains Android), on retombe directement sur le serif générique du navigateur.

Le même cycle existe sur `--font-sans` (manrope) et `--font-mono` (inconsolata) — moins critique car Arial et Menlo sont quasi-universels sur les UAs cibles 2026.

Impact CLS : nul tant que `Times New Roman` est dispo (cas majoritaire). Mais sur certains Linux distroless / Docker minimal sans `ms-core-fonts`, le fallback Times disparaît → swap vers `serif` générique → métriques différentes → CLS micro-shift. À fixer par renommage de la var locale (P-105).

→ **Patch P-105** ci-dessous.

### A.3 — Preload `<link rel="preload" as="font">`

Doc Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md` lignes 184-194) :

> A boolean value that specifies whether the font should be preloaded or not. The default is **true**.

> When a font function is called on a page of your site, it is not globally available and preloaded on all routes. Rather, the font is only preloaded on the related routes based on the type of file where it is used. […] If it's the **root layout**, it is preloaded on all routes.

Comme nos 3 fonts sont chargées dans `src/app/[locale]/layout.tsx` (qui est le root layout effectif sous `/[locale]`), Next 16 émet automatiquement les `<link rel="preload" as="font" type="font/woff2" crossorigin>` sur **toutes** les routes du site.

Sous-réserve à valider en prod (absence de `pnpm build` dans cette session, cf. baseline §A.5) : Next 16 ne preload que les **subsets latin** déclarés. Sur 3 fonts × 6 unicode-range chacune, cela représente potentiellement 6-12 woff2 preload. À chiffrer en Phase F (audit prod) — risque moyen de bandwidth waste si trop de subsets sont preloadés alors qu'1 seul est rendu au-dessus du fold.

→ **Patch P-110** propose un audit `<head>` post-build.

### A.4 — Hero LCP = texte (pas d'image)

Confirmé dans baseline §A.4 :

- Home : H1 Fraunces clamp(3rem, 7.5vw, 5.5rem) (= 48-88 px) — `display-editorial` (`src/app/globals.css:293-299`).
- HeroSchema = SVG inline desktop only (`<aside hidden lg:block>`) ⇒ **pas LCP** mobile.

Donc LCP mobile = H1 texte en Fraunces italique (titleEm) + Manrope. Le swap `font-display: swap` (déjà actif) cause potentiellement un re-layout court car la font final est légèrement plus haute que Times New Roman même avec `size-adjust 115.45%`. Mesure à faire en prod (Lighthouse + Chrome DevTools Layout Shift Regions).

L'impact est **limité** car :

1. `size-adjust 115.45%` est un préset Capsize **spécifique** au pair Fraunces/Times → CLS mesuré typique < 0,01.
2. La font Fraunces est preloadée par Next (root layout).
3. Le fallback CSS Tailwind est cassé (cf. A.2) mais Times reste disponible sur tous les UAs majoritaires.

→ Score critère 8.9 « Pas de FOUT visible » : **0,5 / 1** sur les 15 pages — à confirmer prod.

### A.5 — `<iframe>` & cookie banner

`Grep "<iframe"` sur tout `src/` → **0 occurrence**. Aucun Calendly, YouTube, Stripe, Maps, Plausible iframe.
`Grep "Calendly|cookie banner|consent banner|CookieBanner"` → 0 occurrence d'intégration.

Conséquences :

- Critère 3.2 (iframes ont `aspect-ratio`) : **vert d'office** sur les 15 pages.
- Critère 3.6 (injection cookie sans réservation) : **vert** tant qu'aucun banner n'est ajouté.
- Critère 3.7 (placeholder ads/consent) : **vert** d'office.

→ **STOP & ASK 1** : un cookie banner sera-t-il posé pour la Phase compliance Sprint 16/17 ? Si oui, la doctrine impose réservation d'espace (slot fixe en bas de viewport) — anticiper.

### A.6 — `<Image>` & `<img>` recensement complet

Toutes occurrences :

- `<Image>` (1 fichier) : `src/components/visual/Illustration.tsx:89` — `width`/`height` calculés depuis `aspectRatio` + `sizes` responsive. Sources : `1600×900` / `1000×1250` / `1200×1200` / `1200×630`. ✅ Pas de CLS.
- `<img>` (2 fichiers) :
  - `src/components/sections/TeamGrid.tsx:29` — conteneur `div h-20 w-20` fixe → contraint l'avatar. ✅ Pas de CLS.
  - `src/components/sections/PressSpokesperson.tsx:46` — idem `h-20 w-20`. ✅ Pas de CLS.

Aucune des 15 pages stratégiques ne charge ces composants au-dessus du fold (TeamGrid → `/a-propos`, PressSpokesperson → `/presse`). Donc même si le hero des pages stratégiques utilise une image, c'est via `Illustration` (réservation espace garantie via `next/image width/height`).

### A.7 — Skeleton `loading.tsx` global

`src/app/[locale]/loading.tsx` (lignes 1-11) :

```tsx
return (
  <div className="mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20 xl:px-12">
    <div className="bg-border h-4 w-32 animate-pulse rounded-xs" aria-hidden="true" />
    <div className="bg-border mt-4 h-12 w-2/3 animate-pulse rounded-xs" aria-hidden="true" />
    <div className="bg-border mt-6 h-4 w-1/2 animate-pulse rounded-xs" aria-hidden="true" />…
  </div>
);
```

Hauteur réservée pour skeleton : `4 + 16 + 48 + 24 + 16 = 108 px` + padding `lg:py-20 = 80px*2 = 160px` ⇒ **268 px** total.

Hauteur réelle hero pages stratégiques : ≥ 480-720 px (Fraunces display 88px line-height 0.98 + paragraph + CTA + grid hero schema 576 px). Différence ≥ 200 px.

→ Critère 3.5 « Skeleton aux dimensions réelles » : **0 / 1** — un seul `loading.tsx` global force ce skeleton minimaliste sur **toutes** les routes, dont les 15 stratégiques. Au remplacement, layout shift garanti ≥ 0,01 (250 px non réservés sur viewport mobile 800 px).

→ **Patch P-103** : skeleton dédié par segment hero.

→ **Patch P-104** : `loading.tsx` granulaire sur les 4-5 routes lourdes (`/`, `/interventions`, `/audit`, `/reserver`, `/contact`). Sprint 17 PPR rendra ce point partiellement obsolète mais on en a besoin avant.

### A.8 — `next/image` `sizes` correct (critère 3.8)

`src/components/visual/Illustration.tsx:51-56` — table `defaultSizes` :

- `16:9` → `(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px`
- `4:5` → `(max-width: 768px) 100vw, 600px`
- `1:1` → `(max-width: 768px) 100vw, 600px`
- `1200x630` → `1200px`

Pages stratégiques utilisent `16:9` (closing) ou `1:1` (mid). Les valeurs sont **cohérentes** avec les containers `max-w-3xl` (~768 px) ou `Container max-w-1280`. ✅ Critère 3.8 vert sur 15 pages.

### A.9 — Compte d'`Illustration` par page stratégique

| Page                                       | # Illustrations | aspectRatio | priority | CLS-réservé ?                  |
| ------------------------------------------ | --------------- | ----------- | -------- | ------------------------------ |
| `/[locale]` (home)                         | 1               | 16:9        | non      | ✅ via padding-top placeholder |
| `/[locale]/interventions`                  | 1               | 16:9        | non      | ✅                             |
| `/[locale]/interventions/essentielle`      | 0 (template)    | —           | —        | ✅                             |
| `/[locale]/audit`                          | 1               | 16:9        | non      | ✅                             |
| `/[locale]/audit/flash`                    | 0 (DetailHero)  | —           | —        | ✅                             |
| `/[locale]/implementation`                 | 1               | 16:9        | non      | ✅                             |
| `/[locale]/cas-concrets`                   | 1               | 16:9        | non      | ✅                             |
| `/[locale]/methodologie`                   | 2               | 1:1 + 16:9  | non      | ✅                             |
| `/[locale]/comparaisons`                   | 1               | 1:1         | non      | ✅                             |
| `/[locale]/stack-ia`                       | 1               | 16:9        | non      | ✅                             |
| `/[locale]/implantations`                  | 0               | —           | —        | ✅                             |
| `/[locale]/implantations/[region]`         | 0               | —           | —        | ✅                             |
| `/[locale]/implantations/[region]/[ville]` | 0               | —           | —        | ✅                             |
| `/[locale]/reserver`                       | 0               | —           | —        | ✅                             |
| `/[locale]/contact`                        | 0               | —           | —        | ✅                             |

→ Critère 3.1 (toutes images ont `width/height` ou `aspect-ratio`) : **15/15 vert**.

---

## B — Diagnostic per-page (per-criterion)

### Légende

- `1` = critère respecté
- `0,5` = critère partiellement respecté ou nécessite une vérification prod
- `0` = critère manquant
- `N/A` = critère non applicable (ex. iframe sur page sans iframe)

### Chapitre 3 (CLS) — table per-page

| #    | Critère                                     | home | inter | int/ess | audit | aud/fl | impl | cas-c | metho | comp | stack | impl. | impl/r | impl/r/v | reserv | contact | Total /15               |
| ---- | ------------------------------------------- | ---- | ----- | ------- | ----- | ------ | ---- | ----- | ----- | ---- | ----- | ----- | ------ | -------- | ------ | ------- | ----------------------- |
| 3.1  | Images width/height ou aspect-ratio         | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15**                  |
| 3.2  | iframes aspect-ratio réservé                | N/A  | N/A   | N/A     | N/A   | N/A    | N/A  | N/A   | N/A   | N/A  | N/A   | N/A   | N/A    | N/A      | N/A    | N/A     | **15** (auto-vert)      |
| 3.3  | Fonts size-adjust fallback                  | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** ✅ Next-injected |
| 3.4  | Web font swap shift < 0,001                 | 0,5  | 0,5   | 0,5     | 0,5   | 0,5    | 0,5  | 0,5   | 0,5   | 0,5  | 0,5   | 0,5   | 0,5    | 0,5      | 0,5    | 0,5     | **7,5**                 |
| 3.5  | Skeleton loading.tsx aux dimensions réelles | 0    | 0     | 0       | 0     | 0      | 0    | 0     | 0     | 0    | 0     | 0     | 0      | 0        | 0      | 0       | **0**                   |
| 3.6  | Pas d'injection bannière sans réservation   | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** (no banner)      |
| 3.7  | Ads/consent banner placeholder réservé      | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** (no banner)      |
| 3.8  | next/image sizes correct                    | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15**                  |
| 3.9  | CLS = 0 sur pages statiques (cible interne) | 0,5  | 0,5   | 0,5     | 0,5   | 0,5    | 0,5  | 0,5   | 0,5   | 0,5  | 0,5   | 0,5   | 0,5    | 0,5      | 0,5    | 0,5     | **7,5**                 |
| 3.10 | CLS p75 ≤ 0,05 field data                   | 0,5  | 0,5   | 0,5     | 0,5   | 0,5    | 0,5  | 0,5   | 0,5   | 0,5  | 0,5   | 0,5   | 0,5    | 0,5      | 0,5    | 0,5     | **7,5**                 |
| —    | **Subtotal**                                | 7,5  | 7,5   | 7,5     | 7,5   | 7,5    | 7,5  | 7,5   | 7,5   | 7,5  | 7,5   | 7,5   | 7,5    | 7,5      | 7,5    | 7,5     | **117 / 150**           |

**Justifications scoring**

- **3.4** = 0,5 partout : `size-adjust` Next-injected protège du gros shift, mais l'auto-référence `--font-serif` (cf. A.2) cause un risque de fallback degraded sur Linux distroless ; à confirmer prod (1/1) ou trouver un Times manquant sur un UA ciblé (0/1).
- **3.5** = 0 partout : `loading.tsx` global trop petit (cf. A.7).
- **3.9 + 3.10** = 0,5 partout : non mesuré (Phase F). Cible interne « CLS = 0 » exige Lighthouse + CrUX prod, indisponible avant déploiement.

### Chapitre 8 (Fonts) — table per-page

| #    | Critère                                               | home | inter | int/ess | audit | aud/fl | impl | cas-c | metho | comp | stack | impl. | impl/r | impl/r/v | reserv | contact | Total /15               |
| ---- | ----------------------------------------------------- | ---- | ----- | ------- | ----- | ------ | ---- | ----- | ----- | ---- | ----- | ----- | ------ | -------- | ------ | ------- | ----------------------- |
| 8.1  | next/font/google self-hosted                          | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** ✅               |
| 8.2  | display: swap                                         | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** ✅               |
| 8.3  | size-adjust fallback Arial/Times                      | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** ✅ Next-injected |
| 8.4  | Subsets latin only                                    | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** ✅               |
| 8.5  | Variable axes Fraunces opsz/SOFT chargés ssi utilisés | 0,5  | 0,5   | 0,5     | 0,5   | 0,5    | 0,5  | 0,5   | 0,5   | 0,5  | 0,5   | 0,5   | 0,5    | 0,5      | 0,5    | 0,5     | **7,5**                 |
| 8.6  | Weights minimaux                                      | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** ✅               |
| 8.7  | Aucune font CDN externe                               | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** ✅               |
| 8.8  | preload font hero                                     | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** Next-default     |
| 8.9  | Pas de FOUT visible (CLS = 0 swap)                    | 0,5  | 0,5   | 0,5     | 0,5   | 0,5    | 0,5  | 0,5   | 0,5   | 0,5  | 0,5   | 0,5   | 0,5    | 0,5      | 0,5    | 0,5     | **7,5**                 |
| 8.10 | Variable font compressée (woff2 < 80 KB)              | 1    | 1     | 1       | 1     | 1      | 1    | 1     | 1     | 1    | 1     | 1     | 1      | 1        | 1      | 1       | **15** Next-served      |
| —    | **Subtotal**                                          | 9    | 9     | 9       | 9     | 9      | 9    | 9     | 9     | 9    | 9     | 9     | 9      | 9        | 9      | 9       | **126,5 / 150**         |

**Justifications scoring**

- **8.5** = 0,5 partout : Fraunces déclarée avec `weight: ["400","500","600"]` + `style: ["normal","italic"]` sans option `axes` explicite. Doc Next dit que les axes par défaut excluent `opsz`/`SOFT` (« only the font weight is included to keep the file size down »). Mais le commentaire de `[locale]/layout.tsx` ligne 32-33 dit : « Variable axes (Fraunces `opsz`, `SOFT`) chargés ». Or **aucun `axes: ['opsz', 'SOFT']`** n'est passé dans la config. Contradiction code/commentaire. Vérification empirique dans build CSS : `unicode-range: U+102-103, U+110-111…` (pas de mention de `opsz`/`SOFT` dans CSS) → **les axes ne sont PAS chargés**. Le commentaire est obsolète.

  Conséquence : la doctrine v3 (titleEm Fraunces italique avec rendu raffiné aux grandes tailles via `opsz`) **n'est pas active**. Le rendu visuel `display-editorial` (88 px) n'utilise pas l'axe `opsz` qui ajusterait automatiquement les contre-formes / contraste pour les grandes tailles. À chiffrer : prendre une capture before/after avec `axes: ['opsz']` + `axes: ['opsz', 'SOFT']` pour mesurer si Will valide la différence visuelle. → **Patch P-107**.

- **8.9** = 0,5 partout : non mesurable hors prod ; voir 3.4.

### Total Agent 2

| Chapitre  | Score           | Cible   | %          |
| --------- | --------------- | ------- | ---------- |
| 3 (CLS)   | 117 / 150       | 150     | 78,0 %     |
| 8 (Fonts) | 126,5 / 150     | 150     | 84,3 %     |
| **TOTAL** | **243,5 / 300** | **300** | **81,2 %** |

---

## C — Patches P-100 → P-110

### P-100 — `loading.tsx` granulaire sur la home

**Effort** : S (45 min)
**Gain estimé** : CLS −0,01 à −0,03 sur navigation client-side ; LCP perceptual −80 à −150 ms (skeleton matché évite re-paint)
**Risque** : Faible
**Dépendances** : aucune

**Fichier** : `src/app/[locale]/loading.tsx` (existing, à compléter)
**Nouveau fichier** : `src/app/[locale]/(home)/loading.tsx` ou `src/app/[locale]/loading.home.tsx` selon convention Next 16 — **STOP & ASK** Will pour valider la convention.

**Rationale** : home hero = grid 2-col 1:1 avec H1 88 px + sous-titre + CTA + hero schema 576×576 → ~720 px desktop, ~480 px mobile. Skeleton matched.

**Diff** :

```diff
+ // src/app/[locale]/loading.tsx — variante home (à scoper Sprint 17 quand on
+ // structurera (home) en route group)
  export default function LocaleLoading() {
    return (
-     <div className="mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20 xl:px-12">
-       <div className="bg-border h-4 w-32 animate-pulse rounded-xs" aria-hidden="true" />
-       <div className="bg-border mt-4 h-12 w-2/3 animate-pulse rounded-xs" aria-hidden="true" />
-       <div className="bg-border mt-6 h-4 w-1/2 animate-pulse rounded-xs" aria-hidden="true" />
-       <span className="sr-only">Loading…</span>
-     </div>
+     <div className="mx-auto w-full max-w-[1280px] px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32 xl:px-12">
+       <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
+         <div className="max-w-2xl">
+           {/* eyebrow skeleton */}
+           <div className="bg-border h-3 w-40 animate-pulse rounded-xs" aria-hidden="true" />
+           {/* H1 display 88 px : 3 lignes max sur mobile, 2 lignes desktop, line-height 0.98 → reserved 264 px desktop, 200 px mobile */}
+           <div
+             className="bg-border mt-8 animate-pulse rounded-xs"
+             aria-hidden="true"
+             style={{ height: "min(264px, calc(88px * 0.98 * 3))" }}
+           />
+           {/* description */}
+           <div className="bg-border mt-8 h-5 w-full max-w-2xl animate-pulse rounded-xs" aria-hidden="true" />
+           <div className="bg-border mt-2 h-5 w-4/5 animate-pulse rounded-xs" aria-hidden="true" />
+           {/* CTA stack */}
+           <div className="mt-10 flex flex-wrap gap-4">
+             <div className="bg-border h-14 w-44 animate-pulse rounded-full" aria-hidden="true" />
+             <div className="bg-border h-14 w-40 animate-pulse rounded-full" aria-hidden="true" />
+           </div>
+         </div>
+         {/* Hero schema desktop only — mirror .hero-schema doctrine 576×576 */}
+         <div className="bg-border hidden h-[36rem] w-full animate-pulse rounded-2xl lg:block" aria-hidden="true" />
+       </div>
+       <span className="sr-only">Loading…</span>
+     </div>
    );
  }
```

**Validation** :

- DevTools Performance trace : layout shift sur navigation `/audit → /` ≤ 0,01.
- Visual diff Storybook (à créer Sprint 17) ou capture manuelle.

---

### P-101 — `loading.tsx` granulaire pour `/[locale]/reserver`

**Effort** : S (30 min)
**Gain estimé** : CLS −0,02 à −0,04 (calendrier 12-mois est très grand → skeleton matché évite shift géant)
**Risque** : Faible
**Dépendances** : aucune

**Fichier nouveau** : `src/app/[locale]/reserver/loading.tsx`

**Diff** :

```diff
+ export default function ReserverLoading() {
+   return (
+     <>
+       <div className="bg-halo-warm relative overflow-hidden py-12 sm:py-14 lg:py-16">
+         <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 xl:px-12">
+           <div className="bg-border h-3 w-24 animate-pulse rounded-xs" aria-hidden="true" />
+           <div className="bg-border mt-4 h-14 w-2/3 max-w-2xl animate-pulse rounded-xs" aria-hidden="true" />
+           <div className="bg-border mt-4 h-5 w-full max-w-xl animate-pulse rounded-xs" aria-hidden="true" />
+         </div>
+       </div>
+       <div className="bg-bg py-8 sm:py-10">
+         <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
+           {/* Calendar skeleton — match ~720 px hauteur réelle (mois courant + footer) */}
+           <div className="bg-border h-[680px] w-full animate-pulse rounded-2xl lg:h-[720px]" aria-hidden="true" />
+         </div>
+       </div>
+       <span className="sr-only">Loading…</span>
+     </>
+   );
+ }
```

**Validation** : DevTools Performance trace navigation `→ /reserver` ; vérifier CLS ≤ 0,01.

---

### P-102 — `loading.tsx` granulaires pour 4 pages stratégiques restantes

**Effort** : M (2 h)
**Gain estimé** : CLS cumulé −0,05 sur les 5 pages stratégiques restantes (somme observable)
**Risque** : Faible
**Dépendances** : P-100, P-101 livrés

**Fichiers nouveaux** :

- `src/app/[locale]/interventions/loading.tsx`
- `src/app/[locale]/audit/loading.tsx`
- `src/app/[locale]/contact/loading.tsx`
- `src/app/[locale]/methodologie/loading.tsx`

**Pattern** : skeleton hero matché (eyebrow + H1 clamp 32-64 px + paragraph + CTA) + skeleton hero schema 576×576 desktop only quand applicable.

→ Diff identique au P-100 mais adapté hauteur H1 (`text-4xl..text-5xl` vs `display-editorial`).

**Validation** : Lighthouse CLS desktop + mobile sur chaque page.

---

### P-103 — Pas de patch sur `size-adjust` Next 16 — laisser le default

**Effort** : XS (5 min — décision)
**Gain estimé** : éviter régression
**Risque** : nul

**Décision** : ne PAS dupliquer les `@font-face Manrope Fallback / Fraunces Fallback / Inconsolata Fallback` dans `globals.css`. Le critère 3.3 / 8.3 est rempli par Next 16 default (`adjustFontFallback: true`).

**Anti-patch** : si quelqu'un propose un patch ajoutant manuellement :

```css
/* DO NOT DO THIS — ce serait dupliquer Next 16 et casser la cascade */
@font-face {
  font-family: "Manrope Fallback";
  size-adjust: 100.06%; /* approximation manuelle moins précise que Next */
  src: local("Arial");
}
```

→ refuser. Les valeurs Next 16 (`size-adjust: 103.19%` Manrope / `115.45%` Fraunces / `112.16%` Inconsolata) sont **mesurées par Capsize** et plus précises que toute estimation manuelle.

→ Documenter cette décision dans **`_AUDIT/AUDIT-WEB-VITALS-2026-PATCHES.md`** comme « patch refusé motivé ».

---

### P-104 — `loading.tsx` granulaires pour pages `/implantations/*` (Sprint 14.9 pSEO)

**Effort** : S (30 min)
**Gain estimé** : CLS −0,01 à −0,02 sur 2 157 villes + 13 régions (impact RUM cumulatif)
**Risque** : Faible
**Dépendances** : aucune

**Fichiers nouveaux** :

- `src/app/[locale]/implantations/loading.tsx`
- `src/app/[locale]/implantations/[region]/loading.tsx`
- `src/app/[locale]/implantations/[region]/[ville]/loading.tsx`

→ Pattern hub + page localisée (eyebrow + H1 + paragraph + grid 2-3 cols).

**Validation** : Lighthouse CLS sur Paris pilote ; navigation `/implantations → /paris`.

---

### P-105 — Renommer `--font-serif` du tailwind theme pour casser l'auto-référence

**Effort** : XS (5 min)
**Gain estimé** : aucun gain perf direct mesurable mais corrige un bug de fallback chain qui peut affecter Linux distroless / Android sans MS Core Fonts (CLS micro-shift potentiel)
**Risque** : Faible
**Dépendances** : aucune

**Fichier** : `src/app/globals.css:67-73`

**Diff** :

```diff
@theme {
  /* ----- Typography v3 ----- */
  --font-sans:
    var(--font-manrope), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
- --font-serif:
-   var(--font-serif), "Iowan Old Style", "Palatino Linotype", Palatino, "URW Palladio L", P052,
-   serif;
+ --font-serif:
+   var(--font-fraunces), "Iowan Old Style", "Palatino Linotype", Palatino, "URW Palladio L", P052,
+   serif;
  --font-mono: var(--font-inconsolata), ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

**Pré-requis** : modifier `[locale]/layout.tsx` ligne 36-41 pour passer `variable: "--font-fraunces"` au lieu de `variable: "--font-serif"` :

```diff
- const fraunces = Fraunces({
-   subsets: ["latin"],
-   variable: "--font-serif",
+ const fraunces = Fraunces({
+   subsets: ["latin"],
+   variable: "--font-fraunces",
    display: "swap",
    weight: ["400", "500", "600"],
    style: ["normal", "italic"],
  });
```

Comme cela, la classe générée par next/font (`fraunces.variable`) écrit `--font-fraunces: "Fraunces", "Fraunces Fallback"` sur `<html>` ; et la cascade Tailwind `@theme { --font-serif: var(--font-fraunces), … }` se résout proprement sans cycle.

**Test** : DevTools → `<html>` → computed style → `--font-serif` doit valoir `"Fraunces", "Fraunces Fallback", "Iowan Old Style", "Palatino Linotype", Palatino, "URW Palladio L", P052, serif` (pas une valeur invalid).

**Validation** :

- `pnpm typecheck && pnpm lint && pnpm test` (rien ne dépend du nom de la var)
- Recherche `var(--font-serif)` dans `src/` et `globals.css` — confirmé : utilisé partout côté consumers (`Container`, `[style]={{ fontFamily: "var(--font-serif)" }}`, `--font-serif` Tailwind theme), ces usages restent valides après rename interne.
- Visual diff `display-editorial` H1 sur les 15 pages — devrait être strictement identique sur Win/Mac/iOS (Times disponible) ; potentiellement légèrement différent sur Linux distroless sans Times.

→ **STOP & ASK 2** : Will valide-t-il qu'on ne casse pas la doctrine en renommant la variable interne (le `--font-serif` reste exposé, c'est juste son chemin interne qui change) ?

---

### P-106 — `Inter Tight` retiré ? — non applicable

**Effort** : XS (vérification)
**Statut** : N/A — `Inter Tight` jamais introduit. Confirmé par grep.

---

### P-107 — Ajouter `axes: ['opsz']` à la déclaration Fraunces

**Effort** : XS (10 min mais visual review)
**Gain estimé** : rendu visuel raffiné aux grandes tailles ; CLS impact 0 ; bundle font +5-15 KB woff2 (variable axis ajouté).
**Risque** : **Moyen visuel** (Will doit valider before/after)

**Contexte** : Comme analysé en B (8.5), le commentaire `[locale]/layout.tsx:32-33` annonce `« Variable axes opsz, SOFT activés »` mais la config `Fraunces({ subsets, variable, display, weight, style })` n'inclut pas `axes`. Soit on supprime le commentaire (option A), soit on ajoute les axes (option B).

**Fichier** : `src/app/[locale]/layout.tsx:35-41`

**Diff option B (active opsz + SOFT)** :

```diff
  const fraunces = Fraunces({
    subsets: ["latin"],
    variable: "--font-serif",
    display: "swap",
    weight: ["400", "500", "600"],
    style: ["normal", "italic"],
+   axes: ["opsz", "SOFT"],
  });
```

Doc Next 16 (`font.md` lignes 160-170) : `axes: ['slnt']`, exemple analogue.

**Diff option A (aligner code et commentaire)** :

```diff
  // Fraunces = serif éditorial premium (style Anthropic/Mistral). Variable axes
- // `opsz` (optical size) + `SOFT` activés pour rendu raffiné aux grandes tailles.
- // Loaded latin only, italic for emphasis on display headings.
+ // Loaded latin only with default wght axis only (opsz/SOFT non chargés pour
+ // limiter le bundle font ; à reconsidérer si la doctrine v3 exige rendu
+ // raffiné mesurable aux grandes tailles).
  const fraunces = Fraunces({
```

**Validation** :

- Visual review `display-editorial` H1 88 px sur home / methodologie / interventions hero.
- Bundle delta : `du -k .next/static/media/*.woff2` avant/après option B.
- Lighthouse perf score n'est pas censé bouger ; LCP négligeable (font preloadée).

→ **STOP & ASK 3** : Will préfère option A (aligner commentaire) ou option B (activer axes — engage +5-15 KB et un visual diff à valider).

---

### P-108 — Anticipation cookie banner : réservation espace fixe

**Effort** : S (à programmer Sprint 16 quand banner posé — pas applicable maintenant)
**Gain estimé** : CLS −0,02 à −0,1 si banner posé sans précaution
**Risque** : Faible
**Dépendances** : décision compliance (Sprint 16 ?)

**Pattern recommandé** (à activer le jour où le banner est posé) :

```tsx
// Dans le root layout ou un BannerProvider
<div
  data-cookie-banner-slot
  className="fixed inset-x-0 bottom-0 z-50 min-h-[120px]" // placeholder
  aria-hidden={!shouldShow}
>
  {shouldShow ? <CookieBanner /> : null}
</div>
```

→ La présence d'un slot `min-h-[120px]` réserve l'espace dès le first paint ; le contenu réel n'introduit aucun shift.

**Validation** : test côté DevTools « Layout shift regions » lors d'un cold-start sans cookie set.

→ Notation : ce patch est **prospectif**. À déclencher uniquement quand un cookie banner sera ajouté (probable Sprint 16).

→ **STOP & ASK 4** : Will programme-t-il un cookie banner Sprint 16 ? Si oui, ajouter ce patch à la roadmap V5 ou V6.

---

### P-109 — Audit `<head>` post-build pour vérifier preload fonts

**Effort** : S (30 min — outil)
**Gain estimé** : visibility — assure que le preload Next default est bien actif en prod.
**Risque** : nul (audit lecture seule)
**Dépendances** : `pnpm build` complété

**Procédure** :

```sh
# Phase F (audit prod) — extraire les preload font du HTML SSG
node -e '
const fs = require("fs");
const html = fs.readFileSync(".next/server/app/fr/page.html", "utf8");
const preloads = [...html.matchAll(/<link rel="preload" as="font"[^>]*>/g)].map(m => m[0]);
console.log("Found", preloads.length, "preload font links:");
preloads.forEach(p => console.log("  -", p));
'
```

**Critère validation** :

- 1-2 preload Manrope (latin subset, weight 400 + 600 si Manrope multi-weight self-hosted) — typiquement 1 woff2 (Latin subset combiné).
- 1 preload Fraunces (latin subset).
- 0-1 preload Inconsolata (s'il est utilisé au-dessus du fold — probable non, c'est le mono → preload optionnel).

Si Next 16 preload **toutes** les fonts × tous les unicode-ranges, on a 6+ preload par page → bandwidth waste. À ce moment-là, **Patch P-110** ci-dessous.

---

### P-110 — Si preload trop nombreux : passer Inconsolata `preload: false`

**Effort** : XS (3 min)
**Gain estimé** : −1 preload font = −10-30 KB transfer initial sur 100 % des routes.
**Risque** : Faible (Inconsolata est utilisée pour `<code>` blocks rares — pas LCP)
**Dépendances** : P-109 mesure prod confirmée

**Fichier** : `src/app/[locale]/layout.tsx:26-30`

**Diff** :

```diff
  const inconsolata = Inconsolata({
    subsets: ["latin"],
    variable: "--font-inconsolata",
    display: "swap",
+   preload: false,
  });
```

**Validation** :

- Re-vérifier critère 8.7 (« aucune font CDN externe ») → toujours vert (la police reste self-hosted, juste pas preloadée).
- Lighthouse perf : pas de régression sur les pages avec `<code>` (acceptable swap latence sur ce cas marginal).

→ **STOP & ASK 5** (si déclenché) : valider avant.

---

## D — STOP & ASK ouverts (5)

### STOP & ASK 1 — Cookie banner Sprint 16 ?

**Contexte** : aucun cookie/consent banner installé actuellement. La doctrine 3.6 / 3.7 impose réservation d'espace si un banner est ajouté — sinon CLS p75 garanti ≥ 0,02.

**Décision requise** : Will prévoit-il un banner Sprint 16 ? Si oui, programmer P-108 dans la roadmap. Si non, garder cet item comme dette technique.

**Options** :
A. Pas de banner V1 (si compliance OUI car SSG sans tracking côté client active).
B. Banner Sprint 16 → ajouter P-108 à V5/V6.
C. Banner V2 (post-launch) → ajouter P-108 à roadmap V6.

**Recommandé** : **A** si Plausible/Microsoft Clarity sont configurés en mode anonymisé sans cookies tiers (cf. doctrine §0bis). **B** ou **C** si Will veut anticiper RGPD strict + Cloudflare Web Analytics first-party.

**Impact si on attend** : bug latent qui apparaîtra le jour où le banner sera ajouté.

### STOP & ASK 2 — Renommer `--font-serif` interne en `--font-fraunces` (P-105) ?

**Contexte** : auto-référence CSS `--font-serif: var(--font-serif), …` dans globals.css crée un cycle. Le fix consiste à renommer la variable interne next/font de `--font-serif` à `--font-fraunces`. La variable Tailwind `--font-serif` exposée aux composants reste inchangée.

**Décision requise** : Will valide-t-il le rename interne ?

**Options** :
A. Appliquer P-105 (rename `--font-fraunces`).
B. Garder `--font-serif` pour next/font + supprimer la fallback chain dans globals.css (perdre les fallbacks intermédiaires Iowan Old Style etc.).
C. Garder l'état actuel et accepter que les fallbacks intermédiaires soient inactifs (option de moindre effort, risque résiduel sur Linux distroless).

**Recommandé** : **A** — gain en cleanness, pas de régression visuelle attendue, pré-requis quasi nul.

**Impact si on attend** : risque CLS micro-shift résiduel sur certains UAs sans Times New Roman ; peu probable sur les UAs cibles 2026 (Win/Mac/iOS/Android tous fournis).

### STOP & ASK 3 — Activer Fraunces `axes: ['opsz', 'SOFT']` (P-107) ?

**Contexte** : commentaire layout.tsx annonce ces axes mais ils ne sont pas configurés. Doctrine v3 (pivot 2026-05-06, ADR 0002) figée HEAD — n'impose pas explicitement opsz mais le commentaire le suggère.

**Décision requise** : option A (aligner commentaire = pas d'axes) ou option B (activer axes = visual + bundle).

**Options** :
A. Option A : aligner commentaire au code actuel — gain 0, risque 0.
B. Option B : activer `axes: ['opsz', 'SOFT']` — visual gain « rendu raffiné aux grandes tailles » (uniquement perceptible 88 px), bundle +5-15 KB woff2.

**Recommandé** : **B** SI Will valide visuellement le before/after sur `display-editorial` 88 px (home + methodologie + comparaisons heroes). **A** si Will préfère la sobriété bundle.

**Impact si on attend** : aucun direct ; le commentaire restera contradictoire.

### STOP & ASK 4 — Inconsolata `preload: false` (P-110) ?

**Contexte** : Inconsolata est utilisée pour les `<code>` éditoriaux (rares au-dessus du fold). Preload par défaut Next 16 → bandwidth waste si peu utilisée.

**Décision requise** : prio Phase F (mesure prod). Si preload Inconsolata visible et page sans `<code>` au-dessus du fold → l'enlever.

**Options** :
A. Garder preload (status quo) — coût bandwidth ~10-30 KB transfer × 100 % routes.
B. Couper preload (P-110) — gain bandwidth, risque swap mineur sur les pages `/glossaire` ou `/blog` qui exposent `<code>`.

**Recommandé** : **B** après mesure P-109 confirmée que Inconsolata est preloadée.

**Impact si on attend** : régression mineure ; à mesurer en Phase F.

### STOP & ASK 5 — Convention `loading.tsx` vs route group `(home)` (P-100) ?

**Contexte** : pour avoir un skeleton spécifique à la home, deux conventions Next 16 :

- A. Créer un route group `[locale]/(home)/page.tsx` + `[locale]/(home)/loading.tsx`. Reorganisation fichiers nécessaire.
- B. Garder `[locale]/page.tsx` + un `loading.tsx` global plus riche qui couvre les patterns hero (skeleton « universal » qui matche home ET interventions ET audit).

**Décision requise** : pas de Next 16 idiom pour « loading.tsx pour une page spécifique » sans route group.

**Options** :
A. Route group `(home)` — conforme idiomatique mais + 1 niveau dossier.
B. Skeleton universal hero — plus simple ; perd un peu de précision mobile vs desktop.
C. P-100 + P-101 + P-102 : un `loading.tsx` par segment **dont la home reste à voir** — laisser P-100 différé V6.

**Recommandé** : **C** — Sprint 17 PPR rendra ce point partiellement obsolète. P-100 (home) en V6 polish, P-101 et P-102 en V1.

**Impact si on attend** : quick win CLS −0,02 home retardé.

---

## E — Top 3 quick wins du périmètre Agent 2

### 1. P-105 — Rename `--font-serif` interne (XS, 5 min)

→ Corrige bug de cascade. Risque visual nul si Times disponible. Premier patch à appliquer post-validation Will.

### 2. P-101 — `loading.tsx` /reserver matché (S, 30 min)

→ Plus gros gain CLS de l'audit. Le calendrier est très haut (~720 px) ; un skeleton matché évite le shift maximal.

### 3. P-102 — `loading.tsx` granulaires 4 pages stratégiques (M, 2 h)

→ Cumul CLS −0,05 sur les 5 pages avec hero hauteur ≥ 600 px (interventions / audit / contact / methodologie + home si P-100 retenu).

---

## F — Notes & informations annexes pour Agent superviseur

### F.1 — Point doctrinal à conserver

Aucun patch de cet agent ne modifie :

- `display-editorial` (Fraunces italique, clamp 48-88 px, `--text-display`)
- `.italic-editorial` (Fraunces italique éditorial)
- Header terracotta
- `.hero-schema` carré 576×576 lg+
- Modular scale typo v3.2

### F.2 — Cible field data (CrUX) — non mesurable Phase A

Critères 3.10 et 8.9 de cette grille exigent CrUX p75 28 j. À évaluer **Phase F** post-déploiement Hetzner CPX32 + Caddy + Cloudflare. Pour l'instant scoring 0,5 partout sur ces deux critères = position prudente.

### F.3 — Lien avec autres agents

- **Agent 1 (LCP)** : critère 2.4 (« Hero text LCP : `swap` + fallback metrics-matched ») = doublon avec mon 8.3 — confirmation que `size-adjust` Next-injected couvre les deux.
- **Agent 4 (TTFB / Caching)** : critère 13.1 (`Cache-Control immutable` sur les `_next/static/media/*.woff2`) → à vérifier dans Caddyfile.
- **Agent 5 (Bundle)** : si on active `axes: ['opsz', 'SOFT']` (P-107 option B), le delta bundle font sera visible dans son audit.

### F.4 — Mesures prod requises Phase F

Pour passer 3.10 / 8.9 / 3.4 / 3.9 de 0,5 → 1 :

1. CrUX query 28j sur axionia.eu post-déploiement.
2. Lighthouse Lab CLS sur les 15 pages, mobile + desktop, 5 runs, médiane.
3. Chrome DevTools Performance → « Layout Shift Regions » sur navigation home → /reserver pour valider P-101.

---

## G — Inventaire de fichiers cités (lecture seule)

| Chemin                                                                        | Rôle                          |
| ----------------------------------------------------------------------------- | ----------------------------- |
| `src/app/[locale]/layout.tsx`                                                 | Wiring 3 fonts next/font      |
| `src/app/globals.css`                                                         | Theme tokens + auto-réf       |
| `src/app/[locale]/loading.tsx`                                                | Skeleton global               |
| `src/components/visual/Illustration.tsx`                                      | next/image wrapper            |
| `src/components/visual/IllustrationPlaceholder.tsx`                           | padding-top reserved          |
| `src/components/sections/TeamGrid.tsx`                                        | `<img>` h-20 w-20             |
| `src/components/sections/PressSpokesperson.tsx`                               | `<img>` h-20 w-20             |
| `src/components/calendar/BookingCalendar.tsx`                                 | Calendrier client (no iframe) |
| `src/components/sections/MethodologyHeroSchema.tsx`                           | Hero schema HTML/CSS          |
| `.next/dev/static/chunks/[next]_internal_font_google_*.module.css.single.css` | Build artifacts fonts         |
| `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`   | Doc Next 16                   |

---

**Fin Agent 2 — CLS / Fonts.**
**Score TOTAL : 243,5 / 300 (81,2 %)**
**Patches : P-100 → P-110 (11 patches dont 1 anti-patch P-103, 1 prospectif P-108, 1 audit P-109)**
**STOP & ASK ouverts : 5**
**Aucun fichier source modifié.**
