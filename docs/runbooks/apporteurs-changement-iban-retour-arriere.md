# Changement d'IBAN des apporteurs : retour arrière (lot 1)

Plan : `docs/plans/apporteurs-changement-iban-2026-11-25.md` (§3.4, §9).
Migration : `prisma/migrations/20261126150000_apporteur_changement_iban`.

## Ce que le lot 1 pose

Quatre tables **neuves**, sans clé étrangère, sans énumération Postgres, sans colonne ajoutée à `apporteurs_reseau` :
`apporteur_changements_iban`, `apporteur_changements_iban_rib`, `apporteur_iban_historique`, `apporteur_virements_compte`.
Rien ne les lit ni ne les écrit tant que le lot 4 (cœur serveur) n'est pas en ligne : **aucun comportement ne change**.

## Retour arrière

**Il n'y en a pas, à dessein.** Aucun script de suppression n'est livré, et la migration n'a pas de `rollback.sql` :

- les tables peuvent rester en place si le code est retiré : rien d'ancien ne les lit ;
- les déclencheurs refusent `DELETE` et `TRUNCATE` (demandes, RIB joints, historique) et toute modification (compte d'un virement) ; seule la purge des octets d'un RIB passe :
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

## Limites à connaître (relecture sécurité du lot 1)

- **Les déclencheurs protègent contre une erreur de code, pas contre un rôle compromis.** Le propriétaire d'une
  table (ou un superutilisateur) peut faire `ALTER TABLE … DISABLE TRIGGER`, `DROP TRIGGER`, ou passer
  `session_replication_role` en `replica`. « Jamais supprimée » vaut pour le code applicatif. **Limite acceptée** :
  c'est le conteneur de l'application qui joue la migration, donc son rôle de connexion est propriétaire de ces
  tables. On ne vérifie pas un « rôle non propriétaire » : la protection vaut contre l'erreur de code, pas
  contre la compromission de ce rôle.
- **Pas de purge en fin de conservation dans ce lot.** Les déclencheurs interdisent de réécrire `iban` et de
  supprimer une ligne (demandes, historique). Quand la durée de conservation sera arrêtée (décision D-7, lot 8),
  la purge passera par une migration qui ajoute la sortie voulue au déclencheur : elle n'est pas devinée ici.
- **Textes RGPD : aucune durée affirmée.** Tant que D-7 n'est pas tranchée (avis du délégué), ni l'exception
  d'effacement (`rgpd-erase.ts`) ni la notice de l'export ne citent « 90 jours » ou « 5 ans » pour le RIB joint ;
  la notice de l'export (`NOTICE_EXCLUSIONS_DOSSIER`) ne mentionne pas ces quatre modèles avant le lot 8
  (liste `MODELES_IBAN_HORS_NOTICE_JUSQU_AU_LOT_8`, à vider à l'allumage).
- **RIB joint : nom de fichier neutre.** Colonnes alignées sur `pieces_apporteur` (`type_mime` 80, `nom_fichier`
  200 NOT NULL). Le lot 4 écrit toujours « rib.pdf », jamais le nom d'origine (il peut contenir l'IBAN).
- **`avis_envoye_at`** est posée par la base (`clock_timestamp()`) au passage de NULL à une valeur, et refusée
  avant la confirmation : le lot 4 n'a aucune date à fournir et l'écrit après l'envoi réel de l'e-mail.

## Pour les lots suivants (piège de format)

L'IBAN de la fiche (`apporteurs_reseau.iban`) est chiffré en `enc:v1`. L'historique et les demandes exigent `enc:v2`
(donnée liée `iban-historique:<id>` / `changement-iban:<id>`, clé exigée) : la validation **déchiffre l'ancien IBAN
puis le rechiffre en v2**, elle ne copie pas la chaîne. Un v1 copié tel quel est refusé par la base. Le statut des
demandes est un texte contraint (et non l'énumération nouvelle que le plan §3.2 proposait) : aucune valeur à
propager entre les deux conteneurs.

## Lots 5, 6 et 9 (espace, console, compléments) : retour arrière

Tout est sous `APPORTEUR_CHANGEMENT_IBAN_ENABLED` : **éteindre l'interrupteur** suffit. L'espace affiche « Pour changer de
compte, écrivez-nous » ; les pages des liens de l'e-mail répondent « Ce lien ne fonctionne plus » ; la console garde les demandes
visibles et plus aucune ne se valide. Aucune migration dans ces lots, aucune nouvelle forme de tâche BullMQ, aucun nouvel e-mail.

Le script `scripts/apporteurs/reprise-historique-iban.ts` (essai à blanc par défaut) ne modifie aucune fiche ; ses lignes
`dossier_initial` restent (ajout seul), comme le reste de l'historique.

**Lots 7 (virements, gel) et 8 (RGPD, purge, alerte 10 jours) : NON livrés** : ils attendent des décisions du dirigeant (D-4, D-6, D-7).
**Ne jamais allumer l'interrupteur avant le lot 7** (plan §9, point 5).

## Lot 7 : `IBAN_EMPREINTE_SECRET` absent au moment d'un virement

« Virement fait » reste possible sans ce secret : le virement est gardé, mais la preuve du compte payé
(empreinte + 4 derniers caractères) n'est pas écrite. Ce cas est signalé : message Sentry de niveau
`warning` (« IBAN_EMPREINTE_SECRET absent ») et ligne de journal `[apporteurs]`. Poser le secret sur
l'application ; les virements déjà faits sans preuve ne se rattrapent pas automatiquement.

La seconde lecture du gel se fait DANS la transaction du versement : une demande ouverte entre le
premier contrôle et l'écriture refuse le virement et n'écrit rien.
