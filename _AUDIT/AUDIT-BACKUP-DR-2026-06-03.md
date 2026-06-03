# Audit Backup & Disaster Recovery — Axion-IA

- **Date** : 2026-06-03
- **Auteur** : Will + Claude (Opus 4.8)
- **Méthode** : audit **lecture seule du dépôt** (6 sous-agents `Explore` en parallèle, un par domaine). Aucun accès VPS/Coolify/Hetzner/Cloudflare/GitHub Actions — les points dépendant de ces consoles sont marqués **⚠️ À CONFIRMER**.
- **Référence** : ADR 0022 (backup scripts-only), ADR 0026 (build externalisé GHCR), audit Pr-04 (18/25, 2026-05-22).
- **Décision** : étendu par **ADR 0032** (PITR pgBackRest + immuabilité + périmètre élargi + secrets age).

---

## 0. Résumé exécutif

**Seul Postgres est réellement sauvegardé.** Deux scripts custom chiffrés (AES-256) poussent des dumps vers Hetzner Storage Box (in-region) **et** Cloudflare R2 (off-provider), avec rotation GFS 7/4/12 et alertes Telegram. C'est solide.

**Tout le reste est un angle mort** : fichiers image-bank, Docuseal, Redis, Plausible (ClickHouse), secrets/config, Coolify, Cloudflare, mirror Git — aucun script de backup. R2 est la **seule** couche hors-Hetzner et ne couvre que Postgres.

**Trou structurel** : la passphrase qui chiffre les backups (`BACKUP_ENCRYPTION_PASSPHRASE`) vit **à l'intérieur du système qu'elle protège** (env Coolify, dump `.secrets-coolify/axion-ia-prod-env.txt`). Un disaster total rend les backups R2 illisibles → « restore from cold » impossible.

**Discipline non prouvée** : 4 fichiers de suivi référencés dans l'ADR/runbooks sont **absents** du dépôt (`CRON-VPS-INVENTORY.md`, `PG-RESTORE-DRILL-LOG.md`, `CI-SECRETS-REQUIRED.md`, `SECRETS-ROTATION-LOG.md`). Aucun log ne prouve qu'un drill de restauration récurrent tourne réellement.

**Hygiène secrets** : `.gitignore` protège bien `.secrets/`, `.secrets-coolify/`, `.env*` de Git, mais ces fichiers sont **en clair au repos** localement et constituent la seule copie de creds Google (GSC/Indexing) irremplaçables.

---

## 1. Inventaire vérifié (fichier par fichier)

| Mécanisme existant | Réalité |
|---|---|
| `scripts/backup-postgres.sh` | ✅ Postgres → Hetzner Storage Box. `pg_dump plain → gzip-9 → AES-256-CBC PBKDF2 100k → rsync SSH`. Vérif taille remote≡local. GFS 7/4/12. Telegram + escalade cascading ≥2. Mode `--restore`. |
| `scripts/backup-postgres-r2.sh` | ✅ Postgres → Cloudflare R2. `pg_dump custom → gzip --best → AES-256 (⚠️ sans `-iter 100000`) → aws s3 cp`. Même GFS. Mode `--restore` (vérif `pg_restore --list`). |
| `scripts/restore-postgres-test.sh` / `-r2.sh` | ✅ Drills : PG éphémère / `pg_restore --list` + row counts tables critiques. |
| `.github/workflows/nightly.yml` job `backup-drill` | ✅ Existe, lance le drill R2, **gardé par `vars.NIGHTLY_BACKUP_DRILL_ENABLED != 'false'`**. ⚠️ commentaire d'en-tête mentionne un historique `if: false` → activation réelle **À CONFIRMER**. |
| ADR 0022 | ✅ Acte « scripts custom, Postgres-only ». pgBackRest classé « V2 ». |
| 4 fichiers de suivi | 🔴 **Absents** (glob → 0 résultat). |
| `backup-redis.sh`, `backup-docuseal.sh`, `backup-plausible.sh`, `backup-files*.sh`, `backup-secrets.sh` | 🔴 **N'existent pas.** Les 4 scripts du dossier sont tous des variantes Postgres. |

---

## 2. Matrice composant × critères (a–g)

Critères : **(a)** sauvegardé · **(b)** mécanisme · **(c)** copies / off-provider / immuable · **(d)** chiffré · **(e)** rétention · **(f)** restore testé · **(g)** monitoré. Légende ✅ ok · ⚠️ partiel · 🔴 absent.

| Composant | a | b | c | d | e | f | g |
|---|---|---|---|---|---|---|---|
| **Postgres (métier)** | ✅ | 2 scripts | 2 dest (SB + R2) ; off-provider ✅ ; immuable 🔴 | ✅ AES-256 | ✅ 7/4/12 | ⚠️ scripts OK, **récurrence non prouvée** | ✅ Telegram |
| **Redis / BullMQ** | 🔴 | AOF local | 1 copie sur le VPS | 🔴 | 🔴 | 🔴 | ⚠️ healthcheck docker |
| **Fichiers image-bank** | 🔴 | aucun | **1 copie unique** (Storage Box = prod) ; off-provider 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Docuseal** (PDF signés) | 🔴 | aucun | 1 copie volume local | 🔴 | 🔴 | 🔴 | 🔴 |
| **Plausible PG + ClickHouse** | 🔴 | aucun | 1 copie volume local | 🔴 | 🔴 | 🔴 | 🔴 |
| **Monitoring** (Prom/Grafana/Uptime-Kuma) | 🔴 | aucun | 1 copie volume local | 🔴 | 🔴 | 🔴 | 🔴 |
| **Volumes Caddy** (certs ACME) | ⚠️ | reconstructible (ACME) | n/a | n/a | n/a | n/a | n/a |
| **Secrets `.secrets/` + creds Google** | 🔴 | 1Password/papier (humain) | clair local + coffre ; backup chiffré versionné 🔴 | 🔴 (local) | manuel | 🔴 | 🔴 |
| **Coolify config / env runtime** | 🔴 | aucun export | source de vérité unique | ⚠️ | 🔴 | 🔴 | 🔴 |
| **GitHub Actions secrets** | 🔴 | non exportables | valeurs non documentées hors GitHub | ✅ (GitHub KMS) | n/a | 🔴 | 🔴 |
| **Code Git / image GHCR** | ✅ | GitHub + GHCR | code = GitHub seul (**pas de mirror**) ; image rebuild via Dockerfile | n/a | ⚠️ rétention GHCR non fixée | ✅ reproductible | n/a |
| **Cloudflare (DNS/WAF/Turnstile)** | 🔴 | UI manuelle | aucun export/IaC | n/a | 🔴 | 🔴 | 🔴 |

**Scoring 3-2-1-1-0** (≥3 copies, ≥2 médias, ≥1 off-site, ≥1 immuable, 0 erreur restore vérifiée) :
- **Postgres ≈ 4/5** (manque l'immuabilité).
- **Tout le reste : 0–1/5.**

---

## 3. Verdict Hetzner

- **Backups Auto VPS** : ADR 0022 dit « garder activé », mais **rien dans le dépôt ne prouve l'activation ni la rétention** → ⚠️ À CONFIRMER en console. Même activés : non atomiques pour la DB, **même fournisseur** que la prod.
- **Storage Box = Hetzner** → ne protège pas d'un sinistre/compte Hetzner.
- **Seule couche off-provider réelle = R2 (Cloudflare)**, et elle ne couvre **que Postgres**. Donc images, Redis, Docuseal, Plausible, secrets → **aucune copie hors Hetzner aujourd'hui**.

---

## 4. Matrice de trous priorisée

### 🔴 P0 — perte de donnée possible aujourd'hui
1. **Fichiers image-bank = copie unique** (Storage Box). Originaux irremplaçables (dédup SHA-256 empêche le ré-upload). Incident/compte Hetzner = perte définitive.
2. **Docuseal non sauvegardé** — PDF signés = valeur légale, irremplaçables.
3. **Secrets non sauvegardés chiffrés/offsite + passphrase backup dans le système qu'elle protège** → backups R2 illisibles en disaster, restore from cold impossible.
4. **Récurrence des drills non prouvée** : un backup jamais restauré n'est pas un backup (var CI à confirmer + 0 log).

### 🟠 P1 — résilience / observabilité
5. Redis/BullMQ sans backup off-site.
6. Plausible (ClickHouse events) non sauvegardé.
7. Pas de **dead-man's-switch** (Healthchecks.io) → échec silencieux d'un cron indétectable.
8. **Immuabilité absente** (R2 Object Lock / WORM) → un attaquant VPS peut effacer les backups.
9. Coolify config / Cloudflare / GitHub secrets non exportés ni documentés → reconstruction from cold non garantie.
10. RTO/RPO non chiffrés ; runbook DR « VPS perdu → plateforme remontée » incomplet.
11. Code Git sans mirror off-GitHub.

### 🟡 P2 — durcissement
12. Secrets locaux en clair au repos (chiffrement client-side type age/SOPS).
13. Rétention GHCR à fixer ; cleanup planifié Storage Box ; bus factor = 1 (Will seul).

---

## 5. Stratégie cible (résumé — détail dans ADR 0032)

- **Périmètre élargi** : scripts backup pour images (offsite R2), Docuseal, Redis, Plausible, secrets (age), mirror Git — calqués sur l'existant (lib commune `backup-lib.sh`).
- **PITR Postgres via pgBackRest** (RPO < 1h, WAL streaming) **en plus** des dumps.
- **Immuabilité R2 Object Lock** sur secrets + monthly Postgres + pgBackRest full.
- **Dead-man's-switch Healthchecks.io** par composant×type.
- **Drill mensuel prouvé** (`restore-drill-monthly.yml`) écrivant un `RestoreDrill`.
- **Secrets chiffrés age** (clé publique sur VPS, privée hors-système) → R2 immuable.
- **Dashboard admin `/infra/backups`** alimenté par une table `BackupRun`/`RestoreDrill` (scripts → API interne HMAC).
- **RTO/RPO chiffrés** dans un runbook DR exécutable.

---

## 6. Points à confirmer (consoles — hors lecture dépôt)

1. Hetzner Backups Auto : activés ? rétention ?
2. `vars.NIGHTLY_BACKUP_DRILL_ENABLED` : le drill CI tourne-t-il vraiment ?
3. R2 Object Lock : configurable / état actuel des buckets ?
4. Cron VPS réel (crontab) : les 3 entrées Postgres tournent-elles ? → à documenter dans `CRON-VPS-INVENTORY.md`.
5. Quelle stack Plausible est déployée (`infra/plausible/` vs `docker/monitoring/`) ?
6. Coolify : existe-t-il un export de config / un backup de sa DB interne ?
