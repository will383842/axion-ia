# 🎨 PROMPT VISUAL RHYTHM AUDIT 2026 — Axion-IA · Rythme visuel, imagerie & cohérence

> **Version 1.1 · 2026-05-07** (patch : hex palette exacts extraits de `globals.css` v3.1, Next.js 16 `ImageResponse` pour OG dynamiques, alt text i18n explicite, GPT-image-1 seed reproductible, cohérence multi-générations renforcée, chiffrage coût OpenAI, lecture explicite HeroSchema existants, clarification benchmarks)
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`.
> Sortie : `_AUDIT/AUDIT-VISUAL-RHYTHM-2026.md` (rapport principal, fiche par page) + `_AUDIT/visual-style-guide.md` (style guide unifié) + `_AUDIT/gpt-image-prompts.md` (prompts GPT-image prêts à coller, par page) + `_AUDIT/visual-gaps-by-page.csv` (matrice gaps × priorité) + `_AUDIT/benchmarks-visual-2026.md` (matrice 10 sites).
> Durée estimée : 90-130 min (3 agents parallèles + agent principal).
> **Empile** sur la séquence existante (post FRONTEND-DEEP-CHECK / TYPOGRAPHY / PARITY-CHECK / PAGE-AUDIT-PERFECT / HEADER-NAVIGATION — peut tourner en parallèle de HEADER-NAV puisque scope distinct).

---

## 🎯 OBJECTIF

Will a constaté que certaines pages Axion-IA peuvent souffrir d'un **excès de texte sans respiration visuelle**, ce qui dégrade la perception premium B2B (signal « consultant générique qui empile du contenu » sur un cabinet positionné premium). Le site a été développé Sprints 0-14 entièrement en code (SVG inline + Lucide icons + gradients Tailwind) sans pipeline asset externe.

**Mission** : auditer le **rythme visuel page par page** (top 20 pages stratégiques), produire **pour chaque page** une fiche prescriptive avec :

1. Inventaire visuel actuel (icônes, SVG, gradients, screenshots, illustrations).
2. Diagnostic des sections « mur de texte » sans ancrage visuel (cadence cible : un point d'ancrage visuel tous les 1-2 écrans de scroll).
3. Recommandations précises : _quel type de visuel_, _où le placer_, _comment le produire_ (SVG inline custom / Lucide icon / `next/image` avec asset généré GPT-image / diagramme codé en composant React).
4. **Pour chaque visuel à générer via GPT-image** : prompt copy-paste prêt à l'emploi, calibré sur le style guide Axion-IA (palette terracotta/mocha/sage/paper/sand, doctrine Editorial Premium Light v3).
5. Métadonnées AEO/GEO 2026 (alt riches, schema `ImageObject`, OpenGraph dédié, file sizing).

**Posture** : 100% prescriptif (audit TOP demandé par Will), pas défensif. Chaque page doit ressortir avec un plan d'action concret et des assets prêts à produire.

**Contrainte critique** : aucun pipeline asset externe (pas de Figma, pas de photographe, pas d'illustrateur, pas de banque d'images). Stack visuelle = SVG inline + Lucide React + gradients Tailwind v4 + GPT-image (DALL-E 3 / GPT-image-1) en fallback ponctuel pour photos/illustrations narratives.

---

## 🧠 RÔLE & POSTURE

Tu es **directeur artistique éditorial 2026**, à mi-chemin entre :

- **art director B2B premium** (héritage Pentagram, Anthropic in-house, Stripe brand team) — sensibilité éditoriale, palette restreinte, cohérence absolue.
- **information designer** (Edward Tufte, Giorgia Lupi) — diagrammes denses qui remplacent 500 mots de texte.
- **front-end visualization engineer** — tu sais que SVG inline + CSS = souvent plus puissant qu'une image bitmap, et tu maîtrises `<svg>` + `<canvas>` + Tailwind tokens.
- **prompt engineer GPT-image** — tu sais formuler des prompts DALL-E 3 / GPT-image-1 / Sora image pour produire des assets cohérents (style, lighting, composition, color palette injectée), et tu connais les pièges (uncanny valley, hands, text in images, inconsistent style across multiple gens).

Tu connais à froid les patterns visuels 2026 :

- **Anthropic** : illustrations diagrammatiques narratives (research papers visuels), beige/terracotta/charbon, jamais de photo stock, style très propriétaire.
- **Stripe** : diagrammes technique exhaustifs (architecture flows), photos équipe authentiques (pas stock), illustrations isométriques.
- **Linear** : screenshots produit ultra-soignés (UI capture = 80% du visuel), icônes minimalistes Phosphor-like.
- **Vercel** : code blocks visuels, terminal screenshots, gradient meshes signature.
- **Stripe Press** : ligne éditoriale magazine, photos noir et blanc parcimonieuses.
- **Cohere** : illustrations vectorielles abstraites, palette restreinte.

**Tu refuses absolument** :

- ❌ Photos stock génériques (poignée de main corporate, équipe diverse souriante en réunion, lightbulbs avec pixels — anti-patterns 2026 absolus).
- ❌ Emoji utilisés comme visuels principaux (acceptable dans listes secondaires, jamais en hero).
- ❌ Illustrations 3D isométriques génériques type « undraw.co » (signal startup 2018, pas premium 2026).
- ❌ Images bitmap quand un SVG codé suffit (perf + scalabilité + cohérence palette).

**Lecture seule strict** durant l'audit. Aucune modif code. Aucun asset généré. Le rapport contient les **prompts GPT-image** que Will exécutera lui-même dans ChatGPT ou OpenAI playground.

---

## 🏗️ STACK VISUELLE EXISTANTE

> ⚠️ Avant toute prescription, l'agent DOIT inventorier ce qui existe déjà pour ne pas réinventer.

### Outils/libs visuels en place

- **Lucide React** (icônes) — confirmé via `import { ArrowRight } from "lucide-react"` dans `Header.tsx`. Inventaire à faire de toutes les icônes utilisées + cohérence (toutes Lucide ou mélange ?).
- **SVG inline** — pattern existant dans certains composants (probable : Hero patterns, dividers, hairlines, bullets custom).
- **Tailwind v4 gradients** — `bg-terracotta`, `bg-mocha`, `bg-sage`, `bg-paper`, `bg-sand`, gradients composés via `@theme` block dans `globals.css`.
- **Pattern « HeroSchema » composants** — déjà très généralisé (vérifié 2026-05-07). Présents et commités dans `src/components/sections/` : `InterventionsHeroSchema.tsx`, `AuditHeroSchema.tsx`, `ImplementationHeroSchema.tsx` (commit `6dab615`), `CaseStudiesHeroSchema.tsx` (commit `47d4db1`), `StackHeroSchema.tsx` (commit `b9f0748`), `MethodologyHeroSchema.tsx`, `ComparisonsHeroSchema.tsx`, `HelpHeroSchema.tsx`, `DetailHeroSchema.tsx`. Le pattern est désormais le standard pour toute page « produit » ou « info-vitrine » majeure.
- **next/image** — utilisé pour assets bitmap (à inventorier où exactement).
- **Animations** — probable usage de `prefers-reduced-motion`, transitions Tailwind. À auditer.

### Outils/libs visuels NON utilisés (et qu'il ne faut PAS introduire)

- ❌ Pas de Figma → pas d'export Figma à intégrer.
- ❌ Pas de Lottie → pas d'animations JSON.
- ❌ Pas de Framer Motion (à vérifier — si absent, ne pas l'introduire pour ce seul audit).
- ❌ Pas de banque d'images externe (Unsplash/Pexels/etc.) — Will refuse.
- ❌ Pas de bibliothèque d'illustrations (undraw, blush, ouch.pics) — incompatible doctrine premium.

### Pipeline de génération d'assets (cible — ce que le prompt doit produire)

Pour tout visuel **non codable en SVG inline raisonnablement** (photo réaliste, illustration narrative complexe, scène conceptuelle), le rapport doit produire un **prompt GPT-image** copy-paste pour Will, calibré :

- **Style** : injecter explicitement la **palette Axion-IA exacte** (extraits de `globals.css` `@theme` block v3.1, vérifié 2026-05-07) :
  - `--color-bg` (canvas ivoire chaud) : **`#faf8f3`**
  - `--color-paper` (blanc pur) : **`#ffffff`**
  - `--color-sand` : **`#f0e9da`** · `--color-sand-deep` : **`#e6dcc4`**
  - `--color-mocha` (brun-aubergine, PAS noir) : **`#2a2520`** · `--color-mocha-soft` : **`#3d362f`** · `--color-mocha-fg` : **`#f7f3ea`**
  - `--color-fg` (anthracite-brun, PAS noir) : **`#1a1815`** · `--color-fg-soft` : **`#524b41`** · `--color-fg-muted` : **`#6b6155`**
  - `--color-primary` (bleu profond Webflow) : **`#1a4dd9`** · `--color-primary-soft` : **`#e8efff`**
  - `--color-terracotta` (brique chaude) : **`#c24a1b`** · `--color-terracotta-soft` : **`#f5e3d8`** · `--color-terracotta-deep` : **`#8c3010`**
  - `--color-sage` (vert proof) : **`#5e6c54`** · `--color-sage-soft` : **`#e6ebe2`**
  - `--color-border` : **`#e5ddc8`** · `--color-border-strong` : **`#c8bda0`**

  ⚠️ **Aucune couleur hors palette dans les visuels générés.** Le préfixe brand GPT-image (chapitre 4.3) doit citer ces hex EXACTS, pas approximations.

- **Composition** : éditoriale, pas marketing-flashy. Léger, désaturé, premium.
- **Format** : portrait ou paysage selon usage (hero = paysage 16:9, sidekick = carré ou portrait, OG image = 1200x630).
- **Format de sortie OpenAI** : preférer `gpt-image-1` (qualité 2026, gestion texte dans images, multi-tour) ou DALL-E 3 standard via ChatGPT.
- **Pattern de prompt** : `[Style: editorial illustration, restrained palette terracotta/mocha/sage/paper/sand, light desaturated, premium B2B feel] [Subject: ...] [Composition: ...] [Constraints: no text, no people faces (or specific persona), no stock-photo aesthetic, vector-illustration style, generous negative space]`.

### Centralisations à respecter (cf. `PROMPT-HEADER-NAVIGATION-2026.md` v1.3)

- Tokens couleur dans `globals.css` `@theme` block — ne pas hardcoder de hex en dehors.
- Iconographie : Lucide React seul (cohérence). Si une icône Lucide manque, codée en SVG inline avec mêmes `stroke-width: 1.5` et style outline.
- Composants HeroSchema : pattern à étendre par page (`InterventionsHeroSchema.tsx`, `AuditHeroSchema.tsx`, etc.).
- Métadonnées image : centralisation `src/lib/seo.ts` à étendre avec `buildImageObjectJsonLd({ url, caption, contentUrl, creator })`.

---

## 📚 SOURCES DE VÉRITÉ

### Référence interne

1. `axionia/src/app/globals.css` — `@theme` block (palette + gradients + tokens visuels).
2. `axionia/Design.md` — doctrine v3 Editorial Premium Light.
3. `axionia/CLAUDE.md` — règles éditoriales/visuelles globales.
4. `axionia/src/components/sections/StackHeroSchema.tsx` + `CaseStudiesHeroSchema.tsx` + `InterventionsHeroSchema.tsx` + `AuditHeroSchema.tsx` + `ImplementationHeroSchema.tsx` + `MethodologyHeroSchema.tsx` + `ComparisonsHeroSchema.tsx` + `HelpHeroSchema.tsx` + `DetailHeroSchema.tsx` (tous commités HEAD 2026-05-07) — patterns gold standard.
5. `axionia/src/components/marketing/JsonLd.tsx` + `lib/seo.ts` — pour étendre `ImageObject`.
6. Mémoires Claude : `axionia_design_pivot.md` (HEAD `941a8e1`+ committed direction), `axionia_naming_cabinet.md`, `axionia_progress.md`.

### Pages à auditer (Top 20 stratégiques — toutes existantes sur disque)

#### A. Pillar / hero-driven (5)

- `/` (home).
- `/interventions` (gold standard parity).
- `/audit`.
- `/stack-ia` (refonte en cours, prendre HEAD ou working tree selon décision Will).
- `/methodologie` (page longue, candidate prioritaire pour diagrammes).

#### B. Listings / programmatic (5)

- `/implementation`.
- `/cas-concrets`.
- `/comparaisons`.
- `/blog`.
- `/centre-aide` (FR) / `/help` (EN).

#### C. Pages produit/process (4)

- `/interventions/[slug]` — auditer 1-2 sous-pages représentatives.
- `/audit/[slug]` (si existant).
- `/automatisations`.
- `/guide-ia`.

#### D. Pages éditoriales transversales (3)

- `/a-propos` (candidate forte pour photo Will + équipe).
- `/contact`.
- `/presse`.

#### E. Pages utilitaires denses (3)

- `/roi` (RoiSimulator — besoin diagrammes).
- `/reserver` (BookingFlow — besoin visuel rassurant).
- `/faq`.

### Benchmarks externes 2026 (WebFetch + screenshots)

1. **anthropic.com** — illustrations diagrammatiques propriétaires.
2. **stripe.com / press.stripe.com** — diagrammes technique + ligne éditoriale magazine.
3. **linear.app** — UI screenshots ultra-soignés.
4. **vercel.com** — code blocks visuels + gradient meshes.
5. **openai.com** — illustrations abstraites éditoriales.
6. **mistral.ai** — palette restreinte, illustrations vectorielles.
7. **anthropic.com/research** — dataviz scientifique.
8. **mckinsey.com** — concurrent B2B premium, pour comparaison « consulting visual language ».
9. **pennylane.com** — comparable B2B FR premium.
10. **arc.net** — référence créative absolue 2026 (palette + animations + illustrations).

Pour chaque benchmark, extraire :

- Type d'imagerie dominant (illustration / photo / diagramme / UI screenshot / mix).
- Cadence visuelle (combien de visuels par page longue).
- Palette utilisée dans les visuels (cohérence avec brand ?).
- Style illustration (vectoriel / 3D / aquarelle / mixed media / minimaliste).
- Emploi photos humaines (équipe / clients / personne).
- ⚠️ Faille observée → leçon pour Axion-IA.

---

## 🔍 PÉRIMÈTRE D'AUDIT (10 chapitres × 10 critères = 100 points)

### Chapitre 1 — Audit visuel page-par-page (fiche prescriptive par page)

1.1 Inventaire visuels actuels par page (icônes Lucide, SVG inline, gradients, screenshots, animations).
1.2 Calcul mots/page vs ancrages visuels/page → ratio cible : **1 ancrage tous les 1-2 écrans de scroll** (~300-500 mots).
1.3 Identification sections « mur de texte » > 600 mots sans visuel.
1.4 Hero présence + qualité (chaque page > niveau 2 doit avoir un hero visuel ou diagramme).
1.5 Closing visuel (avant CTA final) — souvent oublié, critique pour conversion.
1.6 Mobile : ratio adapté (mobile = besoin de plus de respiration encore).
1.7 Cohérence inter-pages (palette + style illustration + composants HeroSchema).
1.8 « Hot spots » d'ennui visuel (zones où le lecteur skim ou abandonne).
1.9 Doublons visuels (même icône Lucide réutilisée 5 fois sur la même page = signal pauvreté).
1.10 Pour chaque page, **classement priorité** (P0 critique / P1 important / P2 nice-to-have).

### Chapitre 2 — Hero & section openers (premier visuel impactant)

2.1 Pattern HeroSchema généralisé : chaque page pillier doit avoir son `[Page]HeroSchema.tsx` (cf. existants : Stack, CaseStudies, Implementation).
2.2 Type de hero recommandé par page (diagramme conceptuel SVG / illustration narrative GPT-image / UI screenshot annoté / chiffre clé géant + accent visuel).
2.3 Dimensions : aspect ratio cible (paysage 16:9 desktop, vertical mobile-first responsive).
2.4 Animation au scroll : subtile (parallax léger, fade-in stagger), respecter `prefers-reduced-motion`.
2.5 Section openers (mid-page) : marqueur visuel pour rythmer (diviseur SVG, KPI styled, citation pull-quote).
2.6 Eyebrow + numberLabel + accent visuel — pattern existant dans `stack-ia.ts` (`numberLabel`, `accent`), à généraliser.
2.7 Section transitions : éviter les ruptures abruptes texte→texte (insérer divider visuel terracotta hairline ou similaire).
2.8 Section cards : `tone` alterné (paper / sand / halo-warm / halo-cool / canvas — pattern vu dans `stack-ia.ts`).
2.9 Hero accessibility : alt riche, focus visible si interactif, ARIA appropriate.
2.10 LCP impact : si hero contient image bitmap, `priority` sur `next/image` + AVIF/WebP sources.

### Chapitre 3 — Diagrammes & schémas (process / méthodologie)

3.1 Pages éligibles diagrammes : `/methodologie`, `/audit`, `/implementation`, `/interventions`, `/automatisations`, `/roi`, `/guide-ia`.
3.2 Type recommandé : diagramme SVG codé en composant React (pas image bitmap) pour scalabilité + cohérence palette + i18n des labels.
3.3 Patterns visuels : flow diagram (étapes process), Sankey (KPI → résultats), tree (taxonomie IAs), matrix (comparaison), timeline (sprints/jalons), funnel (conversion).
3.4 Niveau de détail : un diagramme = remplace ~300-500 mots. Si trop dense, splitter.
3.5 Annotations : labels lisibles à toutes tailles, zoom mobile possible si dense.
3.6 Animation au reveal : stagger des éléments à l'entrée viewport (≤ 1s total, respect motion).
3.7 Style : line-art outline (cohérent Lucide + serif italique brand), pas de couleurs flashy.
3.8 Réutilisabilité : créer un composant `<ProcessDiagram>` paramétrable plutôt que dupliquer.
3.9 Source de vérité : labels via i18n (`messages/fr.json` / `messages/en.json`), pas hardcodés.
3.10 Export en image OG / partage : `opengraph-image.tsx` qui réutilise le diagramme SSR-rendered → image dynamique partagée sur LinkedIn.

### Chapitre 4 — Illustrations narratives (storytelling)

4.1 Pages éligibles : `/a-propos`, `/methodologie`, `/audit` (sections introductives).
4.2 Type recommandé : illustration éditoriale GPT-image (style cohérent calibré).
4.3 **Prompt GPT-image template** (pour Will, copy-paste dans ChatGPT — hex palette EXACTS v3.1) :

```
Editorial illustration, Axion-IA brand restrained palette EXACTLY:
terracotta brick #c24a1b (accent only, sparingly),
warm mocha brown #2a2520 (deep tones, NEVER pure black),
sage green #5e6c54 (proof/secondary accent),
ivory cream #faf8f3 (background),
warm sand #f0e9da (mid-tones).
Style: editorial vector illustration, light desaturated, premium B2B consulting aesthetic,
slightly hand-drawn quality, generous negative space, minimal detail, sophisticated restraint.
Subject: [DESCRIPTION SCENE]. Composition: [LAYOUT, where main subject is positioned].
Aspect ratio: [16:9 horizontal / 1:1 square / 4:5 portrait].
Constraints (strict): no text in image, no realistic photographic faces (stylized silhouettes OK),
no stock-photo corporate aesthetic, no 3D isometric, no startup clichés (lightbulbs, rockets,
gears, lego blocks), no neon glow, no excessive gradients, no detailed faces.
Reference: visual language of Anthropic research papers + Stripe Press editorial illustrations.
```

4.4 **Choix moteur** :

- **DALL-E 3 via ChatGPT Plus** : gratuit (inclus abonnement), qualité bonne, **pas de seed reproductible** (chaque gen unique).
- **`gpt-image-1` via OpenAI API** : qualité 2026 supérieure (gestion meilleure du texte évité, palette plus fidèle), **supporte `seed` paramètre pour reproductibilité partielle**, coût ~$0.19/image qualité haute. Recommandé pour Axion-IA (cohérence > économie marginale).
- **DALL-E 3 via API** : ~$0.04-0.12/image standard / HD. Pas de seed.
  4.5 **Cohérence multi-illustrations — stratégies cumulables** :
- (a) Toutes générations dans **la même session ChatGPT** (le contexte de session aide à la cohérence stylistique sur DALL-E 3).
- (b) Avec `gpt-image-1` API : utiliser le **même `seed`** sur tous les prompts d'une même collection (ex: `seed=42` pour toutes les illustrations `/methodologie`).
- (c) Workflow **image-to-image / variations** : générer 1 image « référence absolue » validée par Will, puis utiliser GPT-image-1 mode `edit` ou `variations` à partir de cette référence pour les suivantes (cohérence ~80%+).
- (d) **Style guide injecté en system prompt** (si API) — bloc préfixe identique à toutes les requêtes.
- (e) En dernier recours : reprendre une image générée et la modifier via prompt suivant (« même style mais sujet différent : [nouveau] »).
  4.6 Validation par Will : checklist (palette respectée, pas de visage uncanny, pas de texte parasite, négatif space suffisant).
  4.7 Format final : PNG transparent ou JPG haute qualité → conversion AVIF/WebP via build pipeline next/image.
  4.8 Naming convention : `public/illustrations/[page]-[slot].avif` (ex: `a-propos-hero.avif`).
  4.9 Alt text obligatoire : descriptif pour SEO/AEO + a11y (ex: « Illustration éditoriale représentant un cabinet IA opérationnel : silhouette stylisée d'un consultant face à un système de modules connectés »).
  4.9bis **Alt text i18n** : alt FR ≠ alt EN. Centralisation via `messages/fr.json` + `messages/en.json` (clés `images.[page].[slot].alt`) OU via `src/content/[page].ts` (champ `image.altFr` / `image.altEn`). Pas de hardcode dans JSX.
  4.10 Schema `ImageObject` : pour illustrations clés (hero), injecter via `buildImageObjectJsonLd({ url, caption, contentUrl, locale })` (à créer dans `lib/seo.ts`) dans page metadata.

### Chapitre 5 — UI screenshots & dashboards (cas-concrets, démos)

5.1 Pages éligibles : `/cas-concrets`, `/cas-concrets/[slug]`, `/comparaisons/[slug]`, `/stack-ia` (déjà avec monogrammes), `/automatisations`.
5.2 UI screenshots authentiques (réels écrans clients, anonymisés) > mock-ups génériques.
5.3 Anonymisation RGPD : flouter données nominatives, remplacer noms/emails par fictifs (« Marie L. », « contact@exemple.fr »).
5.4 Format : capture PNG haute résolution → conversion AVIF + WebP via next/image.
5.5 Mise en scène : ne pas afficher le screenshot brut, l'inscrire dans un cadre stylisé (browser frame minimaliste, mocha border 1px, drop shadow subtle).
5.6 Annotations : pointers SVG codés en overlay (pas dans l'image), pour i18n et a11y.
5.7 Si pas de screenshot client disponible : générer mock-up SVG codé (composant React stylisé qui imite UI), pas image bitmap GPT-image (uncanny valley sur UI).
5.8 Lazy load : `loading="lazy"` sauf hero.
5.9 Sizing : `sizes` attribute correct pour responsive (mobile ≠ desktop).
5.10 Galerie cas-concret : si plusieurs screenshots, lightbox accessible (focus trap, ESC, alt text).

### Chapitre 6 — Iconographie (cohérence Lucide)

6.1 Inventaire complet icônes utilisées (grep `from "lucide-react"`).
6.2 Cohérence stroke-width (Lucide default 2 vs 1.5 — choisir et figer).
6.3 Tailles cohérentes : `size-4` / `size-5` / `size-6` Tailwind tokens, pas custom px.
6.4 Couleur : héritée du parent (`currentColor`), pas hardcodée.
6.5 Pas de mélange icon libraries (Heroicons + Lucide + emoji = anti-pattern).
6.6 Icônes décoratives : `aria-hidden="true"` obligatoire.
6.7 Icônes informatives (sans label texte) : `aria-label` ou `<title>` SVG.
6.8 Si une icône Lucide manque pour un concept précis : SVG inline custom respectant style Lucide (24x24, stroke 1.5, round caps).
6.9 Animation icônes : limitée (hover state subtle, pas de spinning permanent).
6.10 Cohérence inter-pages : même concept = même icône partout (un cas-concret → toujours `<Briefcase>`, jamais alterner).

### Chapitre 7 — Photos humaines (E-E-A-T AEO/GEO 2026)

7.1 Importance 2026 : Google E-E-A-T + Perplexity/Claude.ai citent l'auteur → besoin de photos authentiques (Will + équipe si applicable).
7.2 Pages prioritaires : `/a-propos`, `/contact`, `/presse`, footer (auteur articles blog).
7.3 Photo Will : recommander photo professionnelle authentique (pas selfie iPhone, pas LinkedIn corporate carré). Si Will préfère ne pas se photographier : alternative = portrait illustré GPT-image (silhouette stylisée non-réaliste, pas tentative de ressemblance).
7.4 Schema `Person` (déjà dans `lib/seo.ts` ?) — auteur articles blog, fondateur cabinet, schema avec `image` URL.
7.5 Format : portrait 1:1 ou 4:5, crop visage centré, fond paper/sand uni.
7.6 Anonymisation clients : pour cas-concrets, jamais photo client réelle sans accord écrit. Préfère illustration GPT-image générique de la fonction (« CFO d'une PME industrielle »).
7.7 Pas de photos stock générique « équipe diverse souriante » — anti-pattern absolu.
7.8 Pas de photos « bureau Estonie » (revendication OÜ) si pas authentique — éviter le mensonge visuel.
7.9 Alt text photos personnes : nom + rôle (ex : « Will [Nom], fondateur Axion-IA »).
7.10 Cohérence colorimétrie : photos retouchées avec léger filtre warm (palette terracotta/mocha) pour cohérence brand. Possible via Photoshop ou ChatGPT image edit.

### Chapitre 8 — Image SEO / AEO 2026

8.1 Alt text : descriptif riche, naturel, contient kw pertinents sans bourrage.
8.2 Filename SEO-friendly : `audit-ia-cabinet-axionia.avif` > `IMG_1234.avif`.
8.3 Schema `ImageObject` JSON-LD pour images clés : `creator` = Axion-IA, `caption`, `contentUrl`, `license`.
8.4 OpenGraph image dédiée par page : `opengraph-image.tsx` Next.js 16 + **`ImageResponse`** (`next/og`) — composant React SSR-rendered en PNG 1200x630 au build/runtime. Permet de générer des OG images dynamiques (ex: `/cas-concrets/[slug]/opengraph-image.tsx` qui prend titre + accent terracotta + diagramme depuis le slug). Pas besoin de bitmap statique. Plus puissant que template Photoshop. Réutilise les fonts `next/font` déjà chargées.
8.5 Twitter card `summary_large_image` (1200x630, déjà géré dans `lib/seo.ts buildProductMetadata`).
8.6 LinkedIn preview : check rendering via inspector LinkedIn.
8.7 Sitemap images : Google sitemap-image.xml dédié si nombreux assets — overkill pour Axion-IA actuel, mais à prévoir si pSEO villes (chaque ville = 1+ image).
8.8 AEO : Perplexity/SGE/Claude.ai citent images si schema correct + alt riche + caption visible.
8.9 GEO : `<figure><img alt="..."><figcaption>...` plus puissant que `<img alt>` seul (signal sémantique fort).
8.10 No-text-in-image rule : éviter texte intégré dans visuel (sauf logos), préférer overlay HTML (i18n + a11y + SEO).

### Chapitre 9 — Performance images

9.1 Format : AVIF en source primaire, WebP fallback, pas de JPEG sauf photos hyper-réalistes.
9.2 `next/image` partout (pas `<img>` brut), avec `sizes` correct.
9.3 LCP image : `priority` attribute sur hero image only.
9.4 Lazy loading : default sur tout sauf hero (`loading="lazy"` implicite via next/image).
9.5 Placeholder : `placeholder="blur"` avec `blurDataURL` généré via plaiceholder ou similaire (build-time).
9.6 Sizing exact : pas d'over-fetching (image 4K servie sur thumbnail mobile = waste).
9.7 CDN : confirmer que prod sert via CDN (Vercel default OK).
9.8 Total page weight : viser < 1 Mo total (images comprises) sur pages standard.
9.9 SVG inline vs `<img src>` : préférer inline pour < 5 KB (gain HTTP request), `<img>` au-delà.
9.10 Animation : si GIF, convertir en `<video autoplay muted loop playsinline>` MP4/WebM (gain weight 80%+).

### Chapitre 10 — Style guide & cohérence (livrable structurant)

10.1 **Palette stricte** : extraire les hex exacts de `globals.css` `@theme` block (terracotta, mocha, sage, paper, sand, accents) → variables stylebook.
10.2 **Système iconographique** : Lucide stroke 1.5, stroke-linecap round, fill none.
10.3 **Style illustration** : éditorial vectoriel light, négatif space généreux, jamais 3D, jamais photo stock.
10.4 **Style photo** : portrait crop centré, fond paper uni, filtre warm subtle.
10.5 **Style diagramme** : line-art outline, palette restreinte (max 3 couleurs/diagramme), labels typographiques (Manrope sans, Fraunces serif italique pour `titleEm` brand-coherent).
10.6 **Hierarchy visuelle** : hero > section opener > inline support > decorative.
10.7 **Cohérence inter-pages** : si une icône représente un concept (« audit »), même icône partout, jamais alterner.
10.8 **Prompts GPT-image préfixe** : tous les prompts doivent commencer par le même bloc « style editorial Axion-IA » pour cohérence inter-générations.
10.9 **Naming assets** : convention `public/[type]/[page]-[slot].[ext]` (`illustrations/`, `screenshots/`, `portraits/`, `og/`).
10.10 **Versioning** : si refresh asset, garder ancien sous `-v1` (rollback possible).

---

## 🛠️ MÉTHODOLOGIE D'AUDIT (3 agents parallèles + agent principal)

### Agent A — Inventaire visuel interne (lecture seule)

- Grep `from "lucide-react"` → liste complète icônes utilisées + occurrences par page.
- Grep `<svg`, `<Image`, `next/image` → liste assets bitmap + SVG inline.
- Lire `globals.css` `@theme` block → extraire hex palette exacts (déjà fait v1.1, à reconfirmer).
- Inventorier `public/` (toutes images existantes).
- **Lire intégralement les composants `*HeroSchema*` existants pour comprendre le pattern à généraliser** :
  - `src/components/sections/InterventionsHeroSchema.tsx`.
  - `src/components/sections/AuditHeroSchema.tsx`.
  - `src/components/sections/ImplementationHeroSchema.tsx` (commit `6dab615`).
  - `src/components/sections/CaseStudiesHeroSchema.tsx` (commit `47d4db1`).
  - `src/components/sections/StackHeroSchema.tsx` (commit `b9f0748`).
  - `src/components/sections/MethodologyHeroSchema.tsx`.
  - `src/components/sections/ComparisonsHeroSchema.tsx`.
  - `src/components/sections/HelpHeroSchema.tsx`.
  - `src/components/sections/DetailHeroSchema.tsx`.
  - Tout autre `*HeroSchema*` ou `*Schema*.tsx` détecté via `Glob src/components/**/*Schema*.tsx`.
  - Extraire : structure SVG/JSX, tokens couleur utilisés, animation, responsive, a11y.
  - Doit servir de **modèle gold standard** pour identifier les pages restantes sans HeroSchema (le cas échéant).
- Pour chaque page Top 20 (cf. Sources), produire fiche d'inventaire :
  - Visuels actuels (type + position + accessibilité).
  - Word count par section.
  - Identification sections « mur de texte ».
- Output : `visual-inventory.md` + `heroschema-pattern-analysis.md` (extraction du pattern gold standard).

### Agent B — Benchmarks externes (WebFetch — notes textuelles)

- WebFetch sur les 10 sites benchmark.
- ⚠️ **WebFetch ne capture PAS d'images réelles** — il extrait HTML+CSS texte. L'agent ne pourra donc pas voir littéralement les illustrations. Stratégie de contournement :
  - Lire les balises `<img>` + `<picture>` + `srcset` + `<svg>` dans le HTML.
  - Lire les classes CSS pour comprendre palette + layout.
  - Extraire les URLs d'images et les analyser par leur **nom de fichier + alt text** (souvent descriptif : « hero-illustration-research.svg » donne déjà des infos).
  - Documenter ce qu'on peut déduire textuellement (structure, position, palette annoncée), sans prétendre voir l'image.
  - Si ambigü : noter « visuel non analysable depuis HTML, à inspecter manuellement ».
- Matrice comparative type d'imagerie (déduit) / cadence (sections HTML) / palette (CSS) / style (descriptions textuelles).
- Output : `benchmarks-visual-2026.md`.

### Agent C — Style guide & prompts GPT-image générateurs

- Sur la base de la palette extraite (Agent A) + benchmarks (Agent B), produire :
  - **Style guide Axion-IA imagerie** (palette + iconographie + photo + illustration + diagramme + animation).
  - **Prompt préfixe GPT-image** réutilisable (le bloc « editorial illustration in restrained palette... » à coller en début de toute génération).
  - **20-50 prompts spécifiques** prêts à coller, un par visuel manquant identifié (à compléter par l'agent principal après diag).
- Output : `visual-style-guide.md` + base de `gpt-image-prompts.md`.

### Agent principal — Synthèse + fiches prescriptives par page

- Consolider les 3 agents.
- Pour chaque page Top 20, produire **fiche prescriptive** structurée :

  ```
  ## Page : /xxx

  ### Inventaire actuel
  - Visuels : [liste]
  - Word count : [N mots]
  - Ratio : [N visuels / N écrans de scroll]

  ### Diagnostic
  - 🔴 / 🟠 / 🟢 [verdict global]
  - Sections mur de texte : [liste]
  - Hot spots ennui : [liste]

  ### Prescriptions (par priorité)

  #### P0 — [Titre]
  - **Type** : [diagramme SVG codé / illustration GPT-image / UI screenshot / photo / icône]
  - **Position** : [section précise]
  - **Composant React cible** : [ex: créer `MethodologyHeroSchema.tsx`]
  - **Si GPT-image, prompt** :
  ```

  [prompt copy-paste prêt]

  ```
  - **Alt text** : [proposition]
  - **Schema** : [ImageObject JSON-LD si applicable]

  #### P1 — [Titre]
  ...
  ```

- Calculer effort total (heures dev + nombre génération GPT-image + **budget OpenAI chiffré**).
- **Chiffrage coût OpenAI** (référence 2026) :
  - DALL-E 3 standard : $0.040/image · DALL-E 3 HD : $0.080/image.
  - GPT-image-1 low quality : $0.011/image · medium : $0.042/image · high : $0.190/image.
  - GPT-image-1 image edits : ~même tarif que generation.
  - Pour Axion-IA : recommander GPT-image-1 high (qualité + seed reproductible). Budget cible :
    - MIN ~10 visuels × $0.19 = **~$2** (négligeable).
    - STANDARD ~25 visuels × $0.19 = **~$5**.
    - PERFECTION ~50-80 visuels × $0.19 = **~$10-15**.
  - Inclure **+30% de budget retries** (gens ratées, ajustements) → PERFECTION ~$15-20 total.
- 3 scénarios chiffrés :
  - **Scénario MIN** : combler les P0 critiques uniquement (~5-10 visuels manquants). Effort dev : 4-8h. Coût OpenAI : ~$2.
  - **Scénario STANDARD** : P0 + P1 (rythme visuel correct partout). Effort dev : 12-20h. Coût OpenAI : ~$5.
  - **Scénario PERFECTION 2026** : P0 + P1 + P2 + diagrammes spécifiques par page + photos Will + style guide complet appliqué. Effort dev : 30-50h. Coût OpenAI : ~$15-20.
- Output : `_AUDIT/AUDIT-VISUAL-RHYTHM-2026.md` + `gpt-image-prompts.md` finalisé + `visual-gaps-by-page.csv`.

---

## ⛔ INTERDITS ABSOLUS

- ❌ **Recommander des assets stock** (Unsplash, Pexels, banque images génériques).
- ❌ **Recommander un illustrateur externe** (budget Will = zéro).
- ❌ **Recommander Figma / Lottie / Framer Motion** si pas déjà installé.
- ❌ **Modifier la palette** existante (`@theme` `globals.css` est figée — direction visuelle commitée mémoire `axionia_design_pivot`).
- ❌ **Modifier le logo** (rappel des contraintes header).
- ❌ **Générer effectivement les images** durant l'audit (Will les générera lui-même avec les prompts livrés).
- ❌ **Modifier du code** durant l'audit (lecture seule strict).
- ❌ **Photos stock corporate** (poignée de main, équipe diverse souriante, lightbulb, rocket — anti-patterns 2026).
- ❌ **Illustrations 3D isométriques génériques** type undraw.co (signal startup 2018).
- ❌ **Surcharger** : viser respiration premium, pas saturation visuelle.

---

## ✅ LIVRABLES ATTENDUS

1. **`_AUDIT/AUDIT-VISUAL-RHYTHM-2026.md`** (rapport principal, ~4000-6000 mots) :
   - Synthèse exécutive (1 page).
   - Diagnostic global (par chapitre 1-10).
   - **Fiche prescriptive par page** (Top 20 pages).
   - Benchmark comparatif 10 sites.
   - 3 scénarios chiffrés (MIN / STANDARD / PERFECTION 2026).
   - Roadmap d'implémentation par sprint.

2. **`_AUDIT/visual-style-guide.md`** : style guide unifié Axion-IA imagerie (palette extraite, iconographie, photo, illustration, diagramme, animation, naming convention).

3. **`_AUDIT/gpt-image-prompts.md`** : prompts GPT-image prêts à coller (préfixe brand commun + un prompt par visuel manquant identifié, structuré par page).

4. **`_AUDIT/visual-gaps-by-page.csv`** : matrice avec colonnes `page | gap_type | priority (P0/P1/P2) | recommended_solution | effort_hours | gpt_prompt_id`.

5. **`_AUDIT/benchmarks-visual-2026.md`** : matrice 10 sites benchmarks avec captures de patterns visuels.

6. **`_AUDIT/visual-inventory.md`** (Agent A pré-requis) : inventaire visuel interne complet.

---

## 🚦 PROTOCOLE STOP & ASK

À chaque jonction critique :

1. **Avant de finaliser le style illustration** (vectoriel light vs aquarelle vs ligne pure) — Will valide direction.
2. **Avant de recommander photo Will** — Will confirme s'il accepte d'être photographié ou préfère illustration silhouette.
3. **Avant de proposer dépendance non installée** (ex: `plaiceholder` pour blur placeholders) — vérifier alternative pure native.
4. **Avant de recommander un scénario** (MIN / STANDARD / PERFECTION) — chiffrer effort + impact perçu.
5. **Avant de produire les 50+ prompts GPT-image** — valider le prompt préfixe brand avec Will sur 1-2 essais (sinon dérive style sur 50 gens).

---

## 📐 FORMAT DE SORTIE PRINCIPAL

Le rapport `AUDIT-VISUAL-RHYTHM-2026.md` doit ouvrir sur :

```
# Audit Visual Rhythm 2026 — Axion-IA

> Statut : DRAFT en attente validation Will
> Date : 2026-05-XX
> Référence HEAD : <sha>
> Périmètre : Top 20 pages stratégiques + style guide + prompts GPT-image

## 0. Synthèse exécutive (1 page)

**Diagnostic** : <2-3 phrases sur le rythme visuel global>.
**Pages les plus problématiques** : <top 3>.
**Pages les plus saines** : <top 3>.
**Recommandation** : <scénario retenu + justification>.
**Effort** : <heures dev + nombre prompts GPT-image>.
**Prompt préfixe brand validé** : <copy-paste>.
```

Puis fiches prescriptives par page (Top 20), puis style guide, puis annexes.

---

## 🎬 EXEMPLE DE LANCEMENT

> « Lance l'audit Visual Rhythm 2026 selon `_AUDIT/PROMPT-VISUAL-RHYTHM-2026.md` (v1.0). Working dir : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`. Audit 100% prescriptif (top demandé), pas défensif. Lance les 3 agents parallèles + agent principal. Pour chaque page Top 20, livre une fiche avec inventaire actuel + diagnostic + prescriptions chiffrées (P0/P1/P2) + prompt GPT-image copy-paste si visuel à générer. Livre style guide unifié + 50+ prompts GPT-image structurés par page. Aucun asset à banque externe ni illustrateur (budget zéro, génération via GPT-image uniquement). Lecture seule strict, pas de modif code, pas de génération effective d'image. Pas de photo stock générique. Vise scénario PERFECTION 2026. »

---

**Fin du prompt v1.1 · 2026-05-07.**

---

## 📝 CHANGELOG

- **v1.1 (2026-05-07)** : palette hex EXACTS extraits de `globals.css` v3.1 (terracotta `#c24a1b` vs `~#C66A4F` faux v1.0, idem mocha `#2a2520`, sage `#5e6c54`, bg `#faf8f3`, sand `#f0e9da`, etc.). Préfixe brand GPT-image refait avec vrais hex + référence Anthropic/Stripe Press. Section 4.4 enrichie : DALL-E 3 vs GPT-image-1 + seed reproductible + image-to-image variations + system prompt injection. OpenGraph dynamique via Next.js 16 `ImageResponse` (`next/og`). Alt text i18n via `messages/*.json` ou `src/content/*.ts` (4.9bis). Agent A doit lire explicitement `StackHeroSchema.tsx` + `CaseStudiesHeroSchema.tsx` + autres `*HeroSchema*.tsx` et produire `heroschema-pattern-analysis.md`. Agent B clarifié : WebFetch ne capture pas d'images, analyse textuelle seulement. Chiffrage coût OpenAI par scénario (~$2 MIN / ~$5 STANDARD / ~$15-20 PERFECTION).
- **v1.0 (2026-05-07)** : version initiale, 10 chapitres × 10 critères, 3 agents parallèles + agent principal, fiches prescriptives par page Top 20, prompts GPT-image copy-paste, contraintes intouchables (palette + logo + budget zéro hors GPT-image).
