VERDICT: À CORRIGER

# Relecture de la PR #2360 : changement d'IBAN des apporteurs, lots 1 et 3

Branche relue : `origin/feat/apporteurs-changement-iban-v2` (`f76bff230`), base `origin/main` (`1abd8256d`, branche à jour : 0 commit de retard).
`pnpm-lock.yaml` identique à `main`.

## En bref

Je n'ai trouvé **aucun défaut fonctionnel ni aucune faille** dans le code livré (migration, règles pures, habilitation, purge Sentry, exceptions RGPD).
Le verdict est « À CORRIGER » pour une seule raison, que la consigne de relecture demande de vérifier : **le test SQL de comportement ne détecte pas la suppression de plusieurs gardes de sécurité**.
Il passe en vert alors que :

- l'index « une seule demande ouverte » ne couvre plus les demandes `confirmee` ;
- les octets d'un RIB peuvent être remplacés ;
- l'un ou l'autre des deux verrous du délai de 72 heures est retiré (côté déclencheur).

Le correctif est limité au test SQL : trois blocs, écrits et essayés ci-dessous (constat 1). Les autres constats sont mineurs ou concernent les lots suivants.

## Ce qui a été lancé

| Vérification                                           | Résultat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm prisma:generate`                                 | OK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm typecheck` (`--max-old-space-size=12000`)        | **0 erreur**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `eslint` sur les 8 fichiers source touchés             | 0 erreur                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| vitest, les 7 specs touchés                            | 7 fichiers, **101 tests verts**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| vitest, en plus des specs touchés                      | `src/features/apporteurs-reseau`, `src/lib/observability`, `src/server/auth`, `src/server/qualiopi/alertes`, signature, émargement, `tests/unit/ci` entier et gardes RGPD : **308 fichiers, 3 903 tests verts** (8 sautés, 7 à faire, comme sur `main`)                                                                                                                                                                                                                                                                                                                            |
| Migration sur Postgres 18 local (base vide)            | Appliquée sans erreur ; les quatre tables sont autonomes, aucun autre schéma n'est nécessaire                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `tests/sql/apporteur-changement-iban-comportement.sql` | **Vert** (`psql -v ON_ERROR_STOP=1`, code de sortie 0)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Mutations du code TS (modifié puis restauré)           | **18 sur 18 détectées** : habilitation ouverte à `admin`, 72 h → 71 h, `>=` → `>` à la borne des 72 h, plafond 3 → 4, borne des 30 jours, gel toujours actif, transition `confirmee → expiree` ajoutée au code, transition `confirmee → a_confirmer` ajoutée au déclencheur, borne de longueur de `quatreDerniersCaracteres`, adresse non masquée, 30 → 31 jours pour le téléphone, 10 → 11 jours pour l'alerte, limite de débit 5 → 50, J-5 → J-6, motif Sentry de la console retiré, motif Sentry `compte/` retiré, exception d'effacement renommée, exclusion d'export renommée |
| Mutations du SQL (migration modifiée puis rejouée)     | **9 sur 15 détectées, 6 non détectées** (constat 1). Deux des six sont des faux positifs de ma mutation : la garde d'INSERT et la date de confirmation ont d'autres clauses qui suffisent. La transition `confirmee → a_confirmer` n'est pas vue par le SQL, mais elle l'est par le test de concordance vitest.                                                                                                                                                                                                                                                                    |

Après les mutations, `git status` ne montre plus aucun fichier modifié par la relecture. Seul `.github/workflows/ci.yml` est marqué modifié : le bac à sable le garde en lecture seule et l'a empêché de passer à la version de la branche. Sa version de la PR a été lue par `git diff`.

## Points vérifiés et conformes

- **Migration purement additive.**
  - Quatre `CREATE TABLE` neufs, aucun `DROP`, aucun `ALTER` d'une table existante, aucune clé étrangère.
  - Aucun `CREATE TYPE` ni `ADD VALUE` : le statut est un texte contraint par CHECK.
  - Aucune écriture de données. `apporteurs_reseau` n'est pas touchée.
  - Le garde statique `le-changement-d-iban-n-ajoute-rien-aux-tables-existantes.spec.ts` le vérifie, et ses contre-témoins réagissent.
- **Compatibilité app/worker dans les deux sens** (AGENTS.md, « DEUX conteneurs » et D8b).
  - Aucun code ne lit ni n'écrit ces tables dans ce lot.
  - Aucune forme de tâche BullMQ, aucun gabarit, aucune valeur d'énumération.
  - Un client Prisma plus récent que la base ne casse rien tant qu'il n'interroge pas ces modèles. Un client plus ancien ignore les tables.
  - Les colonnes de `apporteurs_reseau` lues sans liste de colonnes ne changent pas.
- **IBAN jamais en clair.**
  - Le CHECK `^enc:v2:[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$` correspond au format réel de `chiffrerV2` (`src/lib/pii-crypto.ts:162-166` : IV de 12 octets, étiquette de 16 octets, en hexadécimal).
  - Le repli « sans clé → clair » de `encryptPii` est donc refusé par la base, ce qui est voulu.
  - Les octets du RIB exigent l'en-tête `AXB1` (`ENTETE_OCTETS_V1`). Le plafond de 10 485 760 octets est égal à `TAILLE_MAX_PIECE`.
  - Les empreintes et les quatre derniers caractères sont bornés par une expression régulière : un IBAN en clair est refusé comme empreinte (testé).
- **Sentry.**
  - La signature de `/apporteur/dossier/compte/<id>/<signature>` est masquée dans l'URL.
  - Le corps, les cookies, la query et les en-têtes sont supprimés sur ce chemin et sur `…/apporteurs/[…/]changements-de-compte`, quel que soit le préfixe d'administration.
  - Contre-épreuve : les autres pages de la console apporteurs ne sont pas touchées.
  - Les deux motifs ont été retirés un à un lors des mutations, et le test a rougi à chaque fois.
- **Déclencheurs** (essayés sur une base réelle).
  - Une demande naît `a_confirmer`, sans aucune trace d'étape.
  - Transitions fermées : `a_confirmer → {confirmee, opposee, annulee, expiree}`, `confirmee → {validee, refusee, opposee, annulee}`. Une demande décidée est figée.
  - Le cœur de la demande est immuable et la preuve de la confirmation ne se réécrit pas.
  - Les dates d'étape suivent `clock_timestamp()` à une minute près.
  - La validation est refusée avant 72 h, deux fois : par le déclencheur, et par le CHECK `traitee_at >= confirmee_at + 72 h`.
  - Ni `DELETE` ni `TRUNCATE` sur les quatre tables. L'historique est en ajout seul, avec un seul compte en vigueur. `apporteur_virements_compte` est en ajout seul.
- **Habilitation.**
  - `valider_changement_iban: ["super_admin"]` seul.
  - Tests négatifs sur `admin`, `responsable_qualite`, `secretaire`, `editor`, `reader`, et sur un rôle vide, nul ou mal orthographié.
  - La liste fermée des actes réservés au seul `super_admin` est vérifiée dans les deux sens.
  - `requireHabilitation` refuse `admin` (`_habilitations.spec.ts`). La mutation qui ajoute `admin` est détectée.
- **RGPD.**
  - Les quatre modèles portent `/// rgpd: dossier-client`.
  - Une exclusion d'export et une exception d'effacement sont déclarées pour chacun.
  - Les gardes `les-tables-du-dossier-client-suivent-la-personne`, `aucun-outil-mcp-ne-lit-le-dossier-client` et `le-dossier-client-ne-part-pas-au-crm` sont vertes, et elles rougissent si l'on renomme une entrée.
- **§2.5, §2.5 bis et §2.6.**
  - La liste fermée des écrivains d'`email`, `emailHash`, `telephone` et `telephoneHash` correspond au code actuel. Les formes opaques (alias, crochets, dispersion, SQL brut, écriture imbriquée) sont refusées, avec des contre-témoins.
  - La garde « aucune IA sur le chemin de l'IBAN » rougit sur chaque import interdit.

## Constats

### 1. Le test SQL de comportement ne mord pas sur quatre gardes de sécurité. **Gravité : moyenne (à corriger avant fusion)**

Fichier : `tests/sql/apporteur-changement-iban-comportement.sql`.

La migration a été modifiée de quatre façons, une à la fois, puis la migration et le test ont été rejoués sur Postgres 18. Le test **reste vert** dans les quatre cas :

| Mutation de la migration                                                                | Pourquoi rien ne rougit                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migration.sql:41` : l'index `une_ouverte` ne couvre plus que `'a_confirmer'`           | Le cas 1 (`:25`) ne teste que deux demandes `a_confirmer`. Aucun cas n'essaie une seconde demande à côté d'une demande **`confirmee`**. C'est pourtant l'état qui dure le plus longtemps (72 h au moins, jusqu'à 10 jours et plus), et celui pendant lequel les virements sont gelés.                                        |
| `migration.sql:257` : la garde « les octets ne sont jamais remplacés » est neutralisée  | Le cas `:274` change `octets` **et** `taille` dans le même `UPDATE`. C'est la garde sur `taille` qui lève, et le `WHEN raise_exception` accepte n'importe quel message. Le remplacement des seuls octets d'un RIB n'est donc pas couvert.                                                                                    |
| `migration.sql:182` : le contrôle des 72 h dans le déclencheur d'horloge est neutralisé | Le cas `:400` accepte aussi `check_violation`, donc le CHECK de cohérence suffit à le faire passer. Le commentaire du test (« refusée par l'horloge de la base ») ne correspond pas à ce qui est réellement vérifié.                                                                                                         |
| `migration.sql:179` : la fenêtre d'une minute sur `traitee_at` est neutralisée          | Le cas `:395` (`traitee_at` dans le futur) est arrêté par le contrôle des 72 h (`:182`), pas par la fenêtre. Avec les deux mutations à la fois, une validation datée de +3 jours et posée **tout de suite** passerait le CHECK (`traitee_at >= confirmee_at + 72 h`). Les deux verrous ne sont donc jamais testés isolément. |

La cause commune est le motif `EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;` : il accepte **n'importe quelle** exception de **n'importe quel** déclencheur, ce qui masque la garde réellement visée.

**Correctif proposé** : ajouter ces trois blocs à la fin du fichier. Ils ont été essayés :

- vert sur la migration de la PR ;
- rouge sur chacune des quatre mutations ci-dessus.

```sql
-- 9. Une demande CONFIRMEE compte comme ouverte : pas de seconde demande a cote.
BEGIN;
ALTER TABLE apporteur_changements_iban DISABLE TRIGGER apporteur_changements_iban_horloge;
DO $$
DECLARE
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  h text := repeat('d', 64); ap uuid := gen_random_uuid(); d uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine) VALUES (d, ap, chiffre, h, '1234', 'espace');
  UPDATE apporteur_changements_iban SET statut = 'confirmee', confirmee_at = now() WHERE id = d;
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine) VALUES (gen_random_uuid(), ap, chiffre, h, '1234', 'espace');
    RAISE EXCEPTION 'AXT99 seconde demande ouverte acceptee a cote d une confirmee';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
ROLLBACK;

-- 10. Les octets seuls d'un RIB ne se remplacent pas (garde visee par son MESSAGE, pas par n'importe quelle exception).
BEGIN;
DO $$
DECLARE axb1 bytea := '\x41584231' || decode(repeat('00', 40), 'hex'); rid uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_changements_iban_rib (demande_id, octets, sha256, type_mime, taille) VALUES (rid, axb1, repeat('e',64), 'application/pdf', 44);
  BEGIN
    UPDATE apporteur_changements_iban_rib SET octets = '\x41584231ff'::bytea WHERE demande_id = rid;
    RAISE EXCEPTION 'AXT99 octets du RIB remplaces';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%jamais remplac%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;

-- 11. Les deux verrous du delai, chacun par son message : date de decision dans le futur, puis validation avant 72 h.
BEGIN;
DO $$
DECLARE chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32); d uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine) VALUES (d, gen_random_uuid(), chiffre, repeat('d',64), '1234', 'espace');
  UPDATE apporteur_changements_iban SET statut = 'confirmee', confirmee_at = now() WHERE id = d;
  BEGIN
    UPDATE apporteur_changements_iban SET statut = 'validee', traitee_at = now() + interval '3 days', traitee_par = gen_random_uuid() WHERE id = d;
    RAISE EXCEPTION 'AXT99 validation datee dans le futur acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%traitee_at suit%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE apporteur_changements_iban SET statut = 'validee', traitee_at = now(), traitee_par = gen_random_uuid() WHERE id = d;
    RAISE EXCEPTION 'AXT99 validation avant 72 h reelles acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%avant la fin du d%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
```

Plus largement : dans les cas qui visent **une** garde précise, remplacer `IF SQLERRM LIKE 'AXT99%' THEN RAISE` par `IF SQLERRM NOT LIKE '%<message de la garde>%' THEN RAISE`. Le même défaut existe probablement ailleurs, sans conséquence visible aujourd'hui (par exemple au cas `:203`, « saut à validée »).

Deux autres trous mineurs, à combler au passage :

- **Confirmation antidatée à moins de 24 h de la demande.** La fenêtre d'une minute sur `confirmee_at` (`migration.sql:175`) n'est jamais testée seule. Le cas `:207` antidate de 10 jours, et `confirmee_at < demandee_at` suffit à le refuser. Or, sans cette fenêtre, une confirmation posée 23 h après la demande pourrait être datée du moment de la demande et faire gagner 23 h sur les 72.
- **Retour `confirmee → a_confirmer` en SQL.** Il n'est essayé nulle part dans le test SQL. Il n'est verrouillé que par le test de concordance vitest.

### 2. Les dates d'étape sont vérifiées dans une fenêtre, au lieu d'être posées par la base. **Gravité : faible (lot 4 au plus tard)**

Fichier : `migration.sql:163-189`.

Le déclencheur d'horloge **contrôle** les dates fournies par l'appelant (± 1 minute de `clock_timestamp()`). Il ne les **pose** pas. Trois conséquences :

1. **72 h réelles moins une minute.** `confirmee_at` peut être antidatée d'une minute au plus, s'il reste après `demandee_at`. Le délai réel vaut donc au moins 71 h 59.
2. **Décalage d'horloge.** Si l'application passe `new Date()` et que l'horloge du conteneur s'écarte de plus d'une minute de celle de Postgres, toutes les confirmations et toutes les décisions échouent.
3. **Transaction longue.** `demandee_at` a pour défaut `CURRENT_TIMESTAMP`, c'est-à-dire le **début de la transaction**, alors que le contrôle utilise `clock_timestamp()`. Une transaction de création ouverte depuis plus d'une minute échoue (« demandee_at suit l'horloge »).

Correctif proposé : dans `apporteur_changements_iban_garde_horloge`, **affecter** la date à la transition au lieu de la contrôler. Par exemple `NEW."confirmee_at" := clock_timestamp()` quand le statut passe à `confirmee`, et de même pour `traitee_at`, `opposee_at`, `annulee_at`, `expiree_at`, et `demandee_at` à l'insertion. Garder le contrôle des 72 h sur `OLD."confirmee_at"`. Le délai devient alors exact, et le code du lot 4 n'a plus de date à fournir.

À défaut, le lot 4 doit écrire ces dates avec `now()` côté SQL, jamais avec `new Date()`.

### 3. La preuve de confirmation peut être écrite hors de sa transition. **Gravité : faible**

Fichier : `migration.sql:115-118` et `:121-127`.

`confirmation_ip_hash` et `confirmation_navigateur` ne sont figés qu'une fois **non nuls**, et leur écriture n'est pas liée à la transition `a_confirmer → confirmee`.

Constaté sur une base réelle : `UPDATE … SET confirmation_ip_hash = 'x'` réussit sur une demande `a_confirmer`, sans confirmation. Si la confirmation est enregistrée avec un hachage nul, on peut aussi le poser plus tard, lors de la validation.

Correctif proposé : ajouter ces deux colonnes à la règle « un champ de suivi ne s'écrit qu'avec sa transition », comme `confirmee_at`.

`controles` est lui aussi modifiable librement tant que la demande est ouverte. C'est acceptable si le lot 4 ne l'écrit qu'à la décision ; à noter dans le lot 4.

### 4. Purge Sentry de la console : le motif ne protège que si le formulaire reste sous `changements-de-compte`. **Gravité : faible (règle pour le lot 6)**

Fichier : `src/lib/observability/sentry-pii-scrub.ts:155`.

Une Server Action est envoyée (POST) à l'URL de **la page qui l'appelle**. Si le champ « recopier l'IBAN lu sur le RIB » est placé un jour sur la fiche `apporteurs/<id>` (bloc « Compte bancaire », §5.2), la purge ne s'applique pas et l'IBAN recopié part chez Sentry dans le corps de la requête.

Correctif proposé : au lot 6, ajouter un garde statique. Il doit échouer si un composant qui porte le champ de contrôle (`controle-iban*` ou `DecisionIban*`, déjà repérés par `estDuCheminIban`) est rendu par une page hors de `…/apporteurs/changements-de-compte/`. À défaut, écrire cette règle dans le plan (§5.2).

### 5. Garde « aucune IA sur le chemin de l'IBAN » : imports directs seulement. **Gravité : faible**

Fichier : `src/features/apporteurs-reseau/__tests__/l-adresse-e-mail-ne-change-pas-sans-fermer-les-demandes.spec.ts:333`.

La garde lit les imports **directs** des fichiers du chemin. Un module intermédiaire, par exemple `@/server/outils/aide.ts`, qui importerait lui-même `@anthropic-ai/sdk` passerait sans être vu.

Correctif proposé :

- soit suivre les imports relatifs et `@/` sur un ou deux niveaux ;
- soit, plus simple, écrire cette limite dans l'en-tête du fichier, comme c'est déjà fait pour l'analyse des écrivains.

### 6. `quatreDerniersCaracteres` ne garantit pas la forme exigée par la base. **Gravité : très faible**

Fichier : `src/features/apporteurs-reseau/changement-iban-regles.ts:189`.

La fonction retire les espaces et met en majuscules, mais elle peut rendre une fin contenant `-` ou `.` (« FR76-…-01.9 »). Le CHECK `^[A-Z0-9]{4}$` ferait alors échouer l'insertion en erreur 500 au lieu d'un refus lisible.

Correctif proposé : retirer tout caractère qui n'est pas `[A-Z0-9]` avant de couper, ou rendre `null` si la fin ne correspond pas à `^[A-Z0-9]{4}$`. Le lot 4 valide l'IBAN en amont (`ibanValide`), donc le risque est faible.

### 7. Textes RGPD : promesses qui dépendent du lot 8. **Gravité : faible (suivi)**

Fichiers : `src/lib/rgpd-erase.ts:2238` et `src/lib/rgpd-dossier-client.ts:65`.

- L'exception d'effacement de `ApporteurChangementIbanRib` décrit une purge à 90 jours et une conservation de 5 ans. Aucun code ne les applique encore, et la décision D-7 est « oui, sous réserve de l'avis du DPO ».
- L'exclusion d'export de `ApporteurIbanHistorique` dit « rendus sur demande écrite ». Le plan (§7) prévoit pourtant que les IBAN validés soient rendus déchiffrés dans l'export, « comme aujourd'hui ».

Ces écarts sont acceptables tant que les tables restent vides (aucun écrivain avant le lot 4, et l'interrupteur est éteint). Mais **le lot 4 ne doit pas être allumé avant le lot 8**.

Correctif proposé : écrire cette dépendance dans la PR du lot 4, et dans le texte de l'exclusion d'export, comme le texte d'effacement le fait déjà (« sera livré avec le lot RGPD »).

### 8. Runbook : une vérification impossible dans l'architecture actuelle. **Gravité : information**

Fichier : `docs/runbooks/apporteurs-changement-iban-retour-arriere.md:47-50`.

Le runbook demande de « vérifier que le rôle de connexion de l'application n'est pas propriétaire de ces tables ». Or c'est le conteneur de l'application qui joue `prisma migrate deploy` (entrypoint), avec son propre `DATABASE_URL` : il **est** propriétaire des tables qu'il crée.

Les déclencheurs se contournent donc par `ALTER TABLE … DISABLE TRIGGER`, ou par `session_replication_role = replica` si ce rôle est superutilisateur. Sur une base réelle, sous `replica`, j'ai pu insérer une demande directement `validee`.

Correctif proposé : reformuler en limite **acceptée** (« protège contre une erreur de code, pas contre le rôle applicatif ») ou ouvrir un chantier séparé (rôle de migration distinct). Ne pas laisser une vérification qui ne peut pas réussir.

### 9. Détails. **Gravité : très faible**

- `migration.sql:367` : `declare_par VARCHAR(64)`, alors que `traitee_par` est un `UUID`. Choisir une forme unique pour l'auteur d'un acte de console.
- `.github/workflows/ci.yml` (ajout de l'étape) : la commande `psql` tient sur une seule ligne avec une longue suite d'espaces au lieu de la continuation `\` des étapes voisines. Cela fonctionne, mais la ligne est à reformater comme les autres.
- La table `apporteur_changements_iban_rib` accepte un RIB dont la demande n'existe pas : c'est voulu (pas de clé étrangère). Le lot 4 doit écrire le RIB et la demande dans la même transaction.

## Ce qu'il faut corriger pour passer à « BON »

1. Ajouter au test SQL les trois blocs du constat 1 (essayés : vert sur la PR, rouge sur chaque mutation).
2. De préférence dans la même PR, puisque la migration n'est pas encore jouée, appliquer les constats 2 et 3 : dates posées par la base, et preuve de confirmation liée à sa transition. Sinon, reporter ces deux exigences dans la description du lot 4.

Les constats 4 à 9 peuvent suivre dans les lots concernés.
