# R31 — Quota provider épuisé : auto-arrêt et reprise du retard

- **Code** : R31
- **Version** : 1.0
- **Date dernière maj** : 2026-08-15
- **Sévérité** : 🟠 **P1 — production arrêtée, aucune perte de données**
- **Impact si non traité** : la production de contenu reste à l'arrêt ; le retard accumulé ne se résorbe pas.

## Contexte — pourquoi ce runbook existe

Entre le 9 et le 24 juillet 2026, le compte OpenAI s'est retrouvé sans crédit à
trois reprises. À chaque fois, **rien n'a arrêté la production** :

- le disjoncteur (`provider-router.ts`) ne fait qu'échouer vite, il ne prévient
  personne et l'orchestrateur ré-enfile au tick suivant ;
- le plafond de dépense interne n'est jamais approché, puisqu'un appel refusé
  pour quota **ne coûte rien** ;
- seul le kill switch **manuel** pouvait stopper l'hémorragie.

Bilan : **1 532 jobs en échec** et 56 jobs figés en boucle qualité, pour une
cause purement administrative. Deux mécanismes ont été ajoutés le 2026-08-15
pour que cela ne se reproduise pas.

## Mécanisme 1 — auto-arrêt (`quota-guard.ts`)

Après **3 échecs permanents consécutifs** (`quota_exhausted` ou `auth_failed`)
d'un provider critique (aujourd'hui : OpenAI, seul provider du rôle texte), le
kill switch global est activé **automatiquement** :

- clé `kill_switch` → `{ active: true, auto: true, reason: "Auto-arrêt : quota … épuisé" }` ;
- alerte Telegram `[🛑 GÉNÉRATION ARRÊTÉE]` ;
- le premier appel réussi remet le compteur à zéro.

`auto: true` distingue cet arrêt d'une décision humaine. **Un kill switch posé à
la main n'est jamais écrasé** : son motif est une information que personne
d'autre ne détient.

À 96 ticks/jour, la coupure intervient en moins de 15 minutes — au lieu de
plusieurs jours.

## Mécanisme 2 — reprise du retard (`recovery/backlog-recovery.ts`)

Un slot de campagne est consommé **à vie** : `generatedCount` s'incrémente à
l'enfilement et ne redescend jamais, et l'orchestrateur ne repasse jamais sur un
slot servi. **Sans reprise explicite, un contenu en échec n'est donc jamais
régénéré, même après rechargement du crédit.**

À chaque tick de l'orchestrateur (toutes les 15 min), trois balayages :

| Balayage | Cible | Effet |
| --- | --- | --- |
| `drainFailedJobs` | échecs de cause **externe et passagère** | remise en file, rythmée |
| `sweepStuckJobs` | jobs `queued`/`running` figés > 60 min | remise en file |
| `sweepStrandedQualityJobs` | jobs `quality_improving` figés > 60 min | réinjection dans la boucle qualité |

Points importants :

- **aucun job n'est créé** : les lignes existantes sont réutilisées (même `id`,
  même `slotIndex`, même `idempotencyKey`). Rien n'est perdu, rien n'est
  redécompté ;
- les échecs **de génération** (plan invalide, aucun output valide, gate qualité)
  ne sont **pas** relancés : ils se reproduiraient à l'identique en dépensant du
  crédit. Voir `recovery/failure-classifier.ts` ;
- un job encore en vol n'est jamais doublé (`resolveReenqueueAction`) ;
- les jobs en boucle qualité sont réinjectés **sans être régénérés** : ils
  portent déjà un contenu payé.

### Réglages — clé `ContentGenConfig.backlog_recovery`

```json
{
  "enabled": true,
  "maxPerTick": 5,
  "maxPerDay": 40,
  "maxRetries": 3,
  "stuckAfterMinutes": 60
}
```

`maxPerDay: 40` est délibérément modeste : le retard se résorbe sans jamais
dominer la production neuve ni provoquer un pic de dépense. Avec ~1 340 échecs
relançables, la résorption prend environ cinq semaines.

## Procédure de reprise après une panne de crédit

### 1. Confirmer que le crédit est bien rechargé

```bash
ssh axion-prod
docker exec <conteneur-worker> node -e 'fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"user",content:"ping"}],max_tokens:1})}).then(r=>r.text().then(t=>console.log(r.status,t.slice(0,200))))'
```

`200` = crédit actif. `429 insufficient_quota` / `credit_balance_exhausted` =
**ne pas lever le kill switch**, la production repartirait pour rien.

### 2. Lever le kill switch

`/fr/{ADMIN_URL_PREFIX}/content-gen/settings/kill-switch` → « Release ».

Si le motif indique un arrêt automatique (`auto: true`), le lever manuellement
est la bonne marche à suivre : la reprise n'est jamais automatique, pour éviter
tout redémarrage surprise.

### 3. Laisser la reprise faire son travail

Au tick suivant (≤ 15 min), l'orchestrateur reprend la production neuve **et**
commence à drainer le retard. Rien d'autre à faire.

### 4. Surveiller les premières heures

```sql
-- Le retard doit décroître, les publications repartir.
SELECT status, count(*) FROM content_gen_jobs GROUP BY status ORDER BY 2 DESC;

-- Les relances du jour (retryCount incrémenté par la reprise).
SELECT count(*) FROM content_gen_jobs
WHERE "retryCount" > 0 AND "updatedAt" >= current_date;
```

Dans les logs du worker : `[orchestrator] reprise du retard — N échec(s)
relancé(s), …`.

## Ce qu'il ne faut PAS faire

- ❌ **Ne jamais utiliser « Supprimer les échecs »** comme nettoyage : la
  suppression est définitive et le slot étant consommé à vie, le contenu ne sera
  **jamais** régénéré.
- ❌ **Ne pas lancer un « Relancer tous les échecs » en une fois** : 1 500
  relances simultanées videraient le crédit fraîchement rechargé en quelques
  minutes. La reprise rythmée existe précisément pour éviter ça.
- ❌ **Ne pas remettre le statut à `queued` en SQL direct** : sans enfilement
  BullMQ correspondant, le job devient un zombie. Passer par l'interface admin ou
  laisser la reprise agir.

## Liens

- `src/server/content-gen/providers/quota-guard.ts` — auto-arrêt
- `src/server/content-gen/recovery/backlog-recovery.ts` — reprise du retard
- `src/server/content-gen/recovery/failure-classifier.ts` — ce qui est relançable
- Runbook R01 (kill switch), R02 (plafond de dépense), R11 (disjoncteur provider)
- Audit à l'origine : `_AUDIT/CONTENT-GEN-E2E-2026-08-15/`
