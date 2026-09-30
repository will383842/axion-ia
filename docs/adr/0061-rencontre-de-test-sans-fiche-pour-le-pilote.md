# ADR 0061 — Rencontre de test sans fiche pour le pilote (chemin « nouveau prospect »)

- **Statut** : proposé (PR `visio/correctifs-d-schema`, label `schema`)
- **Date** : 2026-09-30
- **Constat** : vérification finale V1 du chantier visio, défaut **P-2** (lentille « parcours prospect »)
- **Prolonge** : ADR 0053 (dossier client, point « client fictif »), ADR 0054 (drapeau `ferme | pilote | ouvert`)
- **Référence** : migration `prisma/migrations/20260930170000_visio_rencontre_de_test_calendly` ; `src/server/visio/adresses-de-test.ts` ; `src/features/dossier-client/rencontre-calendly.ts` ; `src/features/dossier-client/creer-prospect.ts` ; `tests/sql/dossier-client-comportement.sql` (cas 19)

## Contexte

En mode `pilote`, seules les rencontres `estTestInterne` s'enregistrent (`sessions.ts`, étape 6). Jusqu'ici, une rencontre de test ne naissait que **saisie dans la console, sur la fiche fictive** « Atelier Test Fictif » (`creerRencontre`), et la base l'imposait : `CHECK rencontres_test_interne_saisie (NOT est_test_interne OR source = 'saisie_manuelle')`.

L'essai réel exigé par Will (« faux rendez-vous », fin de chantier) passait donc par une fiche **déjà rangée**. Le chemin d'un **nouveau prospect** ne pouvait tourner en réel qu'avec le premier vrai prospect, après l'annonce publique :

- réservation Calendly, liste blanche, rencontre créée à la demande ;
- rencontre « à classer », passe P2 sautée (`en_attente_client`) ;
- « Créer la fiche prospect », puis `completerApresRattachement` (P2 à P5), puis le devis ;
- proposition de fiche par adresse.

C'est aussi sur ce chemin que se voit le défaut P-1 (version remplacée qui revient « à valider »).

## Décision

1. **Une liste d'adresses de test, côté serveur** : la variable `VISIO_ADRESSES_DE_TEST` (site ET worker, lue à l'exécution). Elle contient des adresses, ou leurs empreintes `hashEmailForLookup` (64 hex), séparées par des virgules. Jamais dans le dépôt, qui est public. Si elle est absente, aucune adresse n'est de test et rien ne change.
2. **`assurerRencontrePourCalendly` marque `estTestInterne`** quand l'adresse du **titulaire** de la réservation est dans la liste. Le marquage se fait **à la création seulement** : une rencontre existante n'est jamais marquée après coup, car la purge du pilote supprime toute rencontre `estTestInterne`, et une rencontre peut déjà être rangée chez un vrai client. La rencontre reste « à classer » et sans fiche (A4 inchangé).
3. **La base accepte une rencontre de test née de Calendly** : `rencontres_test_interne_saisie` devient `NOT est_test_interne OR source IN ('saisie_manuelle', 'calendly')`. C'est le même nom : la contrainte est supprimée puis recréée dans la transaction de la migration. Le CHECK est élargi : aucune ligne existante ne peut le violer, rien n'est repris ni perdu. La partie Prisma de la migration est vide, et `schema.prisma` ne change pas.
4. **« Créer la fiche prospect » depuis une rencontre de test inscrit la fiche créée dans `clients_test_interne`.** Elle devient une fiche fictive : la purge du pilote (`purgerPilote`) efface ses rencontres, projets et personnes, comme ceux de la fiche fictive d'origine. La fiche elle-même reste, comme la fiche fictive. Sa suppression est un geste de Will.
5. **Une garde sur les redéfinitions** (`tests/unit/ci/un-objet-sql-brut-redefini-l-est-dans-la-meme-migration.spec.ts`) :
   - aucune migration postérieure à celle du chantier ne supprime un objet déclaré dans `prisma/objets-sql-bruts.ts` sans le recréer, sous le même nom et sur la même table, dans la même migration ;
   - le miroir en mémoire des tests (`_dossier-en-memoire.ts`) suit la **dernière** définition du CHECK, source par source.

## Ce que cette décision ne fait PAS

- **Elle n'assouplit pas `rencontres_saisie_sur_fiche_validee`.** La synthèse V1 proposait d'en exempter les rencontres de test, pour la variante « rendez-vous de test sans fiche » de `creerRencontre`. Cette variante n'est pas codée, et aucun écrivain ne demande l'exemption : l'ajouter élargirait la base pour rien. Gate D prouve qu'une saisie de test sans fiche reste refusée (cas 19). Si la variante est voulue un jour, l'exemption tient en une migration.
- **Elle n'ouvre pas l'enregistrement.** Le drapeau reste `ferme` tant que Will ne pose pas `ENREGISTREMENT_VISIO_PILOTE=true`. Une rencontre de test n'est enregistrable qu'en `pilote` ou `ouvert`.
- **Elle n'empêche pas de ranger une rencontre de test chez un vrai client** si l'adresse de test appartient déjà à une fiche réelle. La proposition par adresse la suggère, et Will valide ou non. La rencontre reste de test : elle est exclue des synthèses (`HORS_RENCONTRES_DE_TEST`) et purgée avec le pilote. Il faut donc choisir une adresse de test qui n'est le contact d'aucune fiche.
- **Elle ne change rien à Axion Partners.** La fiche créée passe par la porte unique `creerOuRetrouverClient`, comme toute fiche prospect. Si l'émission `client.cree` (INT-T03) atterrit avant l'essai, elle partira pour cette fiche d'essai comme pour une autre.

## Fenêtre app/worker

- **Image N-1 sur base migrée** : elle n'écrit `est_test_interne` que pour une saisie, ce qui reste dans le nouveau domaine.
- **Image N sur base non migrée** (le worker est bâti ~50 min avant que l'app ne joue la migration) : elle ne marque une rencontre Calendly que si `VISIO_ADRESSES_DE_TEST` est posée. **La variable ne se pose qu'après avoir vérifié la migration en production.** Sans elle, le code neuf écrit exactement ce qu'écrivait l'ancien.

## Protocole de l'essai réel « nouveau prospect » (s'ajoute au jalon O-1)

1. Vérifier la migration en production (lecture seule) : `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'rencontres_test_interne_saisie'` doit contenir `'calendly'`.
2. Poser `VISIO_ADRESSES_DE_TEST=<adresse d'essai>` sur le site ET le worker. L'adresse ne doit être le contact d'aucune fiche. Redémarrer les deux.
3. Drapeau `ENREGISTREMENT_VISIO_PILOTE=true` (déjà requis par O-1).
4. Réserver un « Discutons de votre projet IA » sur `/fr/appel` avec cette adresse, sans nom d'entreprise connu.
5. Vérifier que la rencontre du jour apparaît « à classer » avec le badge « test interne », puis l'enregistrer avec l'extension.
6. Attendre le compte rendu `a_valider` (P2 sautée : `en_attente_client`).
7. Ouvrir « Après l'appel », puis « Créer la fiche prospect ». Contrôler que la fiche est inscrite dans `clients_test_interne`, que P2 à P5 repartent, et qu'**une seule** version est « à valider » (défaut P-1).
8. Faire « Valider et préparer le devis » : le devis s'ouvre avec le projet.
9. Purger : `pnpm exec tsx scripts/visio/pilote.ts --purger` (à blanc), puis `--appliquer`. Retirer `VISIO_ADRESSES_DE_TEST`, puis supprimer la fiche d'essai à la main.

## Réversion

L'ancien CHECK refuse les rencontres Calendly de test. Pour revenir en arrière : purger le pilote, puis appliquer le SQL de réversion écrit en commentaire dans la migration. Le code seul se retire sans migration : sans la variable, il n'écrit plus de rencontre Calendly de test.
