# Journal de rotation des secrets & clés — Axion-IA

> Registre des secrets critiques, de leur emplacement de secours (coffre) et de leurs rotations.
> **Aucune valeur ici.** Référencé par ADR 0022 §positives / ADR 0032.

- **Dernière revue** : 2026-06-03

---

## 1. Clés de chiffrement de backup (les plus critiques)

| Clé | Rôle | Copie hors-système (coffre) | Dernière rotation | Runbook rotation |
|---|---|---|---|---|
| `BACKUP_ENCRYPTION_PASSPHRASE` | AES-256 des dumps PG (+ image-bank/docuseal/redis/plausible) | ⚠️ **À CONFIRMER** présente en 1Password + papier | **rotée après 2026-05-09** (cf. ⚠️ ci-dessous) | ❌ à créer |
| `SOPS_AGE_KEY` (privée age) | déchiffrement archive secrets (ADR 0032) | 🆕 **OBLIGATOIRE** 1Password + papier, JAMAIS sur VPS | 🆕 à générer | ❌ à créer |
| `AGE_RECIPIENT` (publique age) | chiffrement secrets (sur VPS) | n/a (publique) | 🆕 à générer | n/a |
| `PGBACKREST_REPO1_CIPHER_PASS` | chiffrement repo pgBackRest | 🆕 1Password + papier | 🆕 à générer | ❌ à créer |

> ⚠️ **Trou identifié à l'audit** : `BACKUP_ENCRYPTION_PASSPHRASE` est présente dans l'env Coolify
> et dans `.secrets-coolify/axion-ia-prod-env.txt` (le système qu'elle protège). Sa **seule** copie
> de survie doit être hors-système. À vérifier/sécuriser en priorité.
>
> 🔴 **FINDING 2026-06-03 (critique DR)** : la valeur dans `.secrets-coolify/axion-ia-prod-env.txt`
> (44 chars) est **PÉRIMÉE** — la passphrase prod actuelle (Coolify) fait **64 chars** (rotée depuis
> le 2026-05-09). Les dumps R2 sont chiffrés avec la valeur **64 chars** (Coolify). Un cold-restore
> utilisant l'ancien dump local **échouerait** (`bad decrypt`). → **Action Will** : mettre la valeur
> COURANTE (Coolify, 64 chars) en coffre 1Password + papier, et purger/mettre à jour le dump local
> périmé. La valeur courante a été posée le 2026-06-03 en secret GitHub Actions (pour les drills).

## 2. Secrets applicatifs / infra

| Secret | Emplacement | Copie coffre | Dernière rotation | Runbook |
|---|---|---|---|---|
| `AUTH_SECRET` | Coolify RUN | ⚠️ | ⚠️ non tracé | ❌ |
| `ADMIN_URL_PREFIX` | Coolify RUN | ⚠️ | ⚠️ | ❌ |
| `PII_ENCRYPTION_KEY` | Coolify RUN | ⚠️ (immuable post-prod) | — | ❌ |
| `IP_HASH_SALT` | Coolify RUN | ⚠️ | — | ❌ |
| `REDIS_PASSWORD` | Coolify RUN | ⚠️ | 2026-05-09 (post-leak) | ❌ |
| `BACKUP_INGEST_SECRET` (ADR 0032) | Coolify RUN + GH Secrets | 🆕 | 🆕 à générer | n/a |
| Creds Google (`gsc-service-account.json`, `gsc-oauth-client.json`, refresh token) | `.secrets/` (clair, VPS+local) | ⚠️ irremplaçables — **sécuriser dans le coffre** | — | ❌ |
| `COOLIFY_API_TOKEN` / `HETZNER_API_TOKEN` / `CLOUDFLARE_API_TOKEN` | `.secrets/api-tokens.env` + GH | ⚠️ | ⚠️ | ❌ |

## 3. Procédure générique de rotation (à formaliser en runbook)

1. Générer la nouvelle valeur (`openssl rand`, `age-keygen`…).
2. Mettre à jour la source de vérité (Coolify env / GH secret / `.secrets/`).
3. Mettre à jour la copie coffre (1Password + papier) **et** cette table (date).
4. Redéployer / redémarrer le container concerné.
5. Vérifier (healthz, backup test, déchiffrement test).
6. ⚠️ `BACKUP_ENCRYPTION_PASSPHRASE` / clé age : rotation **cassante** pour les archives existantes
   → garder l'ancienne clé jusqu'à expiration de la rétention des backups chiffrés avec.
