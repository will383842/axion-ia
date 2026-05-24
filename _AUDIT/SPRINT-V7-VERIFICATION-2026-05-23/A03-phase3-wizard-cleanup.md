# A03 Phase 3 — Wizard /campaigns/new + cleanup

## Statut : ✅ PROD

Les 3 claims sont matérialisés sur disque (HEAD `98e7626a`). Wizard 4 steps présent
et instancié, redirect 308 `coverage/new` en place, cleanup `dailyBatchSize` net
dans `src/`. Bug lint-staged `59ede0e5` confirmé et corrigé par re-apply `0b7c0797`.

## Files claimed vs found

### Commit `8f4d0e9d` — wizard 4 steps + 9 sliders ContentType

| Fichier claimed                                                                             | LOC commit | Trouvé disque |
| ------------------------------------------------------------------------------------------- | ---------: | :-----------: |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/new/page.tsx`                 |        +32 |      ✅       |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/new/_v2/CampaignWizardV2.tsx` |       +518 |      ✅       |
| `src/components/admin/content-gen/__tests__/CampaignWizardV2.test.tsx`                      |       +136 |      ✅       |
| `src/server/actions/content-gen/campaign-wizard.ts`                                         |       +167 |      ✅       |

Vérification structurelle wizard :

- `page.tsx` : Server Component, `auth()` gate → `<CampaignWizardV2 adminPrefix=…/>`. OK.
- `_v2/CampaignWizardV2.tsx` : `"use client"`, state machine `step: 1 | 2 | 3 | 4`,
  5 services `ServiceSector`, `VilleScopeMode` (global_queue|custom_subset), `MixMode`
  (percentage|manual), import `WIZARD_CONTENT_TYPES` + `WIZARD_SECTIONS`. Présence
  des 4 steps confirmée (l.43-l.57). Note : header de fichier mentionne **21
  sliders / 6 sections (Phase 8)**, dépassant le claim "9 sliders" — extension
  livrée en Phase 8 (cf. MEMORY entrée Sessions 7+8+9).

### Commit `50a781d3` — redirect 308 + suppression legacy `_v2`

| Fichier claimed                                                           |    Lignes | Trouvé disque                                                                        |
| ------------------------------------------------------------------------- | --------: | :----------------------------------------------------------------------------------- |
| `…/coverage/new/_v2/CoverageNewV2.tsx` (suppression)                      |      -427 | ✅ supprimé (glob 0)                                                                 |
| `…/coverage/new/page.tsx` (stub redirect)                                 | -74 / +34 | ✅ contient `permanentRedirect(…/campaigns/new)`                                     |
| `…/settings/batches/_v2/BatchesV2.tsx` (suppression)                      |      -202 | ✅ supprimé (glob 0)                                                                 |
| `…/settings/batches/page.tsx` (suppression)                               |       -27 | ✅ supprimé (glob 0)                                                                 |
| `src/components/admin/content-gen/CoverageWizardClient.tsx` (suppression) |    -1 147 | ✅ supprimé (grep 0 imports — uniquement 2 commentaires JSDoc dans `city-equity.ts`) |
| `src/app/[locale]/page.tsx`                                               |       ±30 | ✅                                                                                   |
| `src/components/home/LogosMarquee.tsx`                                    |       ±26 | ✅                                                                                   |

### Commit `59ede0e5` — DÉCLARÉ CASSÉ (lint-staged stash bug)

`git show --stat` confirme : commit contient `public/illustrations/home-founder-william.jpg` +
`src/app/[locale]/page.tsx` + `src/components/home/LogosMarquee.tsx` UNIQUEMENT. **Aucune
trace de `policies.ts`, `OrchestratorV2.tsx`, `layout.tsx`, ou `seeds/content-gen-config.ts`** —
les 4 fichiers cibles annoncés dans le message de commit. Bug lint-staged stash
**confirmé verbatim**.

### Commit `0b7c0797` — re-apply propre

| Fichier claimed                                                                          |  Lignes | Trouvé disque |
| ---------------------------------------------------------------------------------------- | ------: | :-----------: |
| `prisma/seeds/content-gen/content-gen-config.ts`                                         | -2 / +2 |      ✅       |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/layout.tsx`                          | -1 / +1 |      ✅       |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/orchestrator/_v2/OrchestratorV2.tsx` | -2 / +2 |      ✅       |
| `src/server/actions/content-gen/policies.ts`                                             | -7 / +1 |      ✅       |

## Bug lint-staged stash `59ede0e5` → `0b7c0797` — confirmation

| Élément                                                                                                                                              | Résultat                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `59ede0e5` annonce 4 fichiers ciblés                                                                                                                 | ❌ aucun présent dans `git show --stat`                                |
| `59ede0e5` contient à la place 3 fichiers home page non-reliés                                                                                       | ✅ `home-founder-william.jpg`, `[locale]/page.tsx`, `LogosMarquee.tsx` |
| `0b7c0797` re-apply les 4 fichiers cibles dans un commit séparé                                                                                      | ✅ liste exacte conforme au message                                    |
| Disque actuel reflète le re-apply (`BatchSettingsSchema` sans `dailyBatchSize`, OrchestratorV2 "Concurrency workers", layout CTA → `/campaigns/new`) | ✅                                                                     |

## Cleanup §5 — table grep counts

| Pattern                         | `axionia/src/`                                                                                        | Statut                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `dailyBatchSize`                | **0**                                                                                                 | ✅ cleanup complet                                                                                                                   |
| `CoverageNewV2`                 | **0**                                                                                                 | ✅ supprimé                                                                                                                          |
| `BatchesV2`                     | **0** (3 hits = `GeoBatchesV2` — composant distinct, hors scope)                                      | ✅ supprimé                                                                                                                          |
| `CoverageWizardClient`          | **0** imports / instanciations (2 commentaires JSDoc dans `city-equity.ts` l.23 + l.136 — texte mort) | ⚠️ STUB-OK — 2 mentions docstring résiduelles, non-bloquantes (alias `villeSlug` + helper `getCityEquityData` toujours fonctionnels) |
| `coverage/new` (URL référencée) | **9 hits** dans 7 fichiers (CTAs dashboard/onboarding/presets/geo + commentaire historique)           | ⚠️ STUB-OK — toutes ces URLs hitent le redirect 308 `permanentRedirect`. CTA layout `/campaigns/new` (l.89) directement à jour.      |

`dailyBatchSize` hors `src/` : 18 occurrences dans `_AUDIT/`, `prisma/schema.prisma`
l.2979 (commentaire JSDoc historique annonçant la dépréciation), 0 dans le code
runtime.

## Cross-checks

- `BatchSettingsSchema` (`policies.ts:36-44`) : 5 clés `workersConcurrency`,
  `retryMaxAttempts`, `retryBackoffMs`, `dailyTargetByType`, `antiBurstEnabled`.
  `dailyBatchSize` absent — `.strict()` activé, donc tout payload runtime
  contenant la clé serait rejeté. ✅
- `OrchestratorV2.tsx` l.21 + l.32 : description header et stat card affichent
  bien `Concurrency workers` + `Anti-burst`, pas `Daily batch size`. ✅
- `layout.tsx` l.89 : CTA Nouvelle campagne pointe `${base}/campaigns/new`
  (direct, sans redirect intermédiaire). ✅
- Wizard `_v2/CampaignWizardV2.tsx` instancie 4 steps + 21 sliders / 6 sections
  (extension Phase 8 confirmée en commentaire l.70-72). ✅
- 7 fichiers admin (ContentGenDashboardV2, OnboardingV2, CampaignPresetsV2,
  GeoVilleGenerateV2, GeoBatchesNewV2 + page, coverage.ts JSDoc) référencent
  encore `/coverage/new` en URL → tous redirigés par `permanentRedirect` du
  stub `coverage/new/page.tsx`. Comportement conforme au claim "préserver les
  bookmarks". ⚠️ STUB-OK : ajouter un follow-up de migration UI pour pointer
  ces CTAs vers `/campaigns/new` réduirait la latence d'un hop 308 par clic
  admin (non-bloquant Prod).

## Verdict / écarts trouvés

**✅ PROD avec 2 STUB-OK mineurs.**

Trois claims (a/b/c) tous matérialisés et cohérents disque vs commit history.
Le bug lint-staged `59ede0e5` est documenté de manière exacte (mauvais 3
fichiers commités à la place des 4 annoncés) et corrigé sans ambiguïté par
`0b7c0797`. Cleanup `dailyBatchSize` net dans `src/`. Wizard 4 steps présent
et instancié par la page server component avec auth gate.

Écarts non-bloquants :

1. **CTAs admin legacy** — 7 fichiers `_v2` continuent à pointer `/coverage/new`
   au lieu de `/campaigns/new` direct. Hop 308 transparent navigateur, aucun
   impact fonctionnel ni SEO admin.
2. **Commentaires JSDoc `CoverageWizardClient`** — 2 mentions résiduelles dans
   `city-equity.ts` (lignes 23 + 136). Helper `getCityEquityData` et alias
   `villeSlug` toujours valides, simple poussière documentaire.

Aucun écart bloquant. Phase 3 livrable conforme.
