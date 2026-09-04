<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Performance budget (Web Vitals 2026 — voir `_AUDIT/AUDIT-WEB-VITALS-2026-*.md`)

Toute PR qui touche le code frontend doit respecter ces seuils sur les **15 pages stratégiques** :

- **LCP** ≤ 1 800 ms p75 (cible interne ; Google « good » = 2 500 ms)
- **INP** ≤ 100 ms p75 (cible interne ; Google « good » = 200 ms)
- **CLS** = 0 (cible interne stricte ; Google « good » = 0,1)
- **TBT** ≤ 150 ms (Lighthouse lab desktop)
- **First Load JS** ≤ 75 KB gz / route (cible V6)

Exception : `/appel` (réservation d'appel, iframe Calendly client-heavy) → INP ≤ 150 ms, First Load ≤ 110 KB gz.

Tout patch qui dégrade ces seuils requiert un STOP & ASK Will + ADR justifié.

⚠️ **Vérité des gates (rectifiée le 2026-08-15, audit GEO/AEO E2E — GEO-025).** Ce
paragraphe affirmait que Lighthouse CI et `size-limit` bloquaient les PR. C'est **faux**,
et l'a toujours été :

- **Le seul gate réellement bloquant est le `lhci` _post-deploy_** (job `lhci` de
  `.github/workflows/deploy-coolify.yml`), qui mesure 5 URLs de la **prod live** après
  l'atterrissage. Il échoue le workflow, donc il alerte — mais **après** la mise en ligne.
- **🔴 2026-08-24 — LES DEUX GATES PR QUI NE MESURAIENT RIEN ONT ÉTÉ RETIRÉES.** On les
  gardait « le temps de lire ce qu'elles rapportent une fois qu'elles rapportent quelque
  chose ». C'est lu, et voici ce qu'elles rapportaient (run `32666732630`) :
  - **`Lighthouse CI` (PR-time, 13 min) mesurait le RUNNER.** Elle échouait sur **11 URL
    sur 11**, toujours pareil : FCP 7,2 s, LCP 11,5 s, TBT 357 ms, performance 0,50. Au
    même moment, le `lhci` **post-deploy sur la prod live** (run `32668725236`) ne rendait
    **aucun** échec — un seul avertissement `interaction-to-next-paint / auditRan`, qui ne
    se mesure pas en laboratoire. Une gate qui déclare toutes ses cibles en faute pendant
    que la prod passe propre ne mesure pas ses cibles : elle mesurait un runner à 2 cœurs,
    chauffé par les 8 min de Playwright qui la précédaient.
  - **`Bundle delta vs main` (3 min) ne pouvait PAS aboutir.** `size-limit-action` relance
    un build complet pour comparer à `main` ; le step `Build` du même job prend **8 min**,
    et l'action portait `timeout-minutes: 6`. Un cap de 6 min sur un travail de 8 min n'est
    pas un garde-fou, c'est une garantie d'échec — et elle détruisait `.next` en partant.
  - Gain : **16 min sur les 37** de Gate B, et le risque de destruction de `.next` disparaît
    avec l'étape. Verrouillé par `tests/unit/ci/harnais-e2e-mesure-vraiment.spec.ts`, qui
    refuse désormais le RETOUR de `size-limit-action`, et par
    `tests/unit/ci/gate-b-a-ses-services.spec.ts`, qui exige que toute étape placée après la
    suite E2E déclare `always()` ou `!cancelled()`.
- **🟢 2026-08-24 — `pnpm bundle:check` EST DÉSORMAIS BLOQUANTE.** L'étape « Poids du
  bundle » (0 min) ne porte plus `continue-on-error`. Une PR qui alourdit le bundle
  au-delà d'un cliquet **rougit maintenant pour de bon**. Le raisonnement qui la
  maintenait muette était un faux dilemme (« soit muette, soit bloquante à 100 KB et
  toutes les PR ferment ») : la troisième voie était d'**aligner le seuil sur la mesure,
  puis de bloquer** — c'est-à-dire la doctrine écrite deux paragraphes plus bas, jamais
  appliquée à ce bucket. Verrouillé par
  `tests/unit/ci/poids-du-bundle-garde-vraiment.spec.ts`, qui refuse le retour du
  `continue-on-error` ET un cliquet reposé sous la mesure.
- **⛔ CE QUI N'EST MESURÉ PAR AUCUNE GATE : le First Load JS PAR ROUTE** (la cible ≤ 75 KB
  gz ci-dessus). `size-limit` ne sait pas exprimer un budget par route sur un glob — il
  **SOMME**. Le bucket qui prétendait le faire s'appelait « page chunks individuels » et
  comparait 654 KB de somme à 75 KB par route : impossible à passer, et muet sur chaque
  route. Il est renommé en **cliquet anti-croissance** (limite 700 KB, calée sur la mesure).
  La doctrine renvoyait la question à Lighthouse ; Lighthouse n'y a jamais répondu. **Se
  mesure à la main** : `next build --experimental-build-mode compile` (~2 min) puis lecture
  de `.next/static/chunks/app/`.

  🔑 **Mais « à la main » ne vaut que pour les OCTETS, jamais pour le TEMPS** (mesuré le
  2026-09-03). Un poids de fichier est déterministe : une passe suffit, et un avant/après
  de deux builds compare bien deux versions du code. Une métrique de TEMPS ne l'est pas —
  sur le runner GitHub partagé, le TBT mobile des mêmes six pages a bougé de **+13 % à
  +36 %** entre deux runs du même jour, sans qu'une ligne de leur JavaScript ait changé
  (runs `33715874962` et `33743164143`). Un avant/après en deux passes ne distingue donc
  pas un patch de 40 KB d'une minute chargée sur la machine. **Les octets se lisent sur une
  passe ; le TBT, l'INP et le LCP se bornent sur plusieurs runs et se lisent en médiane** —
  c'est ce que fait `lighthouserc.postdeploy.mobile.json` (`aggregationMethod: median`,
  3 runs), et c'est pourquoi ses cliquets se calent sur le maximum observé de **deux** runs
  et non d'un seul.

- **⚠️ DETTE OUVERTE, CHIFFRÉE : le shell partagé pèse 135,75 kB.** Mesure de la dernière
  CI verte (run `32701301987`, 2026-08-24) : dépassement de **35,75 kB** sur la cible de
  100 KB (framework + main + main-app + webpack + polyfills, brotli). Ce bucket-là est
  honnête — cumulatif comme son nom l'annonce. ⚠️ Les deux chiffres qui circulaient
  auparavant dans ce fichier (135,78 puis 134,87) étaient tous les deux **faux** : lire la
  sortie de l'étape « Poids du bundle » d'un run récent, jamais cette page.
  Le bucket porte désormais un **CLIQUET à 138 KB** (mesure + ~2 KB de marge de bruit) et
  la **CIBLE de 100 KB reste écrite dans son nom**. Le cliquet n'excuse pas la dette : il
  empêche qu'elle grossisse, ce qui est le seul risque qu'une gate sache traiter. Abaisser
  ce seuil se fait APRÈS le travail de réduction — jamais avant, sous peine de rouvrir un
  rouge que personne ne peut fermer dans sa propre PR.
- ⚠️ **Le « bind loopback » n'a jamais existé** (mesuré le 2026-08-21). Ce paragraphe a
  affirmé que `next start` ne bindait pas sur 127.0.0.1 en CI. Il ne bindait rien parce
  qu'il n'avait **rien à servir** : l'étape `Bundle delta vs main` relançait `pnpm run build`
  dans le même répertoire juste avant, vidait `.next`, puis mourait en OOM — laissant le
  dossier sans `BUILD_ID`. Les 237 tests Playwright et les 5 URLs Lighthouse de Gate B
  mesuraient donc le vide (run 32443013208 : 209 failed, 0 passed).

Ne repassez pas les gates RETIRÉES (Lighthouse PR-time, `size-limit-action`) en bloquant
« au passage » : elles ne mesuraient pas leurs cibles. Et ne reposez jamais un ratchet sur
un seuil déjà dépassé — cela ouvre un rouge permanent sur toutes les PR. **Seuil aligné
d'abord, blocage ensuite** : c'est exactement ce qui a été appliqué au bucket « Shell
partagé » le 2026-08-24, et les cinq autres buckets étaient déjà verts sur la même mesure
(/appel 110 KB, somme anti-croissance 700 KB, /galerie 75 KB, /implantations 72 KB, et le
dernier à 30 KB) — l'étape est donc devenue bloquante **en passant**, ce qui est le seul
état dans lequel poser une gate.

Source de vérité : `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`.

## Build externalisé GitHub Actions + stubs Prisma/Redis (ADR 0026)

Depuis 2026-05-16 (recovery deploy), le build Docker est **externalisé sur GitHub Actions** (le VPS CPX42 ne suffisait plus, build SSG 17 629 routes saturait les 150 GB à ~117 GB peak). L'image est pushée sur GHCR public, et Coolify ne fait plus que `pull` via `Dockerfile.coolify-pull` (un-liner `FROM ghcr.io/will383842/axion-ia:latest`). Voir ADR 0026.

### ⚠️ Magic string `"stub.invalid"` — NE PAS TOUCHER sans propager

Le build GH Actions ne peut pas se connecter à la DB Postgres ni au Redis du VPS. Pour permettre `pnpm prisma:generate` + `pnpm build` (qui font des appels Prisma au SSG du sitemap/ressources/etc.), on injecte des **URLs stub** comme build-args :

```
DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub
REDIS_URL=redis://stub.invalid:6379
SKIP_ENV_VALIDATION=true
BULLMQ_DISABLED=true
```

Deux clients sont **stub-aware** au niveau singleton :

- **`src/lib/prisma.ts`** : si `process.env.DATABASE_URL?.includes("stub.invalid")`, retourne un Proxy qui short-circuit toutes les queries vers `[] / null / 0 / { _count: { _all: 0 } }`. Les mutations throw (au build aucun call ne devrait muter).
- **`src/lib/redis.ts`** : si `process.env.REDIS_URL?.includes("stub.invalid")`, retourne un Proxy qui répond à toutes les commandes par null/no-op.

En outre, `src/server/exporters/knowledge-rss.ts` + `knowledge-sitemap.ts` font un **early-exit** explicite si la magic string est détectée, pour éviter même l'instanciation lazy du client.

**Conséquences sur le SSG** :

- Pages DB-dependent (sub-sitemaps `knowledge-*`, `/[locale]/ressources`, etc.) sont rendues vides au build
- L'ISR `revalidate=3600` les repopule sous 1h en prod (DATABASE_URL réel injecté par Coolify au runtime)
- Pas de blocage du build entier sur un call DB

**Si tu touches au code de build, RESPECTE ce contrat** :

- ❌ NE PAS changer la string `"stub.invalid"` sans la propager dans `prisma.ts`, `redis.ts`, `knowledge-rss.ts`, `knowledge-sitemap.ts`, `Dockerfile`, `.github/workflows/deploy-coolify.yml`
- ❌ NE PAS retirer le check `SKIP_ENV_VALIDATION === "true"` dans `env.ts` (sinon build fail sur Zod validation des 8 secrets prod absents en GH Actions)
- ❌ NE PAS retirer `BULLMQ_DISABLED=true` du Dockerfile builder stage (sinon BullMQ tente d'initialiser une connexion Redis au SSG)
- ✅ Si une nouvelle page SSG fait un appel DB direct au build, vérifier que le stub Proxy couvre la méthode utilisée OU ajouter un `if (process.env.DATABASE_URL?.includes("stub.invalid")) return <fallback>` early-exit dans la page
- ✅ Tests Vitest tournent avec un PrismaClient mock distinct (pas affecté par le stub Proxy build-time)

### ⚠️ La durée du build a DÉRIVÉ — ~50 min, pas ~25

Ce paragraphe a annoncé « Job `build` (~25 min) » jusqu'au 2026-09-03. **C'est faux d'un
facteur deux**, et mesuré sur **trois runs**, par **deux sessions indépendantes**, en lisant
les `startedAt`/`completedAt` de chaque job — pas les bornes du run :

| Run                       | `Build & push image` | `Trigger Coolify deploy` | Total jusqu'à l'atterrissage |
| ------------------------- | -------------------- | ------------------------ | ---------------------------- |
| 33715874962 (`199d3978a`) | **48 min 59 s**      | 3 min 42 s               | ~53 min                      |
| 33683470223 (`4fc249110`) | **55 min 41 s**      | 7 min 44 s               | ~63 min                      |
| 33677644600 (`095d33ad0`) | **47 min 21 s**      | 4 min 12 s               | ~52 min                      |

**Build 47-56 min, atterrissage 52-63 min. Le plancher n'est jamais sous 47 : ne jamais
réserver un créneau de fusion à moins d'une heure.**

🔑 **Ce chiffre n'est pas une statistique de confort : c'est celui qu'on lit pour décider si
le créneau de fusion est libre.** Le workflow porte `concurrency: cancel-in-progress` —
fusionner pendant un build en vol le TUE, et la prod reste en arrière. Le 2026-09-03, une
session a réservé le créneau alors qu'un build tournait depuis 48 min : `gh pr list` ne
montre pas les déploiements en vol.

⚠️ **Deux précisions qui évitent de chercher au mauvais endroit :**

- **le job `deploy` n'est PAS le coupable.** Le « ~30 s à 28 min » annoncé plus bas est
  bon : mesuré 3 à 8 min sur les trois runs. **La dérive est entièrement dans le build** ;
- **`Lighthouse CI post-deploy` prend 25-26 min, mais il vient APRÈS l'atterrissage** : il
  n'entre pas dans le calcul du créneau. L'ajouter « par prudence » ferait attendre une
  demi-heure pour rien.

**Avant de réserver un créneau, lire l'état RÉEL, jamais ce fichier :**

```bash
gh run list --branch main --workflow "Build & Deploy · GHCR + Coolify (axion-ia.com)" --limit 1
curl -sI https://axion-ia.com/fr | grep -i x-axion-build-sha
```

La cause est structurelle (SSG de 17 629 routes), pas imputable à une PR : #947 était du
code serveur, 29 fichiers, aucune route nouvelle.

### Pipeline complet

1. `git push main` → workflow `.github/workflows/deploy-coolify.yml`
2. **Job `build`** (⚠️ **47-56 min mesurés**, pas ~25 — voir ci-dessus) :
   - Free disk space agressif (~75 GB free)
   - `docker build axionia/Dockerfile` avec build-args stubs
   - `docker push ghcr.io/will383842/axion-ia:{latest,sha-XXXXXXX,main}`
3. **Job `deploy`** (~30s à 28 min selon layers diff) :
   - POST Coolify `/api/v1/deploy`
   - Coolify build `Dockerfile.coolify-pull` (`FROM ghcr.io/...:latest`)
   - `docker pull` layers manquantes
   - Container restart + entrypoint `prisma migrate deploy` + healthcheck
4. **Job `purge`** : Cloudflare `purge_everything`
5. **Job `lhci`** : Lighthouse CI gate 5 URLs prod live

### 🔴 DEUX conteneurs, DEUX vitesses — le worker atterrit ~50 min AVANT l'app

Mesuré le 2026-09-04, en SSH, par deux sessions indépendamment, **sur le contenu et
pas seulement sur l'étiquette d'image** :

```
app    mqbmlz…-093012931326   SOURCE_COMMIT=c2de3f64d   → /app/server.js
worker oqj5ug…-093013729974   SOURCE_COMMIT=e349b02bd   → tsx src/server/queue/worker.ts
```

`e349b02bd` avait été fusionnée **trois minutes** plus tôt : son build GHCR démarrait à
peine. Les marqueurs de cette PR (`FENETRE_CONTACT_SUR_PLACE_JOURS`,
`DELAI_ANTI_DOUBLON_MS`, `libelleDelaiConvocation`) étaient bien présents dans
`/app/src/` du worker.

**La cause : les deux conteneurs ne se bâtissent pas de la même façon.**

| Conteneur           | Ce qu'il exécute                 | Comment il est bâti                | Délai après fusion |
| ------------------- | -------------------------------- | ---------------------------------- | ------------------ |
| **app** `mqbmlz…`   | `server.js` (Next standalone)    | image GHCR, GitHub Actions         | **47-56 min**      |
| **worker** `oqj5u…` | `tsx src/server/queue/worker.ts` | Coolify, depuis les SOURCES **TS** | **~3 min**         |

Le worker n'a **pas de build** : il interprète le TypeScript. Coolify le reconstruit
en quelques minutes depuis le dépôt, sans attendre le SSG des 17 629 routes.

⛔ **LE RISQUE, ET IL N'EST ÉCRIT NULLE PART AILLEURS.** Il existe une fenêtre de
~50 min après chaque fusion pendant laquelle **le worker exécute du code PLUS RÉCENT
que l'app**. Tout contrat partagé entre les deux y est dissocié :

- une **valeur d'énumération** ajoutée côté app et lue par le worker (ou l'inverse) ;
- la **forme d'un payload de job** BullMQ — un job posé par l'ANCIENNE app et consommé
  par le NOUVEAU worker ;
- une **colonne fraîchement migrée** : l'entrypoint qui migre est celui de l'**app**,
  donc le worker peut tourner du code qui attend une colonne que la migration n'a pas
  encore posée.

✅ **Ce qui n'est PAS concerné** : une PR qui ne touche ni migration, ni énumération,
ni forme de job. Les trois PR du 2026-09-04 (#978, #980, #981) étaient dans ce cas —
le risque est réel mais il attend une PR qui change un contrat app↔worker. **Une telle
PR doit être écrite pour tolérer les deux versions en vol pendant une heure**, pas
seulement pour être juste une fois l'atterrissage terminé. En pratique : ajouter avant
de lire, ne jamais retirer une valeur dans la même PR que son dernier usage.

🔑 **Vérifier un atterrissage demande donc DEUX contrôles, et ils ne concordent jamais
pendant une heure :**

```bash
# app — l'en-tête est baké au build, donc fidèle au CONTENU
curl -sI https://axion-ia.com/fr | grep -i x-axion-build-sha

# worker — l'étiquette d'image peut mentir ; lire le CONTENU
ssh root@178.105.55.15 'docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}"'
ssh root@178.105.55.15 'docker exec <worker> grep -rl "<marqueur de la PR>" /app/src'
```

⚠️ **Deux pièges de lecture :**

- L'**ancien conteneur d'app reste debout** quelques minutes après la bascule : un
  `grep <sha>` qui rend UNE ligne peut vouloir dire « à moitié déployé ». Repérer les
  conteneurs par leur préfixe — `mqbmlz…` porte `docker-entrypoint.sh`, `server.js` et
  `prisma-cli/` ; `oqj5ug…` porte `src/` et aucun `.next`.
- L'écart de **90 s** entre les deux bascules, mesuré le matin du 2026-09-04 et repris
  tel quel par trois sessions, était l'écart entre deux **redémarrages de conteneurs**
  — **pas** entre deux versions de code. Mesure juste, conclusion fausse.

### ⚠️ Un déploiement vert ne prouve PAS que le schéma a bougé

`scripts/docker-entrypoint.sh` lance `prisma migrate deploy` **en best-effort** : la
commande tourne dans un sous-shell `set +e`, avec un repli `npx prisma@5.22.0`, et **si
les deux échouent l'entrypoint logue un `WARNING` puis démarre Next.js quand même**. Le
`exec node server.js` final rend donc un code de sortie 0 à Coolify alors que la
migration n'est jamais passée.

Conséquence, et elle s'est déjà produite — incident du **2026-05-18**, raconté dans les
commentaires du `Dockerfile` (~l. 206 et 280) : des symlinks pnpm cassés empêchaient
`prisma migrate deploy` de s'exécuter, l'application tournait, et le **drift de schéma est
resté invisible jusqu'au crash de la console admin**, sur des requêtes portant des
colonnes absentes.

**Ce que chaque signal prouve, et ce qu'il ne prouve pas :**

| Signal                                         | Ce qu'il prouve                            | Ce qu'il ne prouve pas          |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------- |
| Job `deploy` vert                              | Coolify a accepté la commande              | que le conteneur a démarré sain |
| `x-axion-build-sha` à jour                     | l'**image** est servie                     | que le **schéma** a bougé       |
| `[entrypoint] Migrations applied successfully` | la commande a réussi                       | —                               |
| `prisma migrate status`                        | le journal `_prisma_migrations` est à jour | —                               |

**Après tout atterrissage qui porte une migration, vérifier** (accès SSH VPS requis) :

```bash
# 1. Identifier le conteneur applicatif — l'image porte le SHA du commit.
#    ⚠️ Il y a DEUX conteneurs applicatifs ; un seul porte les lignes d'entrypoint.
ssh -o BatchMode=yes root@178.105.55.15 'docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}"'

# 2. Ce que l'entrypoint a fait. Échec = « WARNING: prisma migrate deploy failed … AND npx ».
docker logs <conteneur> 2>&1 | grep entrypoint

# 3. Preuve par le schéma, lecture seule sur la vraie base de production.
docker exec <conteneur> /app/prisma-cli/node_modules/.bin/prisma migrate status \
  --schema=./prisma/schema.prisma
```

⚠️ `migrate status` lit la table `_prisma_migrations`. Sur une base dont le schéma a été
posé autrement (certaines bases de développement), elle annonce « N migrations non
appliquées » alors que toutes les tables sont là. En production c'est un non-sujet —
l'entrypoint migre depuis l'origine — mais si la réponse paraît absurde, c'est la piste.
La preuve dure reste l'existence de la colonne elle-même.

**Si la migration n'est pas passée**, le filet est documenté par l'entrypoint lui-même :

```bash
gh workflow run admin-emergency-migrate.yml -f action=migrate
```

### Modifs Coolify côté plateforme

- `build_pack` : `dockerfile` (inchangé)
- `dockerfile_location` : `/Dockerfile.coolify-pull` (set via API PATCH 2026-05-16)
- ⚠️ Si quelqu'un change `dockerfile_location` via Coolify UI → retour mode build local sur VPS → re-saturation disque CPX42. Surveiller.

## EN locale désactivé (2026-05-16) — procédure de re-enable

Le 2026-05-16, le locale EN a été désactivé suite à un bug pré-existant next-intl v4.11 / Next.js 16.2 (boucle 307 self-redirect sur les routes EN ayant un `pathnames` mapping FR≠EN). Le bug était masqué par CF Managed Challenge ; après désactivation du challenge, il est devenu visible.

**État actuel** :

- `routing.ts` déclare toujours `locales: ["fr", "en"]` + tous les `pathnames` mappings (rien retiré)
- Tous les messages EN (`messages/en.json`) restent en place
- Toutes les pages SSG continuent à pré-renderer en FR + EN
- Mais `src/proxy.ts` intercepte tout `/en/*` au runtime et émet un **301** vers l'équivalent FR via `mapEnToFr()` (cf. `src/lib/i18n/en-to-fr-redirect.ts`)

**Pour réactiver EN (quand le bug next-intl sera fixé)** :

1. Set env var Coolify `EN_LOCALE_ENABLED=true` (Application → Env vars → New → key `EN_LOCALE_ENABLED`, value `true`, scope RUN)
2. Restart container (Coolify → Restart)
3. ✅ EN re-actif. Vérifier `/en/about` → 200 (au lieu de 301 vers `/fr/a-propos`)

**Si tu veux purger les EN URLs de Google Search Console** (recommandé après ≥4 semaines de 301) :

1. GSC → Indexing → Pages → filter par /en/\*
2. Mark as resolved (les 301 vers FR feront le boulot SEO long-terme)

**Si tu veux RETIRER complètement EN du code** (pas recommandé sauf décision définitive) :

1. `routing.ts` : `locales: ["fr"]`
2. Supprimer toutes les entrées `en:` dans `pathnames`
3. Supprimer `messages/en.json`
4. Retirer hreflang `en` des metadata (`src/lib/seo.ts`)
5. Retirer les sub-sitemaps EN de `app/sitemap.ts`
6. Retirer le proxy.ts redirect block

Effort de retrait complet : ~4-6 h. **Mieux vaut garder la toggle env-flag** sauf raison forte de simplifier le code.

### Bug pré-existant next-intl à fixer avant ré-activation

Le bug 307 self-loop apparaît quand :

- next-intl v4.11+ + Next.js 16.2+
- `localePrefix: "always"`
- Route a un `pathnames` mapping avec `fr ≠ en`
- Locale non-default (en) demandé

Symptôme : `/en/about` retourne `307 → /en/about` (loop infini) avec `x-middleware-rewrite: /en/a-propos` (la rewrite interne marche, mais Next émet aussi un 307 vers la même URL).

Fix probable : upgrade next-intl ou downgrade Next, OU patch custom dans le middleware. À investiguer en Sprint dédié quand re-activation EN devient prioritaire.
