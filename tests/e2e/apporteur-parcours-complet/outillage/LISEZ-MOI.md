# Parcours apporteur complet — bac à sable local

Données entièrement fictives ; aucun appel vers la production ni un service réel.
Spec : `tests/e2e/apporteur-parcours-complet.spec.ts`. Captures : `tests/e2e/apporteur-parcours-complet/NN-*.png`.
Ce parcours n'est pas joué par la CI (config dédiée, serveur lancé à la main).

1. Postgres 16 + pgvector + Redis locaux ; `pnpm prisma migrate deploy` ; `pnpm db:seed` (admin de dev).
2. `faux-services.mjs <dossier-certs>` : HTTPS :443 (faux R2 en mémoire + faux SIRENE « actif »), TCP :3310 (faux ClamAV).
   Les hôtes `recherche-entreprises.api.gouv.fr` et `*.localtest-axion.r2.cloudflarestorage.com` sont renvoyés vers
   127.0.0.1 dans `/etc/hosts` du bac à sable ; certificat auto-signé donné à Node par `NODE_EXTRA_CA_CERTS`
   (garder le bundle CA habituel dans le même fichier). Variables : `R2_ACCOUNT_ID=localtest-axion`,
   `R2_BUCKET_NAME=axion-test`, `R2_ACCESS_KEY_ID/SECRET` fictifs, `CLAMAV_HOST=127.0.0.1`,
   `PII_ENCRYPTION_KEY` = 64 caractères hexadécimaux, `SKIP_ENV_VALIDATION=true`, `AUTH_SECRET` fictif.
3. Poser `APPORTEUR_BAC_A_SABLE=1` (sans elle, le test est ignoré : la CI ne le joue donc pas), puis `pnpm dev` (proxys sortants désactivés pour le processus), puis
   `npx playwright test -c tests/e2e/apporteur-parcours-complet/outillage/playwright.bac-a-sable.config.ts`.

E-mails : aucun worker ; les tâches restent dans la file BullMQ de Redis local, d'où le test lit le lien du dossier.
