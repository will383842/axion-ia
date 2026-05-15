# R22 — Backup Postgres restore drill (trimestriel)

- **Code** : R22
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟢 **P2 — routine** (drill préventif) · 🔴 **P0** si vrai incident
- **Impact si non traité** : RTO/RPO inconnus → en cas de vraie corruption, downtime imprévisible. Doctrine §15 doc 09 exige test mensuel/trimestriel.

## Trigger

- **Drill préventif** : tous les 3 mois (1er du trimestre, fenêtre off-hours dimanche 03:00 UTC).
- **Incident réel** : R03 / R06 déclenche → bascule sur ce runbook §4.
- Sentry alerte "data inconsistency" + Will valide restore.

## Cible mesurée

- **RTO** (Recovery Time Objective) : ≤ 30 min cible V1 / ≤ 15 min cible V2.
- **RPO** (Recovery Point Objective) : ≤ 24h (backup quotidien) cible V1 / ≤ 1h V2 (WAL streaming).

## Prérequis

- SSH `root@178.105.55.15` + Hetzner Storage Box credentials (`.secrets/api-tokens.env`).
- Script `axionia/scripts/backup-postgres.sh` (mémoire `runbook-deploy.md` §9).
- Window ops 30 min minimum.

## Étapes drill préventif (quarterly)

### 1. Annoncer maintenance (1h avant)

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🟡 [MAINTENANCE] Drill restore PG planifié dans 1h ($(date +%H:%M))"
```

### 2. Snapshot Hetzner pré-drill (rollback safety net)

Voir `coolify-procedures.md` §7. Snapshot complet VM avant manipulation DB.

### 3. Créer DB de test isolée

```bash
ssh root@178.105.55.15
docker exec axion-ia-postgres-prod psql -U axion_ia -c "CREATE DATABASE axion_ia_drill_$(date +%Y%m);"
```

### 4. Lister backups disponibles

```bash
ssh "${HETZNER_STORAGE_USER}@${HETZNER_STORAGE_HOST}" "ls -lh /backups/postgres/daily/ | tail -10"
```

Choisir backup `< 24h` :

```
axion-ia-pg-daily-2026-05-14-cpx42.sql.gz.enc
```

### 5. Mesurer début restore

```bash
START_TS=$(date +%s)
echo "Drill start: $(date)"
```

### 6. Restore vers DB drill

```bash
bash /var/www/axion-ia/axionia/scripts/backup-postgres.sh \
  --restore axion-ia-pg-daily-2026-05-14-cpx42.sql.gz.enc \
  --target-db axion_ia_drill_$(date +%Y%m)
```

### 7. Re-apply FTS migrations (raw SQL hors Prisma)

```bash
docker exec -T axion-ia-postgres-prod psql -U axion_ia -d axion_ia_drill_$(date +%Y%m) \
  < /var/www/axion-ia/axionia/prisma/migrations_fts/0002_fts_setup.sql
```

### 8. Mesurer fin restore + RTO

```bash
END_TS=$(date +%s)
RTO_MIN=$(( (END_TS - START_TS) / 60 ))
echo "Drill end: $(date) - RTO measured: ${RTO_MIN} min"
```

Critère succès :

- RTO ≤ 30 min ✅
- 30 < RTO ≤ 60 min ⚠️ (action prévue : optimiser script)
- RTO > 60 min ❌ (ADR scaling backup strategy)

### 9. Vérifier intégrité DB drill

```bash
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_drill_$(date +%Y%m) -c "
  SELECT
    (SELECT COUNT(*) FROM \"Article\") AS articles,
    (SELECT COUNT(*) FROM \"KnowledgeEntry\") AS kb_entries,
    (SELECT COUNT(*) FROM \"Booking\") AS bookings,
    (SELECT MAX(\"createdAt\") FROM \"Article\") AS last_article;
"
```

Comparer avec DB prod live :

```bash
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "
  SELECT COUNT(*) FROM \"Article\";
"
```

Différence attendue : < 1 jour de data (RPO).

### 10. Cleanup DB drill

```bash
docker exec axion-ia-postgres-prod psql -U axion_ia -c "DROP DATABASE axion_ia_drill_$(date +%Y%m);"
```

### 11. Documenter résultats

Ajouter ligne dans `_AUDIT/PG-RESTORE-DRILL-LOG.md` :

```markdown
| Date       | RTO    | RPO measured | Backup used      | Result | Notes |
| ---------- | ------ | ------------ | ---------------- | ------ | ----- |
| 2026-05-15 | 18 min | 6h           | daily-2026-05-14 | ✅     | OK    |
```

### 12. Notifier fin

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🟢 [MAINTENANCE] Drill OK — RTO ${RTO_MIN} min, intégrité validée"
```

## Étapes restore réel (incident)

Bascule sur `docs/ops/runbook-incident.md` §4.2 — restore directement sur `axion_ia_prod` (pas DB drill).

Différences :

- Stop app + worker **avant** restore.
- Restore = remplace DB live (DESTRUCTIF — vérifier snapshot Hetzner pré-action).
- Re-apply FTS migrations.
- Re-start app + worker.
- Vérifier `curl /api/healthz` + 1 booking smoke test.

## Vérifications post-drill

- [ ] RTO mesuré ≤ cible (30 min V1).
- [ ] Intégrité DB drill : counts cohérents.
- [ ] DB drill droppée (pas de pollution).
- [ ] Log drill ajouté à `_AUDIT/PG-RESTORE-DRILL-LOG.md`.
- [ ] Si RTO > cible : ADR créé pour amélioration script.

## Rollback

- Drill sur DB isolée → pas de rollback nécessaire.
- Restore réel → rollback = restore d'un backup précédent.

## Escalation

| Niveau | Contact         | Quand                                       |
| ------ | --------------- | ------------------------------------------- |
| L1     | Will            | toujours pour drill (validation + créneaux) |
| L2     | Hetzner support | si Storage Box inaccessible                 |
| L3     | DPO             | si restore réel touche données users        |

## Liens

- Legacy `docs/ops/runbook-incident.md` §4.2 (restore opérationnel)
- Legacy `docs/ops/runbook-deploy.md` §9 (backup config)
- Code : `axionia/scripts/backup-postgres.sh`
- Mémoire `axionia_session_2026-05-09_stabilisation_complete` — snapshot Hetzner discipline
- ADR 0009 — hosting + backup strategy
