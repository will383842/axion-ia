# Audit L07 — Audit (offre) (7 templates)

**Date** : 2026-05-22 | **Agent** : A7

## Scores

| Template                            |   Score | Classe   |
| ----------------------------------- | ------: | -------- |
| `/audit/page.tsx`                   |     810 | BIEN     |
| `/audit/flash/page.tsx`             |     827 | BIEN     |
| `/audit/cible/page.tsx`             |     839 | BIEN     |
| `/audit/strategique-pme/page.tsx`   |     839 | BIEN     |
| `/audit/strategique-eti/page.tsx`   |     838 | BIEN     |
| `/audit/demande/page.tsx`           |     810 | BIEN     |
| `/audit/par-ville/[ville]/page.tsx` |     832 | BIEN     |
| **Moyenne L7**                      | **826** | **BIEN** |

---

## `/audit/page.tsx` — Hub audit

**Score : 810/1000**

| Dim           | Score | Justification                                                                                                        | path:line             |
| ------------- | ----: | -------------------------------------------------------------------------------------------------------------------- | --------------------- |
| D1 SEO        |    95 | Title 59c ✓ "Audit IA PME & ETI · 4 niveaux · Flash dès 490 €", dynamique avec prix ✓                                | page.tsx:77-80        |
| D2 AEO        |    88 | Service JSON-LD ✓ (L90), ItemList 4 tiers ✓ (L102), FAQPage 8Q ✓ (L237). **Sous-titre hero 35 mots > 22 cible** (P0) | page.tsx:90, 102, 237 |
| D4 Web Vitals |    78 | **P0 : CLS historiquement > 0.05** (mentionné AGENTS.md L71). Long page 500 lignes.                                  | lighthouserc.json:71  |
| D5 Images     |    65 | **Zéro hero photo** — icons Lucide uniquement                                                                        |                       |
| D8 Conversion |    82 | CTA above-fold ✓ (L717), sticky mobile ✓ (L934), tarif visible 3 tiers ✓, form 6 étapes OK                           |                       |

### P0

1. **CLS > 0.05 sur /audit** — Lighthouse CI gate fail | 4h | CONFIRMED (AGENTS.md L71)
2. **Sous-titre hero 35 mots** → split en 2×22 mots max | 0.5h | NEW

---

## Pages détail tiers (4 pages — AuditDetailPage template)

**Score moyen : 836/1000**

Pattern commun : Title ≤60c ✓, Service + FAQ JSON-LD ✓, sub-tiers cards avec pricing ✓, CTA clear ✓.

**Faiblesses communes** :

- `revalidate` export manquant (→ default ISR)
- Zéro hero photo

---

## `/audit/demande/page.tsx` — Formulaire

**Score : 810/1000**

| Dim           | Score | Justification                                           |
| ------------- | ----: | ------------------------------------------------------- |
| D7 AI Act     |    88 | RGPD consent explicite ✓, data minimization statement ✓ |
| D8 Conversion |    84 | 22 champs / 6 étapes wizard (justifié UX multi-step) ✓  |

### P1

1. Form error tracking Sentry non visible | 0.5h
2. aria-invalid / aria-describedby sur champs | 2h

---

## `/audit/par-ville/[ville]` — pSEO

**Score : 832/1000**

| Dim           | Score | Justification                                                         |
| ------------- | ----: | --------------------------------------------------------------------- |
| D3 GEO        |    96 | LocalBusiness ✓, GeoCoordinates ✓, code INSEE ✓, hreflang per-ville ✓ |
| D4 Web Vitals |    88 | ISR 86400 ✓, dynamicParams=true ✓                                     |

### P1

1. CTA ville-spécifique manquant (`/audit/demande?ville=${ville}`) | 0.25h
2. Hero image per-ville manquante | MEDIUM

---

## Synthèse L7

### Top P0

1. **CLS > 0.05 /audit hub** — Lighthouse CI fail | 4h | CONFIRMED
2. **Sous-titre hero 35 mots** | 0.5h | NEW
3. **Zéro hero photos** 5 pages tiers | 1 sprint day | P1 visuel

### Top P1

1. `revalidate = 3600` manquant (5 pages détail + demande) | 10min
2. Sentry form errors | 0.5h
3. aria-invalid form | 2h
4. ROI calculator / estimator manquant sur hub | 2-3h
5. CTA per-ville | 0.25h

**Effort total** : ~12h P0+P1
