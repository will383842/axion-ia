# ADR 0002 — Design direction v3 : Editorial Premium Light

- **Statut** : ✅ Accepté
- **Date** : 2026-05-06
- **Décideur** : Will (validé en session post-Sprint 14)
- **Supersedes** : doctrine "Webflow-light" implicite (Design.md initial)
- **Note** : ce changement de doctrine arrive avant la fin de Sprint 14 (frontend public livré). Aucune doctrine intermédiaire "v2 dark" n'a été commitée — uniquement v3 ici.

## Contexte

Inspection live de la home post-Sprint 14 par Will → 2 verdicts successifs :

1. **Home `[locale]/page.tsx` est restée un placeholder Sprint 2** — Sprint 5 a livré les pages produits mais oublié la home racine. Trou non détecté par FRONTEND-DEEP-CHECK.
2. **Doctrine "Webflow-light"** rejetée : _« vieillot, sans contraste, tout est blanc, trop carré »_. Une 1re tentative de pivot dark agressif a aussi été rejetée (_« je veux du haut de gamme sans pour autant que ce soit noir »_) avant que Will valide la direction **Editorial Premium Light** inspirée d'Anthropic / Mistral / Ramp.

## Décision

Pivoter vers une doctrine **Editorial Premium Light** :

- **Surfaces sans noir** :
  - `--color-bg` ivoire chaud `#faf8f3` (default canvas — chaud, pas blanc froid)
  - `--color-paper` blanc pur `#ffffff` (cards, sections de contraste)
  - `--color-sand` `#f0e9da` (intermissions sable)
  - `--color-mocha` `#2a2520` (brun-aubergine — alternative au noir pour blocs premium)
  - `--color-fg` anthracite-brun `#1a1815` (jamais du noir pur)

- **3 fonds composés** :
  - `.bg-halo-warm` : ivoire + halos terracotta/bleu très diffus (Hero)
  - `.bg-halo-cool` : sable + halos bleu/sauge
  - `.bg-mocha-rich` : mocha + halos terracotta+bleu (CTAs/metrics)

- **Typographie** :
  - **Fraunces** (serif éditorial variable) chargée via `next/font` — titres, big numbers, pull-quotes, témoignages, names
  - Manrope (sans-serif) — body, nav, captions
  - Italiques éditoriaux terracotta sur 1-2 mots-clés par titre (signature Anthropic)

- **Palette accents** :
  - `--color-primary` `#1a4dd9` (bleu profond, plus dense que Webflow Blue)
  - `--color-terracotta` `#c24a1b` (brique chaude — accent éditorial, italiques)
  - `--color-sage` `#7a8870` (proof/succès)

- **Radius** : élargi `--radius-lg` 12, `--radius-xl` 20 (cards), `--radius-2xl` 28 (hero blocks)
- **Shadows** : tons chauds `rgba(42, 37, 32, …)` au lieu de gris bleuté
- **Animations** : `cta-lift` (translate-y -2px + shadow growth) remplace `cta-translate-x-6`. `prefers-reduced-motion` strict respecté.

- **Composants partagés étendus** :
  - `<Section>` : prop `tone="canvas|paper|sand|halo-warm|halo-cool|mocha"` + `titleEm` italic-editorial
  - `<Hero>` : `bg-halo-warm` + accent dot + `titleEm` italic
  - `<ProductHero>` (21 pages produits) : `bg-halo-warm` + halo accent latéral + h1 Fraunces
  - `<CtaBlock>` : tones mocha/paper/sand (+ alias `dark`/`light` pour rétrocompat)
  - `<FaqBlock>` : tones canvas/paper/sand
  - `<MetricsRow>` + `<Stat>` : numbers Fraunces 96-112px + suffix terracotta, auto-adapt mocha
  - `<ProcessSteps>` : numéros serif terracotta + top border, auto-adapt mocha
  - `<Card>` : radius-xl, padding 28, border sand, hover terracotta
  - `<TestimonialCard>` : pull-quote pur (figure + blockquote, no Card border) en serif italique
  - `<TimelineBlock>` : dates serif terracotta + connector ring-bg
  - `<TeamGrid>` : sand avatar fallback, names serif, role italic terracotta
  - `<Header>` : logo `Axion` + `IA` italique terracotta, nav active = italique terracotta
  - `<Footer>` : `bg-mocha-rich` (alt au noir), tagline serif géant, columns sobres
  - `<Button>` : 7 variants (+ terracotta), `shape="rounded|pill"`, `cta-lift` hover
  - `<ProductPageTemplate>` : alternance auto **paper → sand → mocha → canvas → mocha**

- **i18n** : 64 nouvelles clés home (titre fragmenté en `Part1` / `Em` / `Part2` pour rendre l'italique éditorial sans markup dans la traduction). 102 keys total in sync (gate `i18n:check`).

## Conséquences

### Positives

- Aucun fond noir (objectif Will)
- Distinction nette entre sections via 6 tones (canvas → paper → sand → halo-warm → halo-cool → mocha)
- Cohérence "cabinet premium B2B 2026" alignée sur les références du segment (Anthropic, Mistral, Ramp)
- API composants quasi inchangée — 99 % des consommateurs n'ont rien à modifier
- Les 21 pages produits remontent automatiquement via PPT (alternance auto)
- Webflow Blue préservé en couleur identitaire (cohérence de marque)

### Risques / dette

- `contrast:check` actuel valide 10 paires v1 — il faudra étendre aux paires v3 (`text-fg-muted` sur `bg-sand`, `text-mocha-fg/70` sur `bg-mocha`, etc.) au prochain sprint correctif.
- Tests Vitest mis à jour : `Hero.test.tsx` (assertion `text-display-editorial` + indicator dot accent), `Button.test.tsx` (assertion `cta-lift` au lieu de `cta-translate`).
- Anti-hex linter strict sur les commentaires JSDoc — bannir tout hex hors `globals.css`.

## Références

- Validation Will (chat 2026-05-06, message « Anthrpic » → direction A confirmée)
- `globals.css` v3 (single source of truth pour tokens)
- `axionia-design` skill — à mettre à jour Sprint 17/20 pour refléter la doctrine Editorial Premium
