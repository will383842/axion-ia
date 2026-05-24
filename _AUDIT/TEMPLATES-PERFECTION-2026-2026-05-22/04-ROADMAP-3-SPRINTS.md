# Roadmap 3 sprints — Post-audit Perfection 2026

**Date** : 2026-05-22 | **HEAD** : e7c4000

---

## Sprint A — P0 Critiques (80h) — Semaine 1-2

### Objectif : Éliminer tous les bloquants sécurité, conformité, Web Vitals

| #                  | Action                                                                                         | Effort        | ROI                    |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------- | ---------------------- |
| A1                 | **Admin noindex** : ajouter `robots: {index:false}` layout admin                               | 30min         | 109 pages sécurisées   |
| A2                 | **LCP hero SVG** : fetchPriority + preload (Home, À-propos, Méthodologie)                      | 1.5h          | Lighthouse CI LCP gate |
| A3                 | **CLS audit hub** : profile Lighthouse + `contain:layout` sections + lazy LocalCoverageSection | 4h            | Lighthouse CI CLS gate |
| A4                 | **Dev pages noindex** : /sections, /design                                                     | 0.5h          | Crawl hygiene          |
| A5                 | **Titles > 60c** : /reserver, /demande-devis                                                   | 10min         | SERP truncation        |
| A6                 | **ReservationAction JSON-LD** : /reserver                                                      | 1h            | AEO signal conversion  |
| A7                 | **Order JSON-LD** : /demande-devis, /demande-devis/confirmation, /confirmation                 | 1.5h          | AEO signal conversion  |
| A8                 | **Copyright OÜ → Axion-IA** : schema.prisma migration                                          | 15min         | Brand/RGPD             |
| A9                 | **EXIF strip AVIF/thumbnail** : `.withMetadata()` × 2                                          | 5min          | RGPD GPS leak          |
| A10                | **AiContentDisclaimer /secteur** : cas-concrets/secteur/[slug]                                 | 0.5h          | AI Act compliance      |
| A11                | **Hub national implantations** : Organization + Service France                                 | 30min         | GEO local              |
| A12                | **REFONTE /sites-web-augmentes** : cloner codage-developpement + FAQ + areasServed             | 5h            | Score 570→750+         |
| A13                | **TBT fiches ville** : Lighthouse audit + defer schemas si > 150ms                             | 3h            | Web Vitals             |
| A14                | **revalidate manquants** : 15 pages (1 ligne/fichier)                                          | 1.5h          | Cache cohérence        |
| A15                | **Sentry form errors** : submitAction wrap try/catch × 4                                       | 2h            | Observabilité          |
| **TOTAL Sprint A** |                                                                                                | **~22h code** |                        |

**Actions Will** (non-code) :

- Signer DPA Anthropic + OpenAI + Perplexity (deadline 2026-08-02)
- Décider adresse physique (WeWork Paris ?)
- Fournir SIREN/SIRET/TVA pour mentions-légales

---

## Sprint B — P1 Majeurs AEO/GEO (120h) — Semaine 3-6

### Objectif : Passer de BIEN (870) à BIEN+ (920) sur les 250 templates

| #                  | Action                                                                                                   | Effort       | ROI               |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------------ | ----------------- |
| B1                 | **BreadcrumbList JSON-LD** : 7 hubs blog                                                                 | 3.5h         | AEO LLM discovery |
| B2                 | **ItemList JSON-LD** hubs KB : /glossaire, /centre-aide/categorie, /connaissances                        | 3h           | LLM discovery     |
| B3                 | **Speakable cssSelector** : 6 hubs (connaissances, centre-aide, categorie, glossaire, comparaisons, faq) | 3h           | AI Overviews      |
| B4                 | **FAQ sur /par-techno** (3-5 Q/A)                                                                        | 2h           | AEO intent        |
| B5                 | **FAQ sur /par-fonction** (8 fonctions × 3 Q/A)                                                          | 8h           | AEO intent        |
| B6                 | **hasOfferCatalog** : /interventions + /implementation hubs                                              | 1h           | AEO offer catalog |
| B7                 | **Maillage interne sous-services implementation** (9 pages "Voir aussi")                                 | 2h           | Internal linking  |
| B8                 | **connaissances/[slug] refactoring** : factory + AiContentDisclaimer + related articles                  | 3h           | AEO cohérence     |
| B9                 | **"Was this helpful?"** UI : /faq + /comparaisons                                                        | 4h           | Feedback signal   |
| B10                | **Hero images** : /audit/\* (5 tiers), /un-a-un, /codage-developpement                                   | 1 sprint day | Brand D5          |
| B11                | **aria-invalid/describedby** formulaires                                                                 | 4h           | A11y WCAG 2.2     |
| B12                | **Descriptions 210c → 160c** : 5 pages interventions + 2 audit                                           | 2h           | AEO parsing       |
| B13                | **ROI calculator** sur /audit hub                                                                        | 3h           | Conversion        |
| B14                | **CTA per-ville** : `/audit/demande?ville=`                                                              | 1h           | Conversion pSEO   |
| B15                | **FAQ section /centre-aide/categorie** : ItemList + Speakable                                            | 2h           | AEO               |
| B16                | **Plausible events** sur pages clés sans tracking                                                        | 3h           | Analytics         |
| **TOTAL Sprint B** |                                                                                                          | **~50h**     |                   |

---

## Sprint C — Polish + Admin + Monitoring (80h) — Semaine 7-10

### Objectif : Passer de 920 à EXCELLENCE (≥925) + admin hardening

| #                  | Action                                                                          | Effort   | ROI             |
| ------------------ | ------------------------------------------------------------------------------- | -------- | --------------- |
| C1                 | **Toast/feedback mutations** admin (Groupes 2, 3, 4)                            | 8h       | UX admin        |
| C2                 | **Verify ActivityLog mutations** content-gen                                    | 2h       | SOC2            |
| C3                 | **Rate-limit signInAction**                                                     | 2h       | Sécurité        |
| C4                 | **Couverture pSEO** : repeupler 12 villes top (Marseille, Lyon, Toulouse, etc.) | 8h       | pSEO massif     |
| C5                 | **Galerie hub CTA "Utiliser cette image"**                                      | 2h       | Conversion      |
| C6                 | **CLS instrumentation RUM** galerie (vérifier GalleryGrid fill)                 | 3h       | Web Vitals      |
| C7                 | **Accessibilité WCAG 2.2** audit complet Sprint 21                              | 8h       | A11y compliance |
| C8                 | **Vérifier FaqAccordion** data-faq-q/data-faq-a Speakable                       | 1h       | AEO             |
| C9                 | **CollectionPage + CTA** `/mes-ressources`                                      | 2h       | Conversion      |
| C10                | **TBT deferral** schemas afterInteractive validation live                       | 3h       | Web Vitals      |
| C11                | **X-Robots-Tag noindex** sur 301s EN (proxy.ts)                                 | 15min    | SEO             |
| C12                | **SIREN/SIRET/TVA** mentions-légales (attente Will)                             | 30min    | Legal           |
| C13                | **Illustrations hero** : connaissances, guides, centre-aide/catégorie           | 6h       | Conversion      |
| C14                | **Pagination** hubs 50+ items (connaissances, centre-aide)                      | 4h       | Performance     |
| C15                | **Breadcrumbs admin** (PR 4) + **Command palette** (PR 5)                       | 8h       | UX admin        |
| **TOTAL Sprint C** |                                                                                 | **~60h** |                 |

---

## Projection scores post-sprints

| Lot                |    Avant | Sprint A | Sprint B | Sprint C |
| ------------------ | -------: | -------: | -------: | -------: |
| L01 Home           |      799 |      840 |      880 |      920 |
| L02 Blog           |      869 |      875 |      920 |      930 |
| L03 Cas concrets   |      915 |      930 |      945 |      950 |
| L04 KB/Guides      |      910 |      915 |      945 |      955 |
| L05 FAQ/Compar     |      894 |      900 |      930 |      940 |
| L06 Galerie/Stack  |      900 |      910 |      920 |      940 |
| L07 Audit offre    |      826 |      860 |      890 |      915 |
| L08 Interventions  |      892 |      895 |      915 |      930 |
| L09 Implementation |      873 |      880 |      910 |      925 |
| L10 Verticales     |      818 |      860 |      890 |      915 |
| L11 GEO local      |      876 |      900 |      920 |      935 |
| L12 Conversion     |      820 |      860 |      900 |      920 |
| L13 Légal/RGPD     |      888 |      893 |      900 |      910 |
| L14 Admin V2       |      380 |      680 |      720 |      780 |
| **Moyenne 250**    | **~843** |     ~875 |     ~910 | **~928** |

**Cible finale** : ≥925 (EXCELLENCE) atteinte post-Sprint C.

---

## Budget estimé

| Sprint    | Heures dev |    Semaines | Coût estimé  |
| --------- | ---------: | ----------: | ------------ |
| Sprint A  |        22h |     1-2 sem | ~3-4K€       |
| Sprint B  |        50h |     3-5 sem | ~7-8K€       |
| Sprint C  |        60h |     6-9 sem | ~8-10K€      |
| **Total** |  **~132h** | **~10 sem** | **~18-22K€** |
