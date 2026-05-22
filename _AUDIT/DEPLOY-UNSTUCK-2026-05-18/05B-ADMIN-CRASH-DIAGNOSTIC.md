# 05B — Admin crash post-deploy diagnostic & fix

Généré : 2026-05-18 ~07:55 UTC, mis à jour 08:47 UTC.

## Symptôme

Après deploy Cycle 6 (HEAD `45ad1e1`) :

- Will tente login admin sur `https://axion-ia.com/admin-xfz5hk0j7hrk`
- Login form s'affiche (200)
- Credentials soumis → "credentials rejetés" perçu
- Page affiche error boundary : "Une erreur est survenue / La page admin n'a pas pu se charger / L'incident a été automatiquement signalé"
- Sentry capture l'erreur

Will dit aussi : "pas de design changé visible".

## Investigation initiale

- Erreurs console copiées par Will = **toutes Bitwarden extension** (Migrator, SignalR bitwarden.eu, fido2, overlay.background.ts) → écartées.
- `/fr/admin-xfz5hk0j7hrk/login` → 200 OK ✅ (form render OK).
- `/api/auth/csrf` GET → `{csrfToken:"..."}` ✅ (Auth.js fonctionne API-level).
- `/api/auth/session` → `null` ✅ (cohérent sans cookie).
- `/api/healthz` → `db:ok, redis:ok` ✅.

→ Login form OK, auth API OK → bug dans la page admin home post-login.

## Cause root

`src/app/[locale]/(admin)/[adminPrefix]/page.tsx` fait **17 queries Prisma simultanées** via `Promise.all`. Si UNE seule échoue (schéma DB désynchro), toute la page crash → `error.tsx` affiche message → Sentry.

Workflow `admin-emergency-migrate.yml` créé pour SSH Hetzner via `secrets.HETZNER_SSH_KEY` + diagnostiquer.

### Premier blocage

`prisma migrate status` via le binaire local du container échoue :

```
Error: Cannot find module '@prisma/engines'
Require stack: /app/node_modules/prisma/build/index.js
code: 'MODULE_NOT_FOUND'
```

Cause : symlinks pnpm brisés au runner stage. Le Dockerfile copie `node_modules/@prisma` mais le content-addressed store `.pnpm/` n'est pas inclus → les symlinks pointent vers du vide.

### Solution chirurgicale

Fresh install prisma + engines via npm dans `/tmp/prisma-fresh/` (totalement séparé de pnpm node_modules). Workflow patché.

## Diagnostic confirmé

Avec le fresh binary, `prisma migrate status` répond :

```
Datasource "db": PostgreSQL database "axionia" at "u7zlql3bpb1xy5t4kg6jnvpm:5432"

22 migrations found in prisma/migrations
Following migrations have not yet been applied:
20260516142016_create_country_table
20260516142017_add_image_bank_tables
20260516170000_image_bank_lookup_temporal_fields
20260516200000_add_service_sector
20260516200000_rgpd_ip_hash_additif
```

🎯 **5 migrations Prisma manquantes en prod depuis 2026-05-16** (probablement le recovery deploy 2026-05-16 a sauté ces migrations à cause du même bug pnpm symlinks). Toutes liées à : Country, ImageBank, ServiceSector, RGPD IP hash.

Au démarrage du container, l'entrypoint `docker-entrypoint.sh` essayait `prisma migrate deploy` mais le binaire local pnpm fail avec `@prisma/engines` not found → erreur catched silencieusement → container démarre quand même → Prisma Client compile bien (il a `@prisma/client` qui est séparé) mais queries sur Country/ImageBank/sector renvoient `P2021` (table not found) → admin page crash.

## Fix appliqué

### Étape 1 (immédiat, manuel) — résolution incident

Workflow `admin-emergency-migrate.yml` lancé en mode `migrate` (run `26020599939`) :

```
Applying migration `20260516142016_create_country_table`
Applying migration `20260516142017_add_image_bank_tables`
Applying migration `20260516170000_image_bank_lookup_temporal_fields`
Applying migration `20260516200000_add_service_sector`
Applying migration `20260516200000_rgpd_ip_hash_additif`

All migrations have been successfully applied.
Database schema is up to date!
```

Container restarté, healthz OK en 0.47 s, admin login débloqué.

### Étape 2 (durable) — fix Dockerfile (HEAD `229a0ff`)

- **Builder stage** : `RUN npm install` prisma + @prisma/engines dans `/tmp/prisma-cli/` (séparé de pnpm node_modules).
- **Runner stage** : `COPY /tmp/prisma-cli /app/prisma-cli`.
- **docker-entrypoint.sh** : priorise `/app/prisma-cli/node_modules/.bin/prisma` au lieu du binaire pnpm broken. Fallback npx en dernier recours.

Coût : ~200 MB image. Build durée +30 s. Réversible : revert ces 2 fichiers.

### Anti-régression

- Workflow `admin-emergency-migrate.yml` gardé en filet de sécurité (action=`status` ou `migrate` via `workflow_dispatch`).
- Future debug : si crash similaire, `gh workflow run admin-emergency-migrate.yml -f action=status` pour dump diagnostic.

## Causes systémiques à adresser

1. **`docker-entrypoint.sh` catch silencieusement** : pattern intentionnel pour ne pas bloquer le boot, mais cause des bugs invisibles. Reconsidérer : healthcheck dédié qui exécute une query Prisma sur un modèle récemment ajouté pour détecter le drift.
2. **17 queries simultanées dans admin home** : un seul crash propage à toute la page. Wrap chaque query dans try/catch ou Promise.allSettled + degrade gracefully.
3. **Pas d'alerte drift DB** : aucun monitoring n'a signalé que des migrations sont en attente. Ajouter cron `daily-migration-status-check.yml` (idempotent, alerte si migrations pending > 0).

## Timeline incident

| Heure UTC   | Event                                                             |
| ----------- | ----------------------------------------------------------------- |
| 06:46       | Deploy Cycle 6 success (HEAD `45ad1e1`), prod sert nouvelle image |
| 06:50-07:00 | Will tente login admin → crash error boundary                     |
| 07:05       | Diagnostic démarre                                                |
| 07:30       | Workflow `admin-emergency-migrate.yml` créé                       |
| 07:40       | Premier run status fail (`@prisma/engines` not found)             |
| 07:50       | Fresh install path identifié + appliqué                           |
| 07:51       | `prisma migrate deploy` réussit (5 migrations appliquées)         |
| 07:52       | Container restart + healthz OK                                    |
| 08:00       | Fix Dockerfile durable rédigé                                     |
| 08:02       | Push HEAD `229a0ff`                                               |
| 08:46       | Deploy Cycle 7 LHCI success                                       |
| 08:47       | Smoke 10/10 vertes                                                |

**Total downtime utilisateur admin** : ~1 h.
**Total downtime utilisateur public** : 0 (prod publique a continué de servir baseline normalement).
