# ADR 0059 — Registre append-only des numéros émis (`numeros_emis`)

- **Statut** : proposé (PR `qualiopi/numeros-emis-jamais-reattribues`)
- **Date** : 2026-09-30
- **Constat** : registre des incidents Qualiopi, engagement ouvert « empêcher la réattribution d'un numéro déjà émis »
- **Prolonge** : ADR 0035 (« Ce qui reste ouvert »)
- **Référence** : `src/server/qualiopi/numbering/allocate.ts` ; migration `prisma/migrations/20260930120000_numeros_emis_registre` ; `tests/unit/ci/tout-allocateur-alimente-le-registre-des-numeros.spec.ts` ; `tests/sql/numeros-emis-comportement.sql` (Gate D)

## Contexte

L'ADR 0035 a remplacé `count(*) + 1` par `MAX(séquence) + 1`. Ce maximum ne porte que sur les lignes **encore présentes** dans la table métier. Le 19/08/2026, les données de deux actions ont été supprimées directement en base ; la série des factures est repartie à 001 et **`AXI-FACT-2026-001` a été émis une seconde fois le 15/09** (CGI, art. 242 nonies A ann. II : séquence continue, sans réemploi). Aucun index unique ne pouvait le voir : la ligne d'origine n'existait plus.

## Décision

1. **Une table `numeros_emis`** (`numero` clé primaire, `table_source`, `emis_le`) garde la trace de tout numéro émis. Elle ne porte aucune donnée personnelle.
2. **Elle est alimentée par déclencheur, pas par le code.** Sur chacune des 9 tables dont un allocateur `nextNumero` lit la série (`factures_formation`, `trainer_statements.numero_facture`, `devis`, `clients`, `formations`, `training_sessions`, `reclamations`, `audit_missions`, `documents_generes`), un déclencheur `AFTER INSERT OR UPDATE OF <colonne>` y insère le numéro (`ON CONFLICT DO NOTHING`), dans la même transaction que la ligne métier. Les 18 sites d'appel ne changent pas, et tout écrivain est couvert : app, worker, script, psql.
3. **Elle est en ajout seul.** UPDATE, DELETE et TRUNCATE sont refusés en base (`AXN01`), sans exception.
4. **`nextNumero` lit les deux sources** — la table métier par le lecteur de l'appelant, le registre par préfixe — et prend le maximum. Le registre est lu par le client Prisma global, hors de la transaction de l'appelant, pour qu'une erreur ne l'annule pas.
5. **Repli.** Si la table n'existe pas encore (P2021 : fenêtre app/worker de ~50 min, migration best-effort), ou pour toute autre erreur du registre, `nextNumero` retombe sur l'ancien calcul et le signale. Une facturation ne se bloque jamais sur le registre.
6. **Backfill** des numéros présents à la migration, et d'eux seuls (`emis_le` = `created_at` de la ligne).
7. **Liste des tables dérivée**, pas écrite à la main : le test balaie les appels à `nextNumero`, en extrait les modèles lus, les traduit en (table, colonne) par le schéma, et exige déclencheur + backfill pour chacun (et aucun déclencheur en trop).

## Ce que cette décision ne fait PAS

- **Elle ne répare pas le doublon `AXI-FACT-2026-001`.** C'est une régularisation comptable qui appartient au dirigeant. Le premier numéro, supprimé le 19/08, n'est dans aucune table : le backfill ne peut pas le reconstituer. En revanche, le numéro présent est désormais au registre, et la série ne pourra plus revenir en arrière.
- **Elle ne ferme pas la course concurrente** : le registre n'est pas réservé avant l'insertion (il faudrait écrire depuis les 18 sites). L'index unique de chaque table et la reprise P2002 restent le mécanisme.
- **Elle ne refuse pas en base l'insertion d'un numéro déjà au registre** (le déclencheur l'ignore). La prévention passe par `nextNumero`. Un refus en base casserait les 7 collisions héritées (ADR 0035 §4), les restaurations, et les brouillons renumérotés ; il pourra être étudié une fois l'état hérité purgé.

## Conséquences

- Supprimer une ligne métier (purge, erreur, SQL direct) ne libère plus son numéro. Une purge de démonstration laisse ses numéros `-DEMO-` au registre, sans effet : `parseSequence` les écarte.
- Le registre étant lu par **préfixe sans filtre de table**, un numéro émis dans une table ne se réemploie dans aucune autre : c'est l'unicité inter-tables, pour tout numéro émis après la migration, que l'ADR 0035 disait hors de portée.
- ⚠️ Revers : si une table non concernée par une série portait un numéro de cette série **supérieur** à sa borne, la série sauterait ce numéro (un trou justifié plutôt qu'un doublon). Le relevé de l'ADR 0035 ne montre aucun cas ; à revérifier en base (lecture seule) **avant fusion** — `numeros_emis` n'existe pas encore à ce moment-là, on interroge donc la seule autre table qui a porté ces préfixes : `SELECT numero FROM documents_generes WHERE numero LIKE 'AXI-FACT-%' OR numero LIKE 'AXI-AVO-%';` doit être vide.
- Après atterrissage, vérifier la migration (AGENTS.md, « Un déploiement vert ne prouve PAS que le schéma a bougé ») puis `SELECT table_source, count(*) FROM numeros_emis GROUP BY 1;`.

## Corriger un numéro erroné à séquence élevée

Le registre étant en ajout seul, une erreur de saisie (un numéro `AXI-FACT-2026-900` inséré à la main au lieu de `-009`, par exemple) ne se corrige pas en supprimant la ligne métier : la borne resterait à 900, et la série sauterait 891 numéros. La seule sortie est de retirer la ligne **du registre**, ce que la base refuse par construction. Procédure, qui doit rester exceptionnelle :

1. **Qui** : le dirigeant, seul. C'est une décision de régularisation comptable, pas une opération technique ; elle ne se délègue ni à une session Claude, ni à un script, ni à un déploiement.
2. **Avant** : établir que le numéro n'a **jamais** été transmis à un tiers (ni PDF envoyé, ni pièce remise, ni écriture comptable). Un numéro transmis est émis, même par erreur : il ne se retire pas, il s'annule par avoir et le trou se justifie par une note d'écart.
3. **Comment** : connecté avec le rôle **propriétaire** de la table (seul autorisé à désactiver un déclencheur), dans UNE transaction :
   ```sql
   BEGIN;
   ALTER TABLE numeros_emis DISABLE TRIGGER numeros_emis_ajout_seul;
   DELETE FROM numeros_emis WHERE numero = 'AXI-FACT-2026-900';
   ALTER TABLE numeros_emis ENABLE TRIGGER numeros_emis_ajout_seul;
   COMMIT;
   ```
   `ALTER TABLE` étant transactionnel, un échec en cours de route laisse le déclencheur actif. Vérifier ensuite qu'il l'est : `SELECT tgenabled FROM pg_trigger WHERE tgname = 'numeros_emis_ajout_seul';` doit rendre `O`.
4. **Trace, obligatoire** :
   - une ligne au **registre des incidents Qualiopi** : date, numéro retiré, motif, preuve de non-transmission, auteur ;
   - une **note d'écart** jointe à la série concernée, qui explique la correction à l'auditeur ou au contrôleur fiscal.

Gate D (`tests/sql/numeros-emis-comportement.sql`, cas 0) exige les 11 déclencheurs **actifs** sur une base migrée à neuf : une désactivation laissée en place par une migration rougit la CI. En production, rien ne la verrait sinon la requête de l'étape 3 — d'où l'obligation de la jouer.
