# Guide réseau — retour arrière MANUEL de deux anciennes migrations

> Fiche SITE-PETITS (audit du parcours guide réseau). **Note de procédure, rien n'est exécuté.**
> Les migrations ci-dessous sont déjà appliquées en production : **on ne les modifie jamais**
> et on ne leur ajoute pas de `rollback.sql` rétroactif. Ce document ne sert qu'à garder, au
> même endroit, le SQL inverse proposé, au cas où il faudrait défaire l'une d'elles à la main.

## Quand s'en servir

Seulement sur décision de Williams, après sauvegarde de la base, **dans une transaction**, jamais
depuis l'entrypoint ni la CI. Le retour arrière d'une migration ne retire pas sa ligne de
`_prisma_migrations` : après coup, il faut aussi traiter le journal (voir « Après le retour
arrière »). Le code qui lit ces objets doit avoir été retiré ou rendu tolérant AVANT
(fenêtre app/worker de ~50 min, cf. `AGENTS.md`).

## Migrations concernées

Ce sont les deux migrations qui touchent les tables du parcours guide réseau et n'ont ni
`rollback.sql` ni commande inverse dans leur en-tête :

| Migration                                 | Objets créés                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `20260902120000_email_oppositions`        | table `email_oppositions` + index unique sur `email_hash`                                  |
| `20260924120000_guide_requests_et_lettre` | type `GuideRequestOrigine`, table `guide_requests`, 6 colonnes de `newsletter_subscribers` |

(Les autres migrations du parcours sont déjà couvertes : `contacts_guide_reseau`,
`contacts_guide_reseau_origine_optionnelle` et `oppositions_marques_crm` ont un `rollback.sql` ;
`guide_requests_dernier_clic`, `guide_reseau_receptions` et `guide_reseau_origines` portent leur
commande inverse en en-tête. `guide_request_origine_message_prive` ajoute une valeur
d'énumération : PostgreSQL ne sait pas la retirer, voir la dernière section.)

## 1. `20260902120000_email_oppositions`

⚠️ **Données à effets juridiques.** La table est la liste des personnes opposées à la
prospection commerciale. Un stop l'emporte toujours : la table n'est **jamais supprimée**, elle
est seulement mise de côté sous un autre nom (les données sont conservées).

**Toute suppression de données de personnes (`DROP`, `DELETE`, `TRUNCATE`) exige un ordre écrit
de Williams. Sans cet ordre, ne rien supprimer.**

```sql
BEGIN;
-- Sauvegarde préalable recommandée :
--   \copy email_oppositions TO 'email_oppositions.csv' CSV HEADER
ALTER TABLE "email_oppositions" RENAME TO "email_oppositions_archive";
COMMIT;
```

Dépendances à vérifier avant : `oppositions_marques_crm` (migration postérieure) ne doit pas
référencer cette table ; sinon, la défaire d'abord via son propre `rollback.sql`.

## 2. `20260924120000_guide_requests_et_lettre`

⚠️ Met de côté les demandes de guide (`guide_requests`) et les champs de consentement de la
lettre : **rien n'est supprimé**, tout est renommé en `…_archive` (données conservées). **Toute
suppression exige un ordre écrit de Williams.** À défaire APRÈS les migrations postérieures qui touchent `guide_requests` /
`GuideRequestOrigine` (`guide_requests_dernier_clic`, `guide_request_origine_message_prive`,
`contacts_guide_reseau*`), dans l'ordre inverse de leur date.

```sql
BEGIN;
-- Sauvegarde préalable recommandée :
--   \copy guide_requests TO 'guide_requests.csv' CSV HEADER
ALTER TABLE "guide_requests" RENAME TO "guide_requests_archive";
ALTER TABLE "newsletter_subscribers" RENAME COLUMN "consent_form_ref" TO "consent_form_ref_archive";
ALTER TABLE "newsletter_subscribers" RENAME COLUMN "consent_version" TO "consent_version_archive";
ALTER TABLE "newsletter_subscribers" RENAME COLUMN "last_sent_at" TO "last_sent_at_archive";
ALTER TABLE "newsletter_subscribers" RENAME COLUMN "last_click_at" TO "last_click_at_archive";
ALTER TABLE "newsletter_subscribers" RENAME COLUMN "soft_bounce_count" TO "soft_bounce_count_archive";
ALTER TABLE "newsletter_subscribers" RENAME COLUMN "last_soft_bounce_at" TO "last_soft_bounce_at_archive";
-- Le type « GuideRequestOrigine » reste en place (il est encore utilisé par la table archivée).
COMMIT;
```

Remarque : la migration n'a pas supprimé `newsletter_subscribers.ip_address` (retrait prévu
au lot L6) ; le retour arrière n'a donc rien à restaurer de ce côté.

## Après le retour arrière

1. Retirer la migration de l'historique pour que `prisma migrate deploy` ne la croie pas
   appliquée (sinon un futur rejouement est ignoré) :
   `prisma migrate resolve --rolled-back <nom de la migration>` (ne fait que marquer l'échec ;
   à choisir en connaissance de cause). **Ne pas** effacer la ligne de `_prisma_migrations` à la
   main : toute suppression de ligne exige un ordre écrit de Williams.
2. Retirer du schéma Prisma les modèles et colonnes correspondants (ou les renommer), dans une migration NOUVELLE qui ne supprime aucune donnée.
3. Vérifier par `\d` que les objets ont bien été renommés en `…_archive`, puis lancer `prisma migrate status`.

## Non réversible : valeur d'énumération `message_prive`

`ALTER TYPE … ADD VALUE` (`20261101090000_guide_request_origine_message_prive`) ne s'annule pas en
PostgreSQL. Retirer la valeur impose de recréer le type (créer un type neuf sans elle, convertir
la colonne, remplacer l'ancien — suppression de l'ancien type seulement sur ordre écrit de Williams) après avoir réaffecté les lignes qui la portent. Procédure à
écrire au cas par cas ; non proposée ici.
