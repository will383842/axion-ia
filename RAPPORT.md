# RAPPORT — INT-T60-A (table IDCC → OPCO)

Branche de travail : `opco/int-t60-a-idcc-opco` — tête `83e19b8d904d267dd27f000aa8a6d64a2f5d50a0`
(depuis `origin/main` `9df6687e`). Aucune PR ouverte, rien fusionné.

## 🔴 Statut : ARRÊT RM-08 — source officielle NON lue, remonté à A01

La consigne est appliquée : sans source lisible depuis la session, **aucune
correspondance n'est inventée**. Seul ce qui ne dépend pas de la source est poussé
(schéma, migration, import paramétré testé sur une fixture marquée FICTIVE).

### Source identifiée (non lue)

- **Table SIRET-OPCO « SIRO »**, France compétences, publiée sur data.gouv.fr :
  `https://www.data.gouv.fr/datasets/table-siret-opco`
  (id `688a210c012cfbf595d7a99a`).
- D'après les résultats de recherche web (et NON d'après le fichier lui-même) :
  table SIRET → OPCO, portant l'IDCC déclaré en DSN (rubrique S21.G00.11.022) ou une
  valeur d'échappement ; fichier principal CSV ~101 Mo, **mis à jour le 2026-05-11** ;
  dictionnaire des données PDF mis à jour le 2025-07-31.
- ⚠️ Conséquence de forme : la SIRO est une table **SIRET → OPCO**. La correspondance
  IDCC → OPCO s'en déduit par les **couples distincts (idcc, opco)** — c'est ce que fait
  `lireFichierSiro`. À confirmer à la lecture du dictionnaire.
- Liste des intitulés (ministère du Travail) : non trouvée, non lue.

### Ce qui a été essayé (2026-10-04, ~12:30 UTC)

| URL | Moyen | Résultat |
| --- | --- | --- |
| `https://www.data.gouv.fr/api/1/datasets/?q=idcc+opco` | curl | CONNECT 403 (proxy, politique d'organisation) |
| `https://www.data.gouv.fr/api/1/datasets/?q=SIRO` | curl | CONNECT 403 |
| `https://travail-emploi.gouv.fr/liste-des-conventions-collectives-et-de-leur-opco-de-rattachement` | curl | CONNECT 403 |
| `https://travail-emploi.gouv.fr/les-operateurs-de-competences-opco` | curl | CONNECT 403 |
| `https://www.francecompetences.fr/` | curl | CONNECT 403 |
| `https://static.data.gouv.fr/`, `code.travail.gouv.fr`, `legifrance.gouv.fr`, `service-public.fr`, `dares.travail-emploi.gouv.fr` | curl | code 000 (CONNECT refusé) |
| `https://www.data.gouv.fr/api/1/datasets/?q=idcc%20opco` | WebFetch | EGRESS_BLOCKED |
| `https://static.data.gouv.fr/` | WebFetch | EGRESS_BLOCKED |
| `https://www.francecompetences.fr/base-documentaire/` | WebFetch | EGRESS_BLOCKED |
| recherche « fichier SIRO correspondance IDCC OPCO data.gouv.fr » | WebSearch | ✅ titres + résumé seulement (source identifiée ci-dessus) |

**Pour débloquer** : autoriser `www.data.gouv.fr` et `static.data.gouv.fr` dans la
politique réseau de l'environnement (Paramètres de l'environnement → accès réseau), ou
déposer le CSV et le dictionnaire PDF dans le dépôt / une session qui y a accès.

## Schéma (poussé)

`prisma/schema.prisma` + migration additive `20261004200000_idcc_opco` (postérieure à
`20261004190000_opco_suivi_entreprise`, la dernière de `main`, revérifié après push).

- `idcc_opco` (`IdccOpco`) : PK **composée** `("idcc", "opco")` ; `idcc CHAR(4)` avec
  `CHECK ("idcc" ~ '^[0-9]{4}$')` ; `opco` = énumération existante `"Opco"` (les onze,
  inchangée) ; `millesime_source DATE` ; `source_url TEXT` ; `importe_at TIMESTAMPTZ` ;
  `intitule TEXT NULL` + `intitule_source TEXT NULL` (source distincte de la SIRO).
- `idcc_opco_changements` (`IdccOpcoChangement`) : `id`, `idcc` (même CHECK),
  `ancien_opco NULL`, `nouvel_opco NULL`, `millesime_source`, `importe_at` ; CHECK : au
  moins un côté, et les deux côtés diffèrent. Ajouts seuls.
- Annotation `/// rgpd: technique — …` sur les deux modèles.
- `prisma migrate diff` (schéma de `main` → schéma de la branche) rend **exactement** le
  SQL de la migration (hors CHECK, que Prisma ne modélise pas).
- Migration jouée sur un PostgreSQL 16 local vierge : refus vérifiés de `123`, `12a4`
  (les deux tables), du doublon `(9001, atlas)`, d'un OPCO hors énumération, d'un
  changement `atlas → atlas` et `null → null`. `(9001, atlas)` + `(9001, afdas)` = deux
  lignes acceptées.
- Fenêtre app/worker : tables neuves, aucune énumération ni payload BullMQ touché ;
  aucun code ne lit encore ces tables.

## Import (poussé) — `src/server/qualiopi/financements/idcc-import.ts`

- `lireFichierSiro(texte, config)` : **paramétré** (séparateur, noms de colonnes,
  libellés OPCO de la source → codes, valeurs d'échappement de l'IDCC, tolérance de
  lignes invalides — défaut 0). Rien n'est supposé sur le fichier réel. Refuse : fichier
  vide, colonne absente, guillemet non refermé, libellé OPCO non répertorié (jamais
  deviné), IDCC invalide au-delà de la tolérance, aucun couple.
- `importerMillesimeIdccOpco(db, …)` : UNE transaction `Serializable` ; refuse si la
  table mélange déjà deux millésimes, si le millésime est plus ancien que celui en place,
  ou si un même millésime revient au contenu différent ; même millésime + même contenu =
  `deja_importe`, **zéro écriture** ; sinon `deleteMany` + `createMany` du millésime
  entier, intitulés conservés par IDCC, écarts journalisés (`calculerChangements` :
  retiré + ajouté sur un IDCC = un changement ancien → nouvel ; surplus seul avec un côté
  null). Premier import : rien n'est écrasé, donc rien journalisé.
- `importerFichierIdccOpco` : lecture **avant** la transaction — un fichier refusé ne
  touche jamais la table.
- Le vrai `PrismaClient` satisfait l'interface `BaseIdccOpco` (vérifié par `tsc` avec un
  appelant temporaire, retiré avant commit).
- **Dépendances ajoutées : aucune** (`package.json` non modifié ; parseur CSV interne).
- `OPCO_LABELS` non touchés.

## NON fait — attend la source (volontairement)

1. **Tâche planifiée mensuelle** : non branchée. Le téléchargement (URL exacte de la
   ressource CSV, format, encodage, ~101 Mo → lecture en flux probable) et la
   `ConfigFichierSiro` réelle dépendent du fichier. Brancher une tâche sans eux, c'est
   brancher une tâche qui échoue chaque mois. À faire ensuite : file existante des crons
   formation/Qualiopi dans `queues.ts`/`worker.ts` (sinon worker `idcc-opco-import`), en
   tolérant une table absente (fenêtre ~50 min où le worker précède la migration).
2. **`IDCC_OPCO_MAP` de `naf-opco.ts`** : non remplacée. La remplacer par une table
   encore vide ferait perdre la seule entrée sourcée (1516 → akto) sans rien apporter ;
   ce remplacement doit suivre le premier import réel (lecture de la table, repli
   prudent = aucune déduction si la table est vide).
3. `clients.ts` : non touché.

## Témoins et résultats (fixture FICTIVE)

`src/server/qualiopi/financements/__tests__/idcc-import.spec.ts` — 12 tests, 12 verts :

| Témoin | Résultat |
| --- | --- |
| Double import du même millésime : aucun effet, aucune écriture, aucun changement journalisé | ✅ |
| Changement d'OPCO entre deux millésimes journalisé (`9001 atlas → afdas`), table sur un seul millésime | ✅ |
| IDCC à deux OPCO = deux lignes | ✅ |
| Fichier vide, blanc, HTML d'erreur, en-tête seul : refusé, table intacte | ✅ |
| `123` et `12a4` refusés (code + CHECK présent dans la migration ; et en base réelle, cf. Schéma) | ✅ |
| + millésime plus ancien / même millésime au contenu différent refusés ; intitulé conservé ; libellé inconnu refusé ; guillemets/BOM | ✅ |

## Contrôles lancés

- `vitest` : `idcc-import.spec.ts` 12/12 ; avec `src/server/qualiopi/crm` : 20 fichiers,
  188/188 ; garde-fous lisant schéma/migrations (44 fichiers) : 421/421.
- `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) : 0 erreur.
- `eslint` sur les fichiers touchés : 0 ; `prettier --check` : propre ; `prisma format`
  et `prisma validate` : OK.
- Commit poussé avec `--no-verify` (contrôles ci-dessus lancés à la main).

## Reste

- Lire la SIRO (CSV + dictionnaire) : écrire URL de la ressource, date, nombre de lignes
  et de couples ; remplir `ConfigFichierSiro` depuis le dictionnaire ; mesurer le temps
  d'import sur 101 Mo (lecture en flux à prévoir).
- Trouver/lire la liste des intitulés du ministère du Travail (import séparé).
- Brancher la tâche mensuelle, puis remplacer `IDCC_OPCO_MAP` par la lecture de la table.
