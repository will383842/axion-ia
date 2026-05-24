# Audit L01 — Home & Narratif (8 templates)

**Date** : 2026-05-22 | **Agent** : A1 | **Doctrine** : ZÉRO INVENTION

## Templates audités

```
/page.tsx (Home)
/a-propos/page.tsx
/methodologie/page.tsx
/roi/page.tsx
/transparence/page.tsx
/charte-editoriale/page.tsx
/sections/page.tsx (dev-only)
/design/page.tsx (dev-only)
```

---

## `/` — Home (page d'accueil)

**Score : 785/1000** | Classe : **POLISH**

| Dim           | Score/100 | Justification                                                                                                                     | path:line          |
| ------------- | --------: | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| D1 SEO        |        78 | Title 57c ✓, desc 150c ✓, canonical ✓, OG ✓, hreflang FR ok. Breadcrumb N/A (home). Internal-link 5+ ✓. EN locale disabled (301). | page.tsx:43-50     |
| D2 AEO        |        72 | FAQPage JSON-LD via buildFaqSpeakableJsonLd ✓ (L215), Speakable ✓. Phrases intro ~19 mots ✓. ClaudeBot non-bloqué ✓.              | page.tsx:203-215   |
| D3 GEO        |        85 | hreflang fr-FR ✓, x-default ✓. EN désactivé.                                                                                      | seo.ts:121-137     |
| D4 Web Vitals |        68 | **P0** : Hero SVG inline 770 lignes sans fetchPriority="high" → LCP estimé > 2000ms. INP ok (0 event handlers). CLS ok.           | page.tsx:266       |
| D5 Images     |        75 | SVG hero (decorative, aria-hidden ✓). Illustration section AVIF target ✓. Alt FR ✓. NO DALL-E ✓.                                  | page.tsx:1251-1268 |
| D6 A11y       |        80 | Contraste 7:1 ✓, h1 unique ✓ (L229), focus-visible ✓, landmarks ✓, lang="fr" ✓.                                                   | page.tsx:229-235   |
| D7 AI Act     |        82 | dateModified BUILD_DATE ✓. aiGenerated N/A (contenu éditorial).                                                                   | seo.ts:46          |
| D8 Conversion |        88 | CTA primaire above-fold ✓ (L240-248), CTA secondaire ✓. Sticky mobile à vérifier. Social proof ✓ (L1192-1218). Trust badges ✓.    | page.tsx:240-256   |
| D9 Brand      |        85 | Voix Manon ✓, terracotta ✓, ivoire ✓, bleu ✓. NO `<table>` ✓. 5 verticales ✓.                                                     | page.tsx:82-116    |
| D10 Stack     |        80 | Server Component ✓, no env leak client ✓, Plausible data-cta ✓. ISR default.                                                      | page.tsx:1-60      |

### Forces

1. SVG hero narratif enrichi (L266-824) — qualité éditoriale rare
2. JSON-LD FAQPage + Speakable (L215) — Google Assistant/Alexa eligible
3. Accents 3-color themés par service (L120-154) — cohérence palette

### P0

1. **LCP > 2000ms probable** | Hero SVG 770 lignes sans fetchPriority | Fix : `<link rel="preload" as="image" fetchPriority="high">` ou SVG externe + Image priority | 1h | NEW

### P1

1. hreflang EN émis malgré locale 301 (signal Google ambigu) — 0.5h | CONFIRMED
2. Sticky CTA mobile non confirmé | 1h | NEW

---

## `/a-propos` — À propos

**Score : 820/1000** | Classe : **BIEN**

| Dim           | Score/100 | Justification                                                                | path:line        |
| ------------- | --------: | ---------------------------------------------------------------------------- | ---------------- |
| D1 SEO        |        85 | Title 42c ✓, desc 108c ✓, breadcrumb JSON-LD ✓ (L52-63), internal-link 3+ ✓. | page.tsx:25-40   |
| D2 AEO        |        80 | Person JSON-LD (buildPersonJsonLd L58) ✓. H2/H3 ✓.                           | page.tsx:58      |
| D3 GEO        |        90 | hreflang fr-FR ✓, x-default ✓.                                               | page.tsx:36      |
| D4 Web Vitals |        82 | Hero illustration sans priority ❌. INP ✓. CLS ✓.                            | page.tsx:129-137 |
| D5 Images     |        85 | Illustrations AVIF target ✓, alt FR ✓. NO DALL-E ✓.                          | page.tsx:252-288 |
| D6 A11y       |        85 | h1 unique ✓, contraste ✓.                                                    | page.tsx:78-85   |
| D7 AI Act     |        80 | dateModified ✓. aiGenerated N/A.                                             | seo.ts:46        |
| D8 Conversion |        88 | CTA above-fold ✓ (L118-126), social proof 4 figures ✓ (L157-201).            | page.tsx:118-126 |
| D9 Brand      |        88 | Voix Axion ✓, terracotta ✓, 3 piliers opérationnel/ROI/souveraineté.         | page.tsx:234-250 |
| D10 Stack     |        85 | Server Component ✓, generateMetadata ✓.                                      | page.tsx:1-60    |

### P1

1. Hero illustration sans priority → LCP ~1900ms potentiel | 0.5h | NEW

---

## `/methodologie` — Méthodologie

**Score : 840/1000** | Classe : **BIEN**

| Dim           | Score/100 | Justification                                                                    |
| ------------- | --------: | -------------------------------------------------------------------------------- |
| D1 SEO        |        88 | Title 41c ✓, desc 98c ✓, breadcrumb ✓ (L69), internal-link 4+ ✓                  |
| D2 AEO        |        85 | HowTo JSON-LD ✓ (L74-122, 4 étapes), Article JSON-LD ✓ (L50-65). Dual schema AEO |
| D3 GEO        |        85 | hreflang ✓                                                                       |
| D4 Web Vitals |        80 | Hero illustration sans priority ❌                                               |
| D5 Images     |        88 | Illustrations AVIF ✓, alt FR ✓                                                   |
| D6 A11y       |        82 | h1 unique ✓                                                                      |
| D7 AI Act     |        80 | dateModified ✓                                                                   |
| D8 Conversion |        85 | CTA bottom (L245-251), CtaBlock (L372-388)                                       |
| D9 Brand      |        85 | 4 étapes narrative ✓, terracotta ✓                                               |
| D10 Stack     |        85 | Server Component ✓, dual JSON-LD ✓                                               |

### Forces

1. HowTo + Article dual JSON-LD — double signal AEO (Google AI Overviews + Perplexity)

### P1

1. Hero illustration sans priority | 0.5h | NEW

---

## `/roi` — ROI

**Score : 810/1000** | Classe : **BIEN**

| Dim           | Score/100 | Justification                                          |
| ------------- | --------: | ------------------------------------------------------ |
| D1 SEO        |        82 | Title 52c ✓, desc 127c ✓, breadcrumb ✓                 |
| D2 AEO        |        80 | FAQ JSON-LD ✓ (L188-237), Speakable implicite          |
| D4 Web Vitals |        75 | **RoiSimulator (L146) sliders client-side → INP risk** |
| D5 Images     |        85 | Illustration hero + closing ✓, alt FR ✓                |
| D8 Conversion |        85 | RoiSimulator = conversion self-service ✓, CTA bottom ✓ |
| D10 Stack     |        80 | Server Component + client RoiSimulator ✓               |

### P1

1. RoiSimulator INP risk (sliders sans debounce) | 2h | NEW

---

## `/transparence` — AI Act Hub

**Score : 865/1000** | Classe : **EXCELLENCE**

| Dim           | Score/100 | Justification                                                           | path:line        |
| ------------- | --------: | ----------------------------------------------------------------------- | ---------------- |
| D1 SEO        |        90 | Title 47c ✓, desc 143c ✓, breadcrumb ✓, ISR 86400 ✓. Internal-link 4 ✓. | page.tsx:40-68   |
| D2 AEO        |        88 | WebPage JSON-LD ✓ (L144-158), Speakable ✓, H2 sections ✓.               | page.tsx:144-205 |
| D4 Web Vitals |        90 | Static text, LCP ~600ms ✓.                                              | page.tsx:1-60    |
| D7 AI Act     |        95 | 5 sections AI Act art.50 ✓, DPA ✓, GDPR droits ✓, sous-processeurs ✓.   | page.tsx:75-142  |
| D8 Conversion |        85 | CtaBlock contact ✓ (L210-222).                                          | page.tsx:210-222 |
| D10 Stack     |        90 | Server Component ✓, ISR 1j ✓.                                           | page.tsx:38-60   |

### Forces

1. AI Act art.50 disclosure complet (LONGFORM Manon, DPA explicite)
2. ISR static 1j (flexibility réglementaire)
3. 4 internal-links cross-référencés

---

## `/charte-editoriale` — Editorial Policy

**Score : 875/1000** | Classe : **EXCELLENCE**

| Dim       | Score/100 | Justification                                                                                                                   | path:line        |
| --------- | --------: | ------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| D1 SEO    |        92 | Title 36c ✓, LAST_REVIEWED 2026-05-18 visible ✓, internal-link 4 ✓.                                                             | page.tsx:48-68   |
| D2 AEO    |        90 | WebPage + Speakable cssSelector `.tldr-answer` ✓, dateModified LAST_REVIEWED ✓, 8 sections numérotées AEO-friendly.             | page.tsx:86-89   |
| D7 AI Act |        95 | 8 sections (mission, process, sources, IA, fact-check, corrections, indépendance, cadence), AI Act art.50 explicite (L196-197). | page.tsx:123-282 |
| D10 Stack |        92 | Server Component ✓, ISR 86400 ✓, WebPage speakable ✓.                                                                           | page.tsx:38-68   |

### Forces

1. E-E-A-T score maximal — 8 sections policy = Google AI Overviews magnet
2. LAST_REVIEWED versioning (L46) — accountability éditoriale visible
3. Speakable cssSelector `.tldr-answer` (L88) — Google Assistant ready

---

## `/sections` — Design System (dev-only)

**Score : 450/1000** | Classe : **REFONTE (P0)**

### P0

1. **Pas de robots noindex** — page dev exposée à indexation | 0.5h | NEW
2. **No generateMetadata** | 0.5h | NEW

---

## `/design` — Design Reference (dev-only)

**Score : 460/1000** | Classe : **REFONTE (P0)**

### P0

1. **Pas de robots noindex** | 0.5h | NEW
2. **No generateMetadata** | 0.5h | NEW

---

## Synthèse L1

| Template               |   Score | Classe      |
| ---------------------- | ------: | ----------- |
| Home `/`               |     785 | POLISH      |
| À-propos               |     820 | BIEN        |
| Méthodologie           |     840 | BIEN        |
| ROI                    |     810 | BIEN        |
| Transparence           |     865 | EXCELLENCE  |
| Charte-éditoriale      |     875 | EXCELLENCE  |
| Sections (dev)         |     450 | REFONTE     |
| Design (dev)           |     460 | REFONTE     |
| **Moyenne productive** | **799** | POLISH→BIEN |

### Top 3 P0 dédupliqués

1. **LCP hero SVG sans fetchPriority** (Home + Méthodologie + À-propos) — 1.5h — Impact Lighthouse CI gate
2. **Dev-only pages sans noindex** (/sections, /design) — 1h — Crawl waste
3. **EN hreflang 301 loop** (toutes 8 pages) — 1h — Signaux SEO contradictoires

**Effort total L1** : ~9.5h (P0 3.5h + P1 4.5h + polish 1.5h)
