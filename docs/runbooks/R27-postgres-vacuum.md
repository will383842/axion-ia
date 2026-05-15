# R27 — Vacuum analyze Postgres (mensuel)

- **Code** : R27
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟢 **P2 — routine**
- **Impact si non traité** : dead tuples s'accumulent → tables bloat → queries lentes (LCP impact via admin/booking lourds). PG autovacuum couvre 90 % mais analyze manuel sur grosses tables reste utile.

## Trigger

- Mensuel (1er du mois après cost reset R21, off-hours dimanche 04:00 UTC).
- Slow query alerts (`pg_stat_activity` queries > 5s).
- Métriques disk usage spike sans correlation contenu.

## Prérequis

- Accès DB shell.
- Connaissance des tables volumineuses (Article, GenerationLog, KnowledgeEmbedding, ActivityLog).

## Étapes

### 1. Identifier tables avec dead tuples élevés

```sql
SELECT relname, n_live_tup, n_dead_tup,
       ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
       pg_size_pretty(pg_relation_size(relid)) AS size
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC
LIMIT 20;
```

### 2. VACUUM ANALYZE sur top tables

```sql
-- Off-hours, peut bloquer écritures brièvement
VACUUM ANALYZE "Article";
VACUUM ANALYZE "GenerationLog";
VACUUM ANALYZE "KnowledgeEntry";
VACUUM ANALYZE "KnowledgeEmbedding";
VACUUM ANALYZE "ContentGenJob";
VACUUM ANALYZE "ActivityLog";
```

Ou full DB :

```bash
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "VACUUM ANALYZE;"
```

### 3. REINDEX si index bloat élevé

```sql
SELECT schemaname, tablename, indexname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE pg_relation_size(indexrelid) > 100 * 1024 * 1024  -- > 100 MB
ORDER BY pg_relation_size(indexrelid) DESC;

-- REINDEX (CONCURRENTLY pour pas bloquer écritures, PG 12+)
REINDEX INDEX CONCURRENTLY "Article_slug_idx";
```

### 4. Mesurer post-vacuum

```sql
SELECT relname, n_dead_tup, pg_size_pretty(pg_relation_size(relid)) AS size
FROM pg_stat_user_tables
WHERE relname IN ('Article', 'GenerationLog', 'KnowledgeEntry')
ORDER BY n_dead_tup DESC;
-- Dead tuples doivent avoir diminué de > 80 %
```

### 5. Vérifier autovacuum config

```sql
SELECT name, setting FROM pg_settings WHERE name LIKE 'autovacuum%';
-- autovacuum = on (default)
-- autovacuum_vacuum_threshold = 50
-- autovacuum_analyze_threshold = 50
```

Si autovacuum désactivé pour une raison → revoir avec Will (ADR).

## Vérifications post-fix

- [ ] Tables top dead tuples : dead_pct < 10 % après vacuum.
- [ ] DB size stable ou réduite vs avant.
- [ ] Slow queries baisse dans la semaine suivante (`pg_stat_statements` si activé).

## Rollback

Non applicable. VACUUM est non-destructif (juste réclame espace).

## Escalation

| Niveau | Contact | Quand                                                |
| ------ | ------- | ---------------------------------------------------- |
| L1     | Will    | si dead_pct > 50 % récurrent → ADR autovacuum tuning |

## Liens

- Legacy `docs/ops/runbook-incident.md` §11 (disque plein — déclencheur indirect)
- Postgres docs : https://www.postgresql.org/docs/current/sql-vacuum.html
- ADR 0009 — hosting Hetzner (resources DB)
