# Pr-04 — Backups & Disaster Recovery

**HEAD** : 81f6ea0e
**Score** : 18 / 25

## Évidence

### Script backup chiffré AES-256 (Sprint 23 / M11)
- `scripts/backup-postgres.sh` complet, 189 lignes :
  - pg_dump SQL plain UTF-8 → gzip -9 → openssl AES-256-CBC PBKDF2 100k iter (ligne 144-153)
  - Upload Hetzner Storage Box via rsync over SSH (ligne 160-163)
  - Vérification taille remote ≡ local anti-corruption transit (ligne 166-173)
  - Rotation type-aware : daily 7 / weekly 4 / monthly 12 (ligne 42-47)
  - Telegram alerts succès/échec/cascading-fail (≥2 consécutifs → 🔴🔴 escalation, ligne 77-86)
  - Cleanup local post-upload (ligne 183)
- Mode restore intégré `--restore <filename>` (ligne 100-127) — décrypt + gunzip + `psql DATABASE_URL`.
- Variant R2 disponible `scripts/backup-postgres-r2.sh` (Cloudflare R2 fallback).

### Storage Box Hetzner BX11
- Mémoire 2026-05-17 : BX11 1TB Helsinki, ~3.20€/mois HT. Premier backup OK 2026-05-17 (axion_crm_pro mais infra share).
- Retention 7j local / 30j distant (rotation script).

### Cron prévu
- Commentaire backup-postgres.sh ligne 21-24 : daily 03h, weekly dim 04h, monthly 1er 05h.
- Workflow `.github/workflows/disk-cleanup-prod.yml` actif (cleanup VPS).

### Plan DR (Disaster Recovery)
- `_AUDIT/RUNBOOK-PG-RESTORE-DRILL-2026-05-16.md` ✅ runbook restauration documenté (1 fichier).
- `_AUDIT/E2E-2026-05-09/02-AGENTS/AGT-14-MONITORING-DR.md` + `_AUDIT/CERTIFICATION-FRONTEND-2026/28-DATA-RESILIENCE-DR-2026.md` ✅ — documentation DR multi-pass.
- `scripts/restore-postgres-test.sh` + `scripts/restore-postgres-test-r2.sh` ✅ — script test restore (mensuel doctrine §15).

### RTO / RPO
- RPO ≤ 24h (backup daily). Weekly + monthly = défense-en-profondeur multi-window.
- RTO non documenté chiffré dans le runbook lu (à compléter). Caddy `health_uri /api/healthz` (`src/app/api/healthz/route.ts`) couvre re-routing en cas de container restart, mais bascule DR full (VPS perdu) non chronométrée.

## Findings P0 / P1 / P2

- **P0** : aucun.
- **P1 (test restore monthly)** : doctrine §15 "Test mensuel obligatoire restauration" inscrite dans le script (commentaire ligne 4). Pas d'évidence dans `_AUDIT/RUNBOOK-PG-RESTORE-DRILL-2026-05-16.md` qu'un test mensuel récurrent ait été exécuté/loggué post 2026-05-16. Recommandation : ajouter cron `.github/workflows/restore-drill-monthly.yml` qui exécute `restore-postgres-test.sh` sur un Postgres ephémère + vérifie count rows.
- **P1 (RTO chiffré)** : pas de SLA RTO/RPO documenté dans le runbook DR. Recommandation : ajouter section "RTO ≤ Xh, RPO ≤ Yh" + procédure step-by-step DNS swap si VPS perdu.
- **P2 (snapshot Coolify)** : pas d'évidence Coolify auto-snapshot Hetzner side car build externalisé GH Actions (ADR 0026). Image GHCR redonne le code instantanément, mais DB doit être restaurée from Storage Box → cold start ~minutes-heures selon taille dump.
- **P2 (multi-region)** : Storage Box Helsinki + VPS Falkenstein ≠ même DC mais même fournisseur (Hetzner). Pour DR catastrophique fournisseur, considérer S3 cross-provider (AWS/R2). Pas urgent V1.

## Verdict (paragraphe)

Backend backup solide : script AES-256 chiffré + upload rsync + verif size + rotation 7/4/12 + cascading-fail alert Telegram + restore tested mode intégré. Storage Box Hetzner BX11 opérationnel depuis 2026-05-17. Runbook DR existant `RUNBOOK-PG-RESTORE-DRILL-2026-05-16.md`. Les gaps notables sont (a) absence de preuve que le test restore mensuel est exécuté/loggué de manière récurrente (script existe mais cron CI non observé), (b) RTO/RPO non chiffrés formellement dans le runbook. Score 18/25 — production-ready côté primitive backup, polish à ajouter sur la discipline opérationnelle (cron monthly restore drill + SLA chiffrés DR).
