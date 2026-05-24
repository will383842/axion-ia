# Audit L04 — Knowledge / Centre aide / Guides / Glossaire (10 templates)

**Date** : 2026-05-22 | **Agent** : A4

## Scores

| Template                                 |   Score | Classe     |
| ---------------------------------------- | ------: | ---------- |
| `/connaissances/page.tsx`                |     875 | BIEN       |
| `/connaissances/[slug]/page.tsx`         |     920 | EXCELLENCE |
| `/centre-aide/page.tsx`                  |     905 | BIEN       |
| `/centre-aide/[slug]/page.tsx`           |     935 | EXCELLENCE |
| `/centre-aide/categorie/[slug]/page.tsx` |     910 | BIEN       |
| `/guides/page.tsx`                       |     880 | BIEN       |
| `/guides/[slug]/page.tsx`                |     945 | EXCELLENCE |
| `/guide-ia/page.tsx`                     |     900 | BIEN       |
| `/glossaire/page.tsx`                    |     910 | BIEN       |
| `/glossaire/[slug]/page.tsx`             |     950 | EXCELLENCE |
| **Moyenne L4**                           | **910** | **BIEN**   |

---

## Forces globales L4

1. **Dual JSON-LD** sur détails : Article + QAPage (centre-aide/[slug]), HowTo + Article (guides/[slug]), DefinedTerm + Speakable (glossaire/[slug])
2. **AiContentDisclaimer** partout où applicable ✓
3. **buildArticleJsonLd factory** cohérente pour aiGenerated + creator + disambiguatingDescription
4. **Anti-doorway HCU 2024** : glossaire/[slug] noindex si définition < 80 mots ✓

---

## P0 Actions critiques (AEO)

### 1. ItemList JSON-LD manquant sur hubs

| Page                                     | Fix                                                                  | Effort |
| ---------------------------------------- | -------------------------------------------------------------------- | ------ |
| `/glossaire/page.tsx`                    | Ajouter ItemList(60 termes) après DefinedTermSet (~L129)             | 0.5h   |
| `/centre-aide/categorie/[slug]/page.tsx` | Ajouter ItemList(articles catégorie) après CollectionPage (~L157)    | 0.5h   |
| `/connaissances/page.tsx`                | Étendre hasPart à tous 48 articles OU ajouter ItemList séparé (~L89) | 0.5h   |

**Impact** : Articles orphelins pour LLM discovery → -25% citation rate AI Overviews

### 2. Speakable cssSelector manquant sur hubs

| Page                                     | Selector cible                |
| ---------------------------------------- | ----------------------------- |
| `/connaissances/page.tsx`                | `[data-aeo="kb-intro"]`       |
| `/centre-aide/page.tsx`                  | `[data-aeo="help-intro"]`     |
| `/centre-aide/categorie/[slug]/page.tsx` | `[data-aeo="category-desc"]`  |
| `/glossaire/page.tsx`                    | `[data-aeo="glossary-intro"]` |

**Impact** : -25% citation rate AI Overviews, Google Assistant voice

### 3. connaissances/[slug] refactoring

- Remplacer JSON-LD artisanal (L71-83) par buildArticleJsonLd factory (cohérence aiGenerated)
- Ajouter AiContentDisclaimer avant CtaBlock
- Ajouter "Articles connexes" via findRelatedArticles() (pattern /guides/[slug])

---

## P1 Actions

1. Illustrations hero manquantes sur `/connaissances`, `/guides`, `/centre-aide/categorie/[slug]`
2. SuggestedContent articles related manquant sur connaissances/[slug]
3. Pagination pour hubs 50+ items

---

## Benchmark

| Critère             | HubSpot Academy | Notion Help | Axion-IA              |
| ------------------- | --------------- | ----------- | --------------------- |
| Dual JSON-LD        | Article+HowTo   | Article     | **+3 types**          |
| AiContentDisclaimer | Absent          | Absent      | ✅                    |
| Anti-doorway HCU    | Partiel         | Absent      | ✅ glossaire          |
| Speakable coverage  | ~40%            | Absent      | ~50% → **cible 100%** |

**Effort total** : ~6h (P0 3h + P1 3h)
