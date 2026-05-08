# Annexe A — Inventaire 75 templates

**Source agent** : AGT-COVERAGE
**Date** : 2026-05-06
**Commit audité** : `1135136`

## Synthèse chiffrée

| Métrique                                                           | Valeur                                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Templates attendus (`02b-mapping-pages.md`)                        | 75                                                                                        |
| Pages présentes (statiques + dynamiques avec generateStaticParams) | 34                                                                                        |
| Couverture                                                         | **45 %**                                                                                  |
| Routes orphelines hors mapping (intentionnelles dev)               | 3 (`/components`, `/design`, `/sections`)                                                 |
| Routes orphelines hors mapping (Sprint 11/12/13)                   | 3 (`/audit/demande`, `/reserver`, `/roi`) — **dans `routing.ts` pathnames, donc valides** |
| Routes manquantes P0 critiques                                     | 3 (`/faq/[slug]`, `/desabonnement`, routing.ts à compléter)                               |
| Routes manquantes P1 majeures                                      | 6 (filtres blog cat/tag/auteur, centre-aide [slug] + cat, cas-concrets/secteur/[slug])    |

> **Correction** : les routes `/audit/demande`, `/reserver`, `/roi` ne sont PAS orphelines — elles sont déclarées dans `src/i18n/routing.ts` `pathnames` map (commits `5a5ac6e`, `d6b9983`, `c3d748b`) et correspondent aux livrables Sprints 11/12/13.

## Routes présentes (34)

| Module  | Template                                                                                                  | URL FR               | URL EN     | Metadata          | JSON-LD         | Breadcrumbs          | Verdict        |
| ------- | --------------------------------------------------------------------------------------------------------- | -------------------- | ---------- | ----------------- | --------------- | -------------------- | -------------- |
| Home    | /                                                                                                         | /fr                  | /en        | ✅                | ✅              | n/a                  | OK             |
| M1      | /interventions                                                                                            | listing              | listing    | ✅                | ✅              | ✅                   | OK             |
| M1      | /interventions/essentielle                                                                                | ✅                   | ✅         | ✅                | ✅ Service+FAQ  | ✅                   | OK ★           |
| M1      | /interventions/equipes                                                                                    | ✅                   | ✅         | ✅                | ✅ Service      | ✅                   | OK             |
| M1      | /interventions/managers                                                                                   | ✅                   | ✅         | ✅                | ✅              | ✅                   | OK             |
| M1      | /interventions/conference                                                                                 | ✅                   | ✅         | ✅                | ✅              | ✅                   | OK             |
| M1      | /interventions/dirigeants                                                                                 | ✅                   | ✅         | ✅                | ✅              | ✅                   | OK             |
| M2      | /audit                                                                                                    | listing PriceMatrix  | ✅         | ✅                | ✅              | ✅                   | OK             |
| M2      | /audit/{complet,departement,point-de-vente,cabinet}                                                       | 4 pages              | 4 pages    | ✅                | ✅ Service+FAQ  | ✅                   | OK             |
| M2      | /audit/demande                                                                                            | form embed           | form embed | ✅                | ✅              | ✅                   | OK (Sprint 13) |
| M3      | /implementation                                                                                           | listing              | listing    | ✅                | ✅              | ✅                   | OK             |
| M3      | /implementation/{ia-custom,chatbot,processus,structuration,crm-erp,documents,agents,integrations,no-code} | 9 pages              | 9 pages    | ✅                | ✅ Service+FAQ  | ✅                   | OK             |
| Cas     | /cas-concrets                                                                                             | listing filtres URL  | ✅         | ✅                | ✅              | ✅                   | OK             |
| Cas     | /cas-concrets/[slug]                                                                                      | SSG                  | ✅         | ✅ Article+Review | ✅              | OK                   |
| Blog    | /blog                                                                                                     | listing              | ✅         | ✅                | ✅              | ✅                   | OK             |
| Blog    | /blog/[slug]                                                                                              | SSG                  | ✅         | ✅ Article        | ✅              | OK                   |
| Transv  | /a-propos                                                                                                 | ✅                   | ✅         | ✅                | ✅ Organization | ✅                   | OK             |
| Transv  | /contact                                                                                                  | + ContactForm        | ✅         | ✅ ContactPage    | ✅              | OK (Sprint 13 wired) |
| Transv  | /faq                                                                                                      | listing              | ✅         | ✅ FAQPage        | ✅              | OK                   |
| Transv  | /centre-aide                                                                                              | hub 6 topics         | ✅         | ✅                | ✅              | OK                   |
| Transv  | /reserver                                                                                                 | calendrier + booking | ✅         | ✅                | ✅              | OK (Sprint 11)       |
| Transv  | /roi                                                                                                      | simulateur           | ✅         | ✅                | ✅              | OK (Sprint 12)       |
| Légal   | /mentions-legales                                                                                         | ✅                   | ✅         | ✅                | ✅ WebPage      | ✅                   | OK             |
| Légal   | /conditions-generales                                                                                     | ✅                   | ✅         | ✅                | ✅              | ✅                   | OK             |
| Légal   | /politique-confidentialite                                                                                | ✅                   | ✅         | ✅                | ✅              | ✅                   | OK             |
| Légal   | /cookies                                                                                                  | ✅                   | ✅         | ✅                | ✅              | ✅                   | OK             |
| Légal   | /rgpd                                                                                                     | ✅                   | ✅         | ✅                | ✅              | ✅                   | OK             |
| Légal   | /politique-deplacement                                                                                    | ✅                   | ✅         | ✅                | ✅              | ✅                   | OK             |
| Système | /maintenance                                                                                              | hors locale          | n/a        | n/a               | n/a             | n/a                  | OK             |
| Système | /not-found (root + locale)                                                                                | ✅                   | ✅         | n/a               | n/a             | n/a                  | OK             |
| Système | /error (locale)                                                                                           | ✅                   | ✅         | n/a               | n/a             | n/a                  | OK             |

## Routes manquantes P0 (3)

| ID           | Route                              | Raison                                                                                               | Impact                   |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------ |
| **COV-P0-1** | `/[locale]/faq/[slug]/page.tsx`    | AEO (QAPage Schema citable Perplexity/ChatGPT)                                                       | **CRITIQUE** SEO/AEO     |
| **COV-P0-2** | `/[locale]/desabonnement/page.tsx` | RFC 8058 List-Unsubscribe + RGPD                                                                     | **CRITIQUE** légal       |
| **COV-P0-3** | Compléter `routing.ts` pathnames   | guide-ia, methodologie, glossaire, recherche, confirmation, accessibilite, comparaisons, temoignages | Bloquant si pages créées |

## Routes manquantes P1 (6)

| ID           | Route                           | Type schema           | Impact                   |
| ------------ | ------------------------------- | --------------------- | ------------------------ |
| **COV-P1-1** | `/blog/categorie/[slug]`        | CollectionPage        | -15-20 % SEO blog        |
| **COV-P1-2** | `/blog/tag/[slug]`              | CollectionPage        | Cross-linking            |
| **COV-P1-3** | `/blog/auteur/[slug]`           | ProfilePage / E-E-A-T | Author authority         |
| **COV-P1-4** | `/centre-aide/[slug]`           | Article ou HowTo      | Tutorials non indexables |
| **COV-P1-5** | `/centre-aide/categorie/[slug]` | CollectionPage        | Content organization     |
| **COV-P1-6** | `/cas-concrets/secteur/[slug]`  | CollectionPage        | Industry targeting       |

## Routes manquantes P2 (5)

| ID       | Route                                    | Note                               |
| -------- | ---------------------------------------- | ---------------------------------- |
| COV-P2-1 | `/guide-ia`                              | Lead magnet (si newsletter active) |
| COV-P2-2 | `/methodologie`                          | Longform thought leadership        |
| COV-P2-3 | `/glossaire`                             | DefinedTermSet                     |
| COV-P2-4 | `/comparaisons` + `/comparaisons/[slug]` | High-intent KW                     |
| COV-P2-5 | `/recherche`                             | FTS UI                             |
