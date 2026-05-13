# Migration Prisma V1 — Notes de déploiement

> Statut au 2026-05-13 : **migration SQL pas encore générée**. À faire avant
> le merge `feature/booking-v1 → main` (sinon prod crash : code attend V1
> schema, DB est V0).

## Pourquoi

Sprint X.1 a étendu `prisma/schema.prisma` (15 nouvelles tables Booking V1 +
22 colonnes sur `Booking` + 18 enums). Aucune migration SQL n'a été générée
depuis (`prisma/migrations/` s'arrête à `20260512120000_collective_4h_enum_values`).

Sans migration, `prisma migrate deploy` au démarrage container = no-op,
et le code crash dès qu'il touche une table V1 (Payment, Invoice, Quote…).

## Action requise (Will, avant merge)

### 1. Démarrer la stack locale Postgres + Redis

```bash
docker compose -f docker/docker-compose.yml up -d postgres
```

(Si Docker Desktop n'est pas démarré → le lancer d'abord.)

### 2. Générer la migration

```bash
cd /c/Users/willi/Documents/Projets/Axion-IA/axionia
pnpm prisma migrate dev --name booking_v1_complete
```

Cela va :

- Comparer le schema actuel vs l'état local DB
- Créer `prisma/migrations/<timestamp>_booking_v1_complete/migration.sql`
- Appliquer la migration sur la DB locale
- Régénérer le client Prisma

### 3. Vérifier les tests + lint

```bash
pnpm typecheck
pnpm test --run
```

### 4. Commiter + pusher

```bash
git add prisma/migrations/
git commit -m "feat(prisma): migration v1 — 15 tables booking + 18 enums"
git push origin feature/booking-v1
```

### 5. Merger sur main (déclenche auto-deploy Coolify)

```bash
git checkout main
git merge --no-ff feature/booking-v1
git push origin main
```

Le Dockerfile mis à jour (commit `<TBD>`) inclut maintenant
`prisma migrate deploy` dans l'entrypoint container : la migration
s'applique automatiquement au boot du nouveau container Coolify.

### 6. Monitor le deploy

- Coolify UI : surveiller les logs du container `axion-ia` au boot.
- Premier log attendu : `[entrypoint] Running prisma migrate deploy…`
- Puis : `[entrypoint] Migrations applied successfully.`
- Puis : `[entrypoint] Starting Next.js server on port 3000…`
- Healthcheck `/api/healthz` doit passer en green < 2 min.

## Rollback procedure (si échec migration)

1. Bypass migration au boot : Coolify env var `SKIP_MIGRATE=1` → restart.
2. Investiguer le SQL via Coolify Terminal :
   ```bash
   docker exec -it <postgres-uuid> psql -U axion_ia_prod -d axion_ia_prod
   ```
3. Corriger manuellement OU rollback via `prisma migrate resolve --rolled-back <name>`.
4. Re-deploy avec `SKIP_MIGRATE` retiré.

## Validation post-migration

- Vérifier dans Postgres : `\dt` doit lister les 15 nouvelles tables
  (`payments`, `invoices`, `refunds`, `stripe_webhook_events`,
  `docuseal_webhook_events`, `contract_documents`, `contract_templates`,
  `quotes`, `cadrage_meetings`, `capacity_windows`, `pricing_config`,
  `payment_schedule_profiles`, `booking_payment_schedules`, `site_settings`,
  `booking_transitions`).
- Vérifier dans `\dT` : enums `PaymentProvider`, `QuoteStatus`,
  `CadrageStatus`, `ContractStatus`, `BookingStatus` (étendu), etc.
- Smoke test parcours `/reserver` → option_pending Booking créé OK.

## Migration V0 → V1 data (post-deploy)

Une fois le schema V1 en place, backfill les Bookings V0 existants :

```bash
# Dry-run (lecture seule, recommandé d'abord)
pnpm tsx scripts/migrate-bookings-v0-to-v1.ts

# Apply (écriture DB)
pnpm tsx scripts/migrate-bookings-v0-to-v1.ts --apply
```

Script idempotent : peut être relancé sans risque (UNIQUE constraint sur
BookingTransition empêche les doublons).
