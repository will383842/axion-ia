# Audit A12 — Activation V2 + feature flag effectif

## Résumé

- **Score brut** : 160 / 200
- **Verdict** : 🟡 quasi-conforme (1/5 spot-check login non-gated, justifié pré-auth)
- **Poids** : ×1

## Feature flag configuration

**Fichier** : `src/lib/feature-flags.ts`

- `isAdminV2Enabled()` async (L42-51) :
  - Cookie `admin_v2=1` override per-session.
  - Fallback `isAdminV2EnabledFromEnv()` hors RSC.
- `isAdminV2EnabledFromEnv()` (L57-59) :
  - `process.env["ADMIN_V2_ENABLED"] === "true"`.
  - Pour workers/tests/SSG (sync-only).
- Default `false`.

## Spot-checks 5 routes

| Route                  | Import | Appel async | Branche V1/V2      | Verdict                              |
| ---------------------- | ------ | ----------- | ------------------ | ------------------------------------ |
| `page.tsx` (dashboard) | L20 ✅ | L106 ✅     | Early-return V2 ✅ | CONFORME                             |
| `login/page.tsx`       | ❌     | ❌          | ❌                 | **NON-CONFORME** (justifié pré-auth) |
| `content-gen/page.tsx` | L10 ✅ | L26 ✅      | Early-return V2 ✅ | CONFORME                             |
| `users/page.tsx`       | L8 ✅  | L33 ✅      | Early-return V2 ✅ | CONFORME                             |
| `settings/page.tsx`    | L8 ✅  | L20 ✅      | Early-return V2 ✅ | CONFORME                             |

### Login non-gated (P1)

`src/app/[locale]/(admin)/[adminPrefix]/login/page.tsx` L12-21 : pas de flag check. Redirect simple si déjà loggé. **Acceptable** : login = contexte pré-authentification (distinction V2 non-pertinente).

Pénalité : -40 pts.

## V2 component scaffold

- Root `src/app/[locale]/(admin)/[adminPrefix]/_v2/` (3 fichiers) :
  - `DashboardV2Wrapper.tsx`, `DashboardV2.tsx`, `AdminListScaffold.tsx`.
- Feature-level : chaque route a son `_v2/` subdir.
- ✅ Wiring complet, composants existent.

## Content-Gen coverage alert

- **48 routes** dans `content-gen/**`.
- **1 V2 component** implémenté : `ContentGenDashboardV2.tsx`.
- Les 47 sous-routes : fallback V1 (par design, migration progressive).
- PR 9 « 22 routes » = scope planifié, livré : 1 dashboard + sous-routes restent V1.

## Qualité implémentation

- ✅ Async-first.
- ✅ Early-return V2 first (pas de ternaire imbriqué).
- ✅ Cookie → env → false fallback documenté.
- ✅ Naming `V2` suffix clair.
- ✅ Live toggle (pas de module-level cache).

## Findings

### P1

- **FINDING-A12-P1-01** : `login/page.tsx` ne respecte pas le pattern flag. Justifié (pré-auth) mais master prompt exige all routes. **Fix recommandé** : ajouter `isAdminV2Enabled` + branche stub V1 même sans V2 composant.

## Verdict

🟡 **160/200**. PASS avec advisory. Flag fonctionne correctement. Login ungated acceptable opérationnellement.
