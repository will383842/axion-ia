# Journal des drills de restauration — Axion-IA

> Doctrine §15 : « Test mensuel obligatoire restauration. Sans test → backup ≠ backup. »
> **Source de vérité humaine** des drills. La source machine est la table Prisma `RestoreDrill`
> (alimentée par `restore-*-test*.sh` + workflow `restore-drill-monthly.yml`). Ce fichier reste
> le registre lisible et auditeur-friendly. Référencé par ADR 0022 / ADR 0032 / runbook R22.

- **Cible RTO** : ≤ 30 min (restore dump) ; PITR à chiffrer après premier drill pgBackRest.
- **Cible RPO** : ≤ 1 h (PITR WAL streaming, ADR 0032) — fallback dump ≤ 24 h.

---

## Historique

| Date (UTC) | Composant | Source | Méthode | RTO mesuré | Rows / intégrité | Résultat | Opérateur | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-06-03 14:20 | postgres | R2 daily | restore-drill-monthly.yml → restore-postgres-test-r2.sh (PG éphémère pgvector) | **4 s** | 345 rows (articles 5, knowledge_entries 340, bookings 0, author_profiles 0) ; pg_restore --list OK | ✅ **PASSED** | CI (workflow_dispatch) | 1er drill prouvé. RestoreDrill écrit au dashboard. 3 bugs corrigés ce jour : passphrase périmée, image sans pgvector, comptage noms de modèles au lieu des tables @@map. |
| — | — | — | — | — | — | — | — | ⚠️ Aucun drill loggé AVANT 2026-06-03 (script existait mais n'avait jamais tourné — passphrase CI absente) |

## Modèle d'entrée

```
| 2026-07-01 | postgres | R2 daily | restore-postgres-test-r2.sh (PG éphémère CI) | 14 min | 52 310 rows, pg_restore --list OK | ✅ PASSED | CI nightly | RestoreDrill id=... |
```

## Composants à couvrir mensuellement (ADR 0032)

- [ ] `postgres` — dump R2 (auto CI nightly + mensuel)
- [ ] `postgres_pitr` — pgBackRest restore vers PGDATA jetable + replay WAL
- [ ] `docuseal` — déchiffrement + `PRAGMA integrity_check`
- [ ] `plausible_pg` — `pg_restore --list`
- [ ] `secrets` — vérif intégrité de l'archive chiffrée age (jamais la clé privée en CI)
- [ ] `files_image_bank` — restore d'un échantillon d'archive + checksum
