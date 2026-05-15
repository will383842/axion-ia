# R26 — Cleanup retention tier-3 (90j+)

- **Code** : R26
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟢 **P2 — routine** (cron automatique)
- **Impact si non traité** : tier-3 stagnants polluent KB pool + DB grossit → backup plus lourd. Doctrine HCU anti-doorway exige nettoyage régulier.

## Trigger

- Cron quotidien 03:00 UTC (`content-retention-worker` master § 13.2).
- Vérification SOP hebdo (cf. `review-sop.md`).
- Alerte Telegram `[ℹ️ INFO] Tier-3 stagnant 90j` (master § 13.3).

## Prérequis

- Accès DB.
- Accès admin `/fr/{ADMIN_URL_PREFIX}/content-gen/settings/policies` pour seuil `tier3_retention_days`.

## Étapes (vérification cron / run manuel)

### 1. Vérifier cron exécuté quotidien

```sql
SELECT step, "outputSnippet", "createdAt"
FROM "GenerationLog"
WHERE step = 'retention_purge_tier3'
ORDER BY "createdAt" DESC LIMIT 7;
-- Attendu : 7 entrées quotidiennes
```

### 2. Identifier candidats purge manuel

Seuil défaut : 90 jours (configurable `content_gen_tier3_retention_days`).

```sql
SELECT id, slug, "indexationTier", "createdAt", "updatedAt"
FROM "Article"
WHERE "indexationTier" IN ('tier_3_noindex_nofollow', 'archived')
  AND "createdAt" < NOW() - INTERVAL '90 days'
  AND "publishedAt" IS NULL
ORDER BY "createdAt"
LIMIT 100;
```

### 3. Soft-delete (archive) plutôt que DELETE

```sql
UPDATE "Article"
SET "indexationTier" = 'archived',
    body = '[ARCHIVED-R26-' || TO_CHAR(NOW(), 'YYYY-MM-DD') || ']',
    "updatedAt" = NOW()
WHERE id = ANY(...);
```

⚠️ **JAMAIS DELETE** sur Article pour audit trail (RGPD). Keep row mais purge body.

### 4. Run worker manuel si cron skip

```bash
docker exec axion-ia-worker-prod node -e "
  const { Queue } = require('bullmq');
  const q = new Queue('content-retention', { connection: { url: process.env.REDIS_URL } });
  q.add('manual-purge-r26', { dryRun: false });
"
```

### 5. Métriques après purge

```sql
SELECT
  "indexationTier",
  COUNT(*) AS count,
  ROUND(AVG(LENGTH(body))) AS avg_body_size
FROM "Article"
GROUP BY "indexationTier"
ORDER BY count DESC;
```

## Vérifications post-fix

- [ ] `GenerationLog.step = 'retention_purge_tier3'` quotidien présent.
- [ ] Aucun Article tier-3 > 95j (5j de buffer).
- [ ] DB size n'explose pas mois sur mois.

## Rollback

- Body purgé `[ARCHIVED-R26-...]` → pas de rollback.
- Si purge erronée → restore PG backup (R22) sur jour `< createdAt - 1`.

## Escalation

| Niveau | Contact | Quand                              |
| ------ | ------- | ---------------------------------- |
| L1     | Will    | si cron skip > 7 jours consécutifs |

## Liens

- Master prompt § 13.2 (cron retention)
- Code : `src/server/queue/workers/content-retention-worker.ts` (ou config Setting V1)
- Doctrine anti-doorway HCU 2024 (Google Helpful Content Update)
