# DOWN — booking_v1_complete (2026-05-13)

Sprint X.1 Booking V1 — 22 colonnes étendues sur Booking + tables
auxiliaires (BookingTransition, BookingOption, etc.).

## Doctrine projet

**R22-first** OBLIGATOIRE — migration massive Booking V1 avec data métier
critique (paiements, deposits, contrats). NE PAS rollback manuel.

## Risque

🔴 **Critique** — perte de tous les états deposit-gated, transitions audit
trail, options 48h, factures. Drop manuel = perte business data + comptable.

## Procédure

1. **Toujours** restore via R22 depuis backup pré-2026-05-13
2. Si pas de backup → cas de support escalation, contacter directement Will
3. Vérifier rows critiques avant tout rollback :
   ```sql
   SELECT COUNT(*) FROM "Booking" WHERE "depositPaidAt" IS NOT NULL;
   SELECT COUNT(*) FROM "BookingTransition";
   SELECT COUNT(*) FROM "BookingOption" WHERE "expiresAt" > NOW();
   ```
4. Si > 0 sur l'une de ces tables → rollback rejette des données business.
