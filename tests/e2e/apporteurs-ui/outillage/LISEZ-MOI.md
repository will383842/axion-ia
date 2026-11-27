# Parcours apporteurs par l'interface — bac à sable local

Données entièrement fictives ; jamais la production, aucun e-mail réel (les e-mails restent dans la file
BullMQ du Redis local, sans worker). Les specs se sautent sans `APPORTEUR_BAC_A_SABLE=1` : la CI ne les joue pas.

Mise en place : voir `tests/e2e/apporteur-parcours-complet/outillage/LISEZ-MOI.md` (Postgres 16 + pgvector,
Redis, `prisma migrate deploy`, `pnpm db:seed`, faux R2/SIRENE/ClamAV, `pnpm dev`), puis :

    APPORTEUR_BAC_A_SABLE=1 npx playwright test -c tests/e2e/apporteurs-ui/outillage/playwright.config.ts

`semer.ts` crée des apporteurs fictifs directement en base. Il refuse tout si `APPORTEUR_BAC_A_SABLE` n'est pas exactement `1`, si l'hôte de `DATABASE_URL` n'est pas local, ou si le nom de la base ne contient pas `e2e`, `test` ou `bac` (ex. `axion_e2e`). Les specs exigent aussi exactement `=1`.
Captures : `tests/e2e/apporteurs-ui/captures/` (ignorées par git).
