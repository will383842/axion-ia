# Audit L11 — GEO Local + Implantations (7 templates)

**Date** : 2026-05-22 | **Agent** : A11

## Scores

| Template                                        |   Score | Classe     |
| ----------------------------------------------- | ------: | ---------- |
| `/implantations/page.tsx`                       |     822 | BIEN       |
| `/implantations/[region]/page.tsx`              |     904 | EXCELLENCE |
| `/implantations/[region]/[ville]/page.tsx`      |     897 | EXCELLENCE |
| `/[service]/par-ville/[ville]` (avg 4 services) |     881 | BIEN       |
| **Moyenne L11**                                 | **876** | **BIEN+**  |

---

## `/implantations/page.tsx` — Hub national

**Score : 822/1000**

| Dim    |  Score | Justification                                                               |
| ------ | -----: | --------------------------------------------------------------------------- |
| D1 SEO |     92 | Title 71c ✓, desc 157c ✓, ItemList 12 régions ✓                             |
| D3 GEO | **57** | **P0 : Pas de LocalBusiness/Organization France-level** — GEO signal faible |

### P0

1. **Hub national sans Organization + Service areaServed France** | 0.5h | NEW

---

## `/implantations/[region]/page.tsx` — Hub régional

**Score : 904/1000**

| Dim    | Score | Justification                                                                                           |
| ------ | ----: | ------------------------------------------------------------------------------------------------------- |
| D3 GEO |    97 | LocalBusiness ProfessionalService ✓, address ✓, geo ✓, areaServed:AdministrativeArea ✓, Place JSON-LD ✓ |
| D1 SEO |    95 | Title ~50c ✓ per région                                                                                 |

---

## `/implantations/[region]/[ville]/page.tsx` — Fiche ville CRITIQUE

**Score : 897/1000**

| Dim           | Score | Justification                                                                                                  |
| ------------- | ----: | -------------------------------------------------------------------------------------------------------------- |
| D1 SEO        |    95 | Title "Paris (75-IDF) · Cabinet IA" 59c ✓, breadcrumbs 4 niveaux ✓                                             |
| D2 AEO        |    93 | FAQ Speakable ✓, ItemList villes proches (Haversine 8) ✓                                                       |
| D3 GEO        |    97 | LocalBusiness complet ✓, GeoCoordinates lat/lng ✓, postalCode ✓, 9 sections dont données économiques locales ✓ |
| D4 Web Vitals |    74 | **TBT risque > 150ms** — 9 sections + 5 JSON-LD schemas (P0)                                                   |
| D8 Conversion |    72 | **Adresse physique jamais mentionnée** — section "Où nous rencontrer" manquante (P0)                           |

### P0 CRITIQUES

1. **TBT risque > 150ms** sur fiches ville — Lighthouse audit live requis | 3h | NEW
2. **Adresse physique absente** — décision Will requise (WeWork Paris ?) puis dev | BLOQUÉ

---

## pSEO par-service (4 templates partagés)

Tous utilisent `VilleServicePageTemplate.tsx` avec `buildVilleServiceJsonLdGraph` (7 schemas).

| Dim           | Score | Justification                                        |
| ------------- | ----: | ---------------------------------------------------- |
| D3 GEO        |    97 | LocalBusiness + Service + GeoCoordinates ✓           |
| D4 Web Vitals |    76 | 6 sections + 7 JSON-LD → TBT potentiellement > 150ms |

---

## Couverture SSG

| Donnée                        | Valeur                          |
| ----------------------------- | ------------------------------- |
| Villes en base                | 2 280 communes INSEE ≥5 000 hab |
| Villes indexables (avec copy) | **39 villes pilotes**           |
| Régions                       | 12                              |
| Routes SSG estimées           | ~8 852 pages                    |

---

## Synthèse L11

### Top P0

1. **Hub national sans Organization France** | 0.5h
2. **TBT risque > 150ms** fiches ville | Lighthouse audit 3h
3. **Adresse physique absente** — bloqué décision Will

### Top P1

1. Sectors NAF à auditer vs INSEE Sirene 2024 (5 villes sample)
2. GBP CID links (quand GBP créé)
3. Vérifier coordonnées GPS internes vs INSEE officiel

### Benchmark

| Critère                   | Axion-IA     | HubSpot FR  |
| ------------------------- | ------------ | ----------- |
| LocalBusiness JSON-LD     | ✅✅ complet | ✅ basique  |
| GeoCoordinates            | ✅           | ✅          |
| Adresse physique          | ❌           | ✅✅        |
| FAQ Speakable             | ✅           | ✅          |
| Données économiques INSEE | ✅ (manual)  | ✅✅ (auto) |

**Post-fixes P0 + adresse** : score estimé 926+ (EXCELLENCE).
