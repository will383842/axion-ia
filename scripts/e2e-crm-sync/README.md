# Harnais d'intégration — boucle site → Axion CRM Pro (lot L2)

Vérifier, **en local et sans navigateur**, qu'un événement produit par le site
traverse réellement l'outbox, la signature HMAC, le contrat d'ingestion du CRM,
et ressort en lignes `companies` / `contacts` / `activities` — puis que le
rejouer ne crée rien.

Trois fichiers :

| Fichier                                     | Rôle                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `run-loop-check.ts`                         | le vérificateur : 5 étapes, rapport PASS/FAIL, code de sortie fidèle    |
| `mock-crm.ts`                               | faux récepteur HTTP (401/503/422/200) pour tourner sans la pile Laravel |
| `../../tests/e2e-crm-sync/contract.spec.ts` | tests de contrat purs, sans aucune pile (tournent dans `pnpm test`)     |

> **Ce que chaque mode prouve.** Le mode MOCK verrouille la moitié **site** de
> la boucle (écriture d'outbox, signature, interprétation des statuts, rejeu).
> Le mode RÉEL est le seul à prouver que le CRM **écrit ses lignes**. Aucun ne
> remplace l'autre : un harnais vert en mock ne dit rien de l'ingestion.

---

## 1. Mode MOCK — aucune pile CRM requise

Le seul prérequis est une base **du site** avec la table `crm_sync_outbox`.

```bash
# Base dev du site (le compose du dépôt mappe l'hôte 5433 ; voir la note plus bas)
pnpm db:up

export DATABASE_URL="postgresql://axion_ia:axion_ia_dev@localhost:5433/axion_ia_dev?schema=public"
export DIRECT_URL="$DATABASE_URL"      # ⚠️ Prisma EXIGE les deux (schema.prisma:32)

pnpm exec prisma migrate deploy
pnpm exec prisma generate              # sinon : "Cannot find module prisma/generated/client"

pnpm tsx scripts/e2e-crm-sync/run-loop-check.ts --mock
```

Le mock est démarré **dans le processus** du vérificateur sur un port libre, et
arrêté à la fin. Pour le lancer séparément (afin d'y pointer le site lui-même) :

```bash
pnpm tsx scripts/e2e-crm-sync/mock-crm.ts --port=58099 --secret="$SITE_SYNC_HMAC_SECRET"
# puis CRM_SYNC_URL=http://127.0.0.1:58099/api/internal/site-sync
```

---

## 2. Mode RÉEL — la pile CRM locale

### 2.1 Ce que le compose du CRM expose réellement

Relevé dans `Axion-CRM-Pro/docker-compose.yml` (ne pas se fier à l'habitude) :

| Service    | Conteneur            | Port hôte | Remarque                                          |
| ---------- | -------------------- | --------- | ------------------------------------------------- |
| `postgres` | `axion-crm-postgres` | **55432** | base `axion_crm`, rôle `axion` / `axion_dev_only` |
| `redis`    | `axion-crm-redis`    | **56379** | —                                                 |
| `api`      | `axion-crm-api`      | **aucun** | 🔴 joignable seulement via `caddy`                |
| `caddy`    | `axion-crm-caddy`    | 80 / 443  | expose `https://api.localhost` (TLS interne)      |

🔴 **`api` n'expose aucun port hôte.** La voie prévue est Caddy
(`https://api.localhost` → `api:80`, certificat auto-signé). Si les ports 80/443
de la machine sont déjà pris, ou si l'on préfère éviter le certificat interne,
il faut publier un port soi-même par une **surcouche compose gardée hors du
dépôt CRM** (celui-ci se lit, ne s'écrit pas) :

```yaml
# ~/crm-api-local.yml
services:
  api:
    ports:
      - "58080:80"
    environment:
      APP_KEY: "base64:…" # voir 2.2
      CRM_INGEST_ENABLED: "true"
      CRM_INGEST_BUSINESS_WORKSPACE: "<slug d'un workspace EXISTANT>"
      SITE_SYNC_HMAC_SECRET: "<le même secret que le site>"
```

```bash
cd /c/Users/willi/Documents/Projets/Axion-CRM-Pro
docker compose -f docker-compose.yml -f ~/crm-api-local.yml up -d postgres redis api
```

Passer par `environment:` plutôt que par le `.env` du dépôt évite d'écrire dans
le dépôt CRM. Si l'on modifie tout de même son `.env`, il faut ensuite
`docker compose exec api php artisan config:clear`.

### 2.2 Les six pièges rencontrés au montage

Tous ont été traversés pour obtenir un `5 PASS / 0 FAIL`. Aucun ne relève du
code du lot : ce sont des états de la pile locale.

1. **`APP_KEY` est absent du `.env` du dépôt.** Sans lui, toute requête finit en
   `MissingAppKeyException` (via le driver de session Redis). Générer :
   `php -r 'echo "base64:".base64_encode(random_bytes(32));'`.

2. 🔴 **La base de dev du CRM peut être en RETARD sur le schéma L2.** Celle
   rencontrée ici portait 91 tables mais 12 lignes de `migrations`, et son
   `activities` n'avait ni `external_ref`, ni `person_key`, ni `kind`, ni
   `subject_type`. Symptôme : **HTTP 500 `ingest_failed`**, signature et contrat
   pourtant acceptés — l'échec n'arrive qu'au moment d'écrire. `php artisan migrate`
   n'y suffit pas ; il a fallu repartir d'une base neuve :

   ```bash
   docker exec axion-crm-postgres psql -U axion -d postgres -c "CREATE DATABASE axion_crm_e2e OWNER axion;"
   MSYS_NO_PATHCONV=1 docker exec axion-crm-postgres \
     psql -U axion -d axion_crm_e2e -f /docker-entrypoint-initdb.d/01-extensions.sql
   # puis DB_DATABASE=axion_crm_e2e dans la surcouche, et :
   docker compose … exec -T api php artisan migrate --force
   ```

   Les extensions (`postgis`, `vector`, `pg_partman`…) ne sont installées par
   l'image que sur la base créée au PREMIER démarrage : une base ajoutée
   ensuite doit les recevoir à la main, d'où le rejeu du script d'init.
   Le vérificateur interroge alors `--crm-db=axion_crm_e2e` (ou `CRM_PG_DATABASE`).

3. **Le workspace de destination n'existe pas forcément.** La migration du socle
   L2 crée `vivier-candidats`, **pas** le workspace commercial.
   `CRM_INGEST_BUSINESS_WORKSPACE` vaut
   `axion-ia` par défaut (`config/crm.php`) ; si ce slug n'existe pas, l'ingestion
   lève `workspace_missing`. Lister les slugs disponibles :

   ```bash
   docker exec axion-crm-postgres psql -U axion -d axion_crm_e2e -tAc "select slug from workspaces"
   # au besoin :
   docker exec axion-crm-postgres psql -U axion -d axion_crm_e2e \
     -c "insert into workspaces (slug, name) values ('axion-ia', 'Axion-IA') on conflict do nothing;"
   ```

   🔴 **`workspace_missing` sort en 503, exactement comme `ingest_disabled`.**
   Un harnais qui lit « 503 = CRM au repos » déclarerait donc vert une pile mal
   montée. `run-loop-check.ts` distingue les deux par le code d'erreur du corps —
   ne pas défaire cette distinction.

4. **La cible `dev` désactive opcache** (`Dockerfile.laravel`, `opcache.enable=0`)
   et sert l'application depuis le bind mount `./backend`. Sur Windows
   (gRPC-FUSE), le bootstrap Laravel relit ~3000 fichiers **à chaque requête** :
   mesuré **47 à 82 s**. Or l'émetteur du site coupe à **10 s**
   (`CRM_SYNC_TIMEOUT_MS`, constante non configurable) : le mode réel échoue
   alors en `network` sans que rien ne soit cassé. Remède : monter une
   surcharge opcache (fichier hors dépôt CRM) dans la surcouche compose —

   ```yaml
   volumes:
     - "~/zz-opcache.ini:/usr/local/etc/php/conf.d/zzz-opcache-e2e.ini:ro"
   ```

   avec `opcache.enable=1` et `opcache.validate_timestamps=0`. Les listes
   `volumes` se **fusionnent** entre fichiers compose : la surcharge s'ajoute au
   bind mount, elle ne le remplace pas.

   Mesuré après la surcharge : **180 s à froid** (compilation initiale), puis
   **0,3 à 1,4 s** à chaud. Il faut donc **préchauffer** (`curl …/up`) avant de
   lancer le vérificateur, et **après chaque redémarrage** du conteneur —
   opcache vit dans le processus, un `up --force-recreate` le repart à zéro.

5. **La cible `prod` ne se construit pas ici** : son étage `composer-deps`
   échoue (`composer install`, exit 2). Elle aurait été la voie rapide (application
   copiée dans l'image + opcache) ; en attendant, c'est la cible `dev` + la
   surcharge opcache du point 4.

6. **Telescope bruite les erreurs.** Sur une base sans `telescope_entries`, la
   moindre exception en fait naître une seconde, qui masque la première dans les
   journaux. `TELESCOPE_ENABLED=false` dans la surcouche rend les erreurs
   lisibles.

### 2.3 Côté site

```bash
export DATABASE_URL="postgresql://axion_ia:axion_ia_dev@localhost:5433/axion_ia_dev?schema=public"
export DIRECT_URL="$DATABASE_URL"
export CRM_SYNC_ENABLED=true
export CRM_SYNC_URL="http://localhost:58080/api/internal/site-sync"
export SITE_SYNC_HMAC_SECRET="<64 hex, identique côté CRM>"

pnpm tsx scripts/e2e-crm-sync/run-loop-check.ts
```

`run-loop-check.ts` **pose lui-même** `CRM_SYNC_ENABLED=true`,
`SKIP_ENV_VALIDATION=true` et `BULLMQ_DISABLED=true` : sans le premier, le
verrou d'inertie du lot ferait qu'il n'y aurait rien à observer ; le dernier
évite d'exiger un Redis pour une mise en file qui n'est pas l'objet du test.

> **Note port 5433.** Le compose du site mappe l'hôte **5433**. Si un autre
> projet l'occupe déjà, lancer un Postgres jetable ailleurs et y appliquer les
> migrations — le vérificateur ne demande qu'une `DATABASE_URL` :
>
> ```bash
> docker run -d --name axion-e2e-site-pg -p 5435:5432 \
>   -e POSTGRES_USER=axion_ia -e POSTGRES_PASSWORD=axion_ia_dev \
>   -e POSTGRES_DB=axion_ia_dev pgvector/pgvector:pg16
> ```

---

## 3. Ce que lit le rapport

Sortie réelle obtenue contre la pile CRM locale (Laravel + Postgres), le
2026-08-14 :

```
=== Boucle site → CRM : vérification de bout en bout ===

  [PASS] config     cible=http://localhost:58080/api/internal/site-sync (CRM réel)
  [PASS] enqueue    outbox=4b7cde11-95eb-4d13-8eb6-df27bc208814 event_id=743ce0d1-1847-4d13-bb9a-013eb8758d9a
  [PASS] emit       HTTP 200 → statut CRM « created »
  [PASS] crm-db     activity=1|company|1 company=1 contact=1
  [PASS] replay     le rejeu ne crée rien : « noop_idempotent »

=== BOUCLE VÉRIFIÉE — 5 PASS / 0 FAIL / 0 SKIP ===
```

Contre-vérification en base, après le rejeu — **une seule** activité, ce qui est
la preuve que le second envoi n'a rien écrit :

```
 id |      kind       | subject_type | subject_id |             external_ref              |       title
----+-----------------+--------------+------------+---------------------------------------+--------------------
  1 | form_submission | company      |          1 | site:event:743ce0d1-…                 | Formulaire — audit
```

Code de sortie **0** si aucun `FAIL`, **1** sinon. Un `SKIP` n'est jamais un
échec : il dit qu'une étape n'avait pas lieu d'être (CRM fermé, ou mode mock).

### Les deux issues normales de l'étape `emit`

| Résultat                           | Lecture                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| `sent` + `created` / `updated`     | le CRM est ouvert et a ingéré                                   |
| `failed` 503 **`ingest_disabled`** | `CRM_INGEST_ENABLED` est à OFF — **nominal**, la ligne attend   |
| `failed` 503 autre code            | ❌ pile mal montée (workspace absent…), pas un CRM au repos     |
| `gave_up` 422                      | ❌ les deux contrats ont divergé — voir `contract.spec.ts`      |
| `failed` `network`                 | ❌ CRM injoignable **ou trop lent** (délai de 10 s, cf. 2.2 §3) |

## 4. Options

| Option                        | Défaut                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| `--mock`                      | absent (mode réel)                                           |
| `--cleanup`                   | absent — purge la ligne d'outbox et les lignes CRM `ZZ TEST` |
| `--crm-url=…`                 | `http://localhost:58080/api/internal/site-sync`              |
| `--secret=…`                  | `SITE_SYNC_HMAC_SECRET`, sinon un secret de test             |
| `--crm-container=…`           | `axion-crm-postgres`                                         |
| `--crm-db=…` / `--crm-user=…` | `axion_crm` / `axion`                                        |
| `--siren=…`                   | `000000000` (9 chiffres, non attribuable)                    |

Les lignes créées portent toutes le marqueur **`ZZ TEST E2E`** et une adresse en
`@axion-ia.test`. La base du CRM est interrogée par `docker exec … psql` : le
dépôt du site n'a pas de client Postgres en dépendance, et en ajouter un pour un
harnais de vérification serait un coût permanent pour un besoin ponctuel.

## 5. Les tests de contrat

```bash
pnpm vitest run tests/e2e-crm-sync
```

Aucune pile requise. Ils comparent les constantes du site (`CRM_FORM_TYPES`,
`CrmEventType`, clés du message, format `subject_ref`, signature HMAC) à une
**transcription datée** du contrat PHP (`backend/app/Crm/Ingest/SiteSyncEvent.php`).

Le fichier PHP n'est **pas** lu par le test : le dépôt CRM est absent de la CI du
site, et un test qui n'y trouverait rien serait vert par défaut — une garde qui
ne garde rien. Faire bouger une liste d'un côté oblige à venir éditer ce test,
donc à relire l'autre côté. **Si un de ces tests rougit, la question n'est pas
« comment le faire passer » mais « les deux dépôts sont-ils encore d'accord ».**
