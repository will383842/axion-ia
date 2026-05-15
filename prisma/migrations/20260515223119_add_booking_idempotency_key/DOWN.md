# DOWN — add_booking_idempotency_key (2026-05-15)

Rollback de la migration `20260515223119_add_booking_idempotency_key`.

## Risque

⚪ **Faible** — colonne `idempotency_key` est nullable + index UNIQUE
partiel. Aucune contrainte FK ne dépend de cette colonne. Le drop est
réversible sans perte de données métier (uniquement les clés
d'idempotency précédemment stockées sont perdues — non récupérables
mais sans impact business : pire cas un visiteur peut re-soumettre
un booking dans une fenêtre courte).

## Procédure

```sql
DROP INDEX IF EXISTS "Submission_idempotency_key_key";
ALTER TABLE "Submission" DROP COLUMN IF EXISTS "idempotency_key";

DROP INDEX IF EXISTS "Booking_idempotency_key_key";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "idempotency_key";
```

## Doctrine projet

R22-first : préférer un restore Postgres depuis backup pré-migration
plutôt que ce DOWN ad-hoc. Ce script reste fourni pour cas où le
restore est indisponible OU si seuls les changements idempotency
doivent être annulés sans toucher au reste du schéma.
