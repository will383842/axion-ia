# Visual Style Guide — AxionIA Imagerie 2026

> **Version** : 1.0 · 2026-05-07
> **Statut** : DRAFT en attente validation Will
> **Périmètre** : Style guide unifié pour tous les visuels AxionIA (icônes Lucide, SVG inline codés, illustrations GPT-image, photos, diagrammes, OG images Next.js 16 `ImageResponse`).
> **Doctrine de référence** : Editorial Premium Light v3 (cf. `Design.md`, `axionia_design_pivot.md`).
> **Référence palette** : `globals.css` `@theme` block v3.1 (vérifié 2026-05-07).
> **Audience** : Will (utilisateur unique), agents Claude (audits suivants), futurs contributeurs si onboardés.

Ce document est la **source de vérité unique** pour tout asset visuel produit, généré, ou intégré dans AxionIA. Il est **lecture seule pour l'audit en cours** (aucune modif code), mais **prescriptif** pour toutes les sessions de génération GPT-image et d'intégration future.

---

## 1. Palette stricte (hex v3.1 EXACTS — aucune approximation autorisée)

> Tous les visuels AxionIA, qu'ils soient codés (SVG inline / composants React) ou générés (GPT-image / DALL-E 3 / `gpt-image-1`), doivent **exclusivement** utiliser les hex ci-dessous. Aucune approximation type « warm orange » ou « beige clair » n'est admise dans les prompts ou dans les composants. **Toujours citer le hex EXACT** (`#c24a1b`, pas `#c34a1c` ni `~terracotta`).

### 1.1 Backgrounds & surfaces

| Token CSS           | Hex       | Usage autorisé                                                       | Usage interdit                                   |
| ------------------- | --------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| `--color-bg`        | `#faf8f3` | Canvas principal (background page, illustrations editorial fond uni) | Texte, accent, jamais sur élément interactif     |
| `--color-paper`     | `#ffffff` | Cards, modales, fond portrait, OG image fond (option 2)              | Background de page (jamais — utiliser `#faf8f3`) |
| `--color-sand`      | `#f0e9da` | Mid-tones, surfaces secondaires (sections alternées), illustrations  | Texte (contraste insuffisant)                    |
| `--color-sand-deep` | `#e6dcc4` | Variante sand pour layers profonds, ombrage subtil illustrations     | Background massif (lourd visuellement)           |

### 1.2 Mocha (deep tones — JAMAIS noir pur)

| Token CSS            | Hex       | Usage autorisé                                                 | Usage interdit                                    |
| -------------------- | --------- | -------------------------------------------------------------- | ------------------------------------------------- |
| `--color-mocha`      | `#2a2520` | Sections « inversées » fond sombre, headers de cartes premium  | NE JAMAIS substituer à `#000000` ou tout noir pur |
| `--color-mocha-soft` | `#3d362f` | Variante mocha pour sub-sections, ombre profonde illustrations | Texte sur fond clair (utiliser `--color-fg`)      |
| `--color-mocha-fg`   | `#f7f3ea` | Texte sur fond mocha (contraste AA ✓)                          | Background ou accent                              |

### 1.3 Foreground (texte / outlines)

| Token CSS          | Hex       | Usage autorisé                                                    | Usage interdit                                         |
| ------------------ | --------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `--color-fg`       | `#1a1815` | Texte principal, outlines SVG illustrations, stroke icônes Lucide | Background massif, fond illustration                   |
| `--color-fg-soft`  | `#524b41` | Texte secondaire, sous-titres, captions illustrations             | Texte principal (contraste insuffisant pour body long) |
| `--color-fg-muted` | `#6b6155` | Métadonnées, timestamps, labels secondaires diagrammes            | Texte body principal                                   |

### 1.4 Primary blue (Webflow-inspired deep blue)

| Token CSS              | Hex       | Usage autorisé                           | Usage interdit                                              |
| ---------------------- | --------- | ---------------------------------------- | ----------------------------------------------------------- |
| `--color-primary`      | `#1a4dd9` | Accent technique, liens, CTA secondaire  | Sur-utilisation (terracotta reste l'accent principal brand) |
| `--color-primary-soft` | `#e8efff` | Highlight subtle, fond callout technique | Body background (trop froid pour la doctrine warm)          |

### 1.5 Terracotta (accent principal brand — sparingly)

| Token CSS                 | Hex       | Usage autorisé                                                       | Usage interdit                                              |
| ------------------------- | --------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `--color-terracotta`      | `#c24a1b` | Accent CTA primaire, header brand, focus visuel illustrations (≤15%) | Saturation > 15% de la composition (perd son rôle d'accent) |
| `--color-terracotta-soft` | `#f5e3d8` | Highlight backgrounds, éclats subtle illustrations                   | Texte (contraste insuffisant)                               |
| `--color-terracotta-deep` | `#8c3010` | Hover states CTA, ombrage profond illustrations terracotta           | Background massif (lourd, perd la légèreté editorial)       |

### 1.6 Sage (proof / secondary accent)

| Token CSS           | Hex       | Usage autorisé                                                     | Usage interdit                                          |
| ------------------- | --------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| `--color-sage`      | `#5e6c54` | KPI proof (résultats vérifiés), success states, accents diagrammes | Concurrence directe avec terracotta (sage = secondaire) |
| `--color-sage-soft` | `#e6ebe2` | Fonds callout proof, surfaces secondaires sage                     | Texte (contraste insuffisant)                           |

### 1.7 Borders

| Token CSS               | Hex       | Usage autorisé                                                        | Usage interdit                                           |
| ----------------------- | --------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `--color-border`        | `#e5ddc8` | Bordures subtle cards, dividers, hairlines illustrations              | Outline forte (utiliser `--color-fg` ou `--color-mocha`) |
| `--color-border-strong` | `#c8bda0` | Bordures emphatiques, frames screenshots, séparateurs sections fortes | Bordure principale partout (trop visible massivement)    |

### 1.8 Règles de répartition palette dans une illustration GPT-image

Chaque illustration générée doit respecter cette **distribution chromatique cible** (heuristique éditoriale Anthropic/Stripe Press) :

- **Background ivoire `#faf8f3` ou paper `#ffffff`** : 40-60% de la composition (négatif space).
- **Mid-tones sand `#f0e9da` / `#e6dcc4`** : 15-25% (zones secondaires, ombrage).
- **Outlines fg anthracite `#1a1815` ou mocha `#2a2520`** : 10-20% (lignes, contours, silhouettes).
- **Accent terracotta `#c24a1b`** : ≤ 15% MAXIMUM (sinon perd son rôle d'accent — anti-pattern « illustration trop chaude »).
- **Sage `#5e6c54`** : 0-10% (ponctuel, proof / secondary accent).
- **Primary blue `#1a4dd9`** : 0-5% (très ponctuel, pour un accent technique distinct — éviter sur la majorité des illustrations brand-warm).

---

## 2. Système iconographique

### 2.1 Source unique : Lucide React

- **Bibliothèque autorisée** : Lucide React (`lucide-react`), déjà installée (cf. `package.json`).
- **Bibliothèques interdites** : Heroicons, Phosphor, Feather, Material Icons, Tabler, FontAwesome, emoji en visuel principal.
- **Mélange interdit** : un seul système d'icônes sur tout le site.

### 2.2 Style technique standard

Chaque icône Lucide doit respecter :

- `stroke-width: 1.5` (figé pour cohérence — Lucide default est 2, AxionIA override à 1.5 pour rendu plus éditorial).
- `fill: none` (toutes les icônes outline, jamais filled).
- `stroke` : `currentColor` (héritage de la couleur parent — pas de hardcode).
- Tailles autorisées : `size-4` (16px), `size-5` (20px), `size-6` (24px) Tailwind tokens. **Pas de `size-7`+ ni custom px.**

### 2.3 Accessibilité icônes

- **Décoratives** (à côté d'un texte qui dit déjà la chose) : `aria-hidden="true"`.
- **Informatives sans label texte** (icon-only button) : `aria-label="..."` ou `<title>` SVG inline.
- **Toujours** : taille minimale tap target 44x44px (padding du parent button compense la petite icône visuelle).

### 2.4 Cohérence sémantique inter-pages

Un concept = une icône partout. Liste indicative à figer :

| Concept                      | Icône Lucide                                       |
| ---------------------------- | -------------------------------------------------- |
| Audit / diagnostic           | `Stethoscope` ou `Search`                          |
| Cas concret / case study     | `Briefcase`                                        |
| Méthodologie / process       | `Workflow` ou `GitBranch`                          |
| Stack IA / outils            | `Boxes` ou `Layers`                                |
| Implémentation / déploiement | `Rocket` (interdit ici, prendre `Cog` ou `Wrench`) |
| ROI / résultats              | `TrendingUp`                                       |
| Réservation / RDV            | `CalendarCheck`                                    |
| Guide / documentation        | `BookOpen`                                         |
| FAQ / aide                   | `HelpCircle`                                       |
| Presse / médias              | `Newspaper`                                        |
| Contact / message            | `Mail`                                             |
| À propos / fondateur         | `User` (silhouette)                                |
| Comparaison / vs             | `GitCompare`                                       |
| Sécurité / RGPD              | `ShieldCheck`                                      |
| Vitesse / performance        | `Zap` (avec parcimonie — cliché startup si abusé)  |

### 2.5 SVG custom (si Lucide manque)

Si un concept n'a pas d'icône Lucide adéquate, **coder un SVG inline custom** respectant strictement le style Lucide :

- viewBox `0 0 24 24`
- `stroke-width: 1.5`, `stroke-linecap: round`, `stroke-linejoin: round`
- `fill: none`, `stroke: currentColor`
- Composant React typé (`<MyCustomIcon className="size-5" />`)

### 2.6 Animation icônes

- Hover : subtle (translate-y de 1px, ou color transition 150ms ease).
- **Interdit** : spinning permanent, bounce, pulse continu (sauf loading states dûment justifiés).
- Respect `prefers-reduced-motion` : désactiver toute animation décorative.

---

## 3. Style illustration GPT-image (DALL-E 3 / `gpt-image-1`)

### 3.1 Esthétique cible

**Style éditorial vectoriel light desaturated** :

- Inspiration directe : illustrations **Anthropic** (research papers, blog posts) + **Stripe Press** (magazine éditorial) + **Mistral.ai** (palette restreinte vectorielle).
- Qualité légèrement « hand-drawn » (subtile imperfection dans les lignes, pas pixel-perfect mécanique).
- Négatif space généreux : **40-60% de la composition** doit être vide (background ivoire/paper).
- Détail minimal : pas de surcharge, sophistication par retenue.
- Sentiment éditorial papier magazine premium (pas marketing-flashy, pas startup-plat).

### 3.2 Anti-patterns absolus (à bannir des prompts)

- ❌ **Photos stock corporate** : poignée de main, équipe diverse souriante en réunion, mains sur clavier MacBook, pizza partagée open-space — anti-patterns 2026 absolus.
- ❌ **3D isométrique générique** : signal startup 2018, undraw.co/blush.design — incompatible doctrine premium.
- ❌ **Clichés startup** : lightbulbs (idée), rockets (croissance), gears (process), lego blocks (modulaire), neon glow, glowing nodes, network meshes flashy, brain humain en wireframe.
- ❌ **Visages réalistes photographiques** : uncanny valley quasi-systématique, RGPD ambiguë, anti-doctrine. Silhouettes stylisées ou abstractions OK.
- ❌ **Texte intégré dans l'image** : la typographie est gérée en HTML overlay (i18n + a11y + SEO), jamais bakée dans les pixels.
- ❌ **Gradients excessifs ou rainbow palettes** : palette restreinte stricte (cf. § 1).
- ❌ **Photos drone Estonie / bureau Tallinn** si pas authentiques — pas de mensonge visuel.

### 3.3 Composition autorisée

- Silhouettes stylisées (consultant face à un système modulaire, mains qui dessinent, profil de penseur).
- Objets symboliques minimalistes (carnet ouvert, instrument de mesure, pile de papiers structurée, modules abstraits connectés par des hairlines).
- Diagrammes conceptuels narratifs (flow editorial, pas tech-flashy).
- Architecture intérieure éditoriale (pièce minimaliste, table de travail vue de dessus, fenêtre lumineuse).
- Typographie ornementale **uniquement si générée comme forme abstraite** (pas de mots lisibles).

### 3.4 Format technique de sortie

- Aspect ratios autorisés : **16:9** (hero desktop), **1:1** (square universal), **4:5** (portrait éditorial), **1200x630** (OG image — cible Next.js 16 `ImageResponse`).
- Format brut OpenAI : PNG (préférer transparent si fond uni à recadrer).
- Conversion finale : **AVIF** (source primaire) + **WebP** (fallback) via `next/image` build pipeline.
- **Pas de JPEG** (sauf photos hyper-réalistes avec dégradés naturels — quasi jamais).

### 3.5 Contraintes prompt strictes

Tout prompt GPT-image AxionIA doit (cf. **préfixe brand** ci-dessous, § 11) :

1. Citer **les hex EXACTS** v3.1 (`#c24a1b`, `#2a2520`, etc. — jamais d'approximation textuelle).
2. Imposer négatif space ≥ 40%.
3. Imposer accent terracotta ≤ 15% de la composition.
4. Interdire texte intégré dans l'image.
5. Interdire visages photographiques réalistes (silhouettes OK).
6. Interdire 3D isométrique.
7. Interdire clichés startup (lightbulbs, rockets, gears).
8. Référencer Anthropic + Stripe Press comme langage visuel cible.

---

## 4. Style photo

### 4.1 Photo Will (fondateur AxionIA)

**Si Will accepte d'être photographié** :

- **Format** : portrait 1:1 (carré social) ou 4:5 (portrait éditorial vertical).
- **Crop** : centré sur le visage, du haut de la tête au milieu du torse. Pas de plein-corps.
- **Fond** : uni paper `#ffffff` ou ivoire `#faf8f3` ou sand `#f0e9da`. Pas de bureau corporate, pas de bookshelf de fond, pas de mur de briques tendance LinkedIn 2018.
- **Lumière** : naturelle, douce, latérale (north-window light idéale). Pas de studio strobe corporate.
- **Tenue** : éditorial sobre (chemise unie sand/mocha, pull tricoté beige, jamais costume-cravate — anti-doctrine).
- **Filtre warm** : léger filtre warm post-prod pour cohérence palette (température +10, légère désaturation -5). Possible via Lightroom, Photoshop, ou ChatGPT image edit.
- **Anti-patterns** : selfie iPhone, LinkedIn corporate carré générique, visage trop souriant Hollywood-white-teeth, mains croisées sur cuisse posée artificielle.

**Si Will refuse la photo** (alternative — décision STOP & ASK § 7) :

- Portrait illustré GPT-image **silhouette stylisée non-réaliste** (cf. § 3.3).
- Pas de tentative de ressemblance physique exacte (uncanny valley garanti sur visage).
- Naming : `public/portraits/will-illustration.avif` (vs `will-photo.avif` si réelle).

### 4.2 Photos clients (cas-concrets)

- **Jamais sans accord écrit RGPD**.
- Préférence : **illustration GPT-image générique de la fonction** (« silhouette stylisée d'un CFO de PME industrielle ») plutôt que photo réelle ambiguë.
- Si photo réelle : floutage des arrière-plans identifiables (logos murs, vues fenêtres reconnaissables).

### 4.3 Photos lieux (Estonie / OÜ)

- **Aucune photo « bureau Estonie » fictive** : éviter le mensonge visuel sur la nature de l'OÜ (boîte légale, pas siège physique opérationnel — cf. doctrine `axionia_naming_cabinet`).
- Si une photo « contexte Estonie » est nécessaire (page presse, à propos) : préférer photo neutre paysage Tallinn ou architecture éditoriale, sans prétendre que c'est « notre bureau ».

---

## 5. Style diagramme

### 5.1 Principe : tout diagramme = composant React SVG codé

- **Jamais bitmap** pour un diagramme (perd : i18n labels, scalabilité, cohérence palette, SEO).
- **Jamais Mermaid** rendu côté client (bundle weight + style non-doctrine).
- **Toujours** : composant React `.tsx` qui retourne `<svg>` inline avec props paramétrables (labels via i18n).

### 5.2 Style line-art outline

- Toutes les formes : `fill="none"`, `stroke="var(--color-fg)"` ou `var(--color-mocha)`.
- `stroke-width: 1.5` (cohérent Lucide).
- `stroke-linecap: round`, `stroke-linejoin: round`.
- Hachures, ombres, fills uniquement si justifiés (max 1 zone fillée par diagramme).

### 5.3 Palette diagramme

**Maximum 3 couleurs par diagramme** (au-delà = surcharge) :

- 1 outline principal (`#1a1815` fg ou `#2a2520` mocha).
- 1 accent (terracotta `#c24a1b` OU sage `#5e6c54` OU primary `#1a4dd9` — UN seul).
- 1 surface subtle si zones distinctes (sand `#f0e9da` ou primary-soft `#e8efff`).

### 5.4 Labels typographiques

- **Sans-serif** (Manrope déjà chargée via `next/font`) pour body labels diagramme.
- **Serif italique** (Fraunces déjà chargée, utilisée pour `titleEm` brand-coherent) pour les titres de diagramme ou highlights conceptuels.
- Tailles : `text-xs` (12px) labels secondaires, `text-sm` (14px) labels principaux, `text-base` (16px) titre diagramme.
- `fill="currentColor"` sur les `<text>` SVG (héritage couleur parent).

### 5.5 Patterns visuels diagramme autorisés

- **Flow diagram** : étapes process (méthodologie, audit, implémentation).
- **Sankey** : KPI input → résultats output (page ROI).
- **Tree** : taxonomie outils (page stack-ia, comparaisons).
- **Matrix 2x2** : positionnement (comparaisons concurrents).
- **Timeline horizontale** : sprints/jalons (méthodologie, implémentation).
- **Funnel inversé** : conversion / scoring (page audit).
- **Layered architecture** : strates IA (page guide-ia, stack-ia mid-section).

### 5.6 Animation reveal diagramme

- Stagger des éléments à l'entrée viewport (Intersection Observer).
- Durée totale ≤ 1s.
- Easing : `ease-out` ou `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind `ease-out`).
- Respect `prefers-reduced-motion` : skip animation si réduit.

### 5.7 Réutilisabilité

- Créer un composant `<ProcessDiagram steps={...} />` paramétrable (i18n labels en props) plutôt que dupliquer.
- Pattern existant `*HeroSchema*` : à généraliser (cf. `StackHeroSchema.tsx`, `CaseStudiesHeroSchema.tsx` HEAD).

---

## 6. Hiérarchie visuelle

### 6.1 4 niveaux d'imagerie

1. **Hero** (top of page) : 1 visuel impactant maximum par page. Diagramme SVG codé OU illustration GPT-image OU UI screenshot annoté. Aspect ratio paysage 16:9 desktop, vertical responsive mobile.
2. **Section opener** (mid-page) : marqueur visuel pour rythmer (un tous les 1-2 écrans de scroll, ~300-500 mots). Diagramme codé ou illustration GPT-image carrée 1:1.
3. **Inline support** : icône Lucide ou pictogramme inline (taille `size-4` à `size-6`), accompagnant un H3 ou un bullet de liste.
4. **Decorative** : hairlines, dividers, accents subtle (terracotta `#c24a1b` thin line, mocha border `#2a2520` 1px).

### 6.2 Cadence cible

- **Page courte** (< 800 mots) : 1 hero + 1 section opener + icônes inline.
- **Page moyenne** (800-2000 mots) : 1 hero + 2-3 section openers + diagramme central + icônes inline.
- **Page longue** (> 2000 mots, ex: `/methodologie`, `/guide-ia`) : 1 hero + 4-5 section openers + 2 diagrammes denses + closing visuel + icônes inline.

### 6.3 Closing visuel

Souvent oublié, **critique pour conversion**. Avant le CTA final, insérer un visuel de clôture (pull-quote stylisée, KPI chiffre clé géant, micro-illustration récap, diviseur terracotta hairline).

### 6.4 Mobile : ratio adapté

Mobile = besoin de **plus de respiration encore** (écrans plus petits, scroll fatigue plus rapide). Ne pas sous-estimer la cadence visuelle mobile : viser 1 ancrage tous les 2-3 écrans mobile (vs 1-2 desktop).

---

## 7. Cohérence inter-pages

### 7.1 Règle d'or : 1 concept = 1 traitement visuel partout

- Si « audit » est représenté par un diagramme funnel inversé sur `/audit`, il doit être représenté par le même funnel (même style, même couleurs) partout où il apparaît (home, méthodologie, blog, etc.).
- Si Will est représenté en silhouette stylisée sur `/a-propos`, c'est cette silhouette qui apparaît partout (footer auteur, cas-concrets « notre approche », etc.). Pas une variante différente par page.

### 7.2 Pattern HeroSchema généralisé

Chaque page pillier doit avoir son `[Page]HeroSchema.tsx` (composant React SVG diagramme conceptuel). Existants confirmés :

- `StackHeroSchema.tsx` (page `/stack-ia`).
- `CaseStudiesHeroSchema.tsx` (page `/cas-concrets`).
- (autres `*HeroSchema*` à inventorier).

À créer (proposition Sprint visuel) :

- `MethodologyHeroSchema.tsx`
- `AuditHeroSchema.tsx`
- `InterventionsHeroSchema.tsx` (déjà partiel ?)
- `ImplementationHeroSchema.tsx`
- `RoiHeroSchema.tsx`
- `GuideHeroSchema.tsx`

### 7.3 Tone alterné des sections

Pattern existant dans `stack-ia.ts` (`tone: "paper" | "sand" | "halo-warm" | "halo-cool" | "canvas"`). À généraliser : alterner les `tone` des sections d'une page longue pour respiration visuelle (pas 5 sections paper consécutives).

---

## 8. Animation

### 8.1 Principe : subtilité

L'animation AxionIA est **éditoriale, pas spectaculaire**. Elle sert la lisibilité, pas le wow-factor.

### 8.2 Patterns autorisés

- **Fade-in stagger** au scroll (Intersection Observer) : éléments d'une section apparaissent décalés de 80-120ms. Durée totale ≤ 1s.
- **Hairline reveal** : un divider horizontal terracotta qui se déploie de gauche à droite à l'entrée section (300-500ms, ease-out).
- **Hover button** : translate-y 1-2px + color transition 150ms.
- **Diagramme reveal** : stagger des éléments à l'entrée viewport (≤ 1s total).

### 8.3 Patterns interdits

- ❌ Parallax violent sur hero (signal 2014).
- ❌ Spinning logos / badges en permanence.
- ❌ Bounce / wobble / shake non sollicité.
- ❌ Carrousels auto-play (anti-pattern UX 2026).
- ❌ Animations qui durent > 1s (fatigue cognitive).

### 8.4 Respect `prefers-reduced-motion`

**Toutes** les animations décoratives doivent être désactivées si `prefers-reduced-motion: reduce`. Implémentation via media query CSS ou hook React détection.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Naming convention assets

### 9.1 Structure `public/`

```
public/
├── illustrations/         # Illustrations GPT-image
│   ├── home-hero.avif
│   ├── methodologie-hero.avif
│   ├── methodologie-mid-1.avif
│   ├── audit-hero.avif
│   └── ...
├── screenshots/           # UI screenshots (dashboards, écrans clients anonymisés)
│   ├── case-1-dashboard.avif
│   └── ...
├── portraits/             # Photos / illustrations Will + équipe
│   ├── will-photo.avif        # si photo réelle
│   ├── will-illustration.avif # si silhouette stylisée
│   └── ...
├── og/                    # OG images statiques (fallback si ImageResponse Next.js 16 indispo)
│   ├── home-og.png
│   ├── methodologie-og.png
│   └── ...
└── icons/                 # SVG custom (rare — préférer Lucide)
    └── ...
```

### 9.2 Convention nom de fichier

Format : `[page-slug]-[slot]-[variant?].avif`

Exemples :

- `home-hero.avif` (hero page d'accueil)
- `methodologie-mid-2.avif` (2e section opener page méthodologie)
- `audit-closing.avif` (visuel de clôture page audit)
- `a-propos-portrait-will.avif`
- `cas-concrets-listing-1.avif`

### 9.3 Slugs de page autorisés (correspondance routes Next.js 16)

- `home` (route `/`)
- `interventions`, `interventions-dirigeants`, `interventions-equipes`
- `audit`, `audit-strategique-pme`
- `stack-ia`
- `methodologie`
- `implementation`
- `cas-concrets`
- `comparaisons`
- `blog`
- `centre-aide`
- `guide-ia`
- `a-propos`
- `contact`
- `presse`
- `roi`
- `reserver`
- `faq`

### 9.4 Slots autorisés

- `hero` (top of page)
- `mid-1`, `mid-2`, `mid-3`, ... (section openers, ordonnés du haut vers le bas)
- `closing` (avant CTA final)
- `portrait-[name]` (photos / illustrations personnes)
- `og` (OG image dédiée)
- `diagram-[type]` (diagrammes spécifiques, ex: `diagram-funnel`)

---

## 10. Versioning

### 10.1 Refresh asset

Si un asset est régénéré (nouvelle version GPT-image, retouche photo), **garder l'ancien sous `-v1`** :

- `methodologie-hero.avif` (version courante)
- `methodologie-hero-v1.avif` (version précédente, archivée)

### 10.2 Avantages

- Rollback possible si nouvelle version moins bonne.
- Historique visuel de la marque (utile pour audits futurs, presse).
- Pas de dépendance Git seul (binaires Git suboptimaux).

### 10.3 Limite

Ne pas accumuler indéfiniment : conserver max **2 versions par asset** (`courant` + `v1`). Au-delà, supprimer les `v0`, `v-1`.

---

## 11. Cohérence multi-générations GPT-image — stratégies cumulables

> **Problème central** : générer 50+ illustrations dans la même collection sans cohérence stylistique = 50 images quasi-aléatoires qui ne respectent pas le brand. **Solution : empiler plusieurs stratégies.**

### 11.1 Stratégie (a) — Toutes les générations dans la même session ChatGPT

- DALL-E 3 via ChatGPT Plus tient un **contexte de session** qui aide à la cohérence stylistique entre générations successives dans la même conversation.
- **Limitation** : pas de seed reproductible, cohérence ~60-70% (dégrade après ~10-15 gens dans la même session).

### 11.2 Stratégie (b) — Seed reproductible via `gpt-image-1` API

- L'API OpenAI `gpt-image-1` supporte le paramètre **`seed` (entier)**.
- Utiliser **le même seed** sur tous les prompts d'une collection (ex: `seed=42` pour toutes les illustrations AxionIA).
- Cohérence ~75-85% (variations naturelles dans le rendu, mais palette + composition + style très proches).
- **Coût** : ~$0.19/image qualité haute. Budget 50 images = ~$10 + 30% retries = ~$13.

### 11.3 Stratégie (c) — Workflow image-to-image / variations

1. Générer **1 image « référence absolue »** (ex: hero `/methodologie`) avec prompt complet préfixe brand.
2. Faire valider par Will (palette respectée, style éditorial OK, négatif space suffisant).
3. Pour les illustrations suivantes, utiliser `gpt-image-1` mode `edit` ou `variations` à partir de cette référence.
4. Le prompt devient : « Same style, same palette, same composition language as reference image. Subject: [nouveau sujet]. ».
5. Cohérence ~85-95% (très haute, c'est la stratégie la plus puissante).

### 11.4 Stratégie (d) — Style guide injecté en system prompt (API)

- Si génération via API : injecter le **bloc préfixe brand complet** (cf. § 11.6) en `system` prompt de chaque requête.
- Évite la dérive entre prompts utilisateur successifs.
- Cumulable avec (b) seed et (c) image-to-image.

### 11.5 Stratégie (e) — Reprendre image générée et modifier

- Dans ChatGPT Plus : « Garde le même style mais change le sujet : [nouveau sujet] ». Le contexte de la conversation aide.
- Cohérence ~70-80% si fait dans la foulée, dégrade si nouvelle session.

### 11.6 Préfixe brand AxionIA — bloc COPY-PASTE à coller en début de chaque génération

```
[PRÉFIXE BRAND AXIONIA — copy-paste avant tout sujet]
Editorial illustration, AxionIA brand restrained palette EXACTLY:
terracotta brick #c24a1b (accent only, sparingly, max 15% of composition),
deep mocha brown #2a2520 (deep tones — NEVER pure black),
sage green #5e6c54 (proof / secondary accent, sparingly),
ivory cream #faf8f3 (background — primary canvas),
warm sand #f0e9da (mid-tones, secondary surfaces),
warm anthracite-brown #1a1815 (text / outlines — NEVER pure black).
Style: editorial vector illustration, light desaturated, premium B2B consulting aesthetic,
slightly hand-drawn quality (subtle imperfection in lines), generous negative space (>40%),
minimal detail, sophisticated restraint. Composition feels like Anthropic research papers
or Stripe Press magazine illustrations.
Constraints (strict, non-negotiable):
- NO text in image (typography is HTML-overlaid, not baked into pixels)
- NO realistic photographic faces (silhouettes / abstract figures OK)
- NO stock-photo corporate aesthetic (no handshake, no diverse smiling team meeting)
- NO 3D isometric (anti-pattern signal startup 2018)
- NO startup clichés (lightbulbs, rockets, gears, lego blocks, neon, glowing nodes)
- NO excessive gradients or rainbow palettes
- Aspect ratio: [SPECIFIED PER PROMPT BELOW]
- Negative space: 40-60% of composition
- Reference visual language: Anthropic illustrations + Stripe Press editorial
```

### 11.7 Combinaison recommandée pour AxionIA (PERFECTION 2026)

1. Utiliser `gpt-image-1` API (seed=42, qualité haute).
2. Injecter préfixe brand en `system` prompt.
3. Générer 1 image référence absolue (ex: `home-hero`), valider par Will.
4. Pour les 49+ images suivantes : mode `edit` / `variations` à partir de la référence + prompt sujet spécifique.
5. Conserver le même seed=42 partout.
6. Budget cible : ~$13-15 total OpenAI (50 images × $0.19 + 30% retries).

---

**Fin du style guide v1.0 · 2026-05-07.**

> Pour la bibliothèque complète des prompts GPT-image par page, voir `_AUDIT/gpt-image-prompts.md`.
