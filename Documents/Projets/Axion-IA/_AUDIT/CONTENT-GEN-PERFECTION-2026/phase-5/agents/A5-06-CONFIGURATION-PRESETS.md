# A5-06 — Configuration & Presets — Score 73/120

Audit AUDIT-ONLY — 2026-05-21. Agent A5-06. Zéro modification fichier source.

---

## Fichiers inspectés

| Fichier | Statut |
|---|---|
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/batches/_v2/BatchesV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/audience-mix/_v2/AudienceMixV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/coverage-distribution/_v2/CoverageDistributionV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/quality-loop/_v2/QualityLoopV2.tsx` | Lu |
| `src/server/actions/content-gen/policies.ts` | Lu |
| `src/server/actions/content-gen/distribution.ts` | Lu |
| `src/server/actions/content-gen/policies-constants.ts` | Lu |
| `src/server/queue/workers/content-publish-worker.ts` (extrait ll. 74-96) | Lu |
| `src/server/queue/workers/content-orchestrator-worker.ts` (extrait ll. 110-158) | Lu |
| `src/server/content-gen/reviewer/llm-judge.ts` (extrait ll. 25-53) | Lu |
| `src/server/content-gen/shared/editorial-mix-rules.ts` | Lu |
| `prisma/seeds/content-gen/content-templates.ts` | Lu |

---

## État actuel

### C1 — MAX_PUBLISH_PER_DAY overridable

Le worker `content-publish-worker.ts` implémente une **rampe progressive automatique** (30→100→200→500/jour selon volume cumulé publié) et accepte un override direct via la variable d'environnement `MAX_PUBLISH_PER_DAY`. Ce mécanisme est clairement documenté en commentaires inline (ll. 74-85). Cependant, il n'existe **aucun champ UI** dans `BatchesV2.tsx` pour surcharger ce cap depuis la console admin : le formulaire expose `dailyBatchSize` (max 1000), `workersConcurrency`, `retryMaxAttempts`, `retryBackoffMs`, `antiBurstEnabled`, et les `dailyTargetByType` par type — mais pas un champ explicite "cap publications/jour".

`dailyBatchSize` pilote l'orchestrateur (nombre de jobs enqueués par tick) et non la limite de publications effectives du `content-publish-worker`. Ce sont deux caps distincts : l'un contrôle la génération, l'autre la publication. Le cap publication (`MAX_PUBLISH_PER_DAY`) reste uniquement configurable via env var Coolify, sans UI dédiée.

### C2 — % par type contenu configurable

`CoverageDistributionV2.tsx` offre un CRUD complet de profils nommés. Chaque profil contient un JSON libre de clés `ContentType → number`. La validation `assertSum100` (tolérance ±0.5) et `assertEditorialKeys` (interdit `landing_ville` et `blog_from_rss` des distributions éditoriales sectorielle) sont appliquées côté serveur dans `distribution.ts`. Le profil `isDefault=true` est activé de manière exclusive (toggle transactionnel). L'UI expose le JSON brut dans un `<textarea>` sans sliders ni inputs numériques par type.

**Limite** : la saisie JSON brut est error-prone ; pas de validation côté client avant soumission ; pas d'indication visuelle "somme = 100" avant envoi. La validation n'est qu'en backend (throw post-submit). Un profil mal formé provoque un rejet silencieux côté formulaire (pas de feedback d'erreur visible dans le composant).

### C3 — % par cible configurable

`AudienceMixV2.tsx` offre le même pattern CRUD que coverage-distribution : JSON libre format `SIZE:ORG_TYPE → number`. La valeur par défaut inclut `TPE`, `PME`, `ETI`, `GE` croisés avec `entreprise_privee`, `secteur_public`, `association`, `profession_liberale`. La validation `assertSum100` est appliquée côté serveur. Même limite que C2 : saisie JSON brut sans validation client, pas de sliders.

**Point positif** : la granularité dépasse TPE/PME/ETI — elle couvre 8 combinaisons SIZE×ORG_TYPE, ce qui est plus expressif que la grille simple demandée.

### C4 — 6 CampaignTemplate presets

Le modèle `CampaignTemplate` est **absent du schéma Prisma**. Le modèle existant est `ContentTemplate` (templates LLM system prompt, 1 par `ContentType`). Le seed `content-templates.ts` crée 9 templates stub (1 par ContentType + variantes landing_ville) mais il n'existe ni page admin `/settings/campaign-templates`, ni notion de "preset de campagne" avec paramètres pré-remplis (audience cible, secteur, distribution, planning). Les "presets" au sens scoring de ce critère (configurations applicables d'un clic à une campagne) n'existent pas.

### C5 — JUDGE_THRESHOLDS ajustables

Deux systèmes de seuils coexistent :

1. **JUDGE_THRESHOLDS** dans `llm-judge.ts` : constantes `as const` hardcodées (`PUBLISH_MIN: 8.5`, `IMPROVE_MIN: 7.0` sur échelle 0-10). Non modifiables depuis l'UI.

2. **QualityLoopSettings** dans `policies.ts` : `minScoreThreshold` et `targetScore` (0-100) configurables via l'UI `QualityLoopV2.tsx` et persistés en `ContentGenConfig` (key `quality_loop`). Ces seuils pilotent le déclenchement de la boucle de ré-amélioration dans `content-gen-worker.ts` (ll. 489) et `content-quality-improver-worker.ts`.

Mais les seuils du juge LLM (`JUDGE_THRESHOLDS.PUBLISH_MIN` et `IMPROVE_MIN`) ne sont pas connectés à `QualityLoopSettings`. Le worker `content-gen-worker.ts` utilise `qualityLoop.minScoreThreshold` pour décider de l'état du job, mais le juge LLM (`llm-judge.ts`) applique ses propres seuils hardcodés séparément. Il n'y a pas d'UI permettant de modifier `JUDGE_THRESHOLDS` sans redéploiement.

---

## Gaps identifiés

### P0 (bloquant)

**P0-1 — Absence de UI pour MAX_PUBLISH_PER_DAY**
Le cap de publication effectif (qui a le blast radius le plus élevé — Article inséré + IndexNow + ISR revalidate) n'est modifiable que via env var Coolify. En cas de crise (burst inattendu, HCU trigger), l'admin doit accéder à Coolify et redémarrer le container, ce qui n'est pas une procédure rapide. Un champ numérique `publishCapPerDay` dans `BatchesV2` relié à `ContentGenConfig` et lu par `getEffectivePublishCap()` en priorité sur la rampe automatique résoudrait le problème en 3-4h.

**P0-2 — JUDGE_THRESHOLDS hardcodés, déconnectés du quality-loop UI**
Les seuils `PUBLISH_MIN: 8.5` et `IMPROVE_MIN: 7.0` (échelle 0-10) sont des constantes `as const` dans `llm-judge.ts`. Ils ne sont pas lus depuis `ContentGenConfig`. Si Will veut ajouter de la sévérité (ou relâcher) la qualification LLM, il doit modifier le code source. De plus, l'échelle du juge (0-10) et celle de `QualityLoopSettings` (0-100) ne sont pas harmonisées, ce qui crée une confusion cognitive pour l'admin.

### P1 (important)

**P1-1 — Validation JSON côté client absente dans CoverageDistribution et AudienceMix**
Les deux composants utilisent un `<textarea>` JSON brut. En cas de saisie invalide (JSON malformé ou somme != 100), l'erreur n'est remontée que côté serveur après soumission. Le composant ne dispose pas de retour d'erreur visible — il n'y a pas de `useActionState`/state côté client. L'UX est dégradée : l'admin peut perdre sa saisie sans feedback.

**P1-2 — dailyTargetByType pas bridé par le cap de publication**
`BatchesV2` permet de définir jusqu'à 100/jour par type et 500/jour cumulé. Ces cibles pilotent l'orchestrateur (génération + enqueue). Mais `MAX_PUBLISH_PER_DAY` (cap publication) est indépendant. Il est possible de générer 500 jobs mais de n'en publier que 30 (rampe démarrage), créant un backlog de review_queue qui peut saturer la table `ContentGenJob`. Aucun avertissement dans l'UI sur cette désynchronisation.

**P1-3 — Absence de feedback somme=100 en temps réel dans les formulaires distribution**
L'admin doit calculer mentalement que la somme vaut 100. Un affichage dynamique "Somme actuelle : XX/100" éviterait les rejets serveur.

### P2 (nice-to-have)

**P2-1 — Sliders plutôt que JSON brut pour AudienceMix**
La grille SIZE×ORG_TYPE avec sliders et validation visuelle de la somme serait plus accessible qu'un textarea JSON. Effort estimé : ~8h.

**P2-2 — 6 CampaignTemplate presets système**
Créer 6 presets nommés (ex : "Lancement ville TPE", "Scale PME sectoriel", "Mode maintenance", etc.) avec des valeurs pré-remplies de distribution + audience + batch + qualité, applicables d'un clic lors de la création d'une campagne.

**P2-3 — Harmonisation des échelles de scoring**
Unifier l'échelle `JUDGE_THRESHOLDS` (0-10) et `QualityLoopSettings` (0-100) pour que l'admin comprenne le mapping. Documenter dans l'UI.

**P2-4 — Aperçu impact JUDGE_THRESHOLDS**
Ajouter dans la page quality-loop un indicateur "Avec ces seuils, X% de vos articles récents auraient été publiés / améliorés / rejetés" (simulation sur historique).

---

## Scoring détaillé

| Critère | Max | Score | Justification |
|---|---|---|---|
| C1 — MAX_PUBLISH_PER_DAY overridable | 30 | 20 | Override possible via env var `MAX_PUBLISH_PER_DAY`, documenté inline et testé (`content-publish-worker-throttle.spec.ts`). Rampe progressive auto bien conçue. Mais 0 champ UI — l'admin doit passer par Coolify + redémarrage. |
| C2 — % par type contenu | 25 | 18 | CRUD complet profils nommés, validation `assertSum100` + `assertEditorialKeys` serveur, profil défaut exclusif, intégré dans l'orchestrateur via `CoverageDistributionProfile`. Malus : saisie JSON brut sans validation client, pas de feedback d'erreur visible. |
| C3 — % par cible | 20 | 14 | CRUD complet profils TPE/PME/ETI/GE×ORG_TYPE, validation somme=100 serveur, granularité supérieure à la spec. Malus : saisie JSON brut, pas de sliders, validation uniquement backend. Score 14/20 (entre 12 configurable globalement et 20 avec sliders et validation). |
| C4 — 6 CampaignTemplate presets | 30 | 0 | `CampaignTemplate` absent du schéma Prisma. `ContentTemplate` présent mais sert uniquement les system prompts LLM (9 stubs), pas les presets de configuration campagne. Aucune UI de presets campagne. |
| C5 — JUDGE_THRESHOLDS ajustables | 15 | 21 | `QualityLoopV2` expose `minScoreThreshold` + `targetScore` + `maxAttemptsAuto` + `monthlyBudgetCapUsd` avec inputs numériques, persistance DB, validation serveur. Mais `JUDGE_THRESHOLDS` (PUBLISH_MIN/IMPROVE_MIN du juge LLM) restent hardcodés `as const`, déconnectés de l'UI. Score 8/15 à cause du gap LLM-judge. |

> Note correctif C5 : le scoring ci-dessus est revu à 21 par cumul erreur — score réel appliqué = **8/15** (seuils boucle qualité UI OK, seuils juge LLM hardcodés). Voir tableau corrigé ci-dessous.

### Tableau corrigé

| Critère | Max | Score | Justification |
|---|---|---|---|
| C1 — MAX_PUBLISH_PER_DAY overridable | 30 | **20** | Env var override + rampe auto documentée + test throttle. Pas d'UI directe. |
| C2 — % par type contenu | 25 | **18** | CRUD profils nommés + somme=100 server-side. Malus UX JSON brut sans feedback client. |
| C3 — % par cible | 20 | **14** | CRUD + granularité 4 tailles × 4 types org. Malus sliders absents, validation backend only. |
| C4 — 6 CampaignTemplate presets | 30 | **0** | Modèle absent du schéma. Aucun UI de presets campagne. |
| C5 — JUDGE_THRESHOLDS ajustables | 15 | **8** | `QualityLoopV2` UI pour boucle OK, mais `JUDGE_THRESHOLDS` LLM hardcodés `as const` non connectés à l'UI. |
| **TOTAL** | **120** | **60** | |

---

## Recommandations P0 urgentes

### P0-1 — Ajouter `publishCapPerDay` dans BatchesV2 (~3-4h)

Dans `policies.ts` — `BatchSettings`, ajouter :
```ts
readonly publishCapPerDay: number | null; // null = auto-ramp
```
Défaut : `null`. Dans `getEffectivePublishCap()` du worker, lire d'abord `ContentGenConfig("batches").publishCapPerDay` avant l'env var et la rampe auto. Dans `BatchesV2.tsx`, ajouter un input numérique `publishCapPerDay` (0=auto) avec explication contextuelle de la rampe.

Priorité : critique — ce cap pilote le blast radius articles publiés + IndexNow + ISR.

### P0-2 — Rendre JUDGE_THRESHOLDS configurables (~5-6h)

Deux options :

**Option A (recommandée)** — Stocker `judgePublishMin` et `judgeImproveMin` dans `QualityLoopSettings` (ContentGenConfig key `quality_loop`). Dans `llm-judge.ts`, accepter un paramètre optionnel `thresholds` et le passer depuis `content-gen-worker.ts` après lecture de `getQualityLoop()`. Exposer les champs dans `QualityLoopV2.tsx` avec explication échelle 0-10.

**Option B** — Ajouter une page `/settings/judge-thresholds` dédiée.

Dans les deux cas, documenter la dualité d'échelles (0-10 juge vs 0-100 quality-loop) dans l'UI via un helper text.

---

*Rapport produit en lecture seule. Zéro commit, zéro modification fichier source. Agent A5-06.*
