# DOWN — intervention_type_align (2026-05-08)

Aligne l'enum `InterventionType` Prisma avec la doctrine pricing.ts.

## Doctrine projet (méta-cert 2026-05-15 AGENT 14 P1)

**R22-first** : `pnpm restore-postgres-test-r2` depuis le backup le plus récent
pré-migration. Pour cette migration, R22 est nécessaire car les enum values
sont référencées par des FK + JSONB existants.

## Risque

🟡 **Moyen** — rollback enum value implique de mettre à jour les Bookings
existants qui utilisent les nouvelles values. SQL inverse non trivial sans
backup.

## Procédure manuelle (fallback si R22 indispo)

1. Identifier les Bookings utilisant les nouvelles enum values
   (`SELECT id FROM Booking WHERE interventionType IN (...)`)
2. Migrer chacun vers une value pré-existante (ou supprimer/archiver)
3. `ALTER TYPE` pour retirer les values ajoutées
