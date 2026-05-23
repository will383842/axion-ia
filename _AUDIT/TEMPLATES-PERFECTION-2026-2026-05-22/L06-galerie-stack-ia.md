# Audit L06 — Galerie + Stack IA (7 templates)

**Date** : 2026-05-22 | **Agent** : A6

## Scores

| Template                                     |   Score | Classe         |
| -------------------------------------------- | ------: | -------------- |
| `/galerie/page.tsx`                          |     845 | BIEN           |
| `/galerie/[slug]/page.tsx`                   |     920 | EXCELLENCE     |
| `/galerie/audits/page.tsx`                   |     900 | EXCELLENCE     |
| `/galerie/implementations/page.tsx`          |     900 | EXCELLENCE     |
| `/galerie/interventions-formations/page.tsx` |     900 | EXCELLENCE     |
| `/stack-ia/page.tsx`                         |     910 | EXCELLENCE     |
| `/stack-ia/[tool]/page.tsx`                  |     925 | EXCELLENCE     |
| **Moyenne L6**                               | **900** | **EXCELLENCE** |

---

## `/galerie/page.tsx` — Hub galerie

**Score : 845/1000**

### P0 CRITIQUE — CLS risque

`GalleryGrid.tsx:73-86` : Image `fill` layout sans ratio CSS garanti AVANT Image load

- **Impact** : CLS > 0.05 possible sur connexions lentes (vs budget 0 interne)
- **Fix** : Assurer que `aspect-[4/3]` container est rendu AVANT Image mount
- **Action** : Instrumentation RUM Sentry sur `/galerie` pour valider

| Dim           | Score | Justification                                                                        |
| ------------- | ----: | ------------------------------------------------------------------------------------ |
| D1 SEO        |    95 | Title ✓, desc ✓, ItemList JSON-LD 24 images ✓ (L148-170)                             |
| D5 Images     |    75 | LQIP blurDataURL ✓ (GalleryGrid:82), alt FR/EN ✓. **CLS risk sans intrinsic sizing** |
| D8 Conversion |    70 | **Hub sans CTA "Utiliser cette image"** → manque opportunité conversion              |

---

## `/galerie/[slug]/page.tsx` — Image détail

**Score : 920/1000**

| Dim           | Score | Justification                                                                                                | path:line                             |
| ------------- | ----: | ------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| D2 AEO        |    95 | @graph 6 entités (Org, WebSite, WebPage, Breadcrumb, ImageObject, Subject) ✓                                 | image-jsonld-graph.service.ts:246-292 |
| D5 Images     |    95 | `width/height` intrinsic déclarés ✓ (L180-192, fallback 1280×720), LQIP ✓, priority+fetchPriority ✓, sizes ✓ | galerie/[slug]/page.tsx:180-196       |
| D7 AI Act     |    98 | Copyright Axion-IA ✓, CC BY 4.0 ✓, datePublished/dateModified ✓, IP SHA-256 hashée ✓                         |                                       |
| D8 Conversion |    95 | Download CTA ✓, watermark on-the-fly ✓ (Sharp), rate-limit 10/min/IP ✓                                       | telecharger/route.ts:117-124          |

### Forces

- JSON-LD @graph 6 entités — référence pour Google Images
- Width/height intrinsic → CLS = 0 garanti
- CC BY 4.0 visible partout (badge + download + schema)

---

## `/stack-ia/page.tsx` — Hub Stack IA

**Score : 910/1000**

| Dim       | Score | Justification                                                                 |
| --------- | ----: | ----------------------------------------------------------------------------- |
| D2 AEO    |    95 | ItemList JSON-LD 11 outils ✓, FAQ Speakable ✓, SoftwareApplication per-tool ✓ |
| D7 AI Act |    95 | Disclaimer "aucun partenariat commercial" ✓ (L763-771)                        |

---

## `/stack-ia/[tool]/page.tsx` — Outil détail

**Score : 925/1000**

| Dim       | Score | Justification                                                                                                |
| --------- | ----: | ------------------------------------------------------------------------------------------------------------ |
| D2 AEO    |    98 | SoftwareApplication + Product JSON-LD ✓, additionalProperty (Pricing/Hosting/Maturity) ✓, FAQ Speakable 4Q ✓ |
| D7 AI Act |    98 | "Ce verdict reflète l'usage terrain. Aucun partenariat" ✓                                                    |

### Forces

- Product JSON-LD + additionalProperty → richesse machine-readable
- "Quand on l'évite" dual structure — E-E-A-T fort
- Comparable tools mesh (3 max)

---

## Synthèse L6

### Top P0 dédupliqués

1. **CLS risque galerie hub** (GalleryGrid fill sans ratio garanti) — Lighthouse audit live requis | 3h
2. **Hub galerie sans CTA "Utiliser cette image"** — conversion manquée | 2h

### P1

1. Illustration slots stack (STACK-02-closing) : vérifier `width/height` CSS
2. Pagination aria-current manquante galerie

**Score global** : 900/1000 — Excellence. Stack galerie/image-bank très mature.
