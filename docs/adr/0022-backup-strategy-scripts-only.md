# ADR 0022 — Backup strategy : scripts custom (pas Coolify integrated)

- **Statut** : Accepté
- **Date** : 2026-05-15
- **Auteur** : Will + Claude (Opus 4.7), suite à audit `_AUDIT/CONTENT-GEN-AUDIT-D5-D6-DR-2026-05-15.md`
- **Référence** : ADR 0009 (hosting Hetzner CPX42 + CF Free), runbook R22, `axionia/scripts/backup-postgres*.sh`

## Contexte

Coolify 4.0 propose une feature backups DB integrated (managed via UI),
en plus des stratégies custom déjà en place :

- `axionia/scripts/backup-postgres.sh` → Hetzner Storage Box (rsync SSH)
- `axionia/scripts/backup-postgres-r2.sh` → Cloudflare R2 (S3-compatible)

L'audit D5+D6 a identifié l'absence d'arbitrage formel : Coolify backup
feature n'est pas activé, mais aucun ADR n'expliquait pourquoi.

## Décision

**Scripts custom uniquement** (Hetzner Storage Box + Cloudflare R2 en
parallèle), Coolify backup feature **NON activé**.

### Pipeline en place

```
                  ┌───────────────────────────────┐
                  │ Postgres prod (Hetzner CPX42) │
                  └─────────────┬─────────────────┘
                                │
                  ┌─────────────┴─────────────┐
                  │  pg_dump (cron VPS)       │
                  └──────────┬─────┬──────────┘
                             │     │
              ┌──────────────┘     └──────────────┐
              │                                   │
   ┌──────────▼───────────┐         ┌─────────────▼────────────┐
   │  AES-256 + gzip      │         │  AES-256 + gzip          │
   │  → rsync SSH Storage │         │  → aws s3 cp R2          │
   │  Box (Hetzner)       │         │  (Cloudflare)            │
   └──────────────────────┘         └──────────────────────────┘
        rétention 7d/4w/12m              rétention 7d/4w/12m
        in-region (Nuremberg)            off-Hetzner
```

Deux scripts indépendants exécutés en cron VPS, écart 15 min pour ne
pas saturer pg_dump.

### Couche complémentaire

- **Hetzner Backups Auto** (image VPS quotidienne, ~1,30 €/mois) :
  recovery rapide whole-VPS ~10 min mais inclut OS + Docker + DB =
  pas atomique pour la DB seule. Garde activé.
- **Hetzner snapshots manuels pré-modif risquée** : doctrine forte
  (`coolify-procedures.md` §7), conservée.

## Pourquoi pas Coolify backup feature

| Critère                      | Coolify integrated                               | Scripts custom                            |
| ---------------------------- | ------------------------------------------------ | ----------------------------------------- |
| Source de vérité unique      | UI Coolify                                       | Code versionné Git                        |
| Rétention configurable       | UI seulement                                     | `RETENTION_COUNT` script (audit-friendly) |
| Multi-destination simultanée | ❌ non (1 dest)                                  | ✅ Hetzner SB + R2 en parallèle           |
| Chiffrement client-side      | ⚠️ dépend version                                | ✅ AES-256 + pbkdf2 explicit              |
| Drill restore CI nightly     | ⚠️ pas de hook export                            | ✅ `restore-postgres-test-r2.sh` (Gate D) |
| Lock-in Coolify              | 🔴 oui (si on quitte Coolify, backup illisibles) | 🟢 non (pg_dump standard)                 |
| Visibilité Telegram          | ⚠️ via webhook custom                            | ✅ `notify_telegram` natif scripts        |
| Bénéfice unique vs custom    | Bouton UI "restore"                              | n/a                                       |

Le bouton "restore" Coolify UI n'apporte rien vs un `bash backup-postgres-r2.sh
--restore <key>` également scriptable et qui ne nécessite pas que Coolify
soit up (= utilisable même en disaster Coolify down).

## Conséquences

### Positives

- Stratégie portable : si demain on quitte Coolify (Nomad, K8s, bare-metal),
  les scripts continuent de marcher sans reconfiguration
- Drill nightly automatisé via R2 (pas besoin SSH)
- Doc complète dans `R22-pg-restore-drill.md`
- Chiffrement vérifiable côté client, key sous notre contrôle (1Password
  - papier coffre cf. `_AUDIT/SECRETS-ROTATION-LOG.md` §1)

### Négatives

- Charge maintenance : 2 scripts à maintenir (vs 1 toggle UI)
  - Mitigation : ils sont stables (~150 lignes chacun, pas de dépendance critique)
- Cron VPS à monitorer manuellement
  - Mitigation : `_AUDIT/CRON-VPS-INVENTORY.md` + alerte Telegram succès/fail dans scripts + alerte fail consécutifs (P1-9 fix)
- Si VPS HS, ces scripts ne tournent plus → mais Hetzner Backups Auto + R2 backups historiques restent

## Alternatives considérées

- **Coolify backup feature seul** — écarté : lock-in + pas de multi-destination + pas de drill CI hook.
- **PgBackRest** — surdimensionné V1 (PITR + WAL streaming) ; à reconsidérer V2 quand RPO < 1 h sera nécessaire (cf. R22 cible V2).
- **Backblaze B2** (mentionné ADR 0009) — abandonné au profit de R2 (intégration plus simple avec stack Cloudflare déjà en place, free tier généreux 10 GB).
- **Wal-G / barman** — pareil que PgBackRest, V2.

## Suivi

- Audit D5+D6 livré 2026-05-15 → `_AUDIT/CONTENT-GEN-AUDIT-D5-D6-DR-2026-05-15.md`
- 7 secrets CI à set (cf. `_AUDIT/CI-SECRETS-REQUIRED.md`) pour activer drill nightly automatique
- Premier drill manuel R22 à exécuter (cf. `_AUDIT/PG-RESTORE-DRILL-LOG.md`)
- Inventaire crontab VPS à compléter (cf. `_AUDIT/CRON-VPS-INVENTORY.md`)
- V2 (sprint dédié post-1k visites/mois) : évaluer PgBackRest pour RPO 1 h
