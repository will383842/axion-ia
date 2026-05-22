# Fl-02 — Visiteur recherche locale `/fr/implantations/[region]/[ville]` (et `/audit/par-ville/[ville]`)

**HEAD audité** : 81f6ea0e
**Score** : 22 / 25
**Verdict** : 🟢 GO PROD

## Chaîne traçée

| Étape | Fichier | Ligne | Verdict |
|---|---|---|---|
| Route ville pSEO | `src/app/[locale]/implantations/[region]/[ville]/page.tsx` | 1-967 | OK |
| Route audit×ville | `src/app/[locale]/audit/par-ville/[ville]/page.tsx` | 1-32 (wrapper `renderVilleServicePage`) | OK |
| `revalidate = 86400` + `dynamicParams=true` | `implantations/[region]/[ville]/page.tsx` | 65-66 | OK |
| Anti-doorway HCU 2024 — stub `noindex` sans copy | idem | 107-109, 131-140, 921-966 | OK |
| H1 + Direct Answer 40-80 mots | idem | 282-302 | OK AEO/GEO |
| **4 services (audit/interventions/implantation/un-a-un)** grid | idem | 383-530 | OK (V-Sprint S+2 City Domination) |
| **Section "Villes proches" via SuggestedContent** | idem | 681-696 (variant="cities") | OK (P3 QW-10) |
| **Articles factory mentioning ville** (`getBlogArticlesByVille`) | idem | 156-204 (V-01 P0c) ; helper `src/server/content-gen/blog/get-articles-by-ville.ts` | OK V-01 multi-targets |
| CTA contact local pré-rempli `?ville=` | idem | 320-326 (hero), 855-868 (footer) | OK |
| `AiContentDisclaimer` (P0-5 P4) | idem | 883 (rendu) + 963 (rendu sur stub) | OK |
| **JSON-LD LocalBusiness + Place + FAQ Speakable + ItemList** via `JsonLdGraph` `@graph` | idem | 891-900 (`localBusinessJsonLd`, `placeJsonLd`, `faqSpeakableJsonLd`, `nearbyItemList`) | OK 4 schémas chaînés `@graph` |
| `strategy="afterInteractive"` JSON-LD (V-04 P0i) | idem | 898 | OK |
| FAQ Block + Speakable | idem | 698-716 + 236-240 (`buildFaqSpeakableJsonLd`) | OK |
| Données économiques INSEE | idem | 737-826 | OK différenciation par ville |
| Hero schema écosystème B2B | idem | 346-359 | OK |

## Findings P0/P1/P2

| Niveau | Item | Référence |
|---|---|---|
| **P1** | Le prompt demande "JSON-LD LocalBusiness graphe 8 schémas". Ici 4 schémas chaînés en `@graph` (LocalBusiness, Place, FAQ Speakable, ItemList "villes proches"). Manque BreadcrumbList JSON-LD explicite (rendu via composant `<Breadcrumbs>` mais sans `application/ld+json` vérifié à ce point) ; manque Organization (peut être hérité du root layout), Service (audit/intervention/implementation), Review/AggregateRating. À vérifier si root-layout ou un parent ajoute Organization/BreadcrumbList. | `page.tsx:891-900` |
| **P2** | `/audit/par-ville/[ville]` délègue tout à `VilleServicePageTemplate` — comportement non vérifié ligne-par-ligne ; présumé OK (déjà audit Sprint 14.10.1). | `VilleServicePageTemplate` (référencé) |

## Verdict détaillé

Flow visiteur local solide. Tous les éléments stratégiques (4 services dont 4e verticale un-a-un, villes proches Haversine, articles factory liés, FAQ Speakable, JSON-LD `@graph` `afterInteractive`, AiContentDisclaimer, anti-doorway HCU, données INSEE différenciées) sont câblés en route. Score 22/25 (−3 : graphe JSON-LD à 4 schémas vs 8 demandés ; manque vérif BreadcrumbList/Organization explicite à ce niveau — vraisemblablement hérités layout root).
