# Console éditoriale — lot 0 · rapport de lot

_Session des 20 et 21 août 2026. Branche `feat/console-editoriale`, base `09f7500fa`._

Ce document est le **rapport de lot** exigé au §7.9 du protocole : ce qui a été
fait, ce qui a été vérifié **et comment**, ce qui reste ouvert, ce qui a surpris.

---

## 1. Le verrou de la session précédente est levé

La session du 20 août s'était arrêtée sur une machine qui ne pouvait pas
démarrer Docker : `vmcompute.exe` absent malgré un DISM « réussi ». La cause
était le **démarrage rapide de Windows**, qui transforme « Arrêter puis
rallumer » en démarrage hybride et n'honore pas les opérations en attente.

Le témoin, au retour — et c'est lui qui fait foi, jamais le message de DISM :

```
vmcompute.exe : True
service vmcompute : Running
wsl --status → « Version par défaut : 2 »   (plus aucune mention de virtualisation)
```

Docker Engine **29.7.2** démarre. Postgres 5433, Redis 6381, Mailhog 8025 sont
`healthy`.

---

## 2. Les six critères du §7, un par un

| #   | Critère                                                   | État | Preuve                                                                                                                                         |
| --- | --------------------------------------------------------- | :--: | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `migrate` passe sur une **base vierge**                   |  ✅  | Volume Docker **détruit** (`pnpm db:reset`), puis 192 migrations appliquées dont la mienne — « All migrations have been successfully applied » |
| 2   | L'import crée **61 publications + 13 reprises** + rapport |  ✅  | `pnpm editorial:import` → 61 / 13 / 31 assets / 0 erreur, rapport affiché                                                                      |
| 3   | Un second import affiche « déjà effectué », ne crée rien  |  ✅  | 2ᵉ lancement → « déjà effectué le … », `count(*)` reste **74**                                                                                 |
| 4   | Septembre affiche **15 publications aux bonnes dates**    |  ✅  | 15 lignes sur le profil, du 01/09 au 21/09, jours ouvrés, **aucun décalage de fuseau**                                                         |
| 5   | Le filtre « identité = pro » n'affiche que la page        |  ✅  | `pro` → 13 lignes, toutes sur « LinkedIn — Page Axion-IA »                                                                                     |
| 6   | Le poids de la route est **mesuré et consigné**           |  ✅  | **161,8 kB gz**, identique à `alerts` et `activity-logs` — **delta 0 octet**. §6                                                               |

### Sur le critère 4, une nuance à ne pas maquiller

Septembre compte **15** publications sur le profil personnel et **19** toutes
identités confondues : quatre échos de page tombent aux mêmes dates. Ce ne sont
pas des doublons — le §1 bis est explicite, un écho est **une seconde
diffusion**, avec ses propres métriques, liée par `sourceId`. Le critère est
donc tenu, et la vue non filtrée a raison d'en montrer 19.

---

## 3. L'état de référence, relevé AVANT

Le protocole insiste : une erreur préexistante n'est pas la vôtre, et
l'attribuer fait perdre une heure.

| Suite            | `main` @ 09f7500fa                                                  | Après le lot                                                                                   |
| ---------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm typecheck` | 0 erreur                                                            | **0 erreur**                                                                                   |
| `pnpm lint`      | 0 erreur, **39 avertissements**                                     | **0 erreur, 39 avertissements**                                                                |
| `pnpm test`      | **814 fichiers · 23 403 réussis · 7 ignorés · 0 échec** _(1 264 s)_ | **818 fichiers · 23 514 réussis · 7 ignorés · 0 échec** _(1 223 s)_                            |
| `pnpm build`     | **jamais relevé** — et il ÉCHOUAIT déjà, en OOM _(voir §7)_         | **`next build` vert** : 11 310 pages générées, tableau des routes émis, les deux routes en `ƒ` |

Les baselines `test` et `build` manquaient à la session précédente : **`test`
est désormais relevé**, et l'écart d'avertissements de lint est **nul** — le lot
n'en ajoute aucun.

### Le delta de tests, au test près

```
linkedin-q4.spec.ts    35 tests    conversion, BOM, CRLF, « ; » cité, dates, cas refusés
conformite.spec.ts     32 tests    les 12 règles du §8 : chacune passe ET refuse
amorcage.spec.ts       26 tests    fidélité des référentiels au §1 bis et au §9
calendrier-pur.spec.ts 18 tests    bornage des paramètres d'URL, bords d'année
                      ─────────
                       111 tests
```

23 514 − 23 403 = **111**. Le compte tombe juste : aucun test existant n'a été
modifié, aucun n'a disparu.

---

## 4. Ce qui a été écrit

| Domaine         | Fichier                                                                                   | Rôle                                                |
| --------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Schéma          | `prisma/schema.prisma`                                                                    | 37 objets `Ed*` (24 tables + 13 énumérations)       |
| Migration       | `…/20260821000000_console_editoriale_lot_0/migration.sql`                                 | **624 lignes, 100 % additives, zéro `DROP`**        |
| Référentiels    | `src/server/editorial/referentiels/{comptes,conformite,alertes,familles}.ts`              | Jeux d'amorçage, modules **purs**                   |
| Amorçage        | `prisma/seeds/editorial/index.ts`                                                         | Idempotent, non destructif, **vérifie ses comptes** |
| Analyse         | `src/server/editorial/import/linkedin-q4.ts`                                              | CSV/Markdown → objets, module **pur**               |
| Import          | `prisma/seeds/editorial/import-linkedin.ts`                                               | Transactionnel, idempotent, non répétable           |
| Fixture         | `scripts/editorial/generer-fixture-linkedin.ts` + `tests/fixtures/editorial/linkedin-q4/` | Déterministe, BOM + CRLF + `;`                      |
| Lectures        | `src/server/editorial/queries.ts`                                                         | Server-only, aucune mutation                        |
| Écrans          | `…/console-editoriale/{page.tsx,calendrier/page.tsx}`                                     | **Server Components, zéro JS client**               |
| Tests unitaires | 3 fichiers `*.spec.ts`                                                                    | **93 tests**                                        |
| Tests E2E       | `tests/e2e/console-editoriale.spec.ts`                                                    | Gardes + parcours + état vide + clavier             |
| Skill           | `.claude/skills/axionia-editorial/SKILL.md`                                               | Les pièges, pour ne pas les repayer                 |

---

## 5. Les écarts au plan, assumés et déclarés

| #   | Écart                                                   | Pourquoi                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Les clés étrangères « nues » du plan sont **déclarées** | Un identifiant qui pointe dans le vide est un bug silencieux, et le lot 0 est le seul moment où l'ajouter ne coûte pas de migration destructrice                                                                                   |
| 2   | `motif_regex` → `motifRegex @map("motif_regex")`        | Même colonne SQL, nommage aligné sur les 227 autres modèles                                                                                                                                                                        |
| 3   | `EdMembre.email` en `Citext`                            | Un `@unique` sur du VarChar laisse coexister `Will@x` et `will@x`                                                                                                                                                                  |
| 4   | **`EdRegleConformite.parametres Json?` ajouté**         | Trois des douze règles (`tags-nombre`, `tags-liste`, `mentions`) portent des **seuils** qu'aucun motif ne peut exprimer. Sans ce champ, la fourchette 3–4 et la liste des 17 tags vivraient dans le code — le protocole l'interdit |
| 5   | **`EdCompte.slug` ajouté**                              | `EdMarque`, `EdPilier`, `EdFamille` et `EdSerie` en ont un ; `EdCompte` était le seul référentiel sans clé naturelle, donc sans amorçage idempotent possible                                                                       |
| 6   | **`SiteSettingCategory.editorial` ajouté**              | Même réutilisation de `SiteSetting` que `qualiopi` et `prospection`, plutôt que de surcharger `general`                                                                                                                            |
| 7   | Segment de route `console-editoriale`                   | Décision §14 #3 — le plan écrit `editorial` au §3, la décision fait foi                                                                                                                                                            |
| 8   | `.gitignore` : `.claude/` → `.claude/*` + négation      | Le protocole fait du skill un critère de livraison ; ignoré, il serait resté sur une seule machine. Worktrees et état de session restent ignorés                                                                                   |

Les écarts 4, 5 et 6 sont des **changements de modèle**. Le §8 du protocole
impose de remonter à l'humain « si le modèle doit changer **après** le lot 0 » :
nous sommes **dans** le lot 0, c'est-à-dire au seul moment où ces ajouts sont
gratuits. Ils sont donc décidés, faits, et déclarés ici.

⚠️ `prisma format` a réaligné **12 lignes du modèle `SiteRoute`** (champs `og*`)
lors de la session précédente. Bruit cosmétique, aucune sémantique changée — à
assumer explicitement en revue, ou à restaurer.

---

## 6. Poids des routes — la mesure

### 🔴 D'abord : le build ne PUBLIE PAS le First Load JS

Le tableau des routes de ce projet n'imprime que `Revalidate` et `Expire` :

```
Route (app)                                          Revalidate  Expire
├ ƒ /[locale]/[adminPrefix]/console-editoriale
├ ƒ /[locale]/[adminPrefix]/console-editoriale/calendrier
```

**Aucune colonne `Size` ni `First Load JS`.** Le critère « le poids de la route
est mesuré et consigné » ne peut donc pas être satisfait en lisant la sortie du
build — et une revue qui écrirait « voir le tableau du build » n'aurait rien
mesuré du tout.

La mesure est faite **depuis les manifestes**, en gzippant réellement les
chunks : pour chaque route, les modules clients de son
`page_client-reference-manifest.js`, résolus dans `.next/static`.

### Le relevé, avec deux routes existantes en témoin

| Route                                                        | Chunks | First Load JS (gz) |     Brut |
| ------------------------------------------------------------ | -----: | -----------------: | -------: |
| `/[adminPrefix]/console-editoriale` **(nouveau)**            |     25 |       **161,8 kB** | 514,0 kB |
| `/[adminPrefix]/console-editoriale/calendrier` **(nouveau)** |     25 |       **161,8 kB** | 514,0 kB |
| `/[adminPrefix]/alerts` _(témoin existant)_                  |     25 |           161,8 kB | 514,0 kB |
| `/[adminPrefix]/activity-logs` _(témoin existant)_           |     25 |           161,8 kB | 514,0 kB |

### Le chiffre qui compte : le delta est NUL

Le chunk propre à chaque route, isolé :

| Route                           | Chunk propre |         Brut |    Gzippé |
| ------------------------------- | -----------: | -----------: | --------: |
| `console-editoriale`            |            1 | 1 766 octets | **807 o** |
| `console-editoriale/calendrier` |            1 | 1 766 octets | **808 o** |
| `alerts` _(témoin)_             |            1 | 1 766 octets |     808 o |

C'est **le même talon vide** que porte déjà toute route RSC de la console : les
deux écrans n'embarquent **aucun composant client**. Vérifié à la source —
aucun `"use client"` dans les deux `page.tsx`, et les huit primitives
importées (`AdminPageShell`, `AdminPageHeader`, `AdminCard`, `AdminBadge`,
`AdminEmptyState`, `AdminStatCard`, `AdminButton`, `MonthGridCalendar`) sont
**toutes des Server Components**. Le filtre perso/pro est une série de liens,
pas un état client.

**Delta apporté par le lot : 0 octet.**

### Ce que ce chiffre dit AUSSI, et qu'il ne faut pas taire

Les 161,8 kB gz ne respectent pas le budget de 75 kB du `AGENTS.md` — mais ils
sont **le coût préexistant du shell d'administration**, payé à l'identique par
`alerts` et `activity-logs`. Le `AGENTS.md` le documente déjà : le bucket
« Shell partagé » mesure 134,87 kB réels pour une limite affichée à 100 kB.

Ce lot **n'aggrave pas** la situation d'un octet. La corriger est un autre
chantier, qui ne se règle pas dans un lot éditorial — et les gates de budget
étant en `continue-on-error`, rien n'aurait signalé le contraire.

---

## 6 bis. La passe 3 — l'interface, par le navigateur

```
9 passed (1.0m)   —   npx playwright test tests/e2e/console-editoriale.spec.ts
```

| Test                                                      | Ce qu'il prouve                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| tableau de bord / calendrier sans session → `/login`      | La garde d'authentification tient                                 |
| `?month=99`, `?month=-4`, `?year=abcd`, `?month=0&year=1` | Une URL hostile ne blanchit pas la page                           |
| le tableau de bord affiche ses compteurs                  | 74 publications, 4 mois — **par l'écran**, plus seulement par SQL |
| septembre montre 15 publications du profil                | **Critère 4, vérifié dans le navigateur**                         |
| le filtre « pro » n'affiche que la page                   | **Critère 5, vérifié dans le navigateur**                         |
| l'état vide explique quoi faire                           | Exigence de la passe 3                                            |
| le filtre se parcourt au clavier                          | Exigence de la passe 3                                            |
| le filtre actif porte `aria-current`                      | Un lecteur d'écran distingue le filtre actif                      |

L'instantané de page rendu par Playwright confirme les quatre mois :
**19 / 20 / 19 / 16** — exactement ce que rendait la requête SQL.

### 🔴 Ce que cette passe a révélé : la connexion E2E était morte

`loginAsAdmin` — la fixture **partagée** de tout le dépôt — ne pouvait
**pas** aboutir, pour deux raisons cumulées :

1. `getByLabel(/mot de passe/i)` résolvait **deux** éléments : le champ, et le
   bouton afficher/masquer dont l'`aria-label` vaut « Afficher le mot de
   passe ». En mode strict, Playwright refuse d'agir sur un locator ambigu.
2. La vérification d'arrivée n'acceptait que `/fr/${ADMIN_PREFIX}`, alors que
   l'application atterrit sur `/${ADMIN_PREFIX}` — **sans** `/fr`.

Conséquence : la fixture levait **toujours**, et les quatre autres fichiers E2E
qui l'appellent se **sautaient en silence**. Une couverture qui n'en était pas
une, et qui ne rougissait jamais — le « témoin négatif qui ne vaut rien » du §1
du protocole, en vrai.

Les deux sélecteurs sont corrigés dans `tests/e2e/fixtures/admin-auth.ts`.

> ⚠️ **Ce correctif démasque des tests. C'est une décision à prendre.**
>
> Une fois la connexion réparée, deux tests préexistants **s'exécutent enfin —
> et échouent** :
>
> | Test                            | Cause observée                                               |
> | ------------------------------- | ------------------------------------------------------------ |
> | `admin-booking-flow.spec.ts:29` | `page.goto` → `net::ERR_ABORTED`, dépassement à 30 s         |
> | `admin-nav-clic.spec.ts:87`     | « 70 entrée(s) de navigation en panne », dépassement à 600 s |
>
> **Aucun des deux ne mentionne `console-editoriale`** : ce lot ne les casse
> pas, il les rend visibles. Et les deux causes sentent le **serveur de dev** :
> `playwright.config.ts` lance `pnpm dev` en local (compilation à la
> première requête, 72 entrées de navigation à visiter) mais `pnpm start` en
> CI, où rien ne se compile. **Il faut donc les rejouer en CI avant de conclure
> quoi que ce soit** — je ne les déclare ni cassés ni sains.
>
> Trois issues possibles, et c'est à Will de trancher : garder le correctif
> dans cette PR et traiter les deux tests, le sortir dans une PR dédiée, ou
> marquer les deux tests `fixme` en attendant. **Je n'ai pas tranché seul :
> réparer une fixture partagée dépasse le périmètre d'un lot éditorial.**

---

## 7. Ce qui a surpris

### 🔴 Le diff Prisma voulait détruire les index vectoriels

`prisma migrate diff --from-schema-datasource` a produit **73 lignes de DDL
destructif qui ne sont pas les nôtres** : `DROP INDEX` sur les index HNSW de
pgvector, `DROP COLUMN` sur `keywords.locked_by` et `locked_until`, des dizaines
de `DROP DEFAULT`.

Ce n'est pas une régression : c'est une **dérive préexistante et normale** entre
les migrations et `schema.prisma`, parce que les colonnes `vector` / `tsvector`
et les index HNSW sont créés en SQL brut et que le datamodel Prisma ne sait pas
les exprimer. Embarquée dans ce lot, elle aurait détruit la recherche sémantique
en production **au nom d'un lot éditorial**.

**Parade retenue, versée au skill** : diffuser **schéma contre schéma**
(`git show HEAD:prisma/schema.prisma`), jamais depuis la base, puis vérifier
`grep -c 'DROP' migration.sql` → **0** avant d'installer.

### 🔴 Un test a trouvé un bug qui vidait les 61 premiers commentaires

Le motif qui repère l'intertitre « Premier commentaire » s'écrivait avec `\s*`.
Or `\s` **contient le saut de ligne**, et le quantificateur gourmand faisait
déborder le marqueur sur la ligne suivante : il avalait le commentaire qu'il
devait introduire, qui repartait **vide** — pour les 61 publications, en
silence. Corrigé en `[ \t]`.

C'est exactement ce que le protocole promet : « le test qui compte est celui du
cas refusé ».

### `pnpm build` échouait déjà sur cette machine, avant ce lot

Premier lancement : **OOM à 3 min 30**, tas Node par défaut (4 Go) contre
17 629 routes — `Next.js build worker exited with code: 134`. La baseline
`build` n'ayant **jamais** été relevée, rien ne l'avait révélé : ce n'est pas
une régression du lot, c'est un état préexistant que le lot a mis au jour.

Avec `--max-old-space-size=8192` et les URL stub de la CI (ADR 0026), le build
passe : **11 310 pages statiques générées**, tableau des routes émis. Le build
occupe alors ~6 Go et ne laisse qu'~1 Go libre — ne rien lancer d'autre pendant.

⚠️ Le `postbuild` (précompression brotli des assets statiques) a été
**interrompu volontairement** après 1 122 fichiers : c'est une étape de
déploiement sans rapport avec ce lot, et elle monopolisait la machine. `npm`
n'exécutant `postbuild` **qu'après un `build` réussi**, la réussite de
`next build` est acquise.

### `prisma migrate dev` est inutilisable en non-interactif

Il refuse de tourner sans TTY. Le couple `migrate deploy` + `migrate diff` le
remplace intégralement, et se scripte.

### Le harnais mange les antislashs des heredocs

Y compris entre `<<'EOF'`. Une classe `[̀-ͯ]` est arrivée dans le
fichier sous forme de caractères combinants **invisibles**, et un `[ \t]` sous
forme de tabulation littérale. Parade : `String.fromCharCode(92)` et des
remplacements **littéraux** (`split`/`join`), jamais de `RegExp` construite dans
un heredoc.

---

## 8. Ce qui reste ouvert — et ce que ce lot ne prouve pas

### 🔴 L'import n'a PAS été rejoué sur les vraies données

Les sources du §6 — `Linkedin complet.zip`, `02-calendrier-publication.csv`,
`10-LES-61-POSTS.md` — restent **introuvables** sur cette machine. Tout ce qui
précède est vérifié sur une **fixture fidèle au format décrit au §6**, pas sur
le dossier réel.

Ce que la fixture prouve : le format est lu (BOM, CRLF, `;` dans une cellule
citée, guillemets doublés), l'import est idempotent, transactionnel, et rend le
bon compte.
**Ce qu'elle ne prouve pas** : que les vraies données passent. Les critères 2, 3
et 4 devront être **rejoués** dès que les fichiers seront fournis. Le dire
maintenant coûte moins cher que de le découvrir au lot 1.

### Décisions du §14 encore ouvertes

| #   | Question                                  | Échéance                                  |
| --- | ----------------------------------------- | ----------------------------------------- |
| 1   | TikTok perso ou pro                       | avant lot 5e                              |
| 4   | La liste définitive des piliers           | lot 1 — **0 pilier semé**, volontairement |
| 5   | L'outil d'envoi de la newsletter Williams | avant le 11 octobre                       |

### Une destination de lien n'existe pas encore

La colonne `lien` du CSV connaît `reservation` → `/appel` et `candidature` →
`/carrieres`, deux routes **vérifiées dans `routing.ts`**. `newsletter` n'a
aucune route : le compte n°9 est « à créer, jalon du 11 octobre ».

L'import laisse donc `lienUrl` à `null` et **le signale** (9 avertissements sur
la fixture) plutôt que d'inventer une URL. Conséquence voulue : la règle `utm`
bloquera la validation de ces publications tant que la page n'existe pas.
Inventer une URL aurait rendu la règle verte sur une page inexistante — une
garde qui ne garde rien.

---

## 9. Les onze points « production ready » — état honnête

- [x] Aucune erreur de typage ni de lint **nouvelle** par rapport à `main`
- [x] La suite complète passe, **et la baseline de `main` a été relevée avant**
- [x] La migration s'applique sur une **base vierge** _(volume détruit)_
- [x] Toute règle métier vit **en base** — un test le vérifie
- [x] Les états **vide** et **erreur** existent sur chaque écran, **et la passe 3 les rejoue** (9 tests verts)
- [x] Le skill `axionia-editorial` est écrit **et rendu partageable**
- [x] **Poids de chaque route touchée mesuré et consigné** → §6, delta **0 octet**
- [ ] La migration sur une **base existante** — appliquée une fois sur base déjà
      migrée, mais non rejouée sur une copie de production
- [x] **Toute mutation journalisée dans `EdJournal`** — vérifié en base :
      `select count(*) from ed_journal` → **74**, pour 74 publications. Couverture
      1:1. Le lot 0 n'a pas d'autre mutation, les Server Actions arrivant au lot 1
- [ ] Les critères cochés par **quelqu'un qui n'a pas codé** — passes 2 et 5 du
      protocole (vérificateur, puis second vérificateur à l'aveugle) : **non
      faites**, un seul agent a tenu tous les rôles
- [x] **Rollback décrit** → §10

**Neuf points sur onze.** Les deux qui manquent sont nommés ci-dessus.

> ⚠️ **Le lot n'est donc pas « livré » au sens des onze points.** Les passes 4
> (adversariale), 5 (croisée) et 6 (bout en bout cumulé) supposent une
> hiérarchie d'agents que cette session n'a pas mobilisée. Écrire « livré »
> ici serait exactement la gate verte qui ne garde rien.

---

## 10. Rollback

Le lot est **entièrement additif** : 24 tables neuves, 13 énumérations neuves,
une valeur d'énumération ajoutée, deux colonnes ajoutées à des tables **neuves**,
zéro modification d'une table existante.

| Si…                                   | Alors                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Les écrans cassent                    | Supprimer les deux `page.tsx`. Aucune autre route n'en dépend — rien n'y mène encore depuis la navigation                                                                |
| La migration doit être annulée        | `DROP TABLE ed_*` (24) puis `DROP TYPE "Ed*"` (13). Aucune table existante n'est touchée, donc **aucune perte de donnée hors console éditoriale**                        |
| `SiteSettingCategory.editorial` gêne  | Une valeur d'énumération Postgres ne se retire pas simplement ; elle est inerte si aucune ligne ne la porte. Supprimer la clé `editorial.import.linkedin-2026-q4` suffit |
| L'import a versé de mauvaises données | `DELETE FROM ed_publications WHERE ref_import LIKE 'linkedin-2026-q4-%'` puis supprimer le marqueur `SiteSetting` — l'import redevient rejouable                         |

**Le déploiement ne casse rien s'il n'est pas terminé** : sans amorçage, les
écrans affichent leur état vide, qui explique quoi lancer.
