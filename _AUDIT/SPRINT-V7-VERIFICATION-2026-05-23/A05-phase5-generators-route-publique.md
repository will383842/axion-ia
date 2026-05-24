# A05 Phase 5 — Generators landing-ville-by-vertical + route publique

## Statut : PROD

Phase 5 c1 (commit `ac703b40`) + c2 (commit `5b757acc`) + adapt test V-13 (`4bd715f6`) livrés conformes au brief. Tous les fichiers attendus existent sur disque, sont tracés par git, et le cleanup `landing-ville-templates.ts` est total (aucune référence runtime restante).

HEAD au moment de l'audit : `98e7626a`.

## Files claimed vs found — 5 generators

Commit `ac703b40` annonce 5 generators verticaux + pipeline partagé + dispatcher refactoré.

| Path (relatif `axionia/`)                                                        | Claimed | Found           | Lignes git stat |
| -------------------------------------------------------------------------------- | ------- | --------------- | --------------- |
| `src/server/content-gen/generators/landing-ville-by-vertical-interventions.ts`   | OUI     | OUI             | 52              |
| `src/server/content-gen/generators/landing-ville-by-vertical-audits.ts`          | OUI     | OUI             | 51              |
| `src/server/content-gen/generators/landing-ville-by-vertical-implementations.ts` | OUI     | OUI             | 52              |
| `src/server/content-gen/generators/landing-ville-by-vertical-un-a-un.ts`         | OUI     | OUI             | 56              |
| `src/server/content-gen/generators/landing-ville-by-vertical-sites-web-ia.ts`    | OUI     | OUI             | 61              |
| `src/server/content-gen/generators/landing-ville-shared.ts` (pipeline)           | OUI     | OUI             | 297             |
| `src/server/content-gen/generators/landing-ville.ts` (dispatcher refactor)       | OUI     | OUI             | 331 (-444+331)  |
| `src/server/content-gen/generators/landing-ville-templates.ts` (DELETE)          | OUI     | DELETE confirmé | -183            |
| `src/server/content-gen/generators/index.ts` (5 exports nommés + registry)       | OUI     | OUI             | +24             |

5/5 generators verticaux PRÉSENTS. Pipeline partagé PRÉSENT et exporte `runLandingVilleByVerticalPipeline`, `DOCTRINE_INTOUCHABLE`, `LANDING_VILLE_VERTICAL_SLUGS`, `type LandingVilleVerticalSlug`. Chaque generator vertical importe `runLandingVilleByVerticalPipeline` + `DOCTRINE_INTOUCHABLE` + `type VerticalConfig` depuis `./landing-ville-shared` puis expose `contentType: "landing_ville"` avec une `VerticalConfig` dédiée (slug, systemPromptOverride, userPromptFocusSection, recommendedCtaHref, recommendedCtaLabel). `landing-ville.ts` ne contient plus le pipeline mais un dispatcher minimal (`resolveLandingVilleVertical` + `LANDING_VILLE_BY_VERTICAL_REGISTRY` + mapping rétro-compat 4 variants legacy → 5 verticales).

## Files claimed vs found — route publique [region]/[ville]/[verticale]

Commit `5b757acc` annonce route publique + fetcher (430 lignes 2 fichiers).

| Path (relatif `axionia/`)                                              | Claimed | Found | Lignes |
| ---------------------------------------------------------------------- | ------- | ----- | ------ |
| `src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx` | OUI     | OUI   | 325    |
| `src/server/content-gen/landing-ville/get-article-by-vertical.ts`      | OUI     | OUI   | 105    |

`page.tsx` lignes 47-65 : `generateStaticParams` retourne `top100 = [...VILLES].sort((a,b)=>b.population-a.population).slice(0,100)` × `LANDING_VILLE_VERTICAL_SLUGS` (5 verticales) = 500 routes SSG, conforme claim "top 100 villes × 5 verticales SSG". `dynamicParams = true` + `revalidate = 86400` (24h) ligne 69-70 conformes claim ISR edge case E5 (ADR 0026). Import `LANDING_VILLE_VERTICAL_SLUGS` provenant bien de `landing-ville-shared.ts` (single source of truth — pas de duplication string-array).

`get-article-by-vertical.ts` lignes 48-50 : early-exit `if (process.env.DATABASE_URL?.includes("stub.invalid")) return null;` conforme contrat ADR 0026 stub-aware build GH Actions. Double-query Prisma documenté ligne 9-13 (ContentGenJob → Article via `generatedByJobId`).

## Cleanup landing-ville-templates : count grep

`git ls-files | grep landing-ville-templates` : **0 résultat** (fichier supprimé du tracking git, conforme `git show --stat ac703b40` ligne `delete mode landing-ville-templates.ts` -183 lignes).

`grep -rn "from ['\"].*landing-ville-templates" axionia/` : **0 match**. Aucun import runtime restant.

`grep -rn "landing-ville-templates" axionia/src` : **7 matches**, tous JSDoc historique purs (mentions du nom dans les commentaires "Migration depuis...", "Refactor `landing-ville-templates.ts` (4 variants...) → ...") dans 5 fichiers : `landing-ville.ts:5,44` + `landing-ville-shared.ts:4` + les 4 generators verticaux (sauf un-a-un et sites-web-ia qui sont "NOUVEAUX" et y font référence). Aucun import / require / dynamic load. Conforme contrainte brief "DOIT être 0 ou seulement JSDoc historique".

## Cross-checks

- `landing-ville.ts` dispatcher conserve un fallback rétro-compat 4 variants legacy (`default` / `focus_audit` / `focus_interventions` / `focus_implementation`) → 5 verticales canoniques, garantissant zero-downtime des jobs queue au moment du deploy (LEGACY_VARIANT_TO_VERTICAL ligne 52-57). Default = `interventions` (offre phare Essentielle 490 €) cohérent positionnement Axion-IA.
- `index.ts` exporte les 5 generators verticaux en exports nommés (lignes 79-83) + helpers (`resolveLandingVilleVertical`, `runPipeline`, `DOCTRINE`, `LANDING_VILLE_BY_VERTICAL_REGISTRY`) conformes claim "registry vertical + helpers".
- Test V-13 `persona-coverage.spec.ts` ajusté commit `4bd715f6` (1 ligne : `landing-ville.ts` → `landing-ville-shared.ts`) car la persona Manon/brand-voice a migré dans le pipeline partagé. Cohérent post-refactor (le dispatcher pur ne contient plus l'injection brand). Claim "24/24 tests verts" non re-vérifié runtime (audit READ-ONLY).
- Page publique conforme HCU 2024 : fallback stub `noindex` si Article absent (ligne 14-15 docstring) + AiContentDisclaimer AI Act art. 50 (ligne 30 import). 5 verticales mappées `VERTICAL_LABEL_FR` ligne 72-78 + `VERTICAL_CTA_HREF` ligne 80+.
- Route physiquement présente : `axionia/src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx` confirmé via `ls` (1 seul fichier `page.tsx`, pas de `layout.tsx` ni `loading.tsx`, ce qui est OK — héritage du parent).

## Verdict / écarts trouvés

PROD. Aucun écart trouvé entre les claims des commits `ac703b40` + `5b757acc` + `4bd715f6` et l'état réel du tree à HEAD `98e7626a`.

- 5/5 generators landing-ville-by-vertical-\* présents et bien câblés vers le pipeline partagé.
- Pipeline partagé `landing-ville-shared.ts` présent (297 lignes), expose `runLandingVilleByVerticalPipeline` + `LANDING_VILLE_VERTICAL_SLUGS` + `type LandingVilleVerticalSlug`.
- Dispatcher `landing-ville.ts` correctement refactoré en dispatcher minimal + rétro-compat 4 variants legacy.
- `landing-ville-templates.ts` totalement supprimé du tracking git, 0 import runtime, 7 mentions résiduelles purement JSDoc historique (conforme contrainte).
- Route publique `[locale]/implantations/[region]/[ville]/[verticale]/page.tsx` présente, `generateStaticParams` cap top 100 villes × 5 verticales = 500 SSG, `dynamicParams=true`, `revalidate=86400` conformes claim edge case E5 ADR 0026.
- Fetcher `get-article-by-vertical.ts` présent (105 lignes), early-exit stub-aware DATABASE_URL=stub.invalid conforme contrat ADR 0026.

Confidence : HAUTE (vérification statique tree + git stats + grep cleanup + read scoping). Runtime test V-13 et SSG build non re-exécutés (audit READ-ONLY mode forensique).
