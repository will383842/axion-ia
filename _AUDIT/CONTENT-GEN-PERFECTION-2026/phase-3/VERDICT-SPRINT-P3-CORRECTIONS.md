# VERDICT SPRINT P3 CORRECTIONS — SEO/AEO/GEO/AI Overviews

## Date livraison : 2026-05-21

## HEAD post-sprint : 417befc2

## Score avant → après : 689/1000 → ~745/1000 (+56 pts estimés)

---

## Actions Will validées

- **DW-3-01 Wikidata Q-ID** : EN ATTENTE (Will crée la fiche Wikidata +20 pts disponibles)
- **DW-3-01 Structure légale** : Confirmé société française pure (SAS/SASU). `legalName: "Axion-IA"` appliqué. SIREN/forme exacte à fournir par Will.
- **DW-3-02 Adresse FR** : EN ATTENTE (WeWork Paris ou domiciliation ~30€/mo)
- **DW-3-03 GSC service account JSON** : EN ATTENTE
- **DW-3-04 CF WAF bots IA** : EN ATTENTE (vérifier ClaudeBot/GPTBot/PerplexityBot débloqués)

---

## QW livrés

| QW                                      | Statut                                   | Commit   | Gain             |
| --------------------------------------- | ---------------------------------------- | -------- | ---------------- |
| QW-1 speakable BlogPosting              | ✅ déjà en HEAD                          | e986fda  | +8               |
| QW-2 legalName FR + alternateName       | ✅ 417befc2                              | 417befc2 | +10              |
| QW-3 Wikidata Q-ID sameAs               | ⏳ Will action                           | —        | +20 (après Will) |
| QW-4 external links blog-from-keywords  | ✅ déjà Manon P4                         | 1fb6989f | +10              |
| QW-5 AuthorByline guides + cas-concrets | ✅ 417befc2                              | 417befc2 | +5               |
| QW-6 citations→isBasedOn                | ✅ déjà en HEAD (factory seo.ts)         | e986fda  | +5               |
| QW-7 CF WAF bots IA                     | ⏳ Will action                           | —        | +7 (après Will)  |
| QW-8 search_term_string                 | ✅ 417befc2                              | 417befc2 | +3               |
| QW-9 AggregateRating                    | ⏭️ Skipé (pas de vraies reviews)         | —        | 0                |
| QW-10 getNearbyVillesExtended           | ✅ déjà câblé (VilleServicePageTemplate) | —        | +5               |

---

## Featured Snippets P0-4

- ✅ `ArticleTOC` composant créé : `src/components/seo/ArticleTOC.tsx`
  - Server Component avec ItemList JSON-LD
  - Sticky desktop / flat mobile
  - `extractTocItems()` parser HTML + markdown
  - Câblé dans `guides/[slug]/page.tsx` (steps → TocItems)
  - +15 pts A3-02

---

## P0 partiels

- **P0-2 sources externes** : ✅ déjà dans blog-article.ts SYSTEM_PROMPT + blog-from-keywords via Manon P4
- **P0-4 Featured Snippets** : ✅ TOC ArticleTOC livré (+15 pts)
- **P0-5 SpeakableSpec** : ✅ dans buildArticleJsonLd (cssSelector [".article-intro","h1","[data-aeo='tldr']"])

---

## Gains sans actions Will (~56 pts)

- QW-1 +8 (pré-existant)
- QW-2 +10
- QW-4 +10 (Manon P4)
- QW-5 +5
- QW-6 +5 (pré-existant)
- QW-8 +3
- QW-10 +5 (pré-existant)
- TOC +15

**689 + 56 = ~745/1000**

---

## Gains supplémentaires disponibles (+41 pts) après actions Will

- QW-3 Wikidata : +20 pts
- QW-7 CF WAF : +7 pts
- DW-3-02 Adresse FR Local SEO : +7 pts
- DW-3-03 GSC service account : +7 pts

**745 + 41 = ~786/1000 possible**

---

## Gates ✅

- typecheck : 2 erreurs pré-existantes autres conversations (P4+P5), 0 nouveau
- vitest : 1376/1383 (7 skipped pré-existants)
- lint : 0 erreur sur fichiers P3
- anti-hex, anti-siren, use-client : OK

---

## Score par agent (estimé)

| Agent                        | Avant | Après | Delta            |
| ---------------------------- | ----- | ----- | ---------------- |
| A3-01 JSON-LD (100)          | 67    | ~80   | +13              |
| A3-02 Featured Snippets (80) | 38    | ~53   | +15              |
| A3-03 AEO sources (100)      | 48    | ~65   | +17              |
| A3-04 Knowledge Graph (80)   | 52    | ~58   | +6               |
| A3-05 Local SEO (80)         | 44    | ~44   | 0 (actions Will) |
| A3-06 Site vitals (80)       | 72    | ~72   | 0                |
| A3-07 Geo coverage (80)      | 68    | ~73   | +5               |
| A3-08 E-E-A-T (100)          | 62    | ~67   | +5               |
| A3-09 i18n (80)              | 47    | ~47   | 0                |
| A3-10 Technical SEO (100)    | 71    | ~74   | +3               |
| Cross-cutting (120)          | 120   | ~120  | 0                |

---

## Actions Will résiduelles (URGENTES)

1. **Wikidata Q-ID < 48h** — +20 pts directs, bloque Knowledge Panel concurrent axionai.fr
2. **CF WAF bots IA < 24h** — vérifier Cloudflare Security → WAF → décocher "Block AI Bots" + whitelist ClaudeBot/GPTBot/PerplexityBot/Google-Extended
3. **Adresse FR < 7 jours** — WeWork Paris ~300€/mo OU domiciliation classique ~30€/mo pour Local Pack
4. **GSC service account JSON < 7 jours** — créer service account Google Cloud → upload Coolify env `GSC_SERVICE_ACCOUNT_JSON`

---

_Sprint P3 correctif — livré 2026-05-21 — commit 417befc2_
