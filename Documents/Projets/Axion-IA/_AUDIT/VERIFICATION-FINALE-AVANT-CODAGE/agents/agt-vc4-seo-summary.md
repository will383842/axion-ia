# AGT-VC4 — SEO/AEO/GEO 2026 — Summary

**Score** : 80.5/100 — **Verdict** : 🟡 CONDITIONAL GO

## Résumé

Spec SEO exhaustive (100+ items, JSON-LD 24+ schemas, Speakable + Featured Snippet + sitemap perfection). Template landing-ville TSX intègre les 9 schemas critiques. **Mais 2 bugs P0 pré-existants** (sitemap.xml 404 + og:image localhost) doivent être adressés avant Sprint 1 Day 6 gate.

## Findings clés

| ID | Sev | Item | Effort |
|---|---|---|---|
| VC4-001 | **P0** | /sitemap.xml retourne HTML 404 (17 500+ routes non crawlables) | 2 h |
| VC4-002 | **P0** | og:image pointe localhost (previews sociales cassées) | 1 h |
| VC4-003 | P1 | Twitter handle Manon = placeholder, confirmer ou retirer balise | 30 min |
| VC4-004 | P1 | Google Indexing API V1 = grey-area (JobPosting-only officiel) | 3 h |
| VC4-005 | P1 | Anti-AI-detection 6 signaux non implémentés en validation | 3 h |
| VC4-006 | P2 | Canonical double-signal HTML + HTTP header (risque conflits) | monitoring |

## Catégories scoring

| Catégorie | Score |
|---|---|
| Head HTML 32 / OG 14 / Twitter 7 / Geo 4 | 19/20 |
| Headings + Semantic HTML5 + WCAG AA | 15/15 |
| JSON-LD 24+ schemas | 5/5 |
| Featured Snippet 3 formats | 5/5 |
| Speakable validation Playwright | 4/5 |
| llms.txt YAML Anthropic 2026 | 3/5 |
| IndexNow + Google Indexing API V1 | 3/5 |
| Sitemap perfection + Crawl budget | 10/10 |
| hreflang FR-only + Canonical | 9/10 |
| Anti-AI-detection 6 signaux | 2/5 |
| SearchIntent alignment | 5/5 |
| robots.txt 2026 différencié | 5/5 |
| **Pre-existing bugs adressés** | **2/5** (les 2 P0 ci-dessus) |

## Bloqueurs Sprint 1

P0-1 + P0-2 (bugs pré-existants) à adresser **Day 0 ou Day 1** sinon Day 6 `pnpm verify:all` échouera.
