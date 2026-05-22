# F-07 Maillage interne
## Score : 16/25 — 🟡

## Findings (preuves)

1. **Composant SuggestedContent SSOT** (`src/components/suggested/SuggestedContent.tsx:73`) : RSC pure (V-14 sprint UX 2026-05-22), 3 variants (`articles | cities | cases`), API unifiée + JSON-LD `ItemList` optionnel (l. 47).

2. **Articles avec SuggestedContent** : 3 routes l’importent :
   - `src/app/[locale]/blog/[slug]/page.tsx:27` (related articles)
   - `src/app/[locale]/guides/[slug]/page.tsx`
   - `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (nearbyCases + nearbyVilles + relatedPosts)

3. **findRelatedArticles** (`src/server/content-gen/links/related-articles.ts`) : fonction sourcée DB → résultat injecté dans SuggestedContent variant articles.

4. **Trust-tier links externes** (`src/server/content-gen/links/external-links-injector.ts` + `trust-tier.ts`) : injection externe links curés (audit V-14 trust-tier). Tests présents.

5. **🔴 BUG MAJEUR — catalog liens internes cassé** (`src/server/content-gen/links/internal-link-catalog.ts:20-83`) :
   - `topic: "audit IA", url: "/audits"` → **n’existe pas** (la vraie route = `/audit`)
   - `topic: "interventions formations IA", url: "/interventions-formations"` → **n’existe pas** (vraie route = `/interventions`)
   - `topic: "implémentation IA", url: "/implementations"` → **n’existe pas** (vraie route = `/implementation`)
   - `topic: "tarifs IA", url: "/tarifs"` → **n’existe pas** (aucune route `/tarifs` dans le projet)
   - Vérification PowerShell `Test-Path` confirme l’absence des 3 répertoires/3 routes.
   - Conséquence : `injectInternalLinks()` (l. 121-150) appelé par les générateurs content-gen va injecter des `<a href="/audits">` etc. dans **100 % des articles** générés → 4 liens internes 404 par article.

6. **Articles ≥3 liens internes ?** : Pas vérifiable sans run. Le système `injectInternalLinks` impose `maxLinks = 5` mais les 4 catalog entries sur 9 sont cassées → effectivement ~2 liens internes valides par article max sur les topics courants (blog/glossaire/contact/cabinet conseil IA).

7. **Liens externes ≥2 ?** : `external-links-injector.ts` orchestre l’injection — couvert. Test présent.

8. **Villes proches (P3 QW-10)** : `implantations/[region]/[ville]/page.tsx` utilise SuggestedContent + nearbyVilles ✅.

9. **Breadcrumbs** : `src/components/nav/Breadcrumbs.tsx` utilisé sur blog/rgpd/etc. ; émet JSON-LD `BreadcrumbList`.

10. **Footer maillage** : `Footer.tsx` expose 4 colonnes (services / resources / company / legal) + topRegions × 6 = ~25 liens internes globaux toutes pages.

## P0 bloquants prod
- **🔴 P0 — `internal-link-catalog.ts`** : 4/9 entries pointent vers des URLs inexistantes. Tous les nouveaux articles content-gen produiront ~4 liens 404 → impact SEO (link rot signal négatif Google) + UX (visiteur clique sur lien article, atterrit sur 404).

## P1 importants
- Le catalog statique V1 (9 topics) est limité → V2 (Sprint S+7) prévu pour scan dynamique filesystem + DB Article. Mais corriger les URLs immédiatement.
- Pas de validation au build time que les URLs du catalog existent vraiment dans `routing.pathnames`. Aucun test ne le couvre.
- Footer.tsx topRegions = 6 régions PIB — devrait potentiellement varier par page (pertinence locale).

## P2 polish
- Aucune métrique d’audit du nombre moyen de liens internes par article (à mesurer post-fix).
- Pas de `nofollow` sur certains liens externes (à valider trust-tier policy).

## Verdict
Architecture maillage solide en intention : SuggestedContent SSOT + findRelatedArticles + external-links-injector + trust-tier + Breadcrumbs JSON-LD. MAIS le catalog interne est cassé sur 4/9 entrées (44 %) → bug P0 réel qui pollue tous les articles content-gen. Fix trivial : remplacer `/audits` → `/audit`, `/interventions-formations` → `/interventions`, `/implementations` → `/implementation`, retirer `/tarifs` ou créer route. Score 16/25 ; -9 pour le bug bloquant + absence de validation routing automatisée.
