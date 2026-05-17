# Audit A2 — Sentry Preservation

## Résumé

- **Score brut** : 200 / 200
- **Verdict** : 🟢 CONFORME
- **Poids** : ×3

## Méthode

Commandes exécutées :

```bash
git grep -c "Sentry\." admin-refonte-baseline-2026-05-17 -- 'src/**/*.{ts,tsx}'
git grep -c "Sentry\." HEAD -- 'src/**/*.{ts,tsx}'
git diff admin-refonte-baseline-2026-05-17..HEAD -- 'src/**/*.{ts,tsx}' | grep -E '^[+-].*Sentry\.'
git diff admin-refonte-baseline-2026-05-17..HEAD -- 'src/**/*.{ts,tsx}' | grep -E '^-.*Sentry\.' | wc -l
git diff admin-refonte-baseline-2026-05-17..HEAD -- 'src/**/*.{ts,tsx}' | grep -E '^\+.*Sentry\.' | wc -l
git grep -E "data-sentry-component" baseline..HEAD
```

## Résultats

| Métrique                             | Baseline | HEAD | Delta  |
| ------------------------------------ | -------- | ---- | ------ |
| Mentions Sentry (toutes)             | 6        | 7    | **+1** |
| Appels Sentry effectifs              | 5        | 6    | **+1** |
| `Sentry.captureException`            | 4        | 5    | **+1** |
| `Sentry.setTag/setContext/startSpan` | 0        | 0    | **±0** |
| `data-sentry-component` attrs        | 0        | 0    | **±0** |

**Retraits injustifiés** : **0** ✓

## Findings

### P0 — Preservation Complète

- ✅ **4 appels baseline conservés** :
  - `src/server/queue/workers/image-bank-crons-worker.ts` → `Sentry.captureException(err, {tags, extra})`
  - `src/server/queue/workers/image-bank-enrich-worker.ts` → `Sentry.captureException(err, {tags, extra})`
  - `src/server/queue/workers/image-bank-import-worker.ts` → `Sentry.captureException(err, {tags, extra})`
  - `src/server/queue/workers/image-bank-translate-worker.ts` → `Sentry.captureException(err, {tags, extra})`

### P0 — Nouvel Ajout

- ✅ **1 nouvel appel ajouté** :
  - **Fichier** : `src/app/[locale]/(admin)/[adminPrefix]/error.tsx` (NEW, refonte PR 3)
  - **Ligne 24-27** :
    ```typescript
    Sentry.captureException(error, {
      tags: { route: "admin", boundary: "adminPrefix-root" },
      extra: { digest: error.digest },
    });
    ```
  - **Contexte** : Error boundary RSC pour la console admin. Capture côté client toute erreur non-rattrapée remontant au boundary global.
  - **Justification** : Instrumentalisation de la couche nouveau (refonte zone admin). Respect du contrat « Tous les Sentry.\* doivent être préservés ». Ce nouvel appel enrichit la telemetry.

### P1

- (aucun)

### P2

- 2 mentions dans commentaires (non-code) :
  - `src/app/api/healthz/route.ts` : commentaire sprint futur
  - `src/server/content-gen/providers/health-check.ts` : commentaire jour 2

## Verdict détaillé

**Aucune violation du master prompt §3**.

Tous les appels Sentry baseline ont été 100% préservés. L'ajout du nouvel appel dans `error.tsx` respecte l'esprit du contrat : extension de l'instrumentation vers la refonte admin, avec même signature `captureException(..., {tags, extra})`.

**Aucun retrait injustifié → Score maximal 200/200**.
