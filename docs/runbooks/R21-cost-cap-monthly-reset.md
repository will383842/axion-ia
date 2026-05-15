# R21 — Reset cost cap mensuel

- **Code** : R21
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟢 **P2 — routine**
- **Impact si non traité** : kill switch reste engagé jusqu'à action manuelle si cron foire.

## Trigger

- 1er du mois 00:01 UTC (cron `cost-reset` master § 13.2).
- Vérification manuelle hebdomadaire (cf. SOP `review-sop.md`).

## Prérequis

- Accès DB `axion-ia-postgres-prod`.
- Accès admin `/fr/{ADMIN_URL_PREFIX}/content-gen/costs`.

## Étapes (1er du mois, vérification)

### 1. Vérifier cron exécuté

```sql
SELECT step, "outputSnippet", "createdAt"
FROM "GenerationLog"
WHERE step = 'cost_reset_monthly'
  AND "createdAt" >= DATE_TRUNC('month', NOW())
ORDER BY "createdAt" DESC
LIMIT 5;
```

Attendu : 1 entrée avec date `<mois en cours>-01 00:01:XX`.

### 2. Si cron pas exécuté → run manuel

```bash
docker exec axion-ia-worker-prod node ./dist/scripts/content-gen/reset-monthly.js
# OU si script absent (V1 skeleton)
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "
  DELETE FROM \"CostLedger\"
  WHERE \"createdAt\" < DATE_TRUNC('month', NOW())
    AND \"isAggregated\" = false;
  -- OR aggregate then delete pour conserver historique
"
```

### 3. Vérifier compteurs ProviderConfig

```sql
SELECT slug, "monthlyCapUsd",
  (SELECT COALESCE(SUM("amountUsd"), 0)
   FROM "CostLedger"
   WHERE "providerSlug" = pc.slug
     AND "createdAt" >= DATE_TRUNC('month', NOW())
  ) AS spent_this_month
FROM "ProviderConfig" pc
WHERE enabled = true;
-- spent_this_month attendu : faible (< $5) en début de mois
```

### 4. Si kill switch resté ON par cost cap → release

Voir R02 §B.3 + R01 §Rollback.

```sql
UPDATE "ContentGenConfig"
SET "valueJson" = jsonb_set("valueJson", '{engaged}', 'false')
WHERE key = 'kill_switch'
  AND "valueJson"->>'reason' LIKE 'cost-cap-%';
```

### 5. Notifier Telegram (sanity check)

Optionnel — bot envoie auto `[BACKUP]` ou `[COST RESET]` event.

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🟢 [COST RESET] $(date +%Y-%m) mois en cours, cost ledger purgé"
```

## Vérifications post-fix

- [ ] `GenerationLog` contient entrée `cost_reset_monthly` du mois.
- [ ] `CostLedger` requête mois en cours retourne < $5 sur tous providers.
- [ ] `ContentGenConfig.kill_switch.engaged === false` si déjà release.
- [ ] Dashboard `/content-gen/costs` graphe vide ou faible début mois.

## Rollback

Non applicable (purge est définitive). Si purge erronée → restore PG backup pré-purge (R22).

## Escalation

| Niveau | Contact | Quand                                   |
| ------ | ------- | --------------------------------------- |
| L1     | Will    | si cron mensuel rate 2 mois consécutifs |

## Liens

- Master prompt § 13.2 (cron `cost-reset` monthly)
- R02 — cost cap atteint (souvent post-reset)
- Code : `src/server/queue/workers/` (cron registration)
