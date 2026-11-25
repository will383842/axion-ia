# Changement d'IBAN des apporteurs : retour arrière (lot 1)

Plan : `docs/plans/apporteurs-changement-iban-2026-11-25.md` (§3.4, §9).
Migration : `prisma/migrations/20261126120000_apporteur_changement_iban`.

## Ce que le lot 1 pose

Quatre tables **neuves**, sans clé étrangère, sans énumération Postgres, sans colonne ajoutée à `apporteurs_reseau` :
`apporteur_changements_iban`, `apporteur_changements_iban_rib`, `apporteur_iban_historique`, `apporteur_virements_compte`.
Rien ne les lit ni ne les écrit tant que le lot 4 (cœur serveur) n'est pas en ligne : **aucun comportement ne change**.

## Retour arrière

**Il n'y en a pas, à dessein.** Aucun script de suppression n'est livré, et la migration n'a pas de `rollback.sql` :

- les tables peuvent rester en place si le code est retiré : rien d'ancien ne les lit ;
- les déclencheurs refusent `DELETE` et `TRUNCATE` (demandes, historique) et toute modification (compte d'un virement) :
  une demande est une preuve, un historique de comptes est un ajout seul ;
- une fois une demande validée, la fiche porte le nouvel IBAN, la pièce `rib` courante est le nouveau RIB et
  l'historique porte l'ancien : le retour à l'ancien compte se fait par **une nouvelle demande**, pas par une
  écriture à la main.

Si l'on retire le code d'un lot ultérieur : éteindre l'interrupteur `APPORTEUR_CHANGEMENT_IBAN_ENABLED`
(les demandes ouvertes restent visibles dans la console, aucune ne se valide tant qu'il est éteint).

## Compatibilité des deux conteneurs (AGENTS.md, « DEUX conteneurs » et D8b)

- **Application avant worker, ou l'inverse** : sans effet. Le worker ne lit pas ces tables ; `apporteurs_reseau`
  n'a pas changé de forme, donc ses lectures sans liste de colonnes ne cassent pas.
- **Le client Prisma plus récent que la base** (application mise en ligne, migration pas encore jouée) : le seul
  code qui lira ces tables est celui du lot 4, qui tolère la table absente (`P2021` : « pas de demande »).
- Aucune nouvelle forme de tâche BullMQ, aucun nouveau gabarit d'e-mail dans ce lot.

## Vérifier après la mise en ligne

```bash
ssh root@178.105.55.15 'docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}"'
docker logs <conteneur app> 2>&1 | grep entrypoint            # « Migrations applied successfully »
docker exec <conteneur app> /app/prisma-cli/node_modules/.bin/prisma migrate status --schema=./prisma/schema.prisma
```

La preuve dure reste l'existence des quatre tables (`\dt apporteur_*`) et de leurs déclencheurs
(`select tgname from pg_trigger where tgrelid::regclass::text like 'apporteur_%iban%' or tgrelid::regclass::text = 'apporteur_virements_compte'`).
