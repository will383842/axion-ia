# DOWN — audit_flash_onsite_enum (2026-05-12)

Ajout d'une enum value `AuditType.flash_onsite` ou similaire.

## Doctrine projet

**R22-first**. Voir AGENT 14 P1 — l'enum reverse n'est pas trivial sans
toucher les rows qui utilisent déjà la nouvelle value.

## Risque

⚪ **Faible** — enum value récente, peu de rows utilisateurs.

## SQL inverse (si R22 indispo)

```sql
-- 1. Identifier rows utilisant la nouvelle value
SELECT id FROM "Submission" WHERE auditType = 'flash_onsite';
-- 2. Migrer chacun vers value pré-existante (ex: 'flash')
UPDATE "Submission" SET auditType = 'flash' WHERE auditType = 'flash_onsite';
-- 3. Retirer la value
ALTER TYPE "AuditType" RENAME TO "AuditType_old";
CREATE TYPE "AuditType" AS ENUM ('flash', 'cible', 'strategique_pme', 'strategique_eti');
-- ... cast columns + drop old type
```

Adapter selon le diff réel de `migration.sql`.
