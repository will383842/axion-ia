# R33 — Disaster Recovery : remettre tout le site en ligne

- **Statut** : v2 (2026-07-11) — ADR 0032. Réécrit pour coller à la réalité déployée
  (v1 décrivait du PITR/age/bucket immuable jamais mis en place).
- **Périmètre** : perte de données, corruption, perte totale du VPS, ou compromission.
  Pour une simple panne région, voir **R31**.

## TL;DR — quelle voie choisir selon l'incident

| Scénario                                                    | Voie de recovery                                                        | RTO réaliste                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| Base corrompue / données effacées, VPS sain                 | Restaurer le dernier dump PG depuis R2 (§ Voie B, étape 2)              | 15 min – 1 h                                   |
| VPS mort (incident Hetzner, suppression, corruption disque) | **Restaurer le snapshot Hetzner du VPS entier** (§ Voie A)              | **~15-20 min**                                 |
| Hetzner ENTIER perdu (compte, région)                       | Reconstruire depuis R2 sur un hôte neuf (§ Voie B)                      | 1 – 3 h                                        |
| **Piratage / compromission**                                | Rebuild PROPRE + rotation secrets + restore données pré-hack (§ Voie C) | Heures (NE PAS restaurer le snapshot tel quel) |

## ⚠️ Le seul prérequis vital HORS système

Sans lui, **aucun backup R2 n'est déchiffrable**. À garder accessible hors du VPS (coffre 1Password + copie papier) :

- **`BACKUP_ENCRYPTION_PASSPHRASE`** — chiffre TOUS les backups R2 (Postgres, Docuseal, Plausible, secrets, fichiers) en **AES-256** (`openssl enc -aes-256-cbc -pbkdf2`).

Autres accès à avoir sous la main : compte **Cloudflare R2** (où vivent les backups), **GitHub** (code + image GHCR), **Cloudflare DNS**, **Hetzner** (snapshots + nouveau serveur), **Coolify** (ou ses creds API dans `.secrets/api-tokens.env`).

> ℹ️ La v1 mentionnait `SOPS_AGE_KEY` / `PGBACKREST_REPO1_CIPHER_PASS` / bucket immuable :
> **non applicable**. Les secrets sont chiffrés en AES avec `BACKUP_ENCRYPTION_PASSPHRASE`
> (pas age), le PITR pgBackRest n'a jamais été déployé, et il n'y a pas de bucket Object-Lock.

---

## Voie A — Restaurer le snapshot Hetzner (le plus rapide)

Le VPS entier (app + Postgres + volumes + config Coolify) est **snapshoté chaque jour** par
Hetzner (Backups auto activés, fenêtre 10-14 UTC, ~14 images conservées ≈ 2 semaines).

1. Console Hetzner Cloud → serveur `axionia-web` (id `130002660`) → onglet **Backups**.
2. Choisir le dernier snapshot **sain** (antérieur à l'incident si corruption/hack — cf. Voie C).
3. **Rollback** sur le serveur existant, OU créer un nouveau serveur depuis l'image backup.
4. Au boot : vérifier `docker ps` (tous les conteneurs healthy), puis `curl https://axion-ia.com/api/healthz`.
5. Si nouvelle IP → mettre à jour l'A record dans Cloudflare DNS.

RTO typique ~15-20 min. **Perte de données** = tout ce qui s'est passé depuis le dernier
snapshot (jusqu'à ~24 h). Pour réduire, réappliquer par-dessus le dernier dump PG horaire (Voie B, étape 2).

---

## Voie B — Reconstruire depuis R2 (si Hetzner indisponible)

### Prérequis extensions Postgres

Le dump contient des colonnes `vector` (table `KnowledgeEmbedding`, pgvector) + `citext`/`pg_trgm`/
`unaccent`/`uuid-ossp`. Le Postgres cible **DOIT** avoir **pgvector** (image `pgvector/pgvector:pg16`,
pas `postgres:16-alpine`), sinon `pg_restore` échoue. Le drill CI mensuel le vérifie.

### Étape 0 — Hôte neuf

1. Nouveau VPS. Installer Docker + Compose. (Les outils `aws-cli`/`openssl` sont fournis par les
   conteneurs éphémères des scripts backup, pas besoin de les installer sur l'hôte.)
2. `git clone https://github.com/will383842/axion-ia.git`.

### Étape 1 — Secrets (débloque tout le reste)

```bash
# Lister + récupérer la dernière archive secrets
aws --endpoint-url "$R2_ENDPOINT" s3 ls s3://axion-ia-backups/secrets/ | sort | tail -1
aws --endpoint-url "$R2_ENDPOINT" s3 cp s3://axion-ia-backups/secrets/<archive>.tar.gz.enc .
# Déchiffrer (AES) + décompresser
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE -in <archive>.tar.gz.enc | tar -xzf -
```

Réinjecter ces variables d'environnement dans Coolify (ou le `.env` de la stack).

### Étape 2 — Postgres (dump)

```bash
# Le plus récent = postgres/hourly/ (RPO ~1 h) ; sinon postgres/daily/
aws --endpoint-url "$R2_ENDPOINT" s3 ls s3://axion-ia-backups/postgres/hourly/ | sort | tail -1
# Restaurer via le script (télécharge + déchiffre + valide) :
bash scripts/backup-postgres-r2.sh --restore postgres/hourly/<dernier>.dump.gz.enc
# puis appliquer réellement :
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" <fichier .dump>
```

### Étape 3 — Stack applicative

```bash
# Via Coolify : pull image GHCR ghcr.io/will383842/axion-ia:latest (Dockerfile.coolify-pull)
# Les migrations tournent à l'entrypoint (prisma migrate deploy).
```

### Étape 4 — Données annexes (chacune : télécharger → déchiffrer AES → restaurer dans le volume)

- **Fichiers utilisateurs** : `files/daily/*.tar.gz.enc` → détar dans les volumes `cv-storage`,
  `console-docs` et le bind `/var/data/reviews-media`.
- **Docuseal** (signatures) : `docuseal/daily/*.tar.gz.enc` → détar dans le volume docuseal.
- **Plausible** (non bloquant) : `plausible/pg/*` + `plausible/ch/*`.
- **Redis** : non sauvegardé (files reconstructibles) — rien à restaurer.

### Étape 5 — DNS + vérifs

1. Cloudflare → pointer `axion-ia.com` vers la nouvelle IP.
2. `curl https://axion-ia.com/api/healthz` ; `/fr` → 200 ; admin accessible.
3. Redéposer les wrappers cron `/opt/axion-ia/run-*-backup.sh` + le crontab (cf. `_AUDIT/CRON-VPS-INVENTORY.md`).

---

## Voie C — Piratage / compromission (⚠️ NE PAS restaurer le snapshot tel quel)

Restaurer un snapshot compromis ré-installe la porte dérobée. Procédure :

1. **Isoler** : couper l'accès public (Cloudflare en « Under Attack » / pause DNS), ne PAS détruire
   le serveur compromis (preuves), snapshoter l'état pour analyse.
2. **Hôte propre** : nouveau VPS, image système fraîche (PAS un backup Hetzner du serveur hacké).
3. **Rotation de TOUS les secrets** avant de remonter : `BACKUP_ENCRYPTION_PASSPHRASE`, `AUTH_SECRET`,
   mots de passe Postgres, clés API (Anthropic/OpenAI/Cloudflare/Hetzner/R2/Docuseal…), `GH_DISPATCH_TOKEN`,
   `PII_ENCRYPTION_KEY`. Consigner dans `_AUDIT/SECRETS-ROTATION-LOG.md`.
4. **Restaurer uniquement les DONNÉES** (pas le système) depuis un backup **antérieur à l'intrusion** :
   suivre Voie B étapes 2-4 en choisissant un dump daté d'avant la compromission.
5. Rebuild l'image applicative depuis un commit Git vérifié (revue du diff récent).
6. Remonter le DNS seulement après vérification. RTO = heures, pas minutes — c'est normal et voulu.

---

## Post-incident

- Mesurer et noter le RTO réel dans `_AUDIT/PG-RESTORE-DRILL-LOG.md`.
- Vérifier que tous les cron backups tournent (`crontab -l` sur le nouvel hôte).
- **À faire au moins une fois (non encore répété)** : un drill de restauration COMPLET (Voie A ou B
  de bout en bout) pour valider les RTO ci-dessus. Le drill CI mensuel ne teste que le dump Postgres.
