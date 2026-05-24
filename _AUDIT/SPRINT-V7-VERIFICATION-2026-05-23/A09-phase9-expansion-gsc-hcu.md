# A09 Phase 9 — Expansion progressive + GSC HCU monitor

## Statut : ⚠️ STUB-OK

Worker GSC HCU = V1 stub env-gated (intentionnel, documenté Sessions 10+). Expansion 4 phases = code complet et opérationnel mais non-wired aux call-sites consommateurs.

## Files claimed vs found

| Fichier claimé                                       | Trouvé sur disque                                               | Lignes |
| ---------------------------------------------------- | --------------------------------------------------------------- | ------ |
| `src/server/actions/content-gen/expansion-state.ts`  | `axionia/src/server/actions/content-gen/expansion-state.ts` ✅  | 158    |
| `src/server/queue/workers/gsc-hcu-monitor-worker.ts` | `axionia/src/server/queue/workers/gsc-hcu-monitor-worker.ts` ✅ | 97     |
| `sentry-worker.ts WorkerName +'gsc-hcu-monitor'`     | `axionia/src/server/queue/lib/sentry-worker.ts:96` ✅           | n/a    |

Tous les fichiers déclarés existent et sont accessibles.

## Bug lint-staged stash : 0718f572 confirmed empty ? recovery 790ed7b4 complete ?

**0718f572 stash bug CONFIRMÉ** — `git show --stat` montre 4 fichiers modifiés (`public/llms.txt`, `src/app/[locale]/page.tsx`, `src/components/ui/accordion.tsx`, `src/content/transversal.ts`) qui n'ont **AUCUN rapport** avec Phase 9. Les 2 fichiers Phase 9 (`expansion-state.ts` + `gsc-hcu-monitor-worker.ts`) n'apparaissent pas dans le diff de 0718f572. Le message de commit déclare Phase 9 mais le diff a été pollué par un stash résiduel (3e occurrence après `79a9d408` + `59ede0e5`).

**Recovery 790ed7b4 COMPLET** — `git show --stat 790ed7b4` montre exactement les 2 fichiers manquants : `src/server/actions/content-gen/expansion-state.ts` (+158 lignes) et `src/server/queue/workers/gsc-hcu-monitor-worker.ts` (+97 lignes) = +255 lignes total. Diff propre.

**915a54aa cleanup** — Hotfix indépendant retirant 3 re-exports non-async du fichier `"use server"` `campaign-wizard.ts` (-6/+3) pour conformité Next 16. N'apporte pas les fichiers Phase 9 (contrairement à ce que le message suggère) mais fixe une régression liée.

## Env-gated fallback safe : oui

- `gsc-hcu-monitor-worker.ts:34` → `const ENABLED_ENV = process.env.GSC_HCU_MONITOR_ENABLED === "true";`
- `runMonitorJob:43-52` → si `!ENABLED_ENV` retourne stub data `{ indexedCount: 0, ... thresholdExceeded: false }` + console.log, **aucun appel GSC API**.
- `startGscHcuMonitorWorker:67-69` → throw `"GSC_HCU_MONITOR_ENABLED!=true — worker NOT started (env-gated)"` si non-activé. Le worker ne démarre jamais sans flag.
- En l'absence d'env var (cas par défaut prod actuelle), comportement = no-op total. **Aucun risque d'effet de bord en prod.**

`expansion-state.ts` = pure DB-driven (ContentGenConfig key `"expansion_state"`), pas env-gated mais par design (config persistée). DEFAULT_STATE `phase_a` safe.

## Cross-checks

### 4 phases d'expansion identifiables dans le code : oui

`expansion-state.ts:25-26` :

```ts
const EXPANSION_PHASES = ["phase_a", "phase_b", "phase_c", "phase_d"] as const;
```

`PHASE_QUOTAS` table (lignes 55-88) déclare 4 phases avec quotas explicites :

- `phase_a` : 1 vert × 5 villes × 10 art/j ("MVP pilote mois 0-3")
- `phase_b` : 3 vert × 50 villes × 30 art/j ("Scale prudent mois 4-6")
- `phase_c` : 5 vert × 500 villes × 100 art/j ("Montée vitesse mois 7-12")
- `phase_d` : 5 vert × 2150 villes × 300 art/j ("Nationale full mois 13-24")

Cohérent avec le commit message déclaré.

### Worker gsc-hcu enregistré dans queue index : NON

- `axionia/src/server/queue/worker.ts` : **aucune** mention de `startGscHcuMonitorWorker` ou `gsc-hcu-monitor`.
- `axionia/src/server/queue/queues.ts` : **aucune** mention non plus.
- `sentry-worker.ts:96` enregistre bien `"gsc-hcu-monitor"` dans `WorkerName` union (tagging Sentry only).
- Le seul caller potentiel `startGscHcuMonitorWorker()` est zéro fichier en dehors de sa définition (Grep `startGscHcuMonitorWorker` → 1 hit, le fichier lui-même).

**Conséquence** : même si Will set `GSC_HCU_MONITOR_ENABLED=true`, le worker ne sera **pas** démarré tant qu'on ne l'ajoute pas à `queue/worker.ts` startup. C'est cohérent avec le commit message « V1 squelette, integration Session 10+ » mais l'audit doit le signaler.

### assertWithinPhaseQuotas câblé : NON

- Grep `assertWithinPhaseQuotas` → 1 hit, le fichier lui-même.
- Le commentaire ligne 132 dit « Appelé par campaign-wizard.createCampaignFromWizard avant insert DB » — **MAIS** cet appel n'existe pas encore dans `campaign-wizard.ts`.
- `getCurrentExpansionPhase` et `setCurrentExpansionPhase` ne sont pas non plus consommés par une UI admin actuelle.

L'API expansion-state existe mais **aucun consommateur réel** côté wizard ou orchestrator. Safety net non actif.

## Verdict / écarts trouvés

**Verdict : ⚠️ STUB-OK**

- Code Phase 9 = présent, typesafe, env-gated correctement, recovery complète.
- Bug lint-staged stash confirmé sur 0718f572 ; rattrapage 790ed7b4 propre.
- Worker GSC HCU = stub volontaire (documenté Sessions 10+ pour intégration OAuth réelle). Pas de risque prod.

**Écarts factuels (non-bloquants, déclarés/cohérents avec commit messages)** :

1. `startGscHcuMonitorWorker()` n'est appelé nulle part — worker ne démarrera pas même avec flag env activé tant que `queue/worker.ts` ne l'enregistre pas.
2. `assertWithinPhaseQuotas()` défini mais zéro caller — le filet de sécurité quota n'est pas branché sur `createCampaignFromWizard`.
3. `getCurrentExpansionPhase` / `setCurrentExpansionPhase` non consommés par admin UI (pas de page admin `/content-gen/expansion`).

Ces 3 points correspondent à la description « V1 squelette, Sessions 10+ » du commit, donc cohérents avec le scope déclaré. **Aucun mensonge dans le commit** : la Phase 9 livre bien le code env-gated promis, pas l'intégration complète.
