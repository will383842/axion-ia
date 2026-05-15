# DOWN — kb_v4_audit_log (2026-05-14)

Partie du bundle KB V4 — table `KbAuditLog` (hash-chain immuable des
opérations KB pour conformité RGPD + AI Act art. 50 traçabilité).

## Doctrine projet

**R22-first** OBLIGATOIRE. Voir `20260513221900_kb_01_init_schema/DOWN.md`.

## Risque

🔴 **Critique** — la hash-chain audit_log fait office de preuve
réglementaire AI Act + RGPD. Drop = perte de traçabilité légale. NE PAS
rollback sans accord DPO + Will.

## Note

Si rollback strictement nécessaire pour data corruption → préserver
d'abord les rows existantes en export `pg_dump --table=KbAuditLog`.
