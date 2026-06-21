#!/usr/bin/env bash
# Génère tous les secrets prod requis pour Axion-IA SAS (Sprint 24.1).
#
# Sortie : copy-paste prêts pour Coolify env vars.
#
# Usage :
#   bash scripts/generate-prod-secrets.sh                # imprime sur stdout
#   bash scripts/generate-prod-secrets.sh > .secrets     # redirige (chmod 600 puis sécuriser !)
#
# Sécurité :
#   - Utilise OpenSSL (entropie OS-level, /dev/urandom).
#   - Toutes les longueurs respectent les superRefine zod de src/env.ts :
#       AUTH_SECRET ≥ 32, ADMIN_URL_PREFIX ≥ 16, BACKUP_ENCRYPTION_PASSPHRASE ≥ 32.
#   - INDEXNOW_KEY = 32 hex (Bing exigence).

set -euo pipefail

if ! command -v openssl >/dev/null 2>&1; then
  echo "[error] openssl required" >&2
  exit 1
fi

# 32 bytes random base64 → 44 chars (sans padding final =) — ≥ 32 OK
AUTH_SECRET=$(openssl rand -base64 32 | tr -d '=' | tr '/+' '_-')

# 16 bytes random hex → 32 chars alphanumériques — ≥ 16 OK
ADMIN_URL_PREFIX="adm-$(openssl rand -hex 12)"

# 32 bytes random base64 → 44 chars
BACKUP_ENCRYPTION_PASSPHRASE=$(openssl rand -base64 32 | tr -d '=' | tr '/+' '_-')

# 16 bytes random hex → 32 chars hex (Bing IndexNow format)
INDEXNOW_KEY=$(openssl rand -hex 16)

cat <<EOF
# Axion-IA SAS · secrets prod générés $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Coller dans Coolify → Environment variables. NE JAMAIS committer ce fichier.
# Toutes les valeurs respectent les contraintes superRefine de src/env.ts.

# Auth.js v5 — JWT signing (≥ 32 chars random)
AUTH_SECRET=${AUTH_SECRET}

# URL secrète admin (≥ 16 chars random alphanum) — refuse fallback dev en prod
ADMIN_URL_PREFIX=${ADMIN_URL_PREFIX}

# Backups Postgres AES-256 (≥ 32 chars random)
BACKUP_ENCRYPTION_PASSPHRASE=${BACKUP_ENCRYPTION_PASSPHRASE}

# Bing IndexNow (32 hex chars exact)
INDEXNOW_KEY=${INDEXNOW_KEY}

# ─────────── À renseigner manuellement (sources externes) ───────────
# TURNSTILE_SECRET_KEY=          # depuis Cloudflare → Turnstile widget prod
# TELEGRAM_BOT_TOKEN=            # depuis @BotFather sur Telegram
# TELEGRAM_CHAT_ID=              # ID du chat ops admin
# HETZNER_STORAGE_USER=          # user@user.your-storagebox.de
# HETZNER_STORAGE_HOST=          # user.your-storagebox.de
# HETZNER_STORAGE_KEY=           # depuis Hetzner Storage Box S3 keys
# HETZNER_STORAGE_SECRET=        # idem
# COMPANY_REGISTRATION_NUMBER=   # SIREN/SIRET FR
# COMPANY_VAT_NUMBER=            # FRXX XXXXXXXXX (TVA intracommunautaire FR)
# SENTRY_DSN=                    # depuis sentry.axion-ia.com → settings/projects/.../keys
# SENTRY_AUTH_TOKEN=             # depuis sentry.axion-ia.com → settings/auth-tokens
# GOOGLE_SITE_VERIFICATION=      # depuis search.google.com → property → verify HTML tag
# BING_SITE_VERIFICATION=        # depuis bing.com/webmasters

# ─────────── Defaults Sprint 24/D3 (overridable) ───────────
RETENTION_LOGS_MONTHS=12
RETENTION_SUBS_ARCHIVE_MONTHS=24
RETENTION_NEWSLETTER_UNSUB_MONTHS=36
RETENTION_BOOKINGS_CANCELLED_MONTHS=12
EOF
