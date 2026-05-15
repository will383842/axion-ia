# DOWN — collective_4h_enum_values (2026-05-12)

Ajout enum values pour les formats 4h (`demarrage_ia_express`, `atelier_ia_cible`)
suite refonte taxonomique interventions Sprint 14.10.7.

## Doctrine projet

**R22-first**. Voir AGENT 14 P1.

## Risque

🟡 **Moyen** — les Bookings/Submissions créés avec ces values bloqueraient
le rollback. Migrer vers `intervention_essentielle_4h` (legacy) avant drop.

## SQL inverse

```sql
-- 1. Identifier les rows à migrer
SELECT id FROM "Booking" WHERE "interventionType" IN ('demarrage_ia_express', 'atelier_ia_cible');
-- 2. Mapper vers une value pré-existante ou archiver
UPDATE "Booking" SET "interventionType" = 'intervention_essentielle'
  WHERE "interventionType" IN ('demarrage_ia_express', 'atelier_ia_cible');
-- 3. ALTER TYPE pour retirer (cf. pattern AuditType DOWN précédent)
```

Adapter selon le diff réel de `migration.sql`.
