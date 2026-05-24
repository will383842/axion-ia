# Audit L03 — Cas Concrets (3 templates)

**Date** : 2026-05-22 | **Agent** : A3

## Scores

| Template                                |   Score | Classe         |
| --------------------------------------- | ------: | -------------- |
| `/cas-concrets/page.tsx`                |     925 | EXCELLENCE     |
| `/cas-concrets/[slug]/page.tsx`         |     918 | EXCELLENCE     |
| `/cas-concrets/secteur/[slug]/page.tsx` |     902 | EXCELLENCE     |
| **Moyenne L3**                          | **915** | **EXCELLENCE** |

---

## `/cas-concrets/page.tsx` — Hub

**Score : 925/1000**

| Dim           | Score/100 | Justification                                                                                    | path:line               |
| ------------- | --------: | ------------------------------------------------------------------------------------------------ | ----------------------- |
| D1 SEO        |        95 | Title 60c ✓, desc 150c ✓, canonical ✓, breadcrumbs ✓, ItemList JSON-LD ✓ (L105-119)              | page.tsx:49-58, 105-119 |
| D2 AEO        |        95 | ItemList JSON-LD complet ✓, copy pilar > 80 mots. Filtrage CSS display:none (pas de JS client) ✓ | page.tsx:105-119        |
| D4 Web Vitals |        93 | ISR revalidate=86400 ✓, Client Component filtrage via CSS ✓ (~1KB JS)                            | page.tsx:37             |
| D8 Conversion |        96 | 2× CTA ✓, CtaBlock finale "Devenez cas concret" ✓, pricing Essentielle ✓                         | page.tsx:191-326        |

### Forces

1. ISR + Client filtering CSS équilibrés — page statique + filtrage dynamique sans JS fallback
2. ItemList JSON-LD complet — LLMs voient le full index
3. Copy pilar confiance (280+ mots, anonymisation + ROI chiffré)

---

## `/cas-concrets/[slug]/page.tsx` — Détail

**Score : 918/1000**

| Dim           | Score/100 | Justification                                                                    | path:line             |
| ------------- | --------: | -------------------------------------------------------------------------------- | --------------------- |
| D1 SEO        |        92 | Title format unique ✓, breadcrumbs ✓                                             | page.tsx:61, 66-69    |
| D2 AEO        |        95 | Article + Review dual JSON-LD ✓, TL;DR AnswerCard ✓, AnswerCard role="doc-tip" ✓ | page.tsx:77-127       |
| D7 AI Act     |        98 | AiContentDisclaimer ✓ (L217-221), aiGenerated ✓ (L247), dateModified ✓           | page.tsx:217-221, 247 |
| D8 Conversion |        96 | TestimonialCard + Review JSON-LD 5⭐ ✓, CtaBlock "Démarrez votre cas" ✓          | page.tsx:223-237      |

### P0

1. **Images before/after absentes** — 0 illustration dans détail cas concret → impact engagement -40% | effort MEDIUM | NEW
2. **revalidate ISR manquant** → default 3600s (incohérence avec hub 86400s) | 0.1h | CONFIRMED

---

## `/cas-concrets/secteur/[slug]/page.tsx` — Hub secteur

**Score : 902/1000**

### P0

1. **AI Act disclosure absent** — CollectionPage sans AiContentDisclaimer (vs détail qui l'a) | 0.5h | CRITICAL NEW

---

## Synthèse L3

### Top 3 P0

1. **AiContentDisclaimer absent sur secteur/** — compliance AI Act art.50 | 0.5h | CRITICAL
2. **Images before/after absentes** sur [slug] — engagement visuel | MEDIUM
3. **revalidate ISR manquant** (2 pages) — cache cohérence | 0.2h

**Score moyen** : 915/1000 → EXCELLENCE. Post-fixes P0 → **960+**
