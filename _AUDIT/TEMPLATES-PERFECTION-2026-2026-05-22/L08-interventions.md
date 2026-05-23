# Audit L08 — Interventions (25 templates)

**Date** : 2026-05-22 | **Agent** : A8

## Scores par groupe

| Groupe                     |  Pages |   Score | Classe     |
| -------------------------- | -----: | ------: | ---------- |
| Hub `/interventions`       |      1 |     890 | BIEN       |
| Hubs famille (4)           |      4 |     890 | BIEN       |
| Paliers durée (4)          |      4 |     860 | BIEN       |
| Pages détail format (13)   |     13 |     890 | BIEN       |
| Page formulaire `/demande` |      1 |     880 | BIEN       |
| pSEO par-ville             |      1 |     920 | EXCELLENCE |
| **Moyenne L8**             | **25** | **892** | **BIEN**   |

---

## Hub `/interventions/page.tsx` — Architecture SSOT

**Score : 890/1000**

| Dim           | Score | Justification                                                                           | path:line                 |
| ------------- | ----: | --------------------------------------------------------------------------------------- | ------------------------- |
| D1 SEO        |    87 | Title 83c (hub, acceptable), desc dynamic ✓, breadcrumbs ✓, 8+ internal links ✓         | page.tsx:77-80            |
| D2 AEO        |    78 | Service + ItemList 4 familles ✓. **hasOfferCatalog manquant** (P0). Sous-titre 35+ mots | page.tsx:90-102           |
| D6 A11y       |    94 | h1 unique ✓, ARIA complet ✓, contraste 7:1 ✓                                            | page.tsx:486, 522-555     |
| D8 Conversion |    91 | CTA above-fold ✓, sticky mobile ✓ (threshold=500), tarif entry price visible ✓          | page.tsx:504-511, 933-942 |

### P0

1. **hasOfferCatalog manquant** dans Service JSON-LD — LLMs n'annoncent pas les 4 familles | 0.5h | NEW
2. **Descriptions 210c trop longues** (toutes familles) → max 160-180c | 0.5h par page

---

## Pages détail format — Pattern ProductPageTemplate

**Score : 890/1000**

Toutes 13 pages injectent Service + FAQ JSON-LD via factories ✓. Contenu centralisé SSOT `interventions.ts` ✓.

**Forces** :

- Service + FAQ JSON-LD complet sur tous les formats
- Pricing visible (fixe ou "sur devis" explicite)
- CTA above-fold cohérents

---

## `/interventions/demande/page.tsx` — Formulaire

**Score : 880/1000**

| Dim           | Score | Justification                                                                              |
| ------------- | ----: | ------------------------------------------------------------------------------------------ |
| D7 AI Act     |    90 | RGPD consent ✓, data minimization ✓                                                        |
| D8 Conversion |    80 | **9 champs > 4 recommandés** (country+phone merge recommend) ✓ UX acceptable multi-section |

### P0

1. Réduire de 9→6 champs (merge country+phone, retirer company si non-critique) | 2h

---

## pSEO `/interventions/par-ville/[ville]`

**Score : 920/1000**

| Dim    | Score | Justification                                                       |
| ------ | ----: | ------------------------------------------------------------------- |
| D3 GEO |    97 | LocalBusiness + GeoCoordinates ✓, hreflang per-ville ✓, ISR 86400 ✓ |

---

## Synthèse L8

### Top P0 dédupliqués

1. **hasOfferCatalog manquant** hub interventions | 0.5h | NEW
2. **Descriptions 210c > 160-180c** (5 pages familles) | 2.5h
3. **Formulaire /demande 9 champs** | 2h

### P1

1. Maillage interne pages détail format faible
2. srcset/LQIP vérification Illustration component
3. Social proof sur hubs familles (logos clients)

**Score global** : 892/1000 — Architecture SSOT exemplaire, gaps AEO/UX mineurs.
