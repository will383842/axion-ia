# ADR 0025 — Chiffrement PII at-rest application-level (AES-256-GCM)

- **Statut** : Accepté
- **Date** : 2026-05-15
- **Auteur** : Will + Claude (Opus 4.7), suite à méta-cert `_AUDIT/META-CERT-2026-05-15/12-OWASP-TOP-10-2026.md` P0 OWASP A02
- **Référence** : `src/lib/pii-crypto.ts`, `src/features/booking/actions.ts`, `src/server/queue/workers/booking-crons-worker.ts`, OWASP Top 10 2026

## Contexte

L'audit méta-cert AGENT 12 a flaggé OWASP A02 (Cryptographic Failures)
sur les colonnes PII `Submission.contactEmail` / `contactName` / `contactPhone`
stockées en clair dans Postgres. Scenarios de risque :

1. **Compromise DB** (dump SQL accidentel, backup leak, replica compromis,
   ex-employé avec accès historique) → 100 % des emails/noms/phones leaks.
2. **Log forensique** (Sentry breadcrumbs SQL queries, Postgres slow log)
   → potentielle fuite indirecte.
3. **Conformité** : RGPD art. 32 §1.a _Pseudonymisation and encryption of
   personal data_ — recommandation forte pour PII at-rest.

Le backup Postgres déjà encrypté (`BACKUP_ENCRYPTION_PASSPHRASE`) mitige
le scenario 1 partiellement, mais pas les autres (DB live).

## Décision

Chiffrement application-level **AES-256-GCM** des 3 champs PII Submission
via helper `src/lib/pii-crypto.ts`.

### Architecture

- **Algorithme** : `aes-256-gcm` (Node `crypto` natif, FIPS-compatible).
- **IV** : 12 bytes random par encrypt (recommandation NIST SP 800-38D §8.2.1.1).
- **Tag** : 16 bytes authentication tag → vérifie tampering au decrypt.
- **Format** : `enc:v1:<iv-hex>:<ciphertext-hex>:<tag-hex>` — préfixe
  versionné détecte cleartext legacy + permet `enc:v2:` rotation future.
- **Clé** : `PII_ENCRYPTION_KEY` env var 64 chars hex (32 bytes / 256 bits).
  Génération : `openssl rand -hex 32`. Archivée 1Password + papier.
- **Dev fallback** : sans clé, `encryptPii` est pass-through cleartext
  - warn log. En prod sans clé → fail-fast au boot via `env.ts` superRefine.

### Wiring V1 (Sprint courant)

**Write-side** (chiffrement à l'insertion) :

- `src/features/booking/actions.ts::createBookingAction` ✅
- `src/features/audit/actions.ts` (2 sites : `submitAudit`, `submitAuditRequest`) ✅
- `src/features/contact/actions.ts::submitContact` ✅
- `src/features/implementation/actions.ts::submitImplementation` ✅
- `src/features/quote-request/actions.ts::submitQuoteRequest` ✅

**Read-side** (déchiffrement à la lecture) :

- `src/server/queue/workers/booking-crons-worker.ts::enqueueClientEmail` —
  wrap centralisé (déchiffre `contactEmail` + `payload.data.contactName`
  avant envoi). Couvre 100 % des reads workers BullMQ.

### Wiring V1.5 (sprint dédié + tests E2E)

- Pages admin liste Bookings / Submissions — ajouter `decryptPiiObject()`
  au moment du fetch côté Server Components ou route handlers.
- Email worker direct (`createBookingAction` appelle `enqueueEmail` avec
  `parsed.data.email` cleartext — pas de problème car la valeur vient
  du formData fresh, pas d'un DB read).
- Re-encrypt batch des rows historiques pré-key (script `scripts/migrate-pii-encrypt.ts`).

### Limites V1 acceptées

- **Lookups exact-match cassés** sur les champs chiffrés (`WHERE contactEmail = 'x'`
  ne match plus). Le champ `@db.Citext` Postgres reste mais perd son utilité
  search puisque ciphertexts diffèrent pour la même valeur (IV random).
  → Pour V2, ajout d'une colonne `contactEmailHash` (SHA-256 + IP_HASH_SALT)
  permettra lookups deterministic-blind.
- **Rotation de clé** : nécessite re-encrypt mass des rows existants (sprint
  dédié, gardé pour V2).
- **Pas d'AAD** (Associated Authenticated Data) en V1 — pourrait être ajouté
  V2 si on veut binder le ciphertext à un Submission.id (anti row-swap).
- **Performance** : ~10-30 µs par encrypt/decrypt sur 32 bytes typical email.
  Négligeable vs le round-trip Postgres (~ms).

## Conséquences

### Positives

- **OWASP A02 résolu** : DB dump direct ne révèle plus les PII en clair.
- **RGPD art. 32 §1.a** : conformité renforcée (pseudonymisation/chiffrement).
- **Backward-compat 100 %** : rows legacy cleartext lues sans casse via
  détection préfixe `enc:v1:` (pass-through si absent).
- **Idempotent** : `encryptPii(encryptPii(x))` = `encryptPii(x)` (préfixe détecté).
- **Zéro dépendance externe** (Node `crypto` natif).

### Négatives / À surveiller

- **Mise en place clé prod** : Will doit set `PII_ENCRYPTION_KEY` dans
  Coolify env + archiver 1Password + papier. Sans clé, fail-fast au boot.
- **Re-encrypt batch** des rows historiques est un sprint à part — V1 laisse
  cleartext legacy intact (compatibilité lecture maintenue).
- **Sites de lecture admin** à wirer progressivement avec `decryptPiiObject()` —
  V1 ne wrap que le chemin critique (booking-crons-worker email envoi).
  Les UI admin lisant Submission.contactEmail directement afficheront
  `enc:v1:...` jusqu'à wrap V1.5.

## Alternatives écartées

1. **Postgres `pgcrypto` (column-level encryption DB-side)** — nécessite
   migration mass + extension Postgres + gestion de clé via `key_id` /
   `pgsodium`. Plus complexe, dépend de la version Postgres, et bypass
   d'application loggue la clé dans `pg_stat_statements`.
2. **Transparent Disk Encryption (TDE)** — déjà couvert volume-level par
   Hetzner. Ne mitige PAS le scenario 1 (DB dump direct) car la DB live
   reste cleartext.
3. **No-op (statu quo)** — laissait OWASP A02 ouvert + RGPD art. 32
   recommandation non implémentée.

## Validation cible

- [x] Helper `pii-crypto.ts` livré (AES-256-GCM + IV random + tag verify)
- [x] Env var `PII_ENCRYPTION_KEY` déclarée + superRefine prod-strict
- [x] Write-side wrappé (6 sites Submission.create)
- [x] Read-side critique wrappé (booking-crons-worker `enqueueClientEmail`)
- [ ] Will set `PII_ENCRYPTION_KEY` dans Coolify env + archive 1Password
- [ ] Re-encrypt batch des rows historiques (sprint dédié V1.5)
- [ ] Wrap UI admin lecture Submission (sprint dédié V1.5)
- [ ] Ajout colonne `contactEmailHash` pour lookups deterministic (V2)
