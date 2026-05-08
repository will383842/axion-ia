# AxionIA — Visual Inventory Internal (Agent A)

**Date** : 2026-05-07 (HEAD `941a8e1`+, post-pivot v3.1)
**Périmètre** : Top 20 pages stratégiques sous `axionia/src/app/[locale]/`
**Mode** : lecture seule, audit visuel pré-Sprint Visual Rhythm 2026
**Auteur** : Agent A — Visual Rhythm 2026
**Doctrine** : Editorial Premium Light v3.1 (palette terracotta/mocha/sage/paper/sand/primary)

---

## 0. Résumé exécutif

20 pages auditées. **5/20 disposent d'un HeroSchema éditorial premium** (`/`, `/interventions`, `/audit`, `/stack-ia`, `/cas-concrets`, `/implementation`) soit **30% strict / 35% si on compte le hero SVG inline du Home et le CaseStudiesHeroSchema "stack de cards"**.

**Top 3 gaps critiques** :

1. **Méthodologie (`/methodologie`) est un mur de texte total** — H1 + 4 listes + CtaBlock, ZÉRO visuel hero, ZÉRO ancrage visuel sur les 4 étapes (numéros mono couleur primary). Page de réassurance majeure du tunnel — gap rythme visuel critique.
2. **Pages Comparaisons / Blog / Centre-aide / FAQ / Guide-IA / À-propos / Contact / ROI / Réserver / Presse** — utilisent toutes un **hero plain `<Section titleAs="h1">`** sans illustration. Aucun visuel à droite, aucun closing visuel avant CTA final. 10 pages sur 20 avec hero pauvre.
3. **Sous-pages pilotées par `ProductPageTemplate`** (`/interventions/dirigeants`, `/interventions/equipes`, `/audit/strategique-pme`) — hero éditorial avec `bg-halo-warm` + `border-l-4` accent, mais **aucun schéma SVG** : seulement texte + Price + CTAs. ~20 sous-pages affectées.

**Pattern HeroSchema gold standard validé** sur 5 fichiers : grammaire visuelle homogène (halos terracotta+primary+sage, anneaux concentriques pointillés, particules 4-pointes, centre serif italique terracotta, satellites avec halos doubles 32+22 et dot 11). Variantes maîtrisées (W×H, nombre satellites, layout `labelLayout`).

**Iconographie Lucide** : 36 fichiers consommateurs, ~50-60 icônes distinctes utilisées, **aucune fuite Heroicons/Phosphor**, stroke-width hétérogène (default 2 + override 2.25 + override 3 sur Check/ArrowDown). **`Check` et `ArrowRight` sont sur-utilisées** (>10 instances chacune) sans véritable hiérarchie visuelle.

**Bitmap & SVG** : `public/` ne contient que les SVG démo Next.js (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) et un dossier `press-kit/` vide. **Aucune image bitmap propriétaire**. Une seule route `/api/og/route.tsx` génère l'OG via `@vercel/og` ; **aucun `opengraph-image.tsx` per-page**. `next/image` utilisé uniquement dans `PressSpokesperson.tsx` et `TeamGrid.tsx`.

**SEO image** : `JsonLd.tsx` est un simple injecteur `<script>`. `seo.ts` expose `buildProductMetadata`, `buildServiceJsonLd`, `buildFaqJsonLd`, `buildBreadcrumbJsonLd`. **`buildImageObjectJsonLd` n'existe pas — gap à combler**.

---

## 1. Pattern HeroSchema gold standard

### 1.1 Les 5 fichiers extraits

| Composant                  | Fichier                                                | LOC | Satellites                 | Canvas (W×H)                           | Layout                                                             | Type                                   |
| -------------------------- | ------------------------------------------------------ | --- | -------------------------- | -------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| `InterventionsHeroSchema`  | `src/components/sections/InterventionsHeroSchema.tsx`  | 301 | 5 (orbite ellipse)         | 560 × 760 portrait                     | Sens horaire `[-110, -65, 0, 65, 130]`                             | Orbital 5 nodes                        |
| `StackHeroSchema`          | `src/components/sections/StackHeroSchema.tsx`          | 389 | 6 + cluster 11 dots centre | 560 × 760 portrait                     | Arc safe `[-115, -70, -25, 25, 70, 115]`                           | Orbital 6 nodes + constellation centre |
| `ImplementationHeroSchema` | `src/components/sections/ImplementationHeroSchema.tsx` | 313 | 8 (orbite quasi-ronde)     | 720 × 700 paysage                      | 8 angles `[-90, -45, 0, 45, 90, 135, 180, -135]` + `labelLayout()` | Orbital 8 nodes                        |
| `AuditHeroSchema`          | `src/components/sections/AuditHeroSchema.tsx`          | 239 | 4 steps + 6 outcomes       | flow vertical (HTML/Tailwind, pas SVG) | 3 actes verticaux + `FlowArrow` connecteurs                        | Flow narratif INPUT → PROCESS → OUTPUT |
| `CaseStudiesHeroSchema`    | `src/components/sections/CaseStudiesHeroSchema.tsx`    | 190 | 3 mini-cards stackées      | HTML stack vertical                    | `space-y-3.5` cards + footer "+ d'autres"                          | Stack de mini-cards (pas SVG)          |

### 1.2 Invariants stricts du pattern (à respecter pour tout nouveau HeroSchema)

**Wrapper** :

- `<div role="img" aria-label={ariaLabel} className={className ?? "pointer-events-none mx-auto w-full max-w-md"}>`
- `<svg viewBox=... preserveAspectRatio="xMidYMid meet" overflow="visible" className="h-auto w-full overflow-visible">`
- Server Component pur (pas `"use client"`), pas d'animation.

**Defs SVG** (3 halos + 1 grille + 1 mask vignette) :

- `radialGradient` halo-tc : `0%/0.25 → 60%/0.06 → 100%/0` terracotta (le plus dense)
- `radialGradient` halo-pr : `0%/0.14-0.16 → 100%/0` primary
- `radialGradient` halo-sg : `0%/0.18-0.20 → 100%/0` sage
- `pattern` grille `48 × 48` lignes `var(--color-border-strong)` `strokeOpacity 0.18` `strokeWidth 0.5`
- `radialGradient` grid-mask : `0%/0.55 → 100%/0` blanc (vignette radiale)
- `mask` vignette-mask : `<rect width="100%" height="100%" fill="url(#grid-mask)" />`

**Background** :

- `<rect>` plein-canvas avec `fill="url(#grid)" mask="url(#vignette-mask)"`
- 3 halos diffus : centre terracotta (r 360-380), top-right primary (r 160-180), bottom-left sage (r 150-170)

**Anneaux concentriques** :

- 3 ellipses centrées sur (cx, cy) :
  - Outer : `border-strong` opacity 0.18-0.20 dasharray `2 8`
  - Middle : `terracotta` opacity 0.30-0.32 dasharray `3 6`
  - Inner : `border-strong` opacity 0.28-0.30 (continu)

**Liaisons centre ↔ satellites** :

- `<line>` pointillé `dasharray="3 6"` `strokeWidth="1.25"` `strokeOpacity="0.40"` couleur de l'accent du satellite

**Satellites** :

- 3 cercles concentriques par dot : halo extérieur `r 30-32` opacity 0.10, halo intermédiaire `r 20-22` opacity 0.20, dot principal `r 10-11` `stroke="var(--color-bg)"` `strokeWidth="3"`
- Label : `var(--font-manrope)` `fontSize 15` `fontWeight 700` color `var(--color-fg)` (sauf Stack : serif italique de l'accent)
- Sous-label : `var(--font-manrope)` `fontSize 12.5` `fontWeight 500` color `var(--color-fg-soft)`
- Ancrage texte : `start` à droite du centre, `end` à gauche, `middle` au top/bottom

**Centre** :

- Anneau extérieur diffus `r 78-108` `strokeWidth 14` `strokeOpacity 0.16-0.20` terracotta
- Cercle papier `r 78-108` `fill="var(--color-paper)"` `stroke="var(--color-terracotta)"` `strokeWidth 2.5`
- Premier mot label : `var(--font-serif)` italique `fontSize 22-25` terracotta
- Suite label : `var(--font-manrope)` `fontSize 14` `fontWeight 600` color `var(--color-fg)`
- Caption optionnel : `fontSize 10.5` `fontWeight 500` letterSpacing `0.08em` `var(--color-fg-muted)` UPPERCASE

**Particules décoratives** (signature obligatoire en arrière-plan, ~6 éléments) :

- 4 petits cercles (r 2-2.5) placés aux coins (terracotta TL, sage BR, primary TR, terracotta BL)
- 2 étoiles 4-pointes (path à 8 segments) terracotta + sage

### 1.3 Variantes autorisées

- **Canvas dimensions** : portrait (560×760) si ≤6 satellites, paysage (720×700) si ≥7 satellites.
- **Nombre satellites** : 4 → 8.
- **Layout angles** : libre, mais doit éviter `0°` et `180°` purs (collisions de labels) ou les compenser via `labelLayout()` (cf. `ImplementationHeroSchema`).
- **Centre cluster** : `StackHeroSchema` ajoute un cluster de dots constellation (11 dots, 2 lignes croisées, transform `translate(cx, cy-30)`). Optionnel selon narratif.
- **Type satellite** : `terracotta | primary | sage | mocha`. Le satellite `mocha` peut être réservé à 1 seul élément (signal) ou utilisé pour neutraliser une partie du schéma.
- **Forme alternative non-orbitale** :
  - `AuditHeroSchema` = flow vertical 3 actes (3 cards rounded-2xl reliées par `<FlowArrow>`).
  - `CaseStudiesHeroSchema` = stack de 3 mini-cards (la 1ère prominente, les 2 suivantes border simple).
  - Ces variantes restent **doctrine-conformes** car elles utilisent les mêmes tokens (rounded-2xl, border-2 accent, eyebrow uppercase tracking-[0.18em], serif italique pour métriques).

### 1.4 Pages avec HeroSchema vs sans HeroSchema

| Page                        | HeroSchema présent ?                                 | Composant                         | Verdict                                            |
| --------------------------- | ---------------------------------------------------- | --------------------------------- | -------------------------------------------------- |
| `/`                         | ✅ Hero SVG inline (600×680, pas de composant dédié) | inline `<svg>` 800+ LOC           | **Pourrait être extrait** dans un `HomeHeroSchema` |
| `/interventions`            | ✅                                                   | `InterventionsHeroSchema`         | OK gold standard                                   |
| `/audit`                    | ✅                                                   | `AuditHeroSchema` (variante flow) | OK                                                 |
| `/stack-ia`                 | ✅                                                   | `StackHeroSchema`                 | OK                                                 |
| `/methodologie`             | ❌                                                   | —                                 | **Critique**                                       |
| `/implementation`           | ✅                                                   | `ImplementationHeroSchema`        | OK                                                 |
| `/cas-concrets`             | ✅ (variante stack)                                  | `CaseStudiesHeroSchema`           | OK                                                 |
| `/comparaisons`             | ❌                                                   | —                                 | À combler                                          |
| `/blog`                     | ❌                                                   | —                                 | À combler                                          |
| `/centre-aide`              | ❌                                                   | —                                 | À combler                                          |
| `/interventions/dirigeants` | ❌ (hero `ProductHero`)                              | `ProductPageTemplate`             | À combler                                          |
| `/interventions/equipes`    | ❌ (hero `ProductHero`)                              | `ProductPageTemplate`             | À combler                                          |
| `/audit/strategique-pme`    | ❌ (hero `ProductHero`)                              | `ProductPageTemplate`             | À combler                                          |
| `/guide-ia`                 | ❌                                                   | —                                 | À combler (low priority — lead magnet, OK plain)   |
| `/a-propos`                 | ❌                                                   | —                                 | À combler                                          |
| `/contact`                  | ❌                                                   | —                                 | OK plain (utilitaire)                              |
| `/presse`                   | ❌                                                   | —                                 | À combler (espace presse premium attendu)          |
| `/roi`                      | ❌                                                   | —                                 | À combler (simulator est sa propre force visuelle) |
| `/reserver`                 | ❌                                                   | —                                 | OK plain (calendrier domine)                       |
| `/faq`                      | ❌                                                   | —                                 | OK plain (utilitaire)                              |

**Score HeroSchema** : 5/20 pages strictement (25%) — 6/20 si on compte le hero SVG inline du Home (30%) — 7/20 si on accepte les variantes flow/stack (35%).

### 1.5 Recommandation pour étendre

Créer **8 nouveaux HeroSchema** sur Top 20 :

| Page                    | Nom proposé                    | Type recommandé                                                            | Satellites          | Accents                             |
| ----------------------- | ------------------------------ | -------------------------------------------------------------------------- | ------------------- | ----------------------------------- |
| `/methodologie`         | `MethodologyHeroSchema`        | Flow horizontal 4 étapes (variante audit)                                  | 4                   | terracotta → primary → sage → mocha |
| `/comparaisons`         | `ComparisonsHeroSchema`        | Variante triangle 3-pôles (vous au centre, 2 alternatives)                 | 3                   | terracotta · primary · sage         |
| `/blog`                 | `BlogHeroSchema`               | Stack 3 mini-articles (variante CaseStudiesHeroSchema avec date+tag+title) | 3                   | terracotta                          |
| `/centre-aide`          | `HelpHeroSchema`               | Constellation 5-7 thématiques (variante orbital)                           | 6                   | mocha                               |
| `/interventions/{slug}` | `InterventionDetailHeroSchema` | Daily timeline horizontale (matin/midi/après-midi)                         | 3-4 timeline blocks | accent du module                    |
| `/audit/{slug}`         | `AuditDetailHeroSchema`        | 3 livrables empilés (variante stack)                                       | 3                   | accent du niveau                    |
| `/a-propos`             | `AboutHeroSchema`              | Timeline verticale `ABOUT_TIMELINE` (déjà data en place)                   | 4-6 events          | terracotta                          |
| `/presse`               | `PressHeroSchema`              | Stack 3 facts clés (déjà data via `PRESS_FACTS`)                           | 3                   | terracotta+mocha                    |
| `/roi`                  | `RoiHeroSchema`                | 2 curseurs visuels miniatures (avant slider réel)                          | 2                   | primary · sage                      |

---

## 2. Inventaire visuel par page (Top 20)

Format de fiche : eyebrow → hero quality → mid-section visuals → closing → word count global → verdict.

### A. PILLAR (5)

#### `/` (Home) — `src/app/[locale]/page.tsx` — 1276 LOC

- **Hero** : ✅ riche. Texte gauche + SVG inline (600×680) avec entreprise centre + 3 services satellites (Intervenir/Auditer/Implémenter), halos, anneaux, courbes Bézier, sphère 3D, sparklines décoratives. Pattern HeroSchema **avant la formalisation** (anachronique, devrait être extrait).
- **Mid-section** :
  - Section "Value proposition" : 3 cards avec numéro 7xl serif + Lucide icon 14×14 + bullets `Check` 4×4 + bandeau gain. **Visuel solide**.
  - Section "Why" : 4 points serif numérotés sur `bg-halo-cool`. Plain.
  - Section "Metrics" : 4 metrics serif géants tabular-nums sur `bg-mocha-rich`. **Visuel solide**.
  - Section "Method" : 4 steps serif numérotés avec `border-t`. Plain.
  - Section "Cases" : 3 cards avec metric badge + serif title. Plain.
  - Section "ROI" : card unique CTA. Plain.
  - Section "Testimonials" : 4 quotes avec guillemet ouvrant 6xl serif. Plain.
  - Section "FAQ" : Accordion. Plain.
- **Closing visuel** : ❌ CtaBlock final mocha-rich texte seul.
- **Word count approximatif** : ~2 100 mots (FR + EN doublé).
- **Sections "mur de texte"** : aucune > 600 mots avec ancrage visuel.
- **Doublons icônes** : `Check` ×3 (bullets 3 cards), `ArrowRight` ×6.
- **Verdict** : 🟢 sain. Hero inline pourrait être extrait.

#### `/interventions` — 783 LOC

- **Hero** : ✅ `InterventionsHeroSchema` (gold standard).
- **Mid-section** :
  - Bandeau "Pour qui" : 4 pills Lucide (Globe2/Building2/Sparkles/Plane). **Visuel léger**.
  - Section "5 formats" : 1 card flagship `lg:col-span-2` Essentielle + 4 cards 2×2 avec liseré accent + KpiCard/KpiInline + Sparkles badge "Offre phare". **Visuel riche**.
  - Section "Anti-fear 3 niveaux" : 3 cards level/title/body/recommendation. Plain.
- **Closing visuel** : ❌ `CtaBlock` tone="dark" texte.
- **Word count** : ~1 800 mots.
- **Doublons icônes** : `Check` ×5 (1 par bullet × 5 formats × 5-6 outcomes), `ArrowRight` ×10+.
- **Verdict** : 🟢 sain.

#### `/audit` — 1249 LOC

- **Hero** : ✅ `AuditHeroSchema` (variante flow 3 actes).
- **Mid-section** :
  - `TrustBadges` (composant) — réassurance institutionnelle. ?
  - Bandeau "Pour qui" 5 pills Lucide. **Visuel léger**.
  - Section "Matcher" : 2 colonnes × 4 options avec icône Lucide (Building2/Network/Lightbulb/Wrench/BarChart3/Compass). **Visuel solide**.
  - Section "Pyramide 4 niveaux" : 4 cards (2 flagship Flash+ETI full-width) avec icône module + price tag serif italique terracotta XL. **Visuel riche** (price tag = signature visuelle forte).
  - Section "Tarifs" : table HTML. Plain.
  - Section "Quiz 3 questions" : 3 cards Q/A avec accent. Plain.
  - `WhyAxionIA` (composant 5 différenciants).
  - `SignatureCard` (signature fondateur).
  - `SocialProof`.
  - `AuditFaqSection` 6 questions.
  - Section "Anti-fear 3 stages". Plain.
  - `BeyondAuditBlock`.
- **Closing visuel** : ❌ CtaBlock + StickyMobileCta.
- **Word count** : ~3 500 mots (FR seulement).
- **Doublons icônes** : `Building2` ×4 (matcher tailles), `Network` ×2, `Compass` ×2, `Check` ×8+, `ArrowRight` ×15+.
- **Verdict** : 🟢 sain. Page la plus dense visuellement avec `/`.

#### `/stack-ia` — 803 LOC

- **Hero** : ✅ `StackHeroSchema` (gold standard).
- **Mid-section** :
  - Bandeau "Notre principe" 4 pills Lucide (Sparkles/ShieldCheck/Info/RefreshCw). **Visuel léger**.
  - Section "Manifeste" : 3 cards numérotées serif 3xl. Plain.
  - 5 sections catégories : chacune avec 2-3 cards d'outils contenant **monogramme** `<ToolLogo>` 14×14 sur background accent + name + vendor + maturity pill + tagline serif italique XL + use case + bullets `Check` "Quand on le sort" + bullets `Minus` "Quand on l'évite" + footer combo. **Visuel très riche** (monogrammes = signature unique).
  - Section "Combos" : 6 articles avec 2 monogrammes + flèche + output. Plain.
  - Section "Ce qu'on a écarté" : 6 articles. Plain.
  - Section "FAQ". Plain.
  - Section "Disclaimer".
- **Closing visuel** : ❌ CtaBlock.
- **Word count** : ~3 200 mots.
- **Doublons icônes** : `Check` ×11+ (1 par outil × ~3 use cases). `ArrowRight` ×6+.
- **Verdict** : 🟢 sain. Monogrammes via `ToolLogo` = pattern visuel exemplaire pour /stack-ia.

#### `/methodologie` — 159 LOC

- **Hero** : ❌ pauvre. `<Section titleAs="h1" eyebrow title titleEm description />` — texte seul, pas de visuel à droite.
- **Mid-section** : 1 seule section avec 4 steps `<ol grid lg:grid-cols-4>` — chaque step = numéro mono `text-primary text-2xl tabular-nums` + h2 + p. **ZÉRO icône, ZÉRO illustration, ZÉRO ancrage visuel**. Mur de texte aéré mais sans rythme.
- **Closing visuel** : ❌ `CtaBlock` tone="dark" texte.
- **Word count** : ~280 mots (très court — le problème n'est PAS la longueur, c'est l'absence totale de visuel sur la page de méthode pourtant ÊTRE central de la doctrine).
- **Doublons icônes** : aucun (zéro icône).
- **Verdict** : 🔴 **critique**. Page de réassurance majeure du tunnel Audit → Implémentation, ZÉRO visuel hero, ZÉRO ancrage sur les 4 étapes. **Priority #1**.

### B. LISTINGS (5)

#### `/implementation` — 1216 LOC

- **Hero** : ✅ `ImplementationHeroSchema` desktop + grid 2×4 mobile fallback (très bonne UX responsive).
- **Mid-section** :
  - Bandeau réassurance 4 pills Lucide (Clock/ShieldCheck/Sparkles/Check). **Visuel léger**.
  - Section "2 portes d'entrée" : 3 cards plain. Pas d'illustration.
  - Section "Catalogue" : 8 fonctions via `<CaseStudyCard>`. Plain.
  - Section "Pricing 3 tiers" : 3 cards serif XL price. Plain.
  - Section "Comparatif Make/Agence/AxionIA" : table 3 colonnes avec colonne mise en avant scale 1.04 + ring + badge ★. **Visuel solide**.
  - Section "Scénarios 6 segments" : 6 cards avant/après serif metric. **Visuel solide**.
  - `ProcessSteps` 5 étapes.
  - `FaqAccordion` 9 questions.
  - CtaBlock + StickyMobileCta.
- **Closing visuel** : ❌ CtaBlock texte.
- **Word count** : ~3 800 mots.
- **Doublons icônes** : `Check` ×5+, `ArrowRight` ×15+, `Minus` ×8+, `X` ×3.
- **Verdict** : 🟢 sain.

#### `/cas-concrets` — 254 LOC

- **Hero** : ✅ `CaseStudiesHeroSchema` (variante stack).
- **Mid-section** :
  - Section "Filtres" : 2 listes pills industrie + taille. Plain.
  - Section "Tous les cas" : grille `CaseStudyCard`. Plain.
- **Closing visuel** : ❌ CtaBlock tone="dark".
- **Word count** : ~280 mots côté chrome (le contenu vient des cas).
- **Doublons icônes** : aucune sur la page elle-même.
- **Verdict** : 🟢 sain.

#### `/comparaisons` — 90 LOC

- **Hero** : ❌ plain `<Section titleAs="h1">`.
- **Mid-section** : grille `<ArticleCard>` simple. Pas d'illustration de hero, pas de mid-visuel.
- **Closing visuel** : ❌ aucun (pas de CtaBlock final même).
- **Word count** : ~80 mots côté chrome.
- **Doublons icônes** : aucune.
- **Verdict** : 🔴 **critique**. Page comparaisons IA = enjeu AEO majeur, ZÉRO visuel, ZÉRO ancrage.

#### `/blog` — 102 LOC

- **Hero** : ❌ plain `<Section titleAs="h1">`.
- **Mid-section** : grille `<ArticleCard>`. Plain.
- **Closing visuel** : ❌ CtaBlock texte.
- **Word count** : ~50 mots chrome.
- **Doublons icônes** : aucune.
- **Verdict** : 🟠 important. Blog = canal contenu → manque hero éditorial.

#### `/centre-aide` — 193 LOC

- **Hero** : ❌ plain `<Section tone="halo-warm" titleAs="h1">`.
- **Mid-section** :
  - Section "Thématiques" : grille de cards `<Card>` avec ArrowUpRight. Plain.
  - Section "Tous les articles" : liste avec ArrowUpRight × N. Doublon icône.
- **Closing visuel** : ❌ CtaBlock.
- **Word count** : ~140 mots chrome.
- **Doublons icônes** : `ArrowUpRight` ×N (probablement 50+ articles).
- **Verdict** : 🟠 important.

### C. PRODUIT/PROCESS (4)

#### `/interventions/dirigeants` — 72 LOC (file) → délégué à `ProductPageTemplate`

- **Hero** : ❌ `ProductHero` plain — `bg-halo-warm`, border-l-4 accent, eyebrow, h1 serif clamp(2.5,6,5)rem, answer body, Price, CTAs. **Pas de visuel à droite**.
- **Mid-section** :
  - `daySchedule` (Module 1 only) — DayScheduleSection non lue.
  - `FeatureGrid` benefits.
  - `ProcessSteps` réservation.
  - `MetricsRow` chiffres.
  - `FaqBlock`.
- **Closing visuel** : ❌ CtaBlock final mocha.
- **Word count** : ~1 200 mots (via `INTERVENTIONS["dirigeants"][loc]`).
- **Doublons icônes** : `ArrowRight` (1 dans CTA).
- **Verdict** : 🟠 important. ~10 sous-pages héritent du template — fix template = fix toutes.

#### `/interventions/equipes` — 72 LOC (idem template)

- Identique à dirigeants. Verdict : 🟠 important.

#### `/audit/strategique-pme` — 71 LOC (idem template)

- Identique pattern. Verdict : 🟠 important.

#### `/guide-ia` — 156 LOC

- **Hero** : ❌ plain `<Section titleAs="h1">`.
- **Mid-section** :
  - Section "Sommaire" : 6 chapitres en `<ol>` avec `text-primary font-mono` numérotation. Plain — pas d'icône, pas de visuel.
  - Section "Recevoir le PDF" : `<NewsletterForm>`.
- **Closing visuel** : ❌ CtaBlock.
- **Word count** : ~180 mots chrome.
- **Doublons icônes** : aucune.
- **Verdict** : 🟠 important. Lead magnet doit montrer l'objet (mockup PDF cover, table des matières en visuel).

### D. ÉDITORIALES (3)

#### `/a-propos` — 135 LOC

- **Hero** : ❌ plain `<Section titleAs="h1">`.
- **Mid-section** :
  - Section "Parcours" : `<TimelineBlock>` (composant déjà existant). Visuel timeline.
  - Section "Équipe" : `<TeamGrid>` (Image next/image utilisée). Visuel.
  - Section "Valeurs" : 3 paragraphes texte. Plain.
- **Closing visuel** : ❌ CtaBlock.
- **Word count** : ~150 mots chrome.
- **Doublons icônes** : aucune.
- **Verdict** : 🟠 important. Hero éditorial premium attendu sur "À propos" cabinet IA.

#### `/contact` — 197 LOC

- **Hero** : ❌ plain `<Section tone="halo-warm" titleAs="h1">`.
- **Mid-section** : 3 cards `<Card>` "Trois façons de nous joindre". Plain. Coordonnées simple. `<ContactForm>`.
- **Closing visuel** : ❌ CtaBlock.
- **Word count** : ~190 mots chrome.
- **Verdict** : 🟢 sain (page utilitaire, pas de besoin visuel fort).

#### `/presse` — 386 LOC

- **Hero** : ❌ plain `<Section titleAs="h1">` avec 2 boutons (Download + Mail).
- **Mid-section** :
  - Section "Pitch" : 2 colonnes — pitch serif + `<PressFacts>` aside.
  - Section "Press Kit" : `<PressKit>` avec icônes Download/FileText/ImageIcon/Palette/Type/FileCode.
  - Section "Communiqués" : `<PressReleases>` cards.
  - Section "Porte-parole" : `<PressSpokesperson>` avec next/image avatars.
  - Section "Couverture" : `<MediaCoverage>`.
  - `<PressContact>` mocha bandeau.
  - `<FaqBlock>` FAQ presse.
- **Closing visuel** : ❌ inclus dans PressContact mocha.
- **Word count** : ~600 mots chrome.
- **Doublons icônes** : `Mail` ×2, `Calendar` ×N (releases), `ArrowUpRight` ×N (coverage).
- **Verdict** : 🟠 important. Espace presse premium attendu — hero pauvre vs richesse mid-section. Hero Schema dédié recommandé.

### E. UTILITAIRES DENSES (3)

#### `/roi` — 126 LOC

- **Hero** : ❌ plain `<Section titleAs="h1">`.
- **Mid-section** : `<RoiSimulator>` composant client (icônes Clock/Users/FileText/Mail/Sparkles).
- **Closing visuel** : ❌ CtaBlock tone="dark".
- **Word count** : ~150 mots chrome.
- **Verdict** : 🟠 important. Le simulator est sa propre force visuelle, mais le hero pourrait teaser les 4 outputs en visuel.

#### `/reserver` — 380 LOC

- **Hero** : compact (py-12) plain serif clamp(2,5,3.5)rem + 1 paragraphe. Pas de visuel.
- **Mid-section** : `<BookingCalendar>` composant client domine (calendar UI riche).
- **Closing visuel** : ❌ CtaBlock CGV.
- **Word count** : ~120 mots chrome (hors calendar).
- **Verdict** : 🟢 sain. Calendrier = élément visuel principal légitime.

#### `/faq` — 128 LOC

- **Hero** : ❌ plain `<Section tone="halo-warm" titleAs="h1">`.
- **Mid-section** : `<FaqBlock>` accordion + section "Index" liste avec `ArrowUpRight` × N (~20-30 questions).
- **Closing visuel** : ❌ CtaBlock.
- **Word count** : ~80 mots chrome.
- **Doublons icônes** : `ArrowUpRight` ×N.
- **Verdict** : 🟢 sain (utilitaire FAQ).

---

## 3. Iconographie Lucide globale

### 3.1 Inventaire des imports

**36 fichiers consommateurs** de `lucide-react`. Aucune fuite vers Heroicons / Phosphor / react-icons / Tabler — **cohérence stricte 100%**.

### 3.2 Table fréquence (icônes les plus utilisées)

| Icône                                                                        | Usages observés        | Pages                                                                                                            | Anti-pattern ?                       |
| ---------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `ArrowRight`                                                                 | ~20+ instances         | TOUTES les pages avec CTAs                                                                                       | Non — utilisation idiomatique CTA    |
| `Check`                                                                      | ~15+ instances         | Bullets de TOUTES les pages avec listes outcomes/benefits                                                        | Non — convention list-marker         |
| `ArrowUpRight`                                                               | ~5 fichiers            | `/centre-aide`, `/faq`, `MediaCoverage`, `FaqAccordion`, `PressSpokesperson`                                     | Non                                  |
| `ChevronDown`                                                                | 2 (accordion + select) | UI primitives                                                                                                    | Non                                  |
| `ChevronLeft` / `ChevronRight`                                               | 3                      | Calendar + carousel                                                                                              | Non                                  |
| `Sparkles`                                                                   | 6 fichiers             | `/`, `/interventions`, `/stack-ia`, `/audit`, `/implementation`, AuditRequestForm, BookingCalendar, RoiSimulator | **Surutilisée — devient générique**  |
| `Building2`                                                                  | 5 fichiers             | `/audit` (×4 dans matcher !), `/interventions`, AuditHeroSchema, BookingCalendar, AuditRequestForm               | **Surutilisée sur `/audit`**         |
| `Clock`                                                                      | 4 fichiers             | RoiSimulator, PressContact, CaseStudiesHeroSchema, `/implementation`                                             | OK                                   |
| `ShieldCheck`                                                                | 3 fichiers             | `/stack-ia`, `/implementation`, AuditConversionBlocks, BookingCalendar                                           | OK                                   |
| `Wallet`                                                                     | 2 fichiers             | AuditHeroSchema, CaseStudiesHeroSchema, AuditConversionBlocks                                                    | OK                                   |
| `TrendingUp`                                                                 | 2 fichiers             | AuditHeroSchema, CaseStudiesHeroSchema                                                                           | OK                                   |
| `Briefcase`                                                                  | 3 fichiers             | `/audit`, AuditRequestForm, BookingCalendar, CaseStudiesHeroSchema                                               | OK                                   |
| `Network`                                                                    | 2 fichiers             | `/audit` (×2), AuditRequestForm                                                                                  | OK                                   |
| `Mail`                                                                       | 4 fichiers             | `/presse`, PressContact, RoiSimulator, AuditRequestForm                                                          | OK                                   |
| `Globe2`                                                                     | 3 fichiers             | `/interventions`, `/audit`, AuditRequestForm                                                                     | OK                                   |
| `Sparkles`, `Zap`, `Workflow`, `Wrench`, `Compass`, `Lightbulb`, `BarChart3` | sur `/audit`           | concentration sur 1 page                                                                                         | OK (variété nécessaire pour matcher) |
| `Eye`, `Map`, `ClipboardCheck`, `LineChart`, `GraduationCap`, `Building2`    | AuditHeroSchema        | 4 steps + 6 outcomes                                                                                             | OK                                   |
| `Factory`, `Briefcase`, `Store`                                              | CaseStudiesHeroSchema  | 3 industries                                                                                                     | OK                                   |
| `User`, `Users2`, `Users`, `Crown`, `Star`, `Mic`                            | Calendar/forms/Home    | OK                                                                                                               |
| `Brain`, `Cpu`                                                               | Forms + Audit          | OK                                                                                                               |
| `RefreshCw`, `Info`, `X`, `Minus`                                            | UI utility             | OK                                                                                                               |

**Total icônes distinctes utilisées** : ~50.

### 3.3 Cohérence stroke-width

**Hétérogénéité observée** :

- **Default (2)** : majorité des sites/usages.
- **`strokeWidth={2.25}`** : pattern visible sur `AuditHeroSchema`, `CaseStudiesHeroSchema`, `AuditConversionBlocks`, `/audit/page.tsx` matcher icons. **Convention forte** sur les icônes module/secteur quand affichées en background coloré.
- **`strokeWidth={2.5}`** : `CaseStudiesHeroSchema` (metric icons), `AuditRequestForm` (Check selected).
- **`strokeWidth={3}`** : `Check` dans pills/chips circulaires (h-5 w-5 ou plus petit), `ArrowDown` dans `FlowArrow`. Convention pour bold-check small.
- **`strokeWidth="1.5"`** dans Section.tsx (SVG décoratif arrière-plan).
- **`strokeWidth="0.5"`** : grilles SVG patterns (très fin, vignette).
- **`strokeWidth="0.6"`** : lignes internes cluster `StackHeroSchema`.

**Constat** :

- Cohérence forte sur les 3 patterns principaux (2 default / 2.25 module / 3 pill-check).
- **Pas de hex hardcodé sur color icon** — vérification `<Icon className="text-..."` montre que tous les `text-...` utilisent les tokens v3.1 (terracotta-deep, primary, sage, mocha, fg-soft, fg-muted). ✅ Anti-pattern absent.
- `currentColor` : vérifié, `<svg>` dans `ToolLogo.tsx` utilise `stroke="currentColor"`. ✅

**Recommandations** :

- Standardiser : `strokeWidth={2.25}` pour toutes les icônes Lucide affichées dans un container coloré (pill, square chip).
- Garder `strokeWidth={3}` pour `Check` dans les chips circulaires petites (h-3/h-4/h-5).
- Documenter la règle dans `Design.md` pour ne pas dériver.

### 3.4 Anti-patterns détectés

| Anti-pattern                                                    | Impact                                                                                 | Fichier(s)                                                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **`Sparkles` surutilisée comme icône fourre-tout "innovation"** | Rend la sémantique floue, dilue le signal sur les vraies sections "premium".           | `/`, `/interventions`, `/stack-ia`, `/implementation`, `/audit`, AuditRequestForm, BookingCalendar |
| **`Building2` répétée 4× dans le matcher de `/audit`**          | Toutes les options "par taille" ont la même icône — perte de différenciation visuelle. | `src/app/[locale]/audit/page.tsx` lignes 370-393                                                   |
| **Hex couleur hardcodé sur `<Icon>`**                           | Aucun détecté. ✅                                                                      | —                                                                                                  |
| **Mélange de bibliothèques d'icônes**                           | Aucun. ✅                                                                              | —                                                                                                  |
| **Stroke-width incohérent dans 1 même section**                 | Très faible (vérification ponctuelle). ✅                                              | —                                                                                                  |

---

## 4. Bitmap & SVG inline

### 4.1 Hiérarchie `public/`

```
axionia/public/
├── file.svg              (démo Next.js — peut être supprimé)
├── globe.svg             (démo Next.js — peut être supprimé)
├── next.svg              (démo Next.js — peut être supprimé)
├── vercel.svg            (démo Next.js — peut être supprimé)
├── window.svg            (démo Next.js — peut être supprimé)
└── press-kit/
    ├── .gitkeep
    └── README.md         (placeholder, kit non livré)
```

**Constat** : aucune image bitmap propriétaire (PNG/JPG/WebP/AVIF). Aucun OG image généré côté `public/og/`. Aucun screenshot, aucune photo équipe (ABOUT_TEAM data utilise sans doute des avatars text/svg via `<TeamGrid>`).

### 4.2 Usage `next/image`

- `src/components/sections/PressSpokesperson.tsx` — avatars porte-parole (probablement avatar text fallback en data).
- `src/components/sections/TeamGrid.tsx` — avatars équipe.

**Aucune autre instance** de `next/image` ou `<Image>` dans le code applicatif. Très bon signal de discipline (zéro banque images stock).

### 4.3 Usage `<svg>` inline

**59 occurrences** réparties sur **37 fichiers**. Concentrations notables :

- `ToolLogo.tsx` : 11 SVG inline (1 par outil de la stack — tokens monogrammes propres).
- `app/[locale]/page.tsx` : 1 énorme SVG hero (600×680, ~400 LOC inline) — **candidat à extraction** dans `HomeHeroSchema`.
- `app/[locale]/audit/page.tsx` : 4 (background patterns + dots).
- `AuditConversionBlocks.tsx` : 4 (icônes Lucide + déco).
- 4 HeroSchema files : 1-2 SVG chacun.
- `nav/Footer.tsx` : 2 (logo + déco).

### 4.4 Tableau récap assets

| Type                   | Count           | Localisation                    | Status                  |
| ---------------------- | --------------- | ------------------------------- | ----------------------- |
| Bitmap (PNG/JPG/WebP)  | **0**           | —                               | ✅ Discipline parfaite  |
| SVG asset (public/)    | 5               | `/public/*.svg` (démo Next)     | ⚠️ À nettoyer           |
| SVG inline (component) | 59              | `src/**/*.tsx`                  | ✅ Cohérent doctrine    |
| Lucide icons           | ~50 distinctes  | `lucide-react`                  | ✅                      |
| `next/image`           | 2               | `PressSpokesperson`, `TeamGrid` | ✅                      |
| Press kit assets       | 0 (placeholder) | `public/press-kit/.gitkeep`     | ⚠️ À livrer Sprint 14.6 |

---

## 5. SEO image infrastructure

### 5.1 État actuel

**`src/components/marketing/JsonLd.tsx`** : 17 LOC. Simple wrapper `<script type="application/ld+json">` avec `dangerouslySetInnerHTML`. **Aucune logique métier**, c'est un injecteur générique.

**`src/lib/seo.ts`** : 129 LOC. Expose 4 builders :

- `buildProductMetadata` (Metadata Next 16)
- `buildServiceJsonLd` (Schema.org Service + Offer)
- `buildFaqJsonLd` (FAQPage)
- `buildBreadcrumbJsonLd` (BreadcrumbList)

**`buildImageObjectJsonLd` n'existe pas** — gap. Pour la doctrine GEO 2026 (LLM scraping), chaque page-clé devrait exposer un `ImageObject` JSON-LD pointant vers un OG ou un schéma extrait, avec `caption`, `width`, `height`, `representativeOfPage: true`.

### 5.2 Génération OG / opengraph-image

**Une seule route OG** : `src/app/api/og/route.tsx` utilisant `@vercel/og`'s `ImageResponse`. Endpoint unique non-paramétrique (probablement). Côté metadata Next 16, **aucun `opengraph-image.tsx` per-page** détecté (Glob retourne 0 résultat). Toutes les pages héritent uniquement de l'OG `siteName: "AxionIA"` + image probablement implicite via favicon ou non définie.

**Conséquence SEO** : sur LinkedIn / Twitter / WhatsApp, le partage d'une URL produit `/audit` ou `/stack-ia` affichera probablement une carte sans image distinctive. Pour AEO 2026, c'est un manque-à-gagner critique (les LLMs scrapent les `<meta property="og:image">` pour citer visuellement).

### 5.3 Gaps à combler (Sprint Visual Rhythm 2026)

1. **Créer `buildImageObjectJsonLd`** dans `src/lib/seo.ts` :
   ```ts
   buildImageObjectJsonLd({ url, caption, width, height, locale, representativeOfPage = true });
   ```
2. **Générer `opengraph-image.tsx` per-page Top 20** via Next 16 `ImageResponse` API. Réutiliser le SVG du HeroSchema correspondant en background, ajouter eyebrow + h1 + AxionIA logo.
3. **Émettre `ImageObject` JSON-LD** sur chaque page qui a un HeroSchema, pointant vers `/api/og?page={slug}` (ou `/{locale}/{path}/opengraph-image`).
4. **Documenter dans `Design.md`** la convention OG : 1200×630 px, halo-warm bg, eyebrow uppercase 24px Manrope, h1 serif Fraunces 64px, sous-titre 28px Manrope, AxionIA wordmark coin bas-droit.

---

## OPEN QUESTIONS

1. **Hero SVG inline du Home (~400 LOC dans `page.tsx`)** : doit-il être extrait dans un `HomeHeroSchema` éditorialement homogène avec les 5 autres ? Le canvas 600×680 paysage diffère du portrait 560×760. Recommandation A : extraire en gardant les dimensions (tolérance variante). Recommandation B : refactor vers portrait pour parfaite homogénéité (risque casser le layout 2-col `/`).
2. **Stroke-width canonique** : faut-il standardiser à `2.25` pour TOUS les Lucide en pill/chip, ou laisser Lucide default (2) sur les nav/links ? À trancher dans `Design.md`.
3. **`Sparkles` overuse** : remplacer par des icônes plus spécifiques (Award sur "premium", Compass sur "doctrine", Star sur "phare") ? Ou assumer le pattern "Sparkles = signal d'IA / d'innovation" ?
4. **Press kit assets** (Sprint 14.6) : 6 placeholders dans `PressKit.tsx` (logo, palette, type, etc.) — gating pour génération Visual Rhythm complète sur `/presse`.
5. **`/methodologie`** : extension à 2 sections (cf. priorité critique) ou refonte complète avec hero `MethodologyHeroSchema` flow horizontal ? La page fait 280 mots — si on ajoute un hero schema + une section "Pourquoi cette méthodologie", on passe à ~600 mots, gain de rythme énorme sans dilution.

---

**Fin du document — visual-inventory.md** (Agent A · 2026-05-07)
