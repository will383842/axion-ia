# Audit L10 — Verticales secondaires + Équipe (6 templates)

**Date** : 2026-05-22 | **Agent** : A10

## Scores

| Template                                          |   Score | Classe      |
| ------------------------------------------------- | ------: | ----------- |
| `/codage-developpement/page.tsx`                  |     850 | BIEN        |
| `/codage-developpement/web-digital/page.tsx`      |     848 | BIEN        |
| `/sites-web-augmentes/page.tsx`                   | **570** | **REFONTE** |
| `/un-a-un/page.tsx`                               |     825 | BIEN        |
| `/un-a-un/par-ville/[ville]/page.tsx`             |     906 | EXCELLENCE  |
| `/equipe/[slug]/page.tsx` (Manon — LECTURE SEULE) |     912 | EXCELLENCE  |
| **Moyenne L10**                                   | **818** | **BIEN**    |

---

## `/codage-developpement/page.tsx` — V5 Web & Digital IA

**Score : 850/1000**

| Dim       | Score | Justification                                                      |
| --------- | ----: | ------------------------------------------------------------------ |
| D1 SEO    |    95 | Title 60c ✓, desc 156c ✓, canonical ✓, hreflang ✓                  |
| D2 AEO    |    95 | 4 schemas (Service + FAQ + HowTo + ItemList) ✓, areasServed auto ✓ |
| D5 Images |     0 | **Zéro image/photo** — text-only page                              |

---

## `/sites-web-augmentes/page.tsx` — **REFONTE REQUISE**

**Score : 570/1000**

### P0 CRITIQUES

1. **Zéro areasServed auto** — `buildServiceAreasServed(loc)` manquant dans Service JSON-LD (vs codage-developpement:196 qui l'a) → pénalité GEO
2. **Zéro FAQ/HowTo/ItemList** — 0 schema AEO secondaire (vs 4 sur codage-developpement) → pénalité AEO
3. **CTA uniquement vers /interventions** — pas de `/contact`
4. **Page orpheline architecturale** — duplique contenu codage-developpement sans valeur ajoutée

**Fix** : Cloner structure codage-developpement + adapter | 4-6h

---

## `/un-a-un/page.tsx` — 4e verticale

**Score : 825/1000**

| Dim           | Score | Justification                                                   | path:line   |
| ------------- | ----: | --------------------------------------------------------------- | ----------- |
| D8 Conversion |    98 | CTA ✓, **pricing live** `À partir de ${formattedPrice}` ✓ (L85) | page.tsx:85 |
| D10 Stack     |    95 | ISR 86400s explicite ✓ (L24), pricing dynamic ✓                 | page.tsx:24 |

### P1

- Ajouter FAQ + HowTo schemas (cible 850+) | 2h

---

## `/un-a-un/par-ville/[ville]` — pSEO Excellence

**Score : 906/1000**

| Dim           | Score | Justification                                                                                                                        |
| ------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------ |
| D2 AEO        |    90 | buildVilleServiceJsonLdGraph 7 schemas ✓ (Service + LocalBusiness + FAQ + HowTo + Person + BreadcrumbList + ItemList villes proches) |
| D3 GEO        |    98 | LocalBusiness + GeoCoordinates ✓, population INSEE ✓, postal code ✓                                                                  |
| D8 Conversion |    98 | CTA `/reserver?ville=...` ✓, pricing entry price inline ✓                                                                            |

---

## `/equipe/[slug]/page.tsx` (Manon — LECTURE SEULE)

**Score : 912/1000**

| Dim       | Score | Justification                                                                                                     | path:line                          |
| --------- | ----: | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| D5 Images |    95 | Portrait 1024×1024, **priority=true** ✓ (L118), **width=420 height=420** ✓ (L115-116) → CLS=0, sizes responsive ✓ | page.tsx:112-120                   |
| D7 AI Act |    98 | aiGenerated:true JSON-LD ✓, AiContentDisclaimer visible ✓, disclaiguatingDescription AI Act art.50 ✓              | seo-content-gen-factories.ts:71-76 |

**NOTE** : Portrait Manon correctement implémenté — priority + intrinsic dimensions. Aucune modification requise.

---

## Synthèse L10

### Top P0

1. **REFONTE /sites-web-augmentes** (score 570) — areasServed + FAQ + HowTo + ItemList manquants | 4-6h | CRITIQUE
2. **Zéro images** sur codage-developpement pages — branding faible | 1 sprint day visual

### Top P1

1. FAQ + HowTo sur /un-a-un | 2h
2. Schema Service complet codage-developpement (déjà bien mais vérif hasOfferCatalog)

**Score sans /sites-web-augmentes** : 868/1000 — BIEN. Avec refonte : 880+.
