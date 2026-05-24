# Audit L09 — Implementation (11 templates)

**Date** : 2026-05-22 | **Agent** : A9

## Scores

| Template                                       |   Score | Classe   |
| ---------------------------------------------- | ------: | -------- |
| `/implementation/page.tsx`                     |     888 | BIEN     |
| 9 sous-services (ia-custom, chatbot, etc.)     |     862 | BIEN     |
| `/implementation/par-techno/page.tsx`          |     848 | CORRIGER |
| `/implementation/par-fonction/[slug]/page.tsx` |     856 | BIEN     |
| `/implementation/par-ville/[ville]/page.tsx`   |     881 | BIEN     |
| **Moyenne L9**                                 | **873** | **BIEN** |

---

## Hub `/implementation/page.tsx`

**Score : 888/1000**

| Dim           | Score | Justification                                                                                     | path:line             |
| ------------- | ----: | ------------------------------------------------------------------------------------------------- | --------------------- |
| D1 SEO        |    87 | Title 60c ✓ "Implémentation IA · Catalogue par fonction", 6+ internal-links ✓                     | page.tsx:40-60        |
| D2 AEO        |    92 | Service ✓, ItemList ✓, FAQPage 8Q ✓. FaqAccordion → vérifier data-faq-q/data-faq-a pour Speakable | page.tsx:90, 102, 237 |
| D4 Web Vitals |    82 | Long page 1292 lignes. LCP/CLS/TBT à valider Lighthouse live.                                     |                       |
| D8 Conversion |    91 | CTA ✓, tarif 3 tiers visible ✓, comparatif Make/Agence honnête ✓, sticky mobile ✓                 |                       |

### Forces

1. Comparatif concurrents honnête (Make/Agence vs Axion-IA) — E-E-A-T
2. Scénarios réalistes avant/après (artisan → grand groupe)
3. JSON-LD Service + ItemList + FAQPage + areasServed auto

---

## Sous-services (9 pages — ProductPageTemplate)

**Score moyen : 862/1000**

Pattern uniforme robuste : Service + FAQ JSON-LD ✓, pricing SSOT ✓, breadcrumbs ✓.

**Gap commun** : Maillage interne faible (pas de "Voir aussi" cross-services)

- Fix : Ajouter liens contextuels CRM/ERP ↔ Documents, Agents ↔ Processus | 2h

---

## `/implementation/par-techno/page.tsx` — CORRIGER

**Score : 848/1000**

**P0** :

- **FAQ section absente** — "Chatbot vs Agents ?" / "Quand structurer les données ?" | 2h | NEW
- Slugs EN à valider

---

## `/implementation/par-fonction/[slug]/page.tsx`

**Score : 856/1000**

**P1** : Ajouter FAQ section "IA pour la fonction X ?" (3-5 Q/A) | 1h/fonction

---

## `/implementation/par-ville/[ville]/page.tsx`

**Score : 881/1000**

| Dim           | Score | Justification                                         |
| ------------- | ----: | ----------------------------------------------------- |
| D3 GEO        |    94 | LocalBusiness + GeoCoordinates + INSEE ✓, ISR 86400 ✓ |
| D4 Web Vitals |    88 | ISR 24h ✓, dynamicParams=true ✓                       |

**P1** : Repeupler 12 villes top (Marseille, Lyon, Toulouse, etc.) — impact pSEO massif

---

## Synthèse L9

### Top P0

1. **FAQ manquante sur par-techno** | 2h
2. **FAQ manquante sur par-fonction** (8 fonctions) | 8h

### Top P1

1. Maillage interne sous-services | 2h
2. Couverture pSEO 12 villes supplémentaires
3. Vérifier Speakable activation (data-faq-q/data-faq-a)

**Score global** : 873/1000 — Architecture JSON-LD et pricing SSOT exemplaires. Gaps AEO localisés.
