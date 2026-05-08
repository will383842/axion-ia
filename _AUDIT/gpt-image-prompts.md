# GPT-Image Prompts Library — AxionIA Top 20 Pages

> **Version** : 1.0 · 2026-05-07
> **Statut** : DRAFT en attente validation Will
> **Périmètre** : 53 prompts GPT-image prêts à coller pour les 20 pages stratégiques d'AxionIA.
> **Doctrine** : Editorial Premium Light v3 + palette v3.1 EXACTE (cf. `visual-style-guide.md`).
> **Moteur cible recommandé** : `gpt-image-1` API OpenAI (seed reproductible) ou DALL-E 3 via ChatGPT Plus (fallback).
> **Budget OpenAI cible PERFECTION** : ~$13-15 (53 × $0.19 high quality + 30% retries).
> **Lecture seule** : ce fichier ne génère AUCUNE image, il livre les prompts copy-paste pour Will.

---

## Sommaire

- [Instructions de cohérence multi-générations](#instructions-de-coherence-multi-generations)
- [Préfixe brand AxionIA (à coller en tête de chaque prompt)](#prefixe-brand-axionia)
- [Table des prompts par page](#table-des-prompts-par-page)
- [A. Pillar pages (5)](#a-pillar-pages)
- [B. Listings pages (5)](#b-listings-pages)
- [C. Produit/process pages (4)](#c-produit-process-pages)
- [D. Éditoriales pages (3)](#d-editoriales-pages)
- [E. Utilitaires denses (3)](#e-utilitaires-denses)
- [Total : 53 prompts](#total)

---

## Instructions de cohérence multi-générations

Avant de lancer la production des 53 illustrations, fixer la stratégie suivante (cf. `visual-style-guide.md` § 11) :

1. **Moteur** : `gpt-image-1` via OpenAI API (qualité 2026, gestion meilleure du « no text in image », support `seed`). Fallback : DALL-E 3 via ChatGPT Plus (gratuit, qualité bonne, mais pas de seed).
2. **Seed** : `42` figé sur toutes les générations de cette collection (cohérence ~75-85%).
3. **Workflow recommandé** :
   - **Étape 1** : générer `HOME-01-hero` avec le prompt complet (préfixe brand + sujet + composition).
   - **Étape 2** : faire valider par Will (palette respectée, négatif space ≥ 40%, accent terracotta ≤ 15%, pas de visage uncanny, pas de texte parasite).
   - **Étape 3** : pour les 52 prompts suivants, utiliser `gpt-image-1` mode `edit` / `variations` à partir de `HOME-01-hero` validée comme **référence absolue**. Le prompt devient : « Same style, same palette, same composition language as reference image. Subject: [SUJET DU PROMPT EN COURS] ».
   - **Étape 4** : conserver `seed=42` partout.
4. **Si DALL-E 3 ChatGPT Plus uniquement** : générer toutes les 53 dans **la même session de conversation** (cohérence contextuelle ~60-70%).
5. **Budget cible PERFECTION** : ~$15 OpenAI (53 × $0.19 + 30% retries pour gens ratées / ajustements).
6. **Validation systématique** : checklist 5 points par image (cf. fin de chaque prompt).

---

## Préfixe brand AxionIA

> **À copier-coller en début de chaque prompt ci-dessous.** Aucune approximation hex tolérée. Citer EXACTEMENT les codes ci-dessous.

```text
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

---

## Table des prompts par page

| ID                      | Page                        | Slot          | Aspect ratio | Filename                                                   |
| ----------------------- | --------------------------- | ------------- | ------------ | ---------------------------------------------------------- |
| HOME-01-hero            | `/`                         | hero          | 16:9         | `public/illustrations/home-hero.avif`                      |
| HOME-02-mid             | `/`                         | mid-1         | 1:1          | `public/illustrations/home-mid-1.avif`                     |
| HOME-03-mid             | `/`                         | mid-2         | 1:1          | `public/illustrations/home-mid-2.avif`                     |
| HOME-04-closing         | `/`                         | closing       | 16:9         | `public/illustrations/home-closing.avif`                   |
| INTERV-01-mid           | `/interventions`            | mid-1         | 1:1          | `public/illustrations/interventions-mid-1.avif`            |
| INTERV-02-closing       | `/interventions`            | closing       | 16:9         | `public/illustrations/interventions-closing.avif`          |
| AUDIT-01-hero           | `/audit`                    | hero          | 16:9         | `public/illustrations/audit-hero.avif`                     |
| AUDIT-02-process        | `/audit`                    | mid-1         | 4:5          | `public/illustrations/audit-mid-1.avif`                    |
| AUDIT-03-closing        | `/audit`                    | closing       | 16:9         | `public/illustrations/audit-closing.avif`                  |
| STACK-01-mid            | `/stack-ia`                 | mid-1         | 1:1          | `public/illustrations/stack-ia-mid-1.avif`                 |
| STACK-02-closing        | `/stack-ia`                 | closing       | 16:9         | `public/illustrations/stack-ia-closing.avif`               |
| METHO-01-hero           | `/methodologie`             | hero          | 16:9         | `public/illustrations/methodologie-hero.avif`              |
| METHO-02-mid            | `/methodologie`             | mid-1         | 1:1          | `public/illustrations/methodologie-mid-1.avif`             |
| METHO-03-mid            | `/methodologie`             | mid-2         | 4:5          | `public/illustrations/methodologie-mid-2.avif`             |
| METHO-04-closing        | `/methodologie`             | closing       | 16:9         | `public/illustrations/methodologie-closing.avif`           |
| IMPL-01-hero            | `/implementation`           | hero          | 16:9         | `public/illustrations/implementation-hero.avif`            |
| IMPL-02-mid             | `/implementation`           | mid-1         | 1:1          | `public/illustrations/implementation-mid-1.avif`           |
| IMPL-03-closing         | `/implementation`           | closing       | 16:9         | `public/illustrations/implementation-closing.avif`         |
| CAS-01-hero             | `/cas-concrets`             | hero          | 16:9         | `public/illustrations/cas-concrets-hero.avif`              |
| CAS-02-mid              | `/cas-concrets`             | mid-1         | 1:1          | `public/illustrations/cas-concrets-mid-1.avif`             |
| CAS-03-listing          | `/cas-concrets`             | mid-2         | 4:5          | `public/illustrations/cas-concrets-mid-2.avif`             |
| COMP-01-hero            | `/comparaisons`             | hero          | 16:9         | `public/illustrations/comparaisons-hero.avif`              |
| COMP-02-matrix          | `/comparaisons`             | mid-1         | 1:1          | `public/illustrations/comparaisons-mid-1.avif`             |
| BLOG-01-hero            | `/blog`                     | hero          | 16:9         | `public/illustrations/blog-hero.avif`                      |
| BLOG-02-article-generic | `/blog`                     | mid-1         | 1:1          | `public/illustrations/blog-article-generic.avif`           |
| AIDE-01-hero            | `/centre-aide`              | hero          | 16:9         | `public/illustrations/centre-aide-hero.avif`               |
| AIDE-02-section         | `/centre-aide`              | mid-1         | 1:1          | `public/illustrations/centre-aide-mid-1.avif`              |
| INT-DIR-01-hero         | `/interventions/dirigeants` | hero          | 16:9         | `public/illustrations/interventions-dirigeants-hero.avif`  |
| INT-DIR-02-mid          | `/interventions/dirigeants` | mid-1         | 1:1          | `public/illustrations/interventions-dirigeants-mid-1.avif` |
| INT-EQ-01-hero          | `/interventions/equipes`    | hero          | 16:9         | `public/illustrations/interventions-equipes-hero.avif`     |
| INT-EQ-02-mid           | `/interventions/equipes`    | mid-1         | 1:1          | `public/illustrations/interventions-equipes-mid-1.avif`    |
| AUD-PME-01-hero         | `/audit/strategique-pme`    | hero          | 16:9         | `public/illustrations/audit-strategique-pme-hero.avif`     |
| AUD-PME-02-mid          | `/audit/strategique-pme`    | mid-1         | 1:1          | `public/illustrations/audit-strategique-pme-mid-1.avif`    |
| GUIDE-01-hero           | `/guide-ia`                 | hero          | 16:9         | `public/illustrations/guide-ia-hero.avif`                  |
| GUIDE-02-mid            | `/guide-ia`                 | mid-1         | 4:5          | `public/illustrations/guide-ia-mid-1.avif`                 |
| GUIDE-03-closing        | `/guide-ia`                 | closing       | 16:9         | `public/illustrations/guide-ia-closing.avif`               |
| APROPOS-01-portrait     | `/a-propos`                 | portrait-will | 4:5          | `public/portraits/will-illustration.avif`                  |
| APROPOS-02-mid          | `/a-propos`                 | mid-1         | 1:1          | `public/illustrations/a-propos-mid-1.avif`                 |
| APROPOS-03-closing      | `/a-propos`                 | closing       | 16:9         | `public/illustrations/a-propos-closing.avif`               |
| CONTACT-01-hero         | `/contact`                  | hero          | 16:9         | `public/illustrations/contact-hero.avif`                   |
| CONTACT-02-mid          | `/contact`                  | mid-1         | 1:1          | `public/illustrations/contact-mid-1.avif`                  |
| PRESSE-01-hero          | `/presse`                   | hero          | 16:9         | `public/illustrations/presse-hero.avif`                    |
| PRESSE-02-mid           | `/presse`                   | mid-1         | 1:1          | `public/illustrations/presse-mid-1.avif`                   |
| ROI-01-sankey           | `/roi`                      | hero          | 16:9         | `public/illustrations/roi-hero.avif`                       |
| ROI-02-closing          | `/roi`                      | closing       | 1:1          | `public/illustrations/roi-closing.avif`                    |
| RES-01-hero             | `/reserver`                 | hero          | 16:9         | `public/illustrations/reserver-hero.avif`                  |
| RES-02-mid              | `/reserver`                 | mid-1         | 1:1          | `public/illustrations/reserver-mid-1.avif`                 |
| FAQ-01-hero             | `/faq`                      | hero          | 16:9         | `public/illustrations/faq-hero.avif`                       |
| FAQ-02-divider          | `/faq`                      | mid-1         | 1:1          | `public/illustrations/faq-mid-1.avif`                      |
| OG-HOME-01              | `/`                         | og            | 1200x630     | `public/og/home-og.png`                                    |
| OG-METHO-01             | `/methodologie`             | og            | 1200x630     | `public/og/methodologie-og.png`                            |
| OG-AUDIT-01             | `/audit`                    | og            | 1200x630     | `public/og/audit-og.png`                                   |
| OG-CAS-01               | `/cas-concrets`             | og            | 1200x630     | `public/og/cas-concrets-og.png`                            |
| OG-STACK-01             | `/stack-ia`                 | og            | 1200x630     | `public/og/stack-ia-og.png`                                |

**Total : 53 prompts.**

---

## A. Pillar pages

### Page : `/` (home)

#### Prompt #HOME-01-hero

- **Slot** : hero (top of page, sous le H1)
- **Aspect ratio** : 16:9 (paysage desktop)
- **Sujet** : architecture éditoriale d'un système opérationnel — modules abstraits connectés par des hairlines fines, vue de profil 3/4, comme un schéma de cabinet d'architecte vu sur papier ivoire.
- **Composition** : focal point décalé à droite (règle des tiers), espace négatif large à gauche pour overlay typographique HTML « Cabinet IA opérationnel ».

```text
[Coller préfixe brand AxionIA ici — voir top du document]

Subject: an editorial-style architectural diagram of an operational AI cabinet, drawn as if from a senior consultant's notebook. Several abstract rectangular modules of varying sizes connected by thin hairlines (think Anthropic research paper diagrams). One module is highlighted with a single subtle terracotta #c24a1b stroke accent. The overall feel is of a sophisticated system being mapped, not built — a draftsman's view of operational excellence.

Composition: focal point shifted to the right third of the frame (rule of thirds). Generous negative ivory cream #faf8f3 background on the left half (50%+) for HTML typographic overlay. Outlines in warm anthracite-brown #1a1815, depth shadows in deep mocha #2a2520. Very subtle warm sand #f0e9da fills on 1-2 modules. One discreet sage green #5e6c54 dot as proof marker.

Aspect ratio: 16:9 horizontal.
Negative space: 50% minimum on the left half.
Mood: serene, premium, contemplative — like opening a Stripe Press magazine to a research illustration.
```

- **Alt text FR** : « Schéma éditorial d'un cabinet IA opérationnel : modules connectés par des hairlines fines, accent terracotta sur un module-clé, esthétique inspirée des illustrations Anthropic. »
- **Alt text EN** : « Editorial diagram of an operational AI consultancy: abstract modules connected by thin hairlines, single terracotta accent on a key module, visual language inspired by Anthropic research illustrations. »
- **Filename target** : `public/illustrations/home-hero.avif`
- **Validation checklist** :
  1. Palette respectée (uniquement les hex v3.1 cités) ?
  2. Accent terracotta ≤ 15% de la composition ?
  3. Négatif space ≥ 40% (idéalement ≥ 50% à gauche) ?
  4. Pas de texte parasite intégré dans l'image ?
  5. Pas de visage humain photographique ?

---

#### Prompt #HOME-02-mid

- **Slot** : mid-1 (mi-page, après section « Pourquoi AxionIA »)
- **Aspect ratio** : 1:1 (square)
- **Sujet** : main stylisée tenant un instrument de mesure éditorial (compas ouvert, ou règle pliée) au-dessus d'une feuille gridée.
- **Composition** : centré, instrument occupe 40% du carré.

```text
[Coller préfixe brand AxionIA ici]

Subject: a stylized hand (silhouette only, no realistic skin texture) holding an open architect's compass over a gridded ivory paper. The compass tip touches one node on the grid, suggesting precision and calibration. Linework only, slightly hand-drawn quality.

Composition: centered subject, the compass occupies roughly 40% of the square frame. Background: ivory cream #faf8f3 with very subtle warm sand #f0e9da grid lines (barely visible, like an architect's tracing paper). Outlines in warm anthracite-brown #1a1815. The compass joint has a single discreet terracotta #c24a1b dot.

Aspect ratio: 1:1 square.
Negative space: 50% (around the compass).
Mood: precision, calibration, premium craftsmanship.
```

- **Alt text FR** : « Main stylisée tenant un compas d'architecte au-dessus d'une feuille gridée — symbole de la précision opérationnelle d'AxionIA. »
- **Alt text EN** : « Stylized hand holding an architect's compass over gridded paper — symbol of AxionIA's operational precision. »
- **Filename target** : `public/illustrations/home-mid-1.avif`
- **Validation checklist** :
  1. Palette respectée ?
  2. Silhouette de main, pas main photoréaliste ?
  3. Négatif space ≥ 50% ?
  4. Pas de texte intégré ?
  5. Composition centrée équilibrée ?

---

#### Prompt #HOME-03-mid

- **Slot** : mid-2 (mi-page, après section « Comment ça marche »)
- **Aspect ratio** : 1:1 (square)
- **Sujet** : trois carnets ouverts empilés diagonalement, vus de dessus, chacun avec quelques notes hairlines abstraites (pas de texte lisible).
- **Composition** : empilement diagonal du coin supérieur gauche au coin inférieur droit.

```text
[Coller préfixe brand AxionIA ici]

Subject: three open editorial notebooks stacked diagonally, viewed from above (top-down flat lay). Each notebook shows abstract diagrammatic notes — small connected dots, hairline arrows, simple geometric annotations (NO readable text, NO actual letters or words). One notebook has a thin terracotta #c24a1b underline accent.

Composition: diagonal stacking from top-left to bottom-right. Notebooks rotated slightly. Background: ivory cream #faf8f3. Notebook pages in pure paper white #ffffff with subtle warm sand #f0e9da edges. Outlines and abstract notes in warm anthracite-brown #1a1815.

Aspect ratio: 1:1 square.
Negative space: 40% around the stack.
Mood: editorial, methodical, knowledge-craft (Anthropic research notebook aesthetic).
```

- **Alt text FR** : « Trois carnets éditoriaux ouverts empilés en diagonale, contenant des annotations abstraites — illustration du travail méthodique d'AxionIA. »
- **Alt text EN** : « Three open editorial notebooks stacked diagonally, with abstract annotations — illustration of AxionIA's methodical work. »
- **Filename target** : `public/illustrations/home-mid-2.avif`
- **Validation checklist** :
  1. Aucune lettre / mot lisible dans les annotations ?
  2. Palette respectée ?
  3. Composition diagonale équilibrée ?
  4. Accent terracotta ≤ 15% ?
  5. Style « hand-drawn light » respecté ?

---

#### Prompt #HOME-04-closing

- **Slot** : closing (avant CTA final)
- **Aspect ratio** : 16:9 (paysage)
- **Sujet** : horizon stylisé éditorial — ligne d'horizon hairline qui sépare un ciel ivoire d'un sol sand, avec un seul module abstrait en silhouette qui s'élève à droite.
- **Composition** : horizon bas (1/3 du bas), grand ciel ivoire vide pour overlay CTA HTML.

```text
[Coller préfixe brand AxionIA ici]

Subject: a stylized editorial horizon — a single thin horizon hairline separates a vast ivory cream #faf8f3 sky (top 2/3) from a warm sand #f0e9da ground (bottom 1/3). On the right third of the horizon, a single abstract module silhouette rises (small geometric shape, like a minimal lighthouse or marker). One thin terracotta #c24a1b vertical accent line marks the module.

Composition: horizon at lower third (rule of thirds). Module on the right third (intersection of thirds). Massive negative space in the upper-left two-thirds, suitable for HTML CTA overlay. Outlines in warm anthracite-brown #1a1815.

Aspect ratio: 16:9 horizontal.
Negative space: 65% (most of the upper-left).
Mood: open horizon, contemplative invitation, premium serenity (Stripe Press cover-page feel).
```

- **Alt text FR** : « Horizon éditorial avec un module marqueur sur la droite — invitation visuelle à passer à l'action avec AxionIA. »
- **Alt text EN** : « Editorial horizon with a marker module on the right — visual invitation to engage with AxionIA. »
- **Filename target** : `public/illustrations/home-closing.avif`
- **Validation checklist** :
  1. Horizon précisément au 1/3 bas ?
  2. Négatif space ≥ 60% ?
  3. Module sur intersection des tiers ?
  4. Palette respectée ?
  5. Pas de texte parasite ?

---

### Page : `/interventions`

> Note : le hero est déjà couvert par `InterventionsHeroSchema` (composant React SVG codé). On se concentre sur les mid-sections et le closing.

#### Prompt #INTERV-01-mid

- **Slot** : mid-1 (entre les blocs interventions dirigeants / équipes)
- **Aspect ratio** : 1:1
- **Sujet** : deux silhouettes éditoriales abstraites face-à-face, séparées par une table éditoriale vide entre elles. Vue de profil, simplifiée.
- **Composition** : symétrie miroir avec table fine au centre.

```text
[Coller préfixe brand AxionIA ici]

Subject: two abstract editorial human silhouettes facing each other in profile (NO faces, NO realistic features — pure black silhouette outlines only, gender-neutral, generic). A thin editorial table is suggested between them as a single hairline. One silhouette is slightly larger (the consultant). Above the table, a small abstract diagram floats (3 connected dots).

Composition: bilateral symmetry, mirror axis at center. Table hairline horizontal across the middle. Both silhouettes in warm anthracite-brown #1a1815 outline only (NOT filled). Floating dots in deep mocha #2a2520 with one terracotta #c24a1b dot. Background: ivory cream #faf8f3.

Aspect ratio: 1:1 square.
Negative space: 55%.
Mood: dialogue, alignment, mutual understanding (B2B consulting reception).
```

- **Alt text FR** : « Deux silhouettes éditoriales en dialogue autour d'une table fine — symbole de la posture d'écoute d'AxionIA en intervention. »
- **Alt text EN** : « Two editorial silhouettes in dialogue around a thin table — symbol of AxionIA's listening posture during interventions. »
- **Filename target** : `public/illustrations/interventions-mid-1.avif`
- **Validation checklist** :
  1. Silhouettes outline (pas remplies) ?
  2. Aucun visage / trait facial réaliste ?
  3. Symétrie bilaterale équilibrée ?
  4. Palette respectée ?
  5. Négatif space ≥ 50% ?

---

#### Prompt #INTERV-02-closing

- **Slot** : closing (avant CTA réservation)
- **Aspect ratio** : 16:9
- **Sujet** : trois portes alignées de profil (silhouettes architecturales), une seule entrouverte avec une lumière chaude qui en sort.
- **Composition** : trois portes en perspective décalée vers la droite.

```text
[Coller préfixe brand AxionIA ici]

Subject: three editorial architectural door silhouettes aligned in slight perspective from left to right. Two doors are closed (simple rectangles outlined). The third door (rightmost) is slightly ajar, with a soft warm light glow emerging — the glow is rendered as warm sand #f0e9da gradient very subtle (NOT bright neon, just a hint of warmth).

Composition: doors aligned along the bottom 2/3. Above doors, large negative ivory space for HTML overlay. Outlines in warm anthracite-brown #1a1815. Open door's glow uses warm sand #f0e9da fading into ivory cream #faf8f3. One thin terracotta #c24a1b accent on the open door's edge.

Aspect ratio: 16:9 horizontal.
Negative space: 55% (upper portion).
Mood: choice, invitation, threshold of operational change.
```

- **Alt text FR** : « Trois portes éditoriales alignées, dont une entrouverte laissant échapper une lumière chaude — métaphore visuelle du seuil d'intervention. »
- **Alt text EN** : « Three editorial doors aligned, one slightly ajar emitting warm light — visual metaphor for the threshold of intervention. »
- **Filename target** : `public/illustrations/interventions-closing.avif`
- **Validation checklist** :
  1. Lumière chaude SUBTILE (pas neon glow interdit) ?
  2. Trois portes alignées ?
  3. Palette respectée ?
  4. Négatif space ≥ 50% ?
  5. Pas de texte intégré ?

---

### Page : `/audit`

#### Prompt #AUDIT-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : loupe éditoriale stylisée vue de 3/4, posée sur une carte abstraite de processus (lignes fines connectées). La loupe agrandit un nœud spécifique.
- **Composition** : loupe à droite, carte de processus s'étend sur tout le fond.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial-style magnifying glass (line-art only, slim handle, simple round lens) positioned on the right third, hovering over an abstract process map covering the background. The map consists of small dots connected by hairlines, forming a network. The lens magnifies one specific node, showing it slightly enlarged inside the lens with a single terracotta #c24a1b dot accent.

Composition: magnifying glass on the right (rule of thirds). Process map fills the background subtly. Outlines in warm anthracite-brown #1a1815. Map nodes in deep mocha #2a2520. Magnified node terracotta #c24a1b. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 45%.
Mood: investigation, discernment, surgical precision (a senior auditor's gaze).
```

- **Alt text FR** : « Loupe éditoriale agrandissant un nœud d'une carte de processus abstraite — symbole de l'audit méticuleux d'AxionIA. »
- **Alt text EN** : « Editorial magnifying glass enlarging a node within an abstract process map — symbol of AxionIA's meticulous audit. »
- **Filename target** : `public/illustrations/audit-hero.avif`
- **Validation checklist** :
  1. Loupe en line-art (pas 3D) ?
  2. Map de processus subtile (background) ?
  3. Accent terracotta ≤ 15% ?
  4. Palette respectée ?
  5. Pas de visage / lightbulb / cliché ?

---

#### Prompt #AUDIT-02-process

- **Slot** : mid-1 (section processus d'audit)
- **Aspect ratio** : 4:5 (portrait éditorial vertical)
- **Sujet** : entonnoir inversé éditorial vertical (large en haut, étroit en bas), avec 3 strates internes : observation → analyse → diagnostic. Style line-art outline.
- **Composition** : entonnoir centré, 3 strates étiquetables (mais SANS texte intégré — overlay HTML).

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial inverted funnel diagram, oriented vertically (wide top, narrow bottom). Three internal strata visible as horizontal hairline divisions. Each stratum has a small abstract icon-shape (a circle with dots, an open square, a single dot) — purely abstract, NO text, NO labels.

Composition: funnel centered vertically, occupying middle 60% of the frame. Outlines in warm anthracite-brown #1a1815, stroke-width thin. Each stratum subtly tinted: top stratum ivory cream #faf8f3, middle warm sand #f0e9da, bottom warm sand-deep #e6dcc4. Single terracotta #c24a1b dot at the bottom output.

Aspect ratio: 4:5 vertical portrait.
Negative space: 40% (around the funnel).
Mood: clarity, distillation, methodical reduction (an editorial information design).
```

- **Alt text FR** : « Entonnoir éditorial inversé en trois strates symbolisant le processus d'audit AxionIA : observation, analyse, diagnostic. »
- **Alt text EN** : « Inverted editorial funnel in three strata symbolizing AxionIA's audit process: observation, analysis, diagnosis. »
- **Filename target** : `public/illustrations/audit-mid-1.avif`
- **Validation checklist** :
  1. Aucun texte / label dans les strates ?
  2. Trois strates clairement distinctes ?
  3. Palette respectée (gradient sand subtil) ?
  4. Format vertical 4:5 ?
  5. Accent terracotta ≤ 15% ?

---

#### Prompt #AUDIT-03-closing

- **Slot** : closing
- **Aspect ratio** : 16:9
- **Sujet** : page de carnet éditorial ouverte vue à plat, avec 5 cases à cocher (toutes cochées en hairline subtil, pas de checkmark agressif).
- **Composition** : carnet centré, marges généreuses.

```text
[Coller préfixe brand AxionIA ici]

Subject: an open editorial notebook page viewed flat from above. The page shows five small checkboxes aligned vertically on the left margin. All five are subtly checked with a thin diagonal hairline (NOT a bold checkmark — very minimal, almost like a pencil stroke). Right of each checkbox, an abstract dot or small glyph (NO text, NO words, NO letters). One checkbox line is highlighted with a terracotta #c24a1b underscore.

Composition: notebook centered, occupying middle 70% horizontally. Page in pure paper white #ffffff with very subtle ivory cream #faf8f3 edges. Notebook spine hint on the left. Outlines warm anthracite-brown #1a1815.

Aspect ratio: 16:9 horizontal.
Negative space: 30% margin around notebook.
Mood: completion, validated checklist, methodical closure.
```

- **Alt text FR** : « Page de carnet éditorial avec cinq cases cochées subtilement — symbole de la rigueur de livraison d'audit AxionIA. »
- **Alt text EN** : « Editorial notebook page with five subtly ticked checkboxes — symbol of AxionIA's audit delivery rigor. »
- **Filename target** : `public/illustrations/audit-closing.avif`
- **Validation checklist** :
  1. Aucune lettre / mot lisible ?
  2. Checkmarks subtils (hairlines) ?
  3. Palette respectée ?
  4. Composition centrée équilibrée ?
  5. Accent terracotta ≤ 15% ?

---

### Page : `/stack-ia`

> Note : le hero est déjà couvert par `StackHeroSchema` (composant React SVG codé). On se concentre sur mid + closing.

#### Prompt #STACK-01-mid

- **Slot** : mid-1 (entre les 5 fonctions / 11 outils)
- **Aspect ratio** : 1:1
- **Sujet** : pile éditoriale de modules abstraits empilés verticalement (comme une bibliothèque de boîtes étiquetées en hairline).
- **Composition** : pile centrée, 5-7 modules de hauteurs variables.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial vertical stack of abstract modules — 5 to 7 rectangular boxes of slightly varying heights and widths, stacked from bottom to top with thin hairline outlines. Each module has 1-2 abstract internal markers (a dot, a hairline). One module in the middle is highlighted with a thin terracotta #c24a1b stroke (the "accent module"). NO text, NO labels.

Composition: stack centered, occupying middle 50% of the frame. Outlines in warm anthracite-brown #1a1815. Subtle warm sand #f0e9da fill on alternating modules. Background ivory cream #faf8f3.

Aspect ratio: 1:1 square.
Negative space: 50%.
Mood: layered architecture, modular operational craft (a librarian's organized shelf).
```

- **Alt text FR** : « Pile éditoriale de modules abstraits — métaphore visuelle de la stack IA opérationnelle d'AxionIA. »
- **Alt text EN** : « Editorial stack of abstract modules — visual metaphor for AxionIA's operational AI stack. »
- **Filename target** : `public/illustrations/stack-ia-mid-1.avif`
- **Validation checklist** :
  1. 5-7 modules empilés verticalement ?
  2. Aucun texte ?
  3. Palette respectée ?
  4. Accent terracotta sur 1 module ?
  5. Négatif space ≥ 45% ?

---

#### Prompt #STACK-02-closing

- **Slot** : closing
- **Aspect ratio** : 16:9
- **Sujet** : un seul module isolé sur fond ivoire, vu en perspective légère 3/4, avec un faisceau de hairlines fines qui en partent vers les bords (suggérant que la stack se déploie partout).
- **Composition** : module à gauche, faisceau qui s'étend vers la droite et le haut.

```text
[Coller préfixe brand AxionIA ici]

Subject: a single isolated abstract module (rectangular box, hairline outline) positioned on the left third. From the module, a thin radiating beam of hairlines extends toward the right and slightly upward — like rays from a star, but minimal and editorial (5-7 hairlines, varying lengths, fading toward their tips). One ray is terracotta #c24a1b.

Composition: module on the left, beam expanding right. Outlines in warm anthracite-brown #1a1815. Background ivory cream #faf8f3 with very subtle warm sand #f0e9da gradient toward the right.

Aspect ratio: 16:9 horizontal.
Negative space: 60% (around and within the beam).
Mood: deployment, expansion, operational reach.
```

- **Alt text FR** : « Module isolé d'où s'étendent des hairlines fines — symbole du déploiement de la stack IA opérationnelle d'AxionIA. »
- **Alt text EN** : « Isolated module with thin radiating hairlines — symbol of AxionIA's operational AI stack deployment. »
- **Filename target** : `public/illustrations/stack-ia-closing.avif`
- **Validation checklist** :
  1. Module clairement défini à gauche ?
  2. Hairlines fines (pas neon, pas glow) ?
  3. Palette respectée ?
  4. Négatif space ≥ 55% ?
  5. Composition asymétrique respectée ?

---

### Page : `/methodologie`

#### Prompt #METHO-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : timeline horizontale éditoriale avec 5 jalons (chaque jalon = un petit cercle hairline). Entre les jalons, des hairlines courbes connectent.
- **Composition** : timeline horizontale au tiers bas, espace négatif large au-dessus.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial horizontal timeline with 5 milestones (small circles, hairline outlined). Between consecutive circles, the connecting hairline curves slightly (NOT straight — gives a hand-drawn editorial feel). Each circle has a single dot inside. The third circle (middle) has a terracotta #c24a1b dot inside.

Composition: timeline horizontal at the lower third (rule of thirds). Generous ivory negative space above for HTML overlay (title, subtitle). Outlines in warm anthracite-brown #1a1815. Background ivory cream #faf8f3 with very subtle warm sand #f0e9da hint at the bottom.

Aspect ratio: 16:9 horizontal.
Negative space: 60% (upper portion).
Mood: methodical journey, editorial progression (a Stripe Press chapter divider).
```

- **Alt text FR** : « Timeline éditoriale horizontale à cinq jalons — métaphore visuelle de la méthodologie progressive d'AxionIA. »
- **Alt text EN** : « Editorial horizontal timeline with five milestones — visual metaphor for AxionIA's progressive methodology. »
- **Filename target** : `public/illustrations/methodologie-hero.avif`
- **Validation checklist** :
  1. Timeline clairement positionnée 1/3 bas ?
  2. 5 jalons distincts ?
  3. Hairlines courbes (pas droites) ?
  4. Palette respectée ?
  5. Négatif space ≥ 55% ?

---

#### Prompt #METHO-02-mid

- **Slot** : mid-1 (entre étapes 1-2 et 3-4 de la méthodologie)
- **Aspect ratio** : 1:1
- **Sujet** : main éditoriale stylisée tournant la page d'un carnet, vu de 3/4 du dessus.
- **Composition** : centré, mouvement de page suggéré.

```text
[Coller préfixe brand AxionIA ici]

Subject: a stylized hand silhouette (NO photographic skin, NO realistic features — pure outline silhouette) turning the page of an editorial notebook. View from a 3/4 angle from above. The page being turned is mid-flip, showing both sides slightly. Abstract markings on the visible page (hairlines, dots — NO readable text, NO words).

Composition: centered subject. Hand silhouette in warm anthracite-brown #1a1815 outline. Notebook in pure paper white #ffffff with warm sand #f0e9da page edges. One discreet terracotta #c24a1b dot on the new page being revealed.

Aspect ratio: 1:1 square.
Negative space: 45%.
Mood: progression, transition, page-turning method.
```

- **Alt text FR** : « Main éditoriale tournant une page de carnet — symbole du passage d'une étape à l'autre dans la méthodologie AxionIA. »
- **Alt text EN** : « Editorial hand turning a notebook page — symbol of step-to-step progression in AxionIA's methodology. »
- **Filename target** : `public/illustrations/methodologie-mid-1.avif`
- **Validation checklist** :
  1. Main silhouette outline (pas réaliste) ?
  2. Aucun texte ?
  3. Palette respectée ?
  4. Composition centrée ?
  5. Mouvement de page lisible ?

---

#### Prompt #METHO-03-mid

- **Slot** : mid-2 (entre étapes 5-6 et 7-8)
- **Aspect ratio** : 4:5 (portrait éditorial vertical)
- **Sujet** : diagramme « cycle » éditorial (boucle fermée verticale) à 4 nœuds, avec flèches hairline indiquant le sens de rotation.
- **Composition** : cycle centré, 4 nœuds disposés en losange vertical.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial closed-loop cycle diagram, oriented vertically. Four nodes arranged in a diamond shape (top, right, bottom, left). Connected by curved hairlines forming a continuous cycle. Each hairline has a small subtle arrowhead indicating clockwise rotation. One node (top) is terracotta #c24a1b filled, others outlined.

Composition: cycle centered, occupying middle 60% of the vertical frame. Outlines in warm anthracite-brown #1a1815. Background ivory cream #faf8f3 with very subtle warm sand #f0e9da haze in corners.

Aspect ratio: 4:5 vertical portrait.
Negative space: 40%.
Mood: iterative methodology, continuous improvement (Anthropic research diagram aesthetic).
```

- **Alt text FR** : « Diagramme éditorial cyclique à quatre nœuds — illustration de l'itération méthodologique d'AxionIA. »
- **Alt text EN** : « Editorial cyclical four-node diagram — illustration of AxionIA's methodological iteration. »
- **Filename target** : `public/illustrations/methodologie-mid-2.avif`
- **Validation checklist** :
  1. Cycle fermé clairement lisible ?
  2. Sens de rotation (arrowheads) visible ?
  3. Format vertical 4:5 ?
  4. Palette respectée ?
  5. Accent terracotta sur 1 nœud uniquement ?

---

#### Prompt #METHO-04-closing

- **Slot** : closing
- **Aspect ratio** : 16:9
- **Sujet** : carnet refermé posé sur une table éditoriale, vu de profil 3/4. Une plume éditoriale stylisée posée à côté.
- **Composition** : carnet à droite, plume à gauche, table fine en hairline.

```text
[Coller préfixe brand AxionIA ici]

Subject: a closed editorial notebook resting on a thin table, viewed from a 3/4 side angle. A stylized editorial fountain pen lies next to it (line-art only, simple silhouette, NO realistic chrome detail). One thin terracotta #c24a1b ribbon bookmark peeks from the notebook.

Composition: notebook on the right third, pen on the left third. Thin hairline table line. Outlines in warm anthracite-brown #1a1815. Notebook cover in deep mocha #2a2520. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 50%.
Mood: closure, completed methodology, ready for action.
```

- **Alt text FR** : « Carnet éditorial fermé avec plume posée à côté — symbole de la méthodologie consolidée et prête à être appliquée. »
- **Alt text EN** : « Closed editorial notebook with fountain pen — symbol of consolidated methodology, ready for action. »
- **Filename target** : `public/illustrations/methodologie-closing.avif`
- **Validation checklist** :
  1. Carnet et plume distincts ?
  2. Style line-art éditorial (pas 3D) ?
  3. Palette respectée ?
  4. Négatif space ≥ 45% ?
  5. Pas de texte parasite ?

---

## B. Listings pages

### Page : `/implementation`

#### Prompt #IMPL-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : plan architectural éditorial vu de dessus (top-down) — esquisse de pièces / modules connectés par des hairlines, avec des annotations abstraites.
- **Composition** : plan occupe 60% du frame, espace négatif sur les marges.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial top-down architectural floor plan — abstract rooms or modules connected by thin hairlines, with small abstract annotations (dots, hairline arrows — NO text, NO measurements). Like an architect's working draft on tracing paper. One module is highlighted with a subtle terracotta #c24a1b stroke.

Composition: plan occupies 60% of the central area. Generous ivory negative margins. Outlines warm anthracite-brown #1a1815. Subtle warm sand #f0e9da fill on 2 rooms. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 40% margins.
Mood: planning, deployment blueprint, operational architecture.
```

- **Alt text FR** : « Plan architectural éditorial vu de dessus — métaphore du déploiement opérationnel structuré d'AxionIA. »
- **Alt text EN** : « Editorial top-down architectural plan — metaphor for AxionIA's structured operational deployment. »
- **Filename target** : `public/illustrations/implementation-hero.avif`
- **Validation checklist** :
  1. Plan top-down lisible ?
  2. Aucune mesure / texte ?
  3. Palette respectée ?
  4. Style « tracing paper » respecté ?
  5. Accent terracotta ≤ 15% ?

---

#### Prompt #IMPL-02-mid

- **Slot** : mid-1
- **Aspect ratio** : 1:1
- **Sujet** : étagère éditoriale stylisée à 3 niveaux, avec sur chaque niveau 2-3 modules abstraits posés.
- **Composition** : étagère centrée, 3 strates horizontales.

```text
[Coller préfixe brand AxionIA ici]

Subject: a stylized editorial 3-tier shelf, viewed from the front in slight 3/4 perspective. On each tier, 2-3 abstract small modules (rectangular boxes outlined). Modules vary slightly in size and proportion. One module on the middle tier has a terracotta #c24a1b accent stroke.

Composition: shelf centered, occupying 70% of the frame. Outlines warm anthracite-brown #1a1815. Subtle warm sand #f0e9da fill on the back of the shelf (depth hint). Background ivory cream #faf8f3.

Aspect ratio: 1:1 square.
Negative space: 30% margins.
Mood: organized deployment, layered implementation.
```

- **Alt text FR** : « Étagère éditoriale à trois niveaux — illustration du déploiement organisé par paliers chez AxionIA. »
- **Alt text EN** : « Editorial 3-tier shelf — illustration of AxionIA's tiered organized deployment. »
- **Filename target** : `public/illustrations/implementation-mid-1.avif`
- **Validation checklist** :
  1. 3 niveaux clairement distincts ?
  2. Modules distincts (pas tous identiques) ?
  3. Palette respectée ?
  4. Perspective légère (pas isométrique 3D) ?
  5. Accent terracotta sur 1 module ?

---

#### Prompt #IMPL-03-closing

- **Slot** : closing
- **Aspect ratio** : 16:9
- **Sujet** : main éditoriale stylisée posant une dernière pièce dans un puzzle architectural (mais SANS lego cliché — pièce abstraite éditoriale).
- **Composition** : main à droite, structure à gauche.

```text
[Coller préfixe brand AxionIA ici]

Subject: a stylized editorial hand silhouette (outline only, NO realistic skin, NO photographic features) placing a single abstract piece into an architectural framework. The piece is a simple editorial shape (NOT a lego brick, NOT a puzzle piece — more like an abstract module). The framework is a hairline structure with one missing slot.

Composition: hand on the right, framework on the left. Outlines warm anthracite-brown #1a1815. The piece being placed has a terracotta #c24a1b stroke. Background ivory cream #faf8f3 with subtle warm sand #f0e9da haze.

Aspect ratio: 16:9 horizontal.
Negative space: 45%.
Mood: completion, final placement, operational closure.
```

- **Alt text FR** : « Main éditoriale plaçant une dernière pièce dans une structure architecturale — symbole de la finalisation du déploiement AxionIA. »
- **Alt text EN** : « Editorial hand placing a final piece into an architectural framework — symbol of AxionIA deployment completion. »
- **Filename target** : `public/illustrations/implementation-closing.avif`
- **Validation checklist** :
  1. Main silhouette outline ?
  2. Pas de lego / puzzle cliché ?
  3. Palette respectée ?
  4. Négatif space ≥ 40% ?
  5. Accent terracotta sur la pièce ?

---

### Page : `/cas-concrets`

#### Prompt #CAS-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : étagère éditoriale de dossiers verticaux (3-5 dossiers) vue de profil, chaque dossier de tailles légèrement différentes.
- **Composition** : dossiers alignés horizontalement, espace au-dessus.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial row of 4-5 vertical folders/binders aligned horizontally as if on an archive shelf, viewed from a slight 3/4 angle. Each folder has slightly different proportions (height, width). Each folder has a thin label hairline at the top (NO text, NO words, just an empty rectangle outline). One folder is terracotta #c24a1b on its spine.

Composition: folders along the bottom 2/3. Generous negative ivory space above. Outlines warm anthracite-brown #1a1815. Folders alternating in pure paper white #ffffff and warm sand #f0e9da fills.

Aspect ratio: 16:9 horizontal.
Negative space: 50% (upper portion).
Mood: editorial archive, curated case studies, premium consultancy library.
```

- **Alt text FR** : « Rangée de dossiers éditoriaux représentant les cas concrets d'AxionIA — esthétique d'archive premium. »
- **Alt text EN** : « Row of editorial folders representing AxionIA case studies — premium archive aesthetic. »
- **Filename target** : `public/illustrations/cas-concrets-hero.avif`
- **Validation checklist** :
  1. 4-5 dossiers distincts ?
  2. Aucun texte sur étiquettes ?
  3. Palette respectée ?
  4. Négatif space ≥ 45% ?
  5. Accent terracotta sur 1 dossier ?

---

#### Prompt #CAS-02-mid

- **Slot** : mid-1
- **Aspect ratio** : 1:1
- **Sujet** : page de cas-concret « ouverte » éditoriale (genre fiche de lecture), avec 4 quadrants abstraits.
- **Composition** : page divisée en 4 zones par hairlines en croix.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial single-page case study layout viewed flat from above. The page is divided into 4 quadrants by a thin hairline cross (vertical + horizontal). Each quadrant contains a small abstract diagram (a few connected dots, a hairline curve, an open box, a tiny chart-suggestion). NO text, NO labels.

Composition: page centered, occupying 75% of the square. Cross divider exact center. Outlines warm anthracite-brown #1a1815. Quadrants alternate ivory cream #faf8f3 and very subtle warm sand #f0e9da. One quadrant has a small terracotta #c24a1b dot.

Aspect ratio: 1:1 square.
Negative space: 25% margin.
Mood: structured case analysis, editorial dossier.
```

- **Alt text FR** : « Page éditoriale de cas-concret divisée en quatre quadrants analytiques — illustration de la rigueur d'analyse AxionIA. »
- **Alt text EN** : « Editorial case study page divided into four analytical quadrants — illustration of AxionIA's analytical rigor. »
- **Filename target** : `public/illustrations/cas-concrets-mid-1.avif`
- **Validation checklist** :
  1. 4 quadrants clairement définis ?
  2. Aucun texte ?
  3. Palette respectée ?
  4. Hairline cross centrée ?
  5. Accent terracotta dans 1 quadrant ?

---

#### Prompt #CAS-03-listing

- **Slot** : mid-2 (avant grille de listing des cas)
- **Aspect ratio** : 4:5
- **Sujet** : pile éditoriale verticale de fiches indexées dépassant légèrement les unes des autres, vue de profil.
- **Composition** : pile centrée, dépassements alternés gauche/droite.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial vertical stack of indexed case-study cards, viewed from the side. The cards stack with slight horizontal offsets (alternating left and right) so each card is partially visible. 6-7 cards total. Each card edge has a thin hairline marker tab (different positions per card). One card has a terracotta #c24a1b tab.

Composition: stack centered vertically, occupying middle 70% of the portrait frame. Outlines warm anthracite-brown #1a1815. Cards in pure paper white #ffffff with subtle warm sand #f0e9da edges. Background ivory cream #faf8f3.

Aspect ratio: 4:5 vertical portrait.
Negative space: 30%.
Mood: indexed library, browsable catalog, premium curated cases.
```

- **Alt text FR** : « Pile verticale de fiches indexées éditoriales — illustration du catalogue de cas concrets AxionIA. »
- **Alt text EN** : « Vertical stack of indexed editorial cards — illustration of AxionIA's curated case study catalog. »
- **Filename target** : `public/illustrations/cas-concrets-mid-2.avif`
- **Validation checklist** :
  1. 6-7 cartes distinctes empilées ?
  2. Onglets tabs visibles ?
  3. Format vertical 4:5 ?
  4. Palette respectée ?
  5. Accent terracotta sur 1 onglet ?

---

### Page : `/comparaisons`

#### Prompt #COMP-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : balance éditoriale stylisée vue de face, plateaux légèrement déséquilibrés.
- **Composition** : balance centrée verticalement, espace au-dessus.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial-style balance scale (line-art only, slim minimalist version, NOT ornate). Two plates suspended from a horizontal beam by thin hairlines. The plates are slightly unbalanced — left plate slightly higher, right plate slightly lower. Each plate carries one or two small abstract objects (dots, mini-modules). The right plate's objects include one terracotta #c24a1b dot.

Composition: balance centered vertically, occupying middle 50% of the frame. Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 55%.
Mood: deliberation, comparison, editorial fairness (a judge's restrained instrument).
```

- **Alt text FR** : « Balance éditoriale légèrement déséquilibrée — symbole de la rigueur de comparaison d'AxionIA face aux alternatives. »
- **Alt text EN** : « Slightly unbalanced editorial scale — symbol of AxionIA's rigorous comparison versus alternatives. »
- **Filename target** : `public/illustrations/comparaisons-hero.avif`
- **Validation checklist** :
  1. Balance line-art (pas 3D) ?
  2. Déséquilibre subtil ?
  3. Palette respectée ?
  4. Négatif space ≥ 50% ?
  5. Accent terracotta sur plateau ?

---

#### Prompt #COMP-02-matrix

- **Slot** : mid-1
- **Aspect ratio** : 1:1
- **Sujet** : matrice 2x2 éditoriale (4 quadrants), avec un point dans chaque quadrant représentant un acteur.
- **Composition** : matrice centrée, axes en hairlines fins.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial 2x2 positioning matrix. Two perpendicular axis lines (horizontal + vertical) divide the frame into 4 quadrants. In each quadrant, a small abstract dot (representing an actor). The dot in the top-right quadrant is terracotta #c24a1b (representing AxionIA's ideal positioning). Other dots in deep mocha #2a2520. NO text, NO axis labels.

Composition: matrix centered, occupying middle 70% of the square. Axis lines hairline thin in warm anthracite-brown #1a1815. Background ivory cream #faf8f3 with very subtle warm sand #f0e9da haze in 2 quadrants.

Aspect ratio: 1:1 square.
Negative space: 30% margins.
Mood: strategic positioning, editorial information design.
```

- **Alt text FR** : « Matrice 2x2 éditoriale de positionnement — illustration de la posture stratégique d'AxionIA face aux alternatives. »
- **Alt text EN** : « Editorial 2x2 positioning matrix — illustration of AxionIA's strategic posture versus alternatives. »
- **Filename target** : `public/illustrations/comparaisons-mid-1.avif`
- **Validation checklist** :
  1. 4 quadrants clairement définis ?
  2. Aucun texte / label axe ?
  3. Palette respectée ?
  4. AxionIA en haut-droite ?
  5. Accent terracotta sur 1 dot uniquement ?

---

### Page : `/blog`

#### Prompt #BLOG-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : pile éditoriale de magazines / journaux empilés en désordre élégant, vus de 3/4.
- **Composition** : pile à gauche, espace négatif à droite.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial stack of 4-5 magazines or journals casually stacked on a thin table, viewed from a 3/4 angle. Each magazine has a slightly different orientation (rotated a few degrees). NO readable cover text, NO titles — just abstract cover layouts (a hairline frame, a single dot, a small geometric shape). One magazine spine is terracotta #c24a1b.

Composition: stack on the left third. Generous negative ivory space on the right for HTML overlay. Outlines warm anthracite-brown #1a1815. Magazines alternating pure paper white #ffffff and warm sand #f0e9da. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 60% (right side).
Mood: editorial library, curated reading, premium magazine ambiance (Stripe Press cover-shelf).
```

- **Alt text FR** : « Pile éditoriale de magazines empilés — illustration de la bibliothèque éditoriale du blog AxionIA. »
- **Alt text EN** : « Editorial stack of magazines — illustration of AxionIA blog's editorial library. »
- **Filename target** : `public/illustrations/blog-hero.avif`
- **Validation checklist** :
  1. 4-5 magazines distincts ?
  2. Aucun texte de couverture ?
  3. Palette respectée ?
  4. Négatif space ≥ 55% à droite ?
  5. Accent terracotta sur 1 spine ?

---

#### Prompt #BLOG-02-article-generic

- **Slot** : mid-1 (utilisable comme illustration générique d'article si pas de visuel spécifique)
- **Aspect ratio** : 1:1
- **Sujet** : carnet éditorial ouvert avec une plume posée dans la reliure centrale.
- **Composition** : carnet centré, plume diagonale.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial open notebook viewed from above, with a stylized fountain pen resting in the center binding (diagonally). Both pages show abstract notes — hairlines, small dots, a tiny circular diagram on the left page (NO text, NO words, NO letters anywhere).

Composition: notebook centered, occupying 70% of the frame. Pen diagonally across center. Outlines warm anthracite-brown #1a1815. Notebook pages pure paper white #ffffff. Pen body deep mocha #2a2520 with a single terracotta #c24a1b cap accent. Background ivory cream #faf8f3.

Aspect ratio: 1:1 square.
Negative space: 30% margin.
Mood: editorial writing, generic-but-on-brand article illustration.
```

- **Alt text FR** : « Carnet éditorial ouvert avec plume — illustration générique d'article du blog AxionIA. »
- **Alt text EN** : « Open editorial notebook with fountain pen — generic article illustration for AxionIA blog. »
- **Filename target** : `public/illustrations/blog-article-generic.avif`
- **Validation checklist** :
  1. Carnet et plume clairement visibles ?
  2. Aucune lettre ?
  3. Palette respectée ?
  4. Composition centrée équilibrée ?
  5. Style éditorial respecté ?

---

### Page : `/centre-aide`

#### Prompt #AIDE-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : carte éditoriale stylisée (genre map de cabinet) avec plusieurs « salles » étiquetables (mais sans texte) reliées par des hairlines.
- **Composition** : carte centrée, marges éditoriales.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial-style hand-drawn map of an abstract knowledge space — several rectangular "rooms" of varying sizes connected by thin pathway hairlines, like a museum floorplan or a cabinet's atelier map. Each room has 1-2 small abstract markers inside (a dot, a hairline). One room is terracotta #c24a1b outlined.

Composition: map centered, occupying middle 70% of the frame. Outlines warm anthracite-brown #1a1815. Subtle warm sand #f0e9da fills on 2-3 rooms (mid-tones). Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 30% margins.
Mood: navigable knowledge, editorial wayfinding.
```

- **Alt text FR** : « Carte éditoriale d'un espace de connaissance avec plusieurs salles connectées — illustration du centre d'aide AxionIA. »
- **Alt text EN** : « Editorial map of a knowledge space with connected rooms — illustration of AxionIA help center. »
- **Filename target** : `public/illustrations/centre-aide-hero.avif`
- **Validation checklist** :
  1. Map de salles connectées lisible ?
  2. Aucun texte ?
  3. Palette respectée ?
  4. Style « hand-drawn » respecté ?
  5. Accent terracotta sur 1 salle ?

---

#### Prompt #AIDE-02-section

- **Slot** : mid-1 (entre catégories d'aide)
- **Aspect ratio** : 1:1
- **Sujet** : panneau d'orientation éditorial avec 3-4 flèches hairline pointant dans des directions différentes.
- **Composition** : panneau central, flèches divergentes.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial signpost — a vertical thin pole with 3-4 thin arrow-shaped panels pointing in different directions (left, right, up-left, up-right). Each panel is a simple line-art rectangle with one end angled to suggest direction (NO text on panels). One panel is terracotta #c24a1b outlined.

Composition: signpost centered vertically, occupying middle 50% of the frame. Outlines warm anthracite-brown #1a1815. Subtle ground hairline at the base. Background ivory cream #faf8f3 with very subtle warm sand #f0e9da haze.

Aspect ratio: 1:1 square.
Negative space: 50%.
Mood: orientation, navigation, editorial wayfinding.
```

- **Alt text FR** : « Panneau d'orientation éditorial avec quatre flèches divergentes — illustration des sections du centre d'aide AxionIA. »
- **Alt text EN** : « Editorial signpost with four diverging arrows — illustration of AxionIA help center sections. »
- **Filename target** : `public/illustrations/centre-aide-mid-1.avif`
- **Validation checklist** :
  1. Panneau et flèches lisibles ?
  2. Aucun texte sur panneaux ?
  3. Palette respectée ?
  4. Négatif space ≥ 45% ?
  5. Accent terracotta sur 1 panneau ?

---

## C. Produit/process pages

### Page : `/interventions/dirigeants`

#### Prompt #INT-DIR-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : silhouette éditoriale d'un dirigeant (vue 3/4 dos, debout face à un système modulaire mural abstrait).
- **Composition** : silhouette à gauche, système à droite.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial silhouette of an executive figure (NO photographic features, pure outline silhouette, gender-neutral, generic standing pose) viewed from a 3/4 back angle, facing an abstract wall-mounted modular system. The system has 5-6 abstract modules connected by hairlines, like a strategic dashboard. The figure's hand gestures slightly toward one module.

Composition: figure on the left third. Modular wall on the right two-thirds. Outlines warm anthracite-brown #1a1815. The module the figure points to has a terracotta #c24a1b accent. Background ivory cream #faf8f3 with very subtle warm sand #f0e9da on the wall.

Aspect ratio: 16:9 horizontal.
Negative space: 35%.
Mood: executive contemplation, strategic mastery, premium decision-making.
```

- **Alt text FR** : « Silhouette éditoriale d'un dirigeant face à un système modulaire stratégique — illustration de la posture exécutive avec AxionIA. »
- **Alt text EN** : « Editorial silhouette of an executive facing a strategic modular system — illustration of executive posture with AxionIA. »
- **Filename target** : `public/illustrations/interventions-dirigeants-hero.avif`
- **Validation checklist** :
  1. Silhouette outline (pas réaliste) ?
  2. Système modulaire lisible ?
  3. Palette respectée ?
  4. Pas de visage / traits ?
  5. Accent terracotta sur 1 module ?

---

#### Prompt #INT-DIR-02-mid

- **Slot** : mid-1
- **Aspect ratio** : 1:1
- **Sujet** : tableau de bord éditorial vu de face (vue dossier/page), 5-6 indicateurs minimalistes.
- **Composition** : grille 2x3 d'indicateurs abstraits.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial dashboard layout viewed flat from the front. A 2x3 grid of 6 abstract indicator cards. Each card has a small unique abstract diagram (a sparkline hairline, a dot cluster, a circle gauge with a notch, a small bar suggestion, a single dot, a hairline curve). NO numbers, NO text, NO axis labels.

Composition: grid centered, occupying 75% of the square. Hairline grid dividers in warm anthracite-brown #1a1815. One card has a terracotta #c24a1b internal accent. Cards alternate pure paper white #ffffff and very subtle warm sand #f0e9da fills. Background ivory cream #faf8f3.

Aspect ratio: 1:1 square.
Negative space: 25% margin.
Mood: executive dashboard, editorial KPI panel (Anthropic research summary aesthetic).
```

- **Alt text FR** : « Tableau de bord éditorial à six indicateurs abstraits — illustration du pilotage stratégique pour dirigeants AxionIA. »
- **Alt text EN** : « Editorial dashboard with six abstract indicators — illustration of strategic steering for AxionIA executives. »
- **Filename target** : `public/illustrations/interventions-dirigeants-mid-1.avif`
- **Validation checklist** :
  1. Grille 2x3 visible ?
  2. 6 indicateurs distincts (pas tous identiques) ?
  3. Aucun chiffre / texte ?
  4. Palette respectée ?
  5. Accent terracotta dans 1 carte ?

---

### Page : `/interventions/equipes`

#### Prompt #INT-EQ-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : 4-5 silhouettes éditoriales abstraites disposées autour d'une table circulaire vue en perspective légère.
- **Composition** : table au centre, silhouettes réparties autour.

```text
[Coller préfixe brand AxionIA ici]

Subject: 4-5 editorial human silhouettes (outline only, NO faces, NO realistic features, gender-neutral, generic seated/standing poses, slight variation in posture) arranged around a circular editorial table viewed from a slight elevated 3/4 angle. The table surface shows a faint abstract diagram (hairlines, 2-3 dots — NO text). One silhouette has a discreet terracotta #c24a1b shoulder accent.

Composition: table centered, silhouettes in a ring around it (asymmetric, not perfectly equidistant). Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3 with very subtle warm sand #f0e9da haze beneath the table.

Aspect ratio: 16:9 horizontal.
Negative space: 35%.
Mood: collaborative team, editorial workshop, premium B2B (NOT stock-photo team meeting cliché — sophisticated restraint).
```

- **Alt text FR** : « Quatre silhouettes éditoriales autour d'une table de travail circulaire — illustration de l'intervention équipes AxionIA. »
- **Alt text EN** : « Four editorial silhouettes around a circular work table — illustration of AxionIA team interventions. »
- **Filename target** : `public/illustrations/interventions-equipes-hero.avif`
- **Validation checklist** :
  1. 4-5 silhouettes outline ?
  2. Aucun visage réaliste ?
  3. Pas l'air d'une stock photo équipe ?
  4. Palette respectée ?
  5. Table circulaire avec diagramme subtil ?

---

#### Prompt #INT-EQ-02-mid

- **Slot** : mid-1
- **Aspect ratio** : 1:1
- **Sujet** : trois cartes de rôle/persona éditoriales vues étalées sur une table.
- **Composition** : cartes en éventail léger.

```text
[Coller préfixe brand AxionIA ici]

Subject: three editorial persona/role cards laid out fan-style on a thin table surface, viewed from a 3/4 angle from above. Each card is a minimal vertical rectangle with: an abstract circular silhouette at the top (no facial features), 2-3 hairline rows beneath (representing role attributes — NO actual text). The middle card has a terracotta #c24a1b top border accent.

Composition: cards centered, slight fan overlap. Outlines warm anthracite-brown #1a1815. Cards in pure paper white #ffffff with very subtle warm sand #f0e9da edges. Background ivory cream #faf8f3.

Aspect ratio: 1:1 square.
Negative space: 35%.
Mood: role mapping, persona work, editorial team analysis.
```

- **Alt text FR** : « Trois cartes éditoriales de personas étalées en éventail — illustration de l'analyse des rôles dans une équipe par AxionIA. »
- **Alt text EN** : « Three editorial persona cards spread fan-style — illustration of team role analysis by AxionIA. »
- **Filename target** : `public/illustrations/interventions-equipes-mid-1.avif`
- **Validation checklist** :
  1. 3 cartes en éventail ?
  2. Silhouettes abstract (cercles) ?
  3. Aucun texte ?
  4. Palette respectée ?
  5. Accent terracotta sur 1 carte ?

---

### Page : `/audit/strategique-pme`

#### Prompt #AUD-PME-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : bâtiment PME éditorial stylisé (silhouette architecturale simple) avec une loupe éditoriale qui plane à proximité.
- **Composition** : bâtiment à gauche, loupe à droite.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial silhouette of a small-medium business building (a simple architectural outline — NOT a skyscraper, more like a 3-floor editorial office or atelier facade), positioned on the left third. To its right, a stylized magnifying glass hovers in the air, oriented toward the building's middle floor. The lens has a single terracotta #c24a1b dot inside.

Composition: building on the left, magnifying glass on the right (rule of thirds). Outlines warm anthracite-brown #1a1815. Subtle warm sand #f0e9da fill on the building. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 45%.
Mood: scrutinizing the SMB, editorial diligence, premium audit posture.
```

- **Alt text FR** : « Bâtiment de PME éditorial scruté par une loupe — illustration de l'audit stratégique AxionIA pour PME. »
- **Alt text EN** : « Editorial SMB building scrutinized by a magnifying glass — illustration of AxionIA's strategic audit for SMBs. »
- **Filename target** : `public/illustrations/audit-strategique-pme-hero.avif`
- **Validation checklist** :
  1. Bâtiment de taille PME (pas skyscraper) ?
  2. Loupe line-art ?
  3. Palette respectée ?
  4. Composition asymétrique tiers ?
  5. Accent terracotta dans la loupe ?

---

#### Prompt #AUD-PME-02-mid

- **Slot** : mid-1
- **Aspect ratio** : 1:1
- **Sujet** : organigramme éditorial simplifié à 3 niveaux (1 case en haut, 2 au milieu, 4 en bas) connectés par hairlines.
- **Composition** : organigramme centré.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial simplified org chart — 1 box at top, 2 boxes middle, 4 boxes bottom — connected by thin vertical hairlines forming a tree structure. Each box is an empty rectangle outline with a small dot inside (NO text, NO names). The top box has a terracotta #c24a1b stroke.

Composition: org chart centered, occupying 75% of the square. Outlines warm anthracite-brown #1a1815. Subtle warm sand #f0e9da fills on alternating boxes. Background ivory cream #faf8f3.

Aspect ratio: 1:1 square.
Negative space: 25% margin.
Mood: organizational mapping, editorial structural diagnosis.
```

- **Alt text FR** : « Organigramme éditorial simplifié à trois niveaux — illustration du diagnostic structurel AxionIA pour PME. »
- **Alt text EN** : « Editorial simplified three-tier org chart — illustration of AxionIA's structural diagnosis for SMBs. »
- **Filename target** : `public/illustrations/audit-strategique-pme-mid-1.avif`
- **Validation checklist** :
  1. Structure 1+2+4 visible ?
  2. Hairlines de connexion lisibles ?
  3. Aucun texte ?
  4. Palette respectée ?
  5. Accent terracotta sur top box ?

---

### Page : `/guide-ia`

#### Prompt #GUIDE-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : empilement éditorial vertical de strates (genre coupe géologique éditoriale) — 4-5 strates horizontales avec des markers à l'intérieur.
- **Composition** : strates occupent toute la largeur, négatif au-dessus.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial layered architecture cross-section — 4-5 horizontal strata stacked vertically (like a geological cross-section but minimal and editorial). Each stratum is a thin horizontal band with a few abstract markers inside (a dot, a hairline, a small geometric shape — NO text). The middle stratum has a terracotta #c24a1b internal accent dot.

Composition: strata occupy bottom 60% of the frame. Generous ivory negative space at top for HTML overlay. Outlines warm anthracite-brown #1a1815. Strata alternate ivory cream #faf8f3, warm sand #f0e9da, warm sand-deep #e6dcc4 fills. Background continues ivory cream #faf8f3 above.

Aspect ratio: 16:9 horizontal.
Negative space: 40% (upper portion).
Mood: layered AI knowledge, editorial cross-section, premium learning.
```

- **Alt text FR** : « Coupe éditoriale stratifiée à cinq couches — illustration des strates de compréhension du guide IA AxionIA. »
- **Alt text EN** : « Editorial layered cross-section with five strata — illustration of AI guide knowledge layers from AxionIA. »
- **Filename target** : `public/illustrations/guide-ia-hero.avif`
- **Validation checklist** :
  1. 4-5 strates horizontales distinctes ?
  2. Markers internes (pas texte) ?
  3. Palette respectée (gradient sand) ?
  4. Négatif space ≥ 35% en haut ?
  5. Accent terracotta dans 1 strate ?

---

#### Prompt #GUIDE-02-mid

- **Slot** : mid-1 (au milieu du guide, format vertical pour rythmer)
- **Aspect ratio** : 4:5
- **Sujet** : arbre éditorial taxonomique vu de haut en bas (1 racine, 3 branches, chaque branche se sub-divise une fois).
- **Composition** : arbre centré vertical.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial taxonomic tree diagram, oriented top-down. One root node at the top, branches into 3 sub-nodes at level 2, each level-2 node branches into 2 leaves at level 3 (total: 1 + 3 + 6 nodes = 10). All nodes are small circles, all connections are thin hairlines. NO text, NO labels. One leaf at the bottom-right has a terracotta #c24a1b fill.

Composition: tree centered vertically, occupying middle 75% of the portrait frame. Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3.

Aspect ratio: 4:5 vertical portrait.
Negative space: 25% margin.
Mood: AI taxonomy, editorial knowledge tree, structured learning.
```

- **Alt text FR** : « Arbre éditorial taxonomique de l'IA — illustration de la structuration des concepts dans le guide AxionIA. »
- **Alt text EN** : « Editorial AI taxonomic tree — illustration of concept structuring in AxionIA's AI guide. »
- **Filename target** : `public/illustrations/guide-ia-mid-1.avif`
- **Validation checklist** :
  1. Structure 1+3+6 visible ?
  2. Hairlines de connexion lisibles ?
  3. Format vertical 4:5 ?
  4. Palette respectée ?
  5. Accent terracotta sur 1 leaf ?

---

#### Prompt #GUIDE-03-closing

- **Slot** : closing
- **Aspect ratio** : 16:9
- **Sujet** : silhouette éditoriale d'une personne assise lisant un livre ouvert (vue de profil), entourée d'un négatif space lumineux.
- **Composition** : silhouette à gauche, livre dans les mains.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial silhouette of a person seated, reading an open book held in their hands. View from a clean side profile. NO facial features, NO photographic detail — pure silhouette outline. The book has abstract markings on its visible pages (hairlines, dots, NO text). One page has a terracotta #c24a1b underline accent.

Composition: silhouette on the left third, book in front of them. Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3 with very subtle warm sand #f0e9da glow surrounding the figure.

Aspect ratio: 16:9 horizontal.
Negative space: 50% (right side).
Mood: contemplative reading, editorial knowledge absorption, premium learning closure.
```

- **Alt text FR** : « Silhouette éditoriale d'une personne lisant un livre ouvert — invitation à approfondir le guide IA AxionIA. »
- **Alt text EN** : « Editorial silhouette of a person reading an open book — invitation to deepen AxionIA's AI guide. »
- **Filename target** : `public/illustrations/guide-ia-closing.avif`
- **Validation checklist** :
  1. Silhouette profil pure (pas visage) ?
  2. Livre lisible ?
  3. Palette respectée ?
  4. Négatif space ≥ 45% ?
  5. Accent terracotta dans le livre ?

---

## D. Éditoriales pages

### Page : `/a-propos`

#### Prompt #APROPOS-01-portrait

- **Slot** : portrait-will (alternative illustrée si Will refuse photo)
- **Aspect ratio** : 4:5 (portrait éditorial vertical)
- **Sujet** : silhouette éditoriale stylisée non-réaliste de Will (épaules + tête en outline, NO traits faciaux). Style très restreint.
- **Composition** : centrée, fond paper uni.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial stylized silhouette portrait — head and shoulders only, viewed in 3/4 profile. PURE OUTLINE SILHOUETTE — NO facial features, NO eyes, NO mouth, NO hair detail, NO realistic skin texture. Just a clean silhouette outline of a head + shoulders. Imagine an editorial Stripe Press author-portrait silhouette.

Composition: silhouette centered in the upper 60% of the portrait frame. Lower 40% is uniform background. Outlines warm anthracite-brown #1a1815. Silhouette filled with deep mocha #2a2520 (solid fill, since no facial features are needed). Background pure paper white #ffffff (clean portrait backdrop). One thin terracotta #c24a1b accent line at the base of the shoulders (collar hairline).

Aspect ratio: 4:5 vertical portrait.
Negative space: 50% (around silhouette).
Mood: editorial author silhouette, premium identity placeholder, NOT a photo-substitute (intentionally abstract).
```

- **Alt text FR** : « Portrait silhouette éditorial stylisé du fondateur d'AxionIA — illustration abstraite, non-photoréaliste. »
- **Alt text EN** : « Editorial stylized silhouette portrait of AxionIA's founder — abstract, non-photorealistic illustration. »
- **Filename target** : `public/portraits/will-illustration.avif`
- **Validation checklist** :
  1. Aucun trait facial (yeux/bouche/cheveux détaillés) ?
  2. Format 4:5 vertical ?
  3. Fond paper uni ?
  4. Palette respectée ?
  5. Pas tentative de ressemblance photoréaliste ?

> **Note STOP & ASK** : si Will accepte une photo réelle, ne pas générer ce prompt. Préférer photo professionnelle (cf. style guide § 4.1).

---

#### Prompt #APROPOS-02-mid

- **Slot** : mid-1 (section histoire / parcours)
- **Aspect ratio** : 1:1
- **Sujet** : ligne narrative éditoriale (timeline horizontale courbe) avec 4-5 jalons.
- **Composition** : ligne centrée verticalement, courbe douce.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial narrative timeline rendered as a gentle horizontal curve (NOT a straight line — slight S-shape, hand-drawn quality). Along the curve, 4-5 milestone dots, each accompanied by a small abstract icon (a hairline circle, a small square, a triangle outline, a single dot — NO text, NO dates). The third milestone has a terracotta #c24a1b dot.

Composition: curve centered vertically, spanning the width. Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3.

Aspect ratio: 1:1 square.
Negative space: 60%.
Mood: editorial life-path, narrative journey, premium personal story.
```

- **Alt text FR** : « Ligne narrative éditoriale courbe à quatre jalons — illustration du parcours du fondateur AxionIA. »
- **Alt text EN** : « Editorial curved narrative timeline with four milestones — illustration of AxionIA founder's journey. »
- **Filename target** : `public/illustrations/a-propos-mid-1.avif`
- **Validation checklist** :
  1. Courbe douce S-shape (pas droite) ?
  2. 4-5 jalons distincts ?
  3. Palette respectée ?
  4. Négatif space ≥ 55% ?
  5. Accent terracotta sur 1 jalon ?

---

#### Prompt #APROPOS-03-closing

- **Slot** : closing
- **Aspect ratio** : 16:9
- **Sujet** : porte ouverte éditoriale donnant sur un horizon ivoire (genre invitation au dialogue).
- **Composition** : porte à gauche, horizon à droite.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial open door (line-art outline only, simple architectural door + frame) on the left third, opening toward the right where a serene horizon hairline extends. Through the open door, the horizon glows softly with warm sand #f0e9da gradient. One thin terracotta #c24a1b accent on the door's edge.

Composition: door on the left third (rule of thirds). Horizon extending right. Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 60%.
Mood: invitation, opening, editorial threshold to dialogue.
```

- **Alt text FR** : « Porte éditoriale ouverte sur un horizon ivoire — invitation au dialogue avec AxionIA. »
- **Alt text EN** : « Editorial open door onto an ivory horizon — invitation to dialogue with AxionIA. »
- **Filename target** : `public/illustrations/a-propos-closing.avif`
- **Validation checklist** :
  1. Porte ouverte clairement lisible ?
  2. Horizon serein ?
  3. Palette respectée ?
  4. Pas de neon glow ?
  5. Négatif space ≥ 55% ?

---

### Page : `/contact`

#### Prompt #CONTACT-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : enveloppe éditoriale stylisée vue de 3/4, posée sur une table fine.
- **Composition** : enveloppe à droite, espace négatif à gauche.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial envelope (line-art outline, simple rectangular shape with a triangular flap visible) lying on a thin editorial table, viewed from a 3/4 angle. NO stamps, NO addresses, NO text. The flap is slightly raised. A thin terracotta #c24a1b wax-seal-suggestion (a small circle) sits where a wax seal would be — NOT a realistic wax stamp, just a minimal hairline circle.

Composition: envelope on the right third. Generous negative ivory space on the left for HTML overlay. Outlines warm anthracite-brown #1a1815. Envelope in pure paper white #ffffff with subtle warm sand #f0e9da edges. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 60%.
Mood: editorial correspondence, premium communication invitation.
```

- **Alt text FR** : « Enveloppe éditoriale stylisée avec sceau de cire — invitation à contacter AxionIA. »
- **Alt text EN** : « Stylized editorial envelope with wax seal — invitation to contact AxionIA. »
- **Filename target** : `public/illustrations/contact-hero.avif`
- **Validation checklist** :
  1. Enveloppe line-art (pas réaliste) ?
  2. Aucune adresse / texte ?
  3. Palette respectée ?
  4. Négatif space ≥ 55% ?
  5. Accent terracotta sur sceau ?

---

#### Prompt #CONTACT-02-mid

- **Slot** : mid-1
- **Aspect ratio** : 1:1
- **Sujet** : trois icônes éditoriales d'outils de contact (téléphone, email, calendrier) stylisées.
- **Composition** : alignées horizontalement.

```text
[Coller préfixe brand AxionIA ici]

Subject: three editorial line-art icons aligned horizontally — a stylized telephone receiver (vintage editorial style, NOT modern smartphone), a stylized envelope (mail), a stylized calendar page (a small rectangle with a hairline grid). All in pure line-art outline only. Equal sizing. The middle icon (envelope) has a terracotta #c24a1b accent dot.

Composition: 3 icons centered horizontally, equally spaced, occupying middle 75% of the square. Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3.

Aspect ratio: 1:1 square.
Negative space: 50%.
Mood: contact channels, editorial communication options.
```

- **Alt text FR** : « Trois icônes éditoriales : téléphone, enveloppe, calendrier — moyens de contact AxionIA. »
- **Alt text EN** : « Three editorial icons: phone, envelope, calendar — AxionIA contact channels. »
- **Filename target** : `public/illustrations/contact-mid-1.avif`
- **Validation checklist** :
  1. 3 icônes line-art distinctes ?
  2. Style vintage éditorial (pas smartphone moderne) ?
  3. Palette respectée ?
  4. Alignement équidistant ?
  5. Accent terracotta sur 1 icône ?

---

### Page : `/presse`

#### Prompt #PRESSE-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : journal éditorial déplié vu à plat de dessus, avec colonnes abstraites et photos abstraites floutées.
- **Composition** : journal centré, dépassement par les bords.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial open newspaper viewed flat from above. Multiple columns of abstract text-suggestion (hairlines, NO actual readable letters or words). 2-3 abstract photo-frames (rectangular outlines, with very abstract internal hatching — NO recognizable image inside). Headlines suggested by 2-3 thicker hairlines (NO actual text). One column has a terracotta #c24a1b accent stroke at its top.

Composition: newspaper centered, bleeding to the edges of the frame (cropping a portion). Outlines warm anthracite-brown #1a1815. Newspaper paper in pure paper white #ffffff with warm sand #f0e9da edges. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 25% (the page edges where the newspaper is cropped).
Mood: editorial press, premium publication, journalistic gravitas.
```

- **Alt text FR** : « Journal éditorial ouvert avec colonnes abstraites — illustration de la page presse AxionIA. »
- **Alt text EN** : « Open editorial newspaper with abstract columns — illustration of AxionIA press page. »
- **Filename target** : `public/illustrations/presse-hero.avif`
- **Validation checklist** :
  1. Journal vu à plat lisible ?
  2. Aucune lettre lisible ?
  3. Palette respectée ?
  4. Style « gravitas » respecté ?
  5. Accent terracotta sur 1 colonne ?

---

#### Prompt #PRESSE-02-mid

- **Slot** : mid-1 (section logos média / kit presse)
- **Aspect ratio** : 1:1
- **Sujet** : grille éditoriale 3x3 de cadres rectangulaires vides (placeholders pour logos média).
- **Composition** : grille centrée.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial 3x3 grid of empty rectangular frames (placeholders representing media logos). Each frame is a simple hairline rectangle. Empty inside (NO actual logos, NO text). The center frame has a terracotta #c24a1b stroke. Other frames in warm anthracite-brown #1a1815.

Composition: grid centered, occupying 75% of the square. Hairline grid dividers. Background ivory cream #faf8f3 with alternating frames in pure paper white #ffffff and very subtle warm sand #f0e9da fills.

Aspect ratio: 1:1 square.
Negative space: 25% margin.
Mood: editorial press grid, media kit placeholder, structured.
```

- **Alt text FR** : « Grille éditoriale de placeholders média — illustration du kit presse AxionIA. »
- **Alt text EN** : « Editorial grid of media placeholders — illustration of AxionIA press kit. »
- **Filename target** : `public/illustrations/presse-mid-1.avif`
- **Validation checklist** :
  1. Grille 3x3 lisible ?
  2. Cadres vides (placeholders) ?
  3. Aucun texte ?
  4. Palette respectée ?
  5. Accent terracotta sur cadre central ?

---

## E. Utilitaires denses

### Page : `/roi`

#### Prompt #ROI-01-sankey

- **Slot** : hero (illustration de remplacement / accompagnement du RoiSimulator)
- **Aspect ratio** : 16:9
- **Sujet** : diagramme Sankey éditorial simplifié (3 inputs à gauche fusionnent en 1 output à droite via flux courbes).
- **Composition** : flux horizontal gauche → droite.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial simplified Sankey-style flow diagram. On the left, 3 input streams (3 thin curved bands of varying widths) merge progressively toward the right, eventually converging into a single thicker output stream. The streams are filled (semi-transparent feel) and curve gracefully. The merging point is marked by a terracotta #c24a1b dot. NO text, NO labels.

Composition: flow horizontal across the frame. Streams in warm sand #f0e9da, warm sand-deep #e6dcc4, and primary-soft #e8efff (very subtle blue accent in one stream). Outlines and dots warm anthracite-brown #1a1815. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 35%.
Mood: editorial flow visualization, ROI conversion, premium dataviz (Anthropic research dataviz aesthetic).
```

- **Alt text FR** : « Diagramme Sankey éditorial simplifié représentant la conversion d'inputs en ROI — illustration du calculateur AxionIA. »
- **Alt text EN** : « Editorial simplified Sankey diagram representing ROI conversion — illustration of AxionIA's calculator. »
- **Filename target** : `public/illustrations/roi-hero.avif`
- **Validation checklist** :
  1. 3 inputs → 1 output lisibles ?
  2. Flux courbes (pas droits) ?
  3. Palette respectée (sand variants) ?
  4. Accent terracotta sur point de fusion ?
  5. Aucun texte / chiffre ?

---

#### Prompt #ROI-02-closing

- **Slot** : closing
- **Aspect ratio** : 1:1
- **Sujet** : flèche éditoriale ascendante stylisée (genre courbe de progression discrète).
- **Composition** : flèche en diagonale du coin inférieur gauche au coin supérieur droit.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial upward-curving arrow (NOT a generic stock-photo trend arrow — minimal, thin, slightly hand-drawn). The arrow starts at the bottom-left corner and curves gently upward to the top-right corner. Along its path, 3 small dots mark progression points. The arrowhead is tipped with a terracotta #c24a1b accent.

Composition: arrow diagonal across the square. Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3 with very subtle warm sand #f0e9da haze in the lower portion.

Aspect ratio: 1:1 square.
Negative space: 60% (around the arrow).
Mood: editorial progression, gentle ascent, premium ROI realization.
```

- **Alt text FR** : « Flèche éditoriale ascendante avec trois jalons — symbole de la progression du ROI AxionIA. »
- **Alt text EN** : « Editorial upward arrow with three milestones — symbol of AxionIA ROI progression. »
- **Filename target** : `public/illustrations/roi-closing.avif`
- **Validation checklist** :
  1. Flèche courbe (pas stock) ?
  2. 3 dots de progression ?
  3. Palette respectée ?
  4. Négatif space ≥ 55% ?
  5. Accent terracotta sur arrowhead ?

---

### Page : `/reserver`

#### Prompt #RES-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : calendrier éditorial stylisé vu à plat de dessus, avec une seule case mise en avant.
- **Composition** : calendrier centré.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial calendar grid viewed flat from above. A 5x5 grid of small rectangular cells representing days. Each cell is a thin hairline outline. One cell (mid-grid, slightly off-center) has a terracotta #c24a1b stroke and a single dot inside (the chosen appointment day). NO numbers, NO dates, NO text.

Composition: calendar centered, occupying 75% of the frame. Outlines warm anthracite-brown #1a1815. Cells alternate in pure paper white #ffffff and very subtle warm sand #f0e9da fills (subtle texture). Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 25% margin.
Mood: editorial appointment selection, premium booking moment.
```

- **Alt text FR** : « Grille de calendrier éditorial avec une case mise en avant — illustration de la réservation AxionIA. »
- **Alt text EN** : « Editorial calendar grid with one highlighted cell — illustration of AxionIA booking. »
- **Filename target** : `public/illustrations/reserver-hero.avif`
- **Validation checklist** :
  1. Grille 5x5 lisible ?
  2. Aucun chiffre ?
  3. Une case terracotta clairement marquée ?
  4. Palette respectée ?
  5. Style flat from above respecté ?

---

#### Prompt #RES-02-mid

- **Slot** : mid-1 (rassurance avant formulaire)
- **Aspect ratio** : 1:1
- **Sujet** : main éditoriale stylisée serrant un autre objet (genre poignée discrète mais SANS handshake stock).
- **Composition** : centrée.

> ⚠️ **Anti-handshake** : NE PAS générer une poignée de main corporate stock. Préférer une métaphore d'engagement éditoriale alternative.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial stylized hand silhouette (outline only, NO photographic skin) gently holding a small abstract token or object — NOT a handshake, NOT a corporate gesture. Imagine the hand cupping a small editorial sphere or holding a thin card. The object has a terracotta #c24a1b accent.

Composition: hand centered, object cupped or held. Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3 with very subtle warm sand #f0e9da haze.

Aspect ratio: 1:1 square.
Negative space: 50%.
Mood: editorial commitment, gentle engagement, premium reassurance (NOT stock corporate handshake).

CRITICAL: This is NOT a handshake. NO two hands meeting. NO corporate gesture cliché. Single hand only, with a small object.
```

- **Alt text FR** : « Main éditoriale tenant un objet abstrait — symbole de l'engagement réservé avec AxionIA. »
- **Alt text EN** : « Editorial hand holding an abstract object — symbol of reserved engagement with AxionIA. »
- **Filename target** : `public/illustrations/reserver-mid-1.avif`
- **Validation checklist** :
  1. UNE SEULE main (pas handshake) ?
  2. Silhouette outline (pas réaliste) ?
  3. Palette respectée ?
  4. Pas de cliché corporate ?
  5. Accent terracotta sur objet ?

---

### Page : `/faq`

#### Prompt #FAQ-01-hero

- **Slot** : hero
- **Aspect ratio** : 16:9
- **Sujet** : empilement éditorial de carrés (cartes de questions) avec un seul partiellement ouvert/déplié.
- **Composition** : empilement à gauche, négatif à droite.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial stack of 5 question cards (thin rectangular outlines) stacked vertically with slight horizontal offsets. The third card from the top is partially "opened" — pulled forward as if expanded, revealing a hint of abstract content inside (a hairline, a dot — NO text). One card edge is terracotta #c24a1b.

Composition: stack on the left third. Generous negative ivory space on the right for HTML overlay. Outlines warm anthracite-brown #1a1815. Cards in pure paper white #ffffff with subtle warm sand #f0e9da edges. Background ivory cream #faf8f3.

Aspect ratio: 16:9 horizontal.
Negative space: 60%.
Mood: editorial Q&A, expandable knowledge, premium FAQ.
```

- **Alt text FR** : « Pile éditoriale de cartes de questions, l'une dépliée — illustration de la FAQ AxionIA. »
- **Alt text EN** : « Editorial stack of question cards, one expanded — illustration of AxionIA FAQ. »
- **Filename target** : `public/illustrations/faq-hero.avif`
- **Validation checklist** :
  1. 5 cartes empilées ?
  2. Une carte clairement « ouverte » ?
  3. Aucun texte ?
  4. Palette respectée ?
  5. Négatif space ≥ 55% ?

---

#### Prompt #FAQ-02-divider

- **Slot** : mid-1 (entre catégories de FAQ)
- **Aspect ratio** : 1:1
- **Sujet** : point d'interrogation éditorial déconstruit (composé de hairlines fragmentées qui suggèrent la forme).
- **Composition** : centré.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial deconstructed question mark — the shape of a "?" suggested by fragmented hairlines and dots, NOT a fully drawn punctuation mark. Several thin curve segments + one dot at the bottom suggest the form without rendering it explicitly. One segment is terracotta #c24a1b.

Composition: deconstructed mark centered, occupying middle 50% of the square. Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3.

Aspect ratio: 1:1 square.
Negative space: 65%.
Mood: editorial inquiry, abstract questioning, premium curiosity.
```

- **Alt text FR** : « Point d'interrogation éditorial déconstruit — diviseur visuel pour les sections FAQ AxionIA. »
- **Alt text EN** : « Editorial deconstructed question mark — visual divider for AxionIA FAQ sections. »
- **Filename target** : `public/illustrations/faq-mid-1.avif`
- **Validation checklist** :
  1. Forme déconstruite (pas « ? » net) ?
  2. Hairlines fragmentées lisibles ?
  3. Palette respectée ?
  4. Négatif space ≥ 60% ?
  5. Accent terracotta sur 1 segment ?

---

## F. OG images dynamiques (Next.js 16 `ImageResponse`)

> Ces 5 prompts servent de **fallback bitmap** si Will préfère générer des OG images statiques plutôt que via `next/og` `ImageResponse` SSR. Recommandation : garder `ImageResponse` codé pour les OG (plus puissant, dynamique, i18n) et utiliser ces images uniquement comme fallback ultime.

#### Prompt #OG-HOME-01

- **Slot** : og (page `/`)
- **Aspect ratio** : 1200x630 (ratio social standard)
- **Sujet** : composition équilibrée — diagramme d'architecture modulaire à gauche, espace pour titre à droite.
- **Composition** : split 50/50 visuel/négatif.

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial composition for social sharing — left half shows a small abstract architectural diagram (3-4 connected modules with hairlines), right half is uniform ivory cream #faf8f3 negative space (will be overlaid with HTML title in production, but this image alone has NO text). One module on the left has a terracotta #c24a1b accent.

Composition: 50/50 split — visual content on the left, clean negative space on the right. Outlines warm anthracite-brown #1a1815. Background ivory cream #faf8f3.

Aspect ratio: 1200x630 (use closest available — 1.91:1 if specified, otherwise 16:9 close enough).
Negative space: 50% (right half).
Mood: editorial social card, premium B2B preview.
```

- **Alt text FR** : « Image OG d'AxionIA : diagramme architectural minimaliste, format social. »
- **Alt text EN** : « AxionIA OG image: minimalist architectural diagram, social format. »
- **Filename target** : `public/og/home-og.png`
- **Validation checklist** :
  1. Format ~1200x630 ?
  2. Split 50/50 visuel/vide ?
  3. Aucun texte intégré ?
  4. Palette respectée ?
  5. Accent terracotta visible ?

---

#### Prompt #OG-METHO-01

- **Slot** : og (page `/methodologie`)
- **Aspect ratio** : 1200x630

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial timeline OG composition — horizontal timeline with 5 milestone dots on the left half, blank ivory cream #faf8f3 on the right half. The middle milestone has a terracotta #c24a1b dot.

Composition: timeline on left half (50%), negative space on right (50%). Outlines warm anthracite-brown #1a1815.

Aspect ratio: 1200x630 (~1.91:1).
Negative space: 50%.
Mood: editorial methodology preview.
```

- **Alt text FR** : « Image OG méthodologie AxionIA : timeline éditoriale à cinq jalons. »
- **Alt text EN** : « AxionIA methodology OG image: editorial five-milestone timeline. »
- **Filename target** : `public/og/methodologie-og.png`
- **Validation checklist** :
  1. Timeline lisible ?
  2. Aucun texte ?
  3. Palette respectée ?
  4. Format ~1200x630 ?
  5. Accent terracotta sur 1 jalon ?

---

#### Prompt #OG-AUDIT-01

- **Slot** : og (page `/audit`)
- **Aspect ratio** : 1200x630

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial OG composition — magnifying glass on the left third over a small abstract process map. Right two-thirds: clean ivory cream #faf8f3 negative space.

Composition: visual on left (35%), negative space on right (65%). Outlines warm anthracite-brown #1a1815. One terracotta #c24a1b dot inside the lens.

Aspect ratio: 1200x630.
Negative space: 65%.
Mood: editorial audit preview.
```

- **Alt text FR** : « Image OG audit AxionIA : loupe éditoriale sur carte de processus. »
- **Alt text EN** : « AxionIA audit OG image: editorial magnifying glass over process map. »
- **Filename target** : `public/og/audit-og.png`
- **Validation checklist** :
  1. Loupe + map lisibles ?
  2. Aucun texte ?
  3. Palette respectée ?
  4. Format ~1200x630 ?
  5. Accent terracotta dans loupe ?

---

#### Prompt #OG-CAS-01

- **Slot** : og (page `/cas-concrets`)
- **Aspect ratio** : 1200x630

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial OG — row of 4-5 archive folders aligned along the bottom 1/3 of the frame, vast ivory cream #faf8f3 negative space above.

Composition: folders bottom 1/3, negative space top 2/3. Outlines warm anthracite-brown #1a1815. Folders alternating in pure paper white #ffffff and warm sand #f0e9da. One folder spine is terracotta #c24a1b.

Aspect ratio: 1200x630.
Negative space: 65% (upper portion).
Mood: editorial case study archive preview.
```

- **Alt text FR** : « Image OG cas-concrets AxionIA : rangée de dossiers éditoriaux. »
- **Alt text EN** : « AxionIA case studies OG image: editorial archive folder row. »
- **Filename target** : `public/og/cas-concrets-og.png`
- **Validation checklist** :
  1. Dossiers alignés ?
  2. Format ~1200x630 ?
  3. Aucun texte ?
  4. Palette respectée ?
  5. Accent terracotta sur 1 spine ?

---

#### Prompt #OG-STACK-01

- **Slot** : og (page `/stack-ia`)
- **Aspect ratio** : 1200x630

```text
[Coller préfixe brand AxionIA ici]

Subject: an editorial OG — vertical stack of 5-6 abstract modules on the left third, vast ivory cream #faf8f3 negative space on the right.

Composition: stack on left (35%), negative space on right (65%). Outlines warm anthracite-brown #1a1815. Modules alternating with subtle warm sand #f0e9da fills. One module has a terracotta #c24a1b stroke.

Aspect ratio: 1200x630.
Negative space: 65%.
Mood: editorial AI stack preview.
```

- **Alt text FR** : « Image OG stack-ia AxionIA : pile éditoriale de modules abstraits. »
- **Alt text EN** : « AxionIA AI stack OG image: editorial stack of abstract modules. »
- **Filename target** : `public/og/stack-ia-og.png`
- **Validation checklist** :
  1. Stack vertical lisible ?
  2. Format ~1200x630 ?
  3. Aucun texte ?
  4. Palette respectée ?
  5. Accent terracotta sur 1 module ?

---

## Total

**53 prompts GPT-image** prêts à coller, structurés pour les Top 20 pages stratégiques d'AxionIA + 5 OG images dynamiques.

| Catégorie                | Pages  | Prompts             |
| ------------------------ | ------ | ------------------- |
| A. Pillar pages          | 5      | 15                  |
| B. Listings pages        | 5      | 12                  |
| C. Produit/process pages | 4      | 9                   |
| D. Éditoriales pages     | 3      | 7                   |
| E. Utilitaires denses    | 3      | 6                   |
| F. OG images dynamiques  | 5      | 5 (fallback bitmap) |
| **TOTAL**                | **20** | **53**              |

**Budget OpenAI cible PERFECTION** : ~$13-15 (53 × $0.19 high quality + 30% retries pour gens ratées / ajustements).

**Workflow recommandé** : générer `HOME-01-hero` en premier comme référence absolue, faire valider par Will, puis utiliser `gpt-image-1` mode `edit` / `variations` à partir de cette référence pour les 52 suivants (cohérence ~85-95%). Conserver `seed=42` partout.

---

**Fin de la bibliothèque v1.0 · 2026-05-07.**

> Pour le style guide complet (palette, iconographie, photo, diagramme, animation, naming convention), voir `_AUDIT/visual-style-guide.md`.
