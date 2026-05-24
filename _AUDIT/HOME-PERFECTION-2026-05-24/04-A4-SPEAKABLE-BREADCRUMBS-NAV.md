# A4 — Speakable + Breadcrumbs + Navigation | Score 72/100 ⚠️

## Scoring

| #   | Sous-dim                         | Score | Verdict                                                                              |
| --- | -------------------------------- | ----- | ------------------------------------------------------------------------------------ |
| 1   | Speakable SpeakableSpecification | 85    | Sélecteurs CSS valides, MAIS h1 hero absent                                          |
| 2   | Speakable coverage               | 72    | FAQ couvert; hero + intros NON                                                       |
| 3   | **Breadcrumb policy home**       | 0     | **VIOLATION** — BreadcrumbList émis sur home (convention 2026 = home racine sans BL) |
| 4   | Hiérarchie h1/h2/h3              | 88    | 1 h1, 10 h2; 2 h3 orphelines sans h2 parent                                          |
| 5   | Landmark roles ARIA              | 70    | main/header/footer ✓, manque aria-labelledby sections + nav primaire                 |
| 6   | Skip links                       | 100   | SkipToContent → #main, sr-only, focus visible ✓                                      |
| 7   | Focus management                 | 75    | focus-visible cohérent, manque tabIndex 5 cartes services                            |
| 8   | Mobile sticky CTA                | 95    | StickyMobileCta rAF-optimisé, threshold 600px, dismissible scroll-away               |
| 9   | Nav primaire                     | 80    | 5 items, depth ≤2, mega-menu Interventions sur-complexe                              |
| 10  | Anchor structure                 | 65    | Sections sans IDs (#services #faq #cases absent) → deep-linking limité               |

## Speakable — sélecteurs validés contre HTML réel

```json
{
  "@type": "FAQPage",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": ["[data-faq-q]", "[data-faq-a]", "[itemprop='name']", "[itemprop='text']"]
  }
}
```

| Sélecteur           | HTML match                 | path:line        | Validation             |
| ------------------- | -------------------------- | ---------------- | ---------------------- |
| `[data-faq-q]`      | AccordionTrigger data attr | accordion.tsx:36 | ✅                     |
| `[itemprop='name']` | AccordionTrigger itemProp  | accordion.tsx:37 | ✅                     |
| `[data-faq-a]`      | div data attr              | accordion.tsx:60 | ✅                     |
| `[itemprop='text']` | div itemProp               | accordion.tsx:60 | ✅                     |
| Hero h1             | h1 display-editorial       | page.tsx:377     | ❌ ABSENT de speakable |
| Intro paras         | p text                     | page.tsx:384-385 | ❌ ABSENT              |

**Verdict** : FAQ couvert (Google Assistant/Alexa voice OK), MAIS hero brand intro non lue → brand recall vocal -30%.

## Hiérarchie headings détectée

```
H1: "Cabinet IA opérationnel Paris..." (page.tsx:377)
├── H2: "Cinq expertises" (457) → 5 cards
├── H2: "Trois niveaux..." (668) → pricing
├── H2: "Six raisons concrètes" (935) → why
│   └── H3: "Zéro intermédiaire" (1091) ✓
├── H3: "Six expertises. Indépendantes..." (1128) ❌ ORPHELINE (no h2 parent)
├── H2: "Regardez nos clients" (1255)
├── H2: "Des implémentations sur mesure" (1284)
├── H2: "Vous êtes au cœur..." (1423)
├── H2: "Notre offre pour tous" (1469) → audience
├── H3: "Secteurs couverts" (1506) ❌ ORPHELINE (no h2 parent)
├── H2: "Ce que disent nos clients" (1550)
├── H2: "Questions fréquentes" (1677)
└── H2: "Choisissez votre point de départ" (1729)
```

## Breadcrumb policy — VIOLATION CRITIQUE

**Convention 2026** : Home = racine → NE PAS émettre BreadcrumbList.

**État actuel** (page.tsx:337-349) :

```js
const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/${loc}` },
  ],
};
// émis L1879 via <JsonLd data={breadcrumbJsonLd} />
```

**Fix** :

```js
const breadcrumbJsonLd = null;
// puis retirer le <JsonLd> correspondant L1879
```

## Forces (top 3)

1. **Speakable FAQ conforme** — 12 Q couvrent verticales clés, cssSelectors valides HTML réel
2. **Skip link WCAG 2.4.1 complet** — SkipToContent → #main
3. **Mobile Sticky CTA perf-optimized** — rAF dedup, scroll-dismiss non-intrusif

## P0

1. **BreadcrumbList self-reference violation** (page.tsx:337-349) — `breadcrumbJsonLd = null` — 5min
2. **2 h3 orphelines** (page.tsx:1128, 1506) — soit ajouter h2 wrapper soit retro-grader h3 en div.sr-only — 15min

## P1

1. **Speakable coverage incomplète** — ajouter sélecteur `[data-speakable-hero]` sur h1:377 + p:384-385 — 30min
2. **Anchor IDs sections manquants** — `id="services"`, `"why"`, `"cases"`, `"faq"`, `"pricing"` + aria-labelledby — 1h
3. **Landmark `aria-labelledby` sections** — WCAG 2.1 AA — 30min

## P2

1. Focus ring saillance cartes services — `.group:focus-within:ring-2` — 15min
2. Nav primaire couverture 5 services — /un-a-un + /sites-web-augmentes absent header — 30min
3. Mega-menu Interventions simplification (best-sellers only) — 1h
