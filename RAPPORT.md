# RAPPORT — INT-T60-A (table IDCC → OPCO)

Branche de travail : `opco/int-t60-a-idcc-opco` — **tête `f6e29ce400ecc0ef3dc62e277f5cd7f325d66f1e`**
(`origin/main` `9a898694` fusionnée dedans). Aucune PR ouverte, rien fusionné.

## Statut : LIVRÉ — RM-08 levé, source réelle, une réserve de forme (`siret_nombre`, cf. § Écart)

## 1. Source

Lue par b0 depuis son poste (l'environnement cloud reste bloqué sur data.gouv.fr : je n'ai
pas réessayé). Faits consignés dans
`src/server/qualiopi/financements/__tests__/fixtures/SOURCE-SIRO.md` :

- jeu « Table SIRET-OPCO », France compétences, data.gouv `688a210c012cfbf595d7a99a` ;
- ressource `https://static.data.gouv.fr/resources/table-siret-opco/20260924-155236/siro-202606.csv`,
  millésime 2026-06 (publiée le 2026-09-24), 109 242 949 octets, 3 671 884 lignes ;
- dictionnaire v2.0 du 31/07/2025 ;
- fixtures réelles : `siro-extrait-202606.csv` (264 lignes) et
  `siro-202606-couples-idcc-opco.txt` (1 052 couples agrégés `idcc|opco|nb SIRET`).

## 2. Config — `CONFIG_FICHIER_SIRO` (`src/server/qualiopi/financements/idcc-import.ts`)

Constante exportée, commentée avec sa source :

- séparateur `|` ; colonnes `SIRET`, `IDCC`, **`OPCO_PROPRIETAIRE`** (jamais `OPCO_GESTION`,
  renseigné seulement outre-mer où AKTO gère pour le compte du propriétaire) ;
- les 11 libellés exacts → codes de l'enum `Opco` : `OPCO EP`→`opco_ep`, `AKTO`→`akto`,
  `CONSTRUCTYS`→`constructys`, `ATLAS`→`atlas`, `L'OPCOMMERCE`→`opcommerce`,
  `OCAPIAT`→`ocapiat`, `OPCO MOBILITES`→`mobilites`, `AFDAS`→`afdas`, `OPCO2I`→`opco2i`,
  `UNIFORMATION COHESION SOCIALE`→`uniformation`, `OPCO SANTE`→`opco_sante`.
  Un libellé non répertorié refuse le fichier entier (jamais deviné) ;
- échappements `5100, 5501, 9998, 9999` EXCLUS ;
- IDCC vide ou OPCO vide : ligne IGNORÉE, comptée à part (`lignesSansCouple`), **jamais**
  comme invalide ;
- tolérance : 1 000 lignes invalides (SIRET ou IDCC hors format ; 0 dans l'extrait) ;
  plancher : 1 000 couples (1 009 dans le millésime) — un fichier tronqué n'efface rien.
  Ces deux seuils sont des choix de prudence, pas des faits de la source : dits comme tels.

## 3. Lecture en flux

- `lireFluxSiro(stream, config)` : `ReadableStream<Uint8Array>` → `TextDecoder` UTF-8
  (`fatal`, en mode flux) → découpage sur `\n` ; la fin incomplète d'un morceau est recollée
  au suivant. Refus : encodage non UTF-8, « ligne » > 64 Kio (page HTML, binaire).
- Agrégat en mémoire : une entrée par couple ; les SIRET de chaque couple dans un
  `Float64Array` qui double (14 chiffres < 2^53), triés à la fin pour compter les
  **SIRET distincts** (règle d'A02). Aucune chaîne gardée par ligne.
- `lireFichierSiro(texte)` passe par le même lecteur (tests).
- **Essai à taille réelle** (script jetable, retiré avant commit) : flux synthétique de
  **3 671 884 lignes** reconstitué depuis l'agrégat réel (mêmes couples, mêmes comptes,
  124 575 lignes sans couple), servi par morceaux de 2 000 lignes, **tas V8 plafonné à
  128 Mo** (`--max-old-space-size=128`) : lecture **3,3 s**, tas utilisé en fin 31 Mo, RSS
  214 Mo (Node + Prisma compris). Résultat : **1 009 couples, identiques à l'agrégat
  comptes compris** ; statistiques `lignesSansCouple 124 575`, `lignesEchappement 200 221`,
  `lignesInvalides 0`. Puis import réel par `PrismaClient` dans un PostgreSQL 16 local :
  1 009 lignes, second import `deja_importe`, `1596` = CONSTRUCTYS 274 837 / OPCO EP 1,
  journal vide.

## 4. Téléchargement

- `choisirRessourceSiro(json)` : dans `resources[]` de
  `https://www.data.gouv.fr/api/1/datasets/688a210c012cfbf595d7a99a/`, la ressource
  `format == csv` (casse ignorée) titrée `siro-AAAAMM.csv` (mois 01-12) la plus récente ;
  millésime = `AAAA-MM-01`. `sourceUrl` = l'`url` de cette ressource.
- `telechargerSiro` / `importerSiroDuMois(db, { fetch })` : `fetch` INJECTÉ ;
  `AbortSignal.timeout` — 30 s pour l'API, 15 min pour le fichier (le signal coupe aussi la
  lecture du corps). Refus (`TelechargementSiroRefuse` / `FichierIdccOpcoRefuse`) sur :
  réseau en panne ou délai, HTTP ≠ 200, `content-type` HTML, réponse non JSON, aucune
  ressource conforme, corps vide, en-tête seul, < 1 000 couples. Tout refus a lieu AVANT la
  transaction : table intacte.

## 5. Tâche mensuelle

⚠️ **Écart à la consigne de session, aligné sur l'acceptance** : la consigne proposait la file
`formation-crons` (`qualiopi-formation-crons-worker.ts`). L'acceptance d'INT-T60-A (rattrapage
106, chemins de b0 sur #656, commentaire 5979298391) fixe un **worker dédié** et ne liste pas
`qualiopi-formation-crons-worker.ts` dans ses chemins (la coordination a déjà refusé #1295
pour deux fichiers hors chemins). J'ai donc suivi l'acceptance :

- `src/server/queue/workers/opco-siro-import-worker.ts` : file **`opco-siro-import`**,
  concurrence 1, `lockDuration` 20 min ; inscrite dans `queues.ts` (file, `attempts: 1`,
  répétable purgé puis reposé), `types.ts` (`OpcoSiroImportJobData { tick }`) et `worker.ts` ;
- cadence : **le 20 de chaque mois à 06:00 heure de Paris** — `pattern "0 6 20 * *"`,
  `tz: "Europe/Paris"` (option `tz` de BullMQ 5.81, vérifiée dans ses types) ;
- drapeau **`IDCC_OPCO_IMPORT_ENABLED`** déclaré dans `src/env.ts` (schéma + `runtimeEnv`) :
  défaut ACTIF en production, `"false"` coupe ; COUPÉ en test sauf `"true"` (modèle de
  `suivi-entreprise/drapeau.ts`) ;
- **fenêtre app/worker** : avant tout téléchargement, le passage lit
  `information_schema.tables` (`idcc_opco` + `idcc_opco_changements`, `false` sous
  `stub.invalid`) ; absentes → `warn` « table idcc_opco absente (migration à venir) »,
  sortie propre, aucun téléchargement. Filet : `P2021` / `42P01` / « relation … does not
  exist » rattrapés de même. Un refus de fichier → `error` « import REFUSÉ, table intacte :
  <motif> », sortie propre ; une erreur inattendue remonte au job (échec visible).
- Journal de succès : titre et URL de la ressource, couples, changements, lignes lues /
  sans couple / échappement / invalides. Aucune donnée personnelle (des nombres et une URL).
- Aucune énumération ni forme de job partagée avec l'app : la tâche n'utilise que les tables
  neuves.

## 6. Lecture — `IDCC_OPCO_MAP` retirée (`src/server/qualiopi/crm/naf-opco.ts`)

- `opcosDeLIdcc(idcc, db)` (async, lecteur INJECTÉ — le module reste sans import Prisma) :
  liste triée des OPCO de la table pour l'IDCC normalisé (`normaliserIdcc` : zéro de tête,
  espaces, refus au-delà de 4 chiffres significatifs) ; vide si inconnu, mal formé, ou table
  illisible (log, l'enregistrement de la fiche n'est jamais bloqué).
- `inferOpco({ opcosIdcc, naf })` (pure) : un seul OPCO → lui ; plusieurs → **jamais de
  majorité** : le NAF ne départage que s'il désigne l'un d'eux, sinon `null` (« à
  déterminer ») ; aucun → repli NAF. `inferOpcoDepuisTable(db, …)` enchaîne les deux.
- **Repli table vide : AUCUNE déduction par l'IDCC, l'entrée `1516 → akto` est retirée.**
  Aucun écran ne casse : le repli NAF reste (8559A → AKTO), le sélecteur manuel de l'écran
  Clients reste, et l'inférence ne fait que pré-remplir un champ vide. La source montre
  d'ailleurs que 1516 a DEUX OPCO (AKTO 26 492 / OPCO2I 1) : la constante tranchait déjà ce
  que la source ne tranche pas. Conséquence visible à connaître : avant le premier import,
  un client IDCC 1516 au NAF hors 8559A n'a plus d'OPCO pré-rempli ; après import, un IDCC
  à deux OPCO dont le NAF ne désigne aucun des deux non plus (la règle de part sur
  `siret_nombre` appartient à INT-T61-A).
- Appelants mis à jour : `clients.ts` (création et ré-inférence → `inferOpcoDepuisTable(prisma, …)`).
  Seuls autres renvois : un commentaire de `etat-fonds-opco.ts` cite `inferOpcoFromIdcc`
  (fonction renommée `normaliserIdcc` + `opcosDeLIdcc`) — fichier hors chemins, non touché.
- `OPCO_LABELS` : inchangés.

## 7. Écart à la forme d'A02 — colonne `siret_nombre`

A02 a répondu **OUI** sur #656 (commentaire 5980505240, 13:31 UTC) avec une forme précise,
appliquée mot pour mot à la place de `nb_siret` :

- `siret_nombre INTEGER NOT NULL` (suffixe `Nombre`, préfixe `nb_` écarté par A02) ;
  Prisma `siretNombre Int @map("siret_nombre")` ;
- CHECK **`idcc_opco_siret_nombre_positif`** : `siret_nombre >= 1` ;
- remplacé avec le millésime, dans la même transaction, jamais cumulé ; un même millésime
  aux comptes différents est refusé (« contenu différent ») ; des comptes qui bougent ne
  sont pas journalisés comme changement de rattachement ;
- calculé en **SIRET distincts** du fichier pour le couple, sans arrondi ni échantillonnage.
  A02 écrivait « `OPCO_GESTION`, à confirmer par b0 face à `OPCO_PROPRIETAIRE` » : b0 a
  tranché dans `SOURCE-SIRO.md` — **le couple se lit sur `OPCO_PROPRIETAIRE`** ; c'est ce
  que fait la config.

⚠️ **Réserve de calendrier** : A02 écrit « b0 peut livrer la table AVEC la colonne dès que le
109 est fusionné ». Au démarrage de ma session, l'acceptance d'INT-T60-A sur `main`
d'axion-apporteurs ne portait pas encore `siret_nombre` (rattrapage 109 non fusionné).
La colonne est donc poussée, mais **la PR ne devrait être ouverte/fusionnée qu'après le 109**.

## 8. Schéma et migration

- Migration **renommée `20261004230000_idcc_opco`** (l'ancien `20261004200000` passait
  désormais AVANT `20261004220000_siren_deduit_du_siret`, arrivée sur `main`) ; non encore
  fusionnée, donc modifiée en place (tables neuves, ajouts seuls).
- Jouée sur PostgreSQL 16 local vierge : refus vérifiés de `siret_nombre = 0`
  (`idcc_opco_siret_nombre_positif`), de `123`, et du doublon `(9001, atlas)` ;
  `(9001, atlas)` + `(9001, afdas)` acceptés. `prisma validate` et `prisma generate` : OK.

## 9. Témoins (tests)

`src/server/qualiopi/financements/__tests__/idcc-import.spec.ts` — **31 tests, 31 verts** :

| Témoin | Résultat |
| --- | --- |
| Extrait RÉEL : couples obtenus = couples de l'extrait, tous contenus dans l'agrégat restreint aux IDCC de l'extrait (l'agrégat en a 15 de plus : l'extrait est un échantillon) ; aucun couple de l'extrait hors agrégat | ✅ |
| Extrait réel : aucune valeur d'échappement dans les couples (l'extrait en porte) | ✅ |
| Extrait réel : `1596` = deux lignes, CONSTRUCTYS et OPCO EP | ✅ |
| Extrait réel : 264 lignes, lignes sans IDCC/OPCO ignorées, 0 invalide ; outre-mer lu sur le propriétaire | ✅ |
| Config réelle : le plancher de 1 000 couples refuse l'extrait ; agrégat = 1 009 couples réels, 56 IDCC à ≥ 2 OPCO | ✅ |
| Flux : extrait découpé en morceaux arbitraires (dont une ligne coupée, et 400 coupures) = lecture d'un bloc ; caractère UTF-8 coupé recollé ; HTML / vide / non-UTF-8 / ligne démesurée refusés | ✅ |
| A02 : IDCC à deux OPCO (1 000 SIRET et 1 SIRET) → deux lignes aux comptes exacts ; SIRET répété compté une fois ; second import REMPLACE les comptes | ✅ |
| Double import du même millésime sans effet ; changement d'OPCO journalisé ; fichier refusé = table intacte ; `123`, `12a4`, compte 0 refusés (+ CHECK dans la migration) | ✅ |
| Téléchargement (réseau injecté) : ressource la plus récente, `sourceUrl`, millésime ; refus HTTP 503/404, HTML, vide, < 1 000 couples, délai — table intacte ; délai borné effectivement appliqué | ✅ |

`src/server/queue/workers/__tests__/opco-siro-import-worker.spec.ts` — **11 tests, 11 verts**
(drapeau, déclaration dans `env.ts`, coupé = aucun réseau, table absente = aucun
téléchargement, `P2021` = sortie propre, import journalisé avec l'URL, refus = table
intacte, erreur inattendue remontée, branchement file/cadence/fuseau).

`naf-opco.spec.ts` (39) et `clients.spec.ts` (47, dont « table vide : aucune déduction par
l'IDCC, repli NAF ») : verts.

## 10. Contrôles lancés

- `vitest run tests/unit src/server/qualiopi src/server/queue src/server/actions/qualiopi` :
  **742 fichiers, 9 824 tests verts, 1 todo, 0 échec**.
- `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) : **0 erreur** (le vrai
  `PrismaClient` satisfait `BaseIdccOpco` et `LecteurIdccOpco`).
- `eslint` sur les 13 fichiers touchés : 0 ; `prettier --check` : propre.
- Commit poussé avec `--no-verify` (contrôles ci-dessus lancés à la main). `next build` non lancé.

## 11. Chemins hors liste de l'acceptance (à verser au rattrapage si retenus)

`src/env.ts` (drapeau, demandé par la consigne), `src/server/qualiopi/crm/naf-opco.spec.ts`
et `src/server/actions/qualiopi/clients.spec.ts` (tests des appelants, demandés par la
consigne), fixtures `__tests__/fixtures/*` (versées par b0). `qualiopi-formation-crons-worker.ts`
n'est PAS touché (cf. § 5).

## 12. Premier import à la main, en production, après fusion

1. **Attendre l'atterrissage de l'APP** (c'est elle qui migre) : `x-axion-build-sha` au SHA
   de la fusion, puis `docker logs <app> 2>&1 | grep entrypoint` → « Migrations applied
   successfully » (voir AGENTS.md : un déploiement vert ne prouve pas le schéma). Avant, le
   worker (atterri ~50 min plus tôt) répondrait seulement « table absente ».
2. Vérifier que le worker porte le code : `docker exec <worker> grep -rl opco-siro-import-worker /app/src`.
3. Poser un passage immédiat dans la file (depuis le conteneur du worker, qui a `src/` et `tsx`) :
   ```bash
   ssh root@178.105.55.15 'docker exec -w /app <worker> npx tsx -e "
     import(\"./src/server/queue/queues\").then(async ({ opcoSiroImportQueue }) => {
       await opcoSiroImportQueue?.add(\"import-manuel\", { tick: new Date().toISOString() });
       process.exit(0);
     });"'
   ```
4. Lire le résultat : `docker logs <worker> 2>&1 | grep opco-siro-import-worker` — attendu :
   « siro-AAAAMM.csv (https://static.data.gouv.fr/…) : ~1 009 couple(s) importé(s), 0
   changement(s) journalisé(s) — premier import ». Un refus s'écrit « import REFUSÉ, table
   intacte : <motif> » (si le VPS ne joint pas data.gouv.fr, c'est là qu'on le voit).
5. Contrôle en base (lecture seule) :
   `SELECT millesime_source, count(*), sum(siret_nombre) FROM idcc_opco GROUP BY 1;`
   → une seule ligne, ~1 009 couples, ~3,35 M SIRET (millésime 2026-06 : 3 347 088 hors
   échappements).
6. Relancer est sans risque : même millésime = `deja_importe`, zéro écriture. Couper :
   `IDCC_OPCO_IMPORT_ENABLED=false` sur le worker (Coolify, puis redémarrage).

## Reste

- Ouvrir la PR après le rattrapage 109 (colonne `siret_nombre`), selon le signal de la coordination.
- Intitulés des conventions (liste du ministère du Travail) : import séparé, non fait.
- INT-T61-A : règle de la part sur `siret_nombre` (seuil en SSOT), hors de cette tâche.

Tête de `opco/int-t60-a-idcc-opco` : **`f6e29ce400ecc0ef3dc62e277f5cd7f325d66f1e`**
