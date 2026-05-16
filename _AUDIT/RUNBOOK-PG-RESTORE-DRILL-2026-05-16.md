# Runbook — PG Restore Drill (Sprint Correctif S+1 / P0-S1-6)

> Procédure pour exécuter et documenter un drill de restauration Postgres.
> Action humaine Will + ops uniquement (accès SSH Hetzner CPX42 requis).
> Objectif : mesurer RTO/RPO réels et créer `_AUDIT/PG-RESTORE-DRILL-LOG.md` + `_AUDIT/CRONTAB-PROD-2026-05-XX.txt`.

---

## 0. Pré-requis

- Accès SSH Hetzner CPX42 (`178.105.55.15`)
- Compte Postgres avec rôle suffisant pour CREATE DATABASE
- Connaissance du chemin des dumps (probablement `/var/backups/postgresql/` ou volume Coolify)
- Fenêtre maintenance ~1h (le drill ne touche pas la prod, mais consomme I/O disque)

---

## 1. Étapes (~1h total)

### Étape 1 — Inventaire crontab (5 min)

```bash
ssh root@178.105.55.15
crontab -l > /tmp/crontab-prod-$(date +%Y-%m-%d).txt
cat /tmp/crontab-prod-*.txt
# Copier le contenu vers le repo : _AUDIT/CRONTAB-PROD-2026-05-XX.txt
```

Si le crontab est vide (= les backups passent par Coolify scheduled tasks ou Docker), vérifier :

```bash
docker ps -a | grep -i backup
docker exec <coolify-container> crontab -l
```

Et documenter le mécanisme effectif dans `_AUDIT/CRONTAB-PROD-2026-05-XX.txt`.

### Étape 2 — Localiser le dernier dump PG (5 min)

```bash
# Selon la stack backup, l'un de ces chemins doit exister :
ls -lh /var/backups/postgresql/ 2>/dev/null | tail -5
ls -lh /backups/ 2>/dev/null | tail -5
docker volume inspect coolify_postgres_backup 2>/dev/null
```

Noter le `<chemin-vers-dernier-dump.sql.gz>` et son `mtime`.

**RPO théorique** = (now - dump.mtime). Si dump quotidien, RPO ≈ 12-24h.

### Étape 3 — Exécuter le restore drill (30-45 min)

Dans un DB temporaire isolé :

```bash
# 1. Créer DB temporaire (uniquement sur la même instance PG, pas un autre serveur)
docker exec -it <coolify-postgres-container> psql -U postgres -c "CREATE DATABASE axionia_drill;"

# 2. Démarrer le chrono
DRILL_START=$(date +%s)

# 3. Restore (selon format du dump)
gunzip -c <chemin-vers-dump.sql.gz> | docker exec -i <coolify-postgres-container> psql -U postgres -d axionia_drill

# 4. Arrêter le chrono
DRILL_END=$(date +%s)
RTO_SECONDS=$((DRILL_END - DRILL_START))
echo "RTO mesuré : ${RTO_SECONDS}s ($((RTO_SECONDS / 60)) min)"
```

**Cibles** :

- **RTO** ≤ 15 min (900 s) pour DB ~5-10 GB
- **RPO** ≤ 24 h (dump quotidien)

### Étape 4 — Validation intégrité (5 min)

Vérifier que les tables critiques ont des rows :

```sql
\c axionia_drill
SELECT COUNT(*) FROM submissions;
SELECT COUNT(*) FROM bookings;
SELECT COUNT(*) FROM knowledge_entries;
SELECT MAX(created_at) FROM activity_logs;  -- doit être ≈ dump.mtime
```

Comparer avec les comptes sur la prod :

```sql
-- Dans une autre session sur la DB prod (read-only)
\c axion_ia
SELECT COUNT(*) FROM submissions;
-- etc.
```

Delta entre prod et drill = data perdue depuis le dump. Si delta = 0 sur les tables stables, OK.

### Étape 5 — Cleanup (1 min)

```bash
docker exec -it <coolify-postgres-container> psql -U postgres -c "DROP DATABASE axionia_drill;"
```

### Étape 6 — Documenter dans \_AUDIT/ (10 min)

Créer `_AUDIT/PG-RESTORE-DRILL-LOG.md` avec :

```markdown
# PG Restore Drill Log — 2026-05-XX

## Contexte

- Date : 2026-05-XX HH:MM
- Opérateur : Will + ops
- Stack : Postgres <version> via Coolify sur Hetzner CPX42
- Dump source : <chemin> (mtime 2026-05-XX HH:MM, taille X GB compressé)

## Mesures

| Métrique          | Valeur cible | Valeur mesurée | Statut |
| ----------------- | ------------ | -------------- | ------ |
| RTO               | ≤ 15 min     | <XX min>       | ✅/❌  |
| RPO               | ≤ 24 h       | <XX h>         | ✅/❌  |
| Tables restaurées | toutes       | <N> sur <M>    | ✅/❌  |

## Anomalies

- ...

## Procédure rollback prod (issue de ce drill)

1. ...
2. ...

## Prochain drill

Cible : Q+1 (2026-XX-XX).
```

---

## 2. Cadence recommandée

- **Drill complet** : trimestriel (Q1/Q2/Q3/Q4 2026)
- **Smoke test backup readable** : mensuel (juste `gunzip -t` sur le dernier dump)
- **Monitoring backup success** : Telegram alert Coolify task scheduled si backup fail

---

## 3. Si le RTO/RPO mesuré ne respecte pas les cibles

| Problème                     | Action                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| RTO > 15 min sur DB ~10 GB   | Investiguer compression dump (passer de gzip à zstd), ou pg_basebackup + WAL au lieu de pg_dump |
| RPO > 24 h                   | Réduire cadence dump à 6 h, OU activer WAL streaming continu vers backup remote                 |
| Tables manquantes au restore | Vérifier `pg_dump` flags (`--no-owner --clean --create`) et permissions du compte backup        |

---

## 4. Référence

- Audit `23-monitoring-alerting.md` (P0-1/3) — `_AUDIT/PLATFORM-PERFECTION-2026-05-16/`
- ADR 0022 — `docs/adr/0022-backup-strategy-scripts-only.md`
- Doctrine §15 — RTO/RPO documentés

---

**Fin runbook. Effort estimé : 1h pour le drill + 15 min documentation.**
