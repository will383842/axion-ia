# Audit L05 — FAQ + Comparaisons + Presse (6 templates)

**Date** : 2026-05-22 | **Agent** : A5

## Scores

| Template                        |   Score | Classe         |
| ------------------------------- | ------: | -------------- |
| `/faq/page.tsx`                 |     880 | BIEN           |
| `/faq/[slug]/page.tsx`          |     925 | EXCELLENCE     |
| `/comparaisons/page.tsx`        |     865 | BIEN           |
| `/comparaisons/[slug]/page.tsx` |     905 | EXCELLENCE     |
| `/presse/page.tsx`              |     875 | BIEN           |
| `/presse/[slug]/page.tsx`       |     915 | EXCELLENCE     |
| **Moyenne L5**                  | **894** | **EXCELLENCE** |

---

## Vérification critique brand — `<table>` comparaisons

**RÉSULTAT : ✅ AUCUNE TABLE DÉTECTÉE**

Format implémenté correctement : cards parallèles + liste structurée (pas de `<table>`)

---

## `/faq/page.tsx` — Hub FAQ

**Score : 880/1000**

| Dim           | Score | Justification                                                                                 | path:line      |
| ------------- | ----: | --------------------------------------------------------------------------------------------- | -------------- |
| D1 SEO        |    95 | Title 28c ✓, desc ✓, canonical ✓, breadcrumbs ✓                                               | page.tsx:28-31 |
| D2 AEO        |    92 | FAQPage JSON-LD via buildFaqSpeakableJsonLd ✓ (L63), Speakable cssSelector ✓, 3 thématiques ✓ | page.tsx:63    |
| D8 Conversion |    85 | "Was this helpful?" manquant sur hub (P0)                                                     |                |

### P0

1. **"Was this helpful?" UI absent** — feedback loop SEO signal manquant | effort MEDIUM

---

## `/faq/[slug]/page.tsx` — FAQ thématique

**Score : 925/1000**

| Dim       | Score | Justification                                                                 |
| --------- | ----: | ----------------------------------------------------------------------------- |
| D2 AEO    |    96 | QAPage JSON-LD ✓ (buildQAPageJsonLd), Speakable dual-selector ✓, AnswerCard ✓ |
| D7 AI Act |   100 | Contenu KB knowledge-base (human-edited) ✓                                    |

### Forces

- QAPage JSON-LD + Speakable dual-selector — Stack Overflow-level AEO
- markdown alternate link `/api/markdown/faq/{slug}` → LLM ingestion directe

---

## `/comparaisons/page.tsx` — Hub comparaisons

**Score : 865/1000**

| Dim      | Score | Justification                                                                       |
| -------- | ----: | ----------------------------------------------------------------------------------- |
| D1 SEO   |    93 | Title 60c ✓                                                                         |
| D2 AEO   |    88 | CollectionPage JSON-LD ✓, Speakable MANQUANT (P1)                                   |
| D9 Brand |    92 | **NO `<table>`** ✓, maturity level cards (Discovery/Deployment/Industrialisation) ✓ |

---

## `/comparaisons/[slug]/page.tsx` — Comparaison détail

**Score : 905/1000**

| Dim      | Score | Justification                                                                             |
| -------- | ----: | ----------------------------------------------------------------------------------------- |
| D9 Brand |    98 | **NO `<table>`** ✓, vs-split typography editorial (terracotta "vs") ✓, 3-Card structure ✓ |

---

## `/presse/page.tsx` — Hub presse

**Score : 875/1000**

| Dim       | Score | Justification                                                                      | path:line        |
| --------- | ----: | ---------------------------------------------------------------------------------- | ---------------- |
| D2 AEO    |    90 | NewsroomPage JSON-LD ✓, Speakable dual (#press-pitch, #press-boilerplate) ✓        | page.tsx:114-153 |
| D5 Images |    75 | Hero image webp priority ✓, 3 preview images PressImageBank (optimisation Phase 2) | page.tsx:235-250 |

---

## `/presse/[slug]/page.tsx` — Communiqué détail

**Score : 915/1000**

| Dim       | Score | Justification                                                                   |
| --------- | ----: | ------------------------------------------------------------------------------- |
| D2 AEO    |    94 | NewsArticle JSON-LD ✓, Speakable `[data-aeo="press-release-tldr"]` ✓, WebPage ✓ |
| D7 AI Act |    95 | Anti-doorway HCU noindex si body < 60 mots ✓, smart-chunked paragraphes ✓       |

---

## Synthèse L5

### Top P0

1. **"Was this helpful?" absent** (FAQ hub + comparaisons hub) — feedback loop | MEDIUM
2. **Speakable cssSelector manquant** sur CollectionPage comparaisons — AEO | 0.5h
3. **srcset AVIF/WebP** optimisation presse illustrations — Phase 2 | PLANNED

### Conformité doctrine

- ✅ ZÉRO `<table>` comparaisons (audit passed)
- ✅ FAQPage + QAPage + NewsroomPage + NewsArticle JSON-LD complets
- ✅ Anti-doorway HCU presse

**Benchmark** vs concurrents FR : Axion-IA prédomine sur AEO/AI Act. Gap sur "Was this helpful?" (Intercom/Notion).
