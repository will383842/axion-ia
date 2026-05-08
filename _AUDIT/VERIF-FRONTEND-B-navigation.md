# Annexe B — Audit Navigation

**Source agent** : AGT-NAV
**Couverture** : 12 axes 3.A → 3.L

## Couverture par axe

| Axe                                      | Statut | Note                                                                                                                                                |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.A Header desktop                       | ⚠️     | 5 items zéro dropdown OK · sticky OK · **active state manquant** (P1)                                                                               |
| 3.B Header mobile                        | ⚠️     | aria-modal + Escape + body lock OK · **backdrop click + logo absents** (P1) · animation 250ms manquante (P2) · **focus trap absent** (P1, AGT-A11Y) |
| 3.C Footer 5 zones                       | ⚠️     | Identité + Services partielles · **Zone 4 Entreprise déficitaire** · pas de newsletter signup ni sociaux · **manque /accessibilite** (P0)           |
| 3.D Breadcrumbs                          | ⚠️     | Composant complet (JSON-LD, aria-current) · **pas systématiquement utilisé** dans pages (P2, à confirmer car ProductPageTemplate l'utilise)         |
| 3.E Skip-to-content                      | ✅     | sr-only + focus-visible OK, cible `#main`                                                                                                           |
| 3.F LocaleSwitcher                       | ⚠️     | Server Component OK · **pathnames incomplètes** pour /blog, /faq, /centre-aide (P0)                                                                 |
| 3.G Liens internes                       | ⚠️     | Link/next-intl partout · `/sitemap.xml` exception OK · **liens vers pages programmatiques manquantes**                                              |
| 3.H Speculation Rules + View Transitions | ❌     | **Aucun script speculationrules** dans head · **View Transitions non activées** (P2)                                                                |
| 3.I États navigation                     | ❌     | **Highlight page courante absent** dans Header (P1-NAV-006)                                                                                         |
| 3.J Scroll behavior                      | ❓     | smooth scroll + reduced-motion à valider runtime                                                                                                    |
| 3.K Keyboard order                       | ⚠️     | SkipToContent premier focusable OK · audit Tab order complet à valider runtime                                                                      |
| 3.L Pages programmatiques                | ❌     | seul `/blog/[slug]` + `/cas-concrets/[slug]` livrés · **6 patterns programmatiques manquants** (P0/P1, cf. annexe A)                                |

## Findings P0 (5)

| ID          | Titre                                                                          | Action                                                  |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **NAV-001** | Pages programmatiques manquantes (FAQ/[slug], blog catégorie/tag/auteur, etc.) | Sprint 15+ — dépend de COV-P0-1 et COV-P1-\*            |
| **NAV-002** | Footer ne distingue pas IA Custom Premium dans Services                        | Ajouter item dédié Footer                               |
| **NAV-003** | Pathnames /blog, /faq, /centre-aide sans mapping FR/EN                         | Compléter `routing.ts`                                  |
| **NAV-004** | Page /accessibilite manquante (déclaration WCAG 2.2 AA)                        | Créer route + lier dans Footer Légal                    |
| **NAV-005** | Footer Zone 4 Entreprise incomplète (manque /partenaires, /carrieres, /presse) | Confirmer scope avec Will — peut-être P2 si non roadmap |

## Findings P1 (5)

| ID          | Titre                                                                                                                  | Action                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **NAV-006** | Header n'a pas de **active state** (`aria-current="page"` + underline)                                                 | Ajouter dans `Header.tsx` via `usePathname()` (ou Server Component avec `headers()`) |
| **NAV-007** | LocaleSwitcher fragile sans pathnames complètes (cf. NAV-003)                                                          | Cf. NAV-003                                                                          |
| **NAV-008** | MobileNav : backdrop click ne ferme pas, logo absent dans drawer header, focus trap absent                             | Migrer vers `<Sheet>` Radix (déjà dispo dans `src/components/ui/sheet.tsx`)          |
| **NAV-009** | Footer pas de newsletter signup ni icônes sociales (LinkedIn/YouTube/X attendus §4.3)                                  | Ajouter NewsletterForm (déjà créé Sprint 13) en zone 1 + icônes                      |
| **NAV-010** | Breadcrumbs jamais explicitement utilisés dans pages publiques (le composant existe mais l'audit ne les voit pas tous) | À reconfirmer : ProductPageTemplate les rend bien — vérifier listing + transversales |

## Findings P2

| ID          | Titre                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| **NAV-011** | Audit clavier complet à faire en runtime (Tab order, focus piège, skip-link) |
| **NAV-012** | LocaleSwitcher labels FR/EN — ok B2B, mais hardcoded                         |
| **NAV-013** | MobileNav animation slide-in 250ms manquante                                 |
| **NAV-014** | Footer manque icônes réseaux sociaux LinkedIn/YouTube/X                      |
| **NAV-015** | Speculation Rules + View Transitions API non câblés                          |

## Top 3 risques navigation

1. **Pages programmatiques manquantes** — perte AEO/SEO majeure (FAQ, blog catégories, secteurs cas concrets) — Sprint 15.
2. **Active nav state invisible** — UX dégradée — fix rapide en Sprint 15.
3. **Pathnames routing.ts incohérentes** — risque mal-routage post-launch sur /blog, /faq, /centre-aide — fix immédiat.
