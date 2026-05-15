# R02 — Cost cap provider IA atteint

- **Code** : R02
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique** (100 %) · 🟡 **P1** (80 % warning)
- **Impact si non traité** : kill switch auto déjà déclenché (100 %) → toutes générations stoppées jusqu'au prochain mois OU action humaine.

## Trigger

- Telegram `[⚠️ COÛT 80 %] OpenAI mois : $160/$200. 12 jobs queued.` (par provider, vérif horaire).
- Telegram `[🔴 COÛT 100 %] OpenAI mois : $200/$200. Kill switch auto activé.` (critical).
- Dashboard `/fr/{ADMIN_URL_PREFIX}/content-gen/costs` montre barre rouge sur un provider.

## Prérequis

- Accès admin `/fr/{ADMIN_URL_PREFIX}/content-gen/settings/providers`.
- Accès dashboard providers (OpenAI / Anthropic / Perplexity) pour usage temps réel.
- Compréhension du `ProviderConfig.monthlyCapUsd` (table Prisma).

## Étapes

### Cas A — 80 % atteint (warning, info-only V1)

Pas d'action obligatoire. Mais bon réflexe :

1. Consulter dashboard provider externe (OpenAI usage / Anthropic console / Perplexity).
2. Estimer si le cap mensuel sera dépassé avant fin de mois :
   ```sql
   SELECT
     "providerSlug",
     SUM("amountUsd") AS spent,
     EXTRACT(DAY FROM NOW()) AS day_of_month,
     (SUM("amountUsd") / EXTRACT(DAY FROM NOW())) * 30 AS projected_month
   FROM "CostLedger"
   WHERE "createdAt" >= DATE_TRUNC('month', NOW())
   GROUP BY "providerSlug";
   ```
3. Si projection > cap → planifier action préventive (cas B avant 100 %).

### Cas B — 100 % atteint (kill switch auto engagé)

#### B.1 Vérifier état kill switch

```sql
SELECT "valueJson" FROM "ContentGenConfig" WHERE key = 'kill_switch';
-- Attendu : { "engaged": true, "reason": "cost-cap-100:<provider>:<YYYY-MM>" }
```

Si `engaged: false` malgré alerte → bug, voir R01.

#### B.2 Décider entre 4 options

| Option                            | Quand                                   | Effet                                                        |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| **Augmenter cap**                 | Will OK pour payer plus ce mois         | Update `ProviderConfig.monthlyCapUsd`, désengage kill switch |
| **Attendre reset 1er**            | Coût élevé non urgent                   | Kill switch reste, queue accumule                            |
| **Switch provider**               | Provider concurrent dispo + cap restant | Désactiver provider saturé, activer fallback                 |
| **Désactiver génération du mois** | Stratégie ou coût exceptionnel          | Garder kill switch + drainer queue                           |

#### B.3 Option 1 — Augmenter cap

```
/fr/{ADMIN_URL_PREFIX}/content-gen/settings/providers
→ ligne OpenAI (ou autre) → champ "Cap mensuel (USD)"
→ saisir nouveau montant (ex 300)
→ "Sauvegarder"
```

Server Action : `updateProviderConfigAction`. Effet :

```sql
UPDATE "ProviderConfig"
SET "monthlyCapUsd" = 300, "updatedAt" = NOW()
WHERE slug = 'openai';
```

Puis relâcher kill switch via R01 §Rollback.

#### B.4 Option 3 — Switch provider fallback

```
/fr/{ADMIN_URL_PREFIX}/content-gen/settings/providers
→ ligne OpenAI → toggle "Enabled" → OFF
→ ligne Anthropic → toggle "Enabled" → ON (si pas déjà)
→ vérifier `ProviderConfig.priority` : Anthropic doit être > OpenAI pour fallback router
```

Vérifier dans le router (`src/server/content-gen/providers/router.ts`) :

```bash
docker exec axion-ia-app-prod node -e "
  const { selectProvider } = require('./dist/server/content-gen/providers/router');
  selectProvider('text').then(p => console.log('selected:', p.slug));
"
```

#### B.5 Option 2 — Attendre reset 1er du mois

Cron `cost-reset` mensuel s'exécute 1er à 00:01 UTC (cf. master prompt § 13.2). Vérifier exécution :

```sql
SELECT * FROM "GenerationLog"
WHERE "step" = 'cost_reset_monthly'
ORDER BY "createdAt" DESC LIMIT 5;
```

Si cron pas exécuté à J+1 → run manuel :

```bash
docker exec axion-ia-worker-prod node ./dist/scripts/cost-gen/reset-monthly.js
```

Puis relâcher kill switch (R01 §Rollback).

## Vérifications post-fix

- [ ] Dashboard `/content-gen/costs` montre nouveau `monthlyCapUsd` ou 0 spent (post-reset).
- [ ] `ContentGenConfig.kill_switch.engaged === false`.
- [ ] Worker logs : 1 nouveau job processé OK dans les 5 min :
  ```bash
  docker logs --since 5m axion-ia-worker-prod | grep "content-gen-worker.*completed"
  ```
- [ ] Pas de re-trigger alerte cost cap 100 % dans la même journée (si rate-limit horaire respecté).

## Rollback

- Si augmentation cap regrettée : remettre ancienne valeur (admin UI).
- Si switch provider regretté : ré-enable OpenAI + disable fallback.
- Aucun rollback "automatique" — toutes actions sont reversibles via admin.

## Escalation

| Niveau | Contact          | Quand                                                            |
| ------ | ---------------- | ---------------------------------------------------------------- |
| L1     | Will             | toujours (décision augmenter cap = sa responsabilité financière) |
| L2     | Provider support | si cap externe (OpenAI organization limit) bloque augmentation   |

## Liens

- Master prompt § 12.3bis alertes Telegram cost cap
- Code : `src/server/content-gen/lib/cost-tracker.ts` (auto-trigger kill-switch)
- Code : `src/server/actions/content-gen/providers.ts` (Server Action update cap)
- Mémoire `axionia_coolify_api_authorization` — Coolify API si admin UI down
- ADR 0021 — décision provider routing V1
