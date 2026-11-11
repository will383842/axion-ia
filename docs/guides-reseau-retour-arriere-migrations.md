# Guide réseau — retour arrière MANUEL de deux anciennes migrations

> Fiche SITE-PETITS (audit du parcours guide réseau). **Note de procédure, rien n'est exécuté.**
> Les migrations ci-dessous sont déjà appliquées en production : **on ne les modifie jamais**
> et on ne leur ajoute pas de `rollback.sql` rétroactif. Ce document ne sert qu'à garder, au
> même endroit, le SQL inverse proposé, au cas où il faudrait défaire l'une d'elles à la main.

## Quand s'en servir

Seulement sur décision de Will, après sauvegarde de la base, **dans une transaction**, jamais
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

⚠️ **Perte de données à effets juridiques.** La table est la liste des personnes opposées à la
prospection commerciale. La supprimer fait recommencer les envois vers elles. La sauvegarder
(export des lignes) avant, et ne jamais la supprimer sans plan de remplacement.

```sql
BEGIN;
-- Sauvegarde préalable recommandée :
--   \copy email_oppositions TO 'email_oppositions.csv' CSV HEADER
DROP INDEX IF EXISTS "email_oppositions_email_hash_key";
DROP TABLE IF EXISTS "email_oppositions";
COMMIT;
```

Dépendances à vérifier avant : `oppositions_marques_crm` (migration postérieure) ne doit pas
référencer cette table ; sinon, la défaire d'abord via son propre `rollback.sql`.

## 2. `20260924120000_guide_requests_et_lettre`

⚠️ Supprime toutes les demandes de guide (`guide_requests`) et les champs de consentement de la
lettre. À défaire APRÈS les migrations postérieures qui touchent `guide_requests` /
`GuideRequestOrigine` (`guide_requests_dernier_clic`, `guide_request_origine_message_prive`,
`contacts_guide_reseau*`), dans l'ordre inverse de leur date.

```sql
BEGIN;
-- Sauvegarde préalable recommandée :
--   \copy guide_requests TO 'guide_requests.csv' CSV HEADER
DROP TABLE IF EXISTS "guide_requests";            -- emporte ses 4 index
ALTER TABLE "newsletter_subscribers"
  DROP COLUMN IF EXISTS "consent_form_ref",
  DROP COLUMN IF EXISTS "consent_version",
  DROP COLUMN IF EXISTS "last_sent_at",
  DROP COLUMN IF EXISTS "last_click_at",
  DROP COLUMN IF EXISTS "soft_bounce_count",
  DROP COLUMN IF EXISTS "last_soft_bounce_at";
DROP TYPE IF EXISTS "GuideRequestOrigine";        -- échoue tant qu'une colonne l'utilise
COMMIT;
```

Remarque : la migration n'a pas supprimé `newsletter_subscribers.ip_address` (retrait prévu
au lot L6) ; le retour arrière n'a donc rien à restaurer de ce côté.

## Après le retour arrière

1. Retirer la migration de l'historique pour que `prisma migrate deploy` ne la croie pas
   appliquée (sinon un futur rejouement est ignoré) :
   `DELETE FROM "_prisma_migrations" WHERE migration_name = '<nom de la migration>';`
   — ou `prisma migrate resolve --rolled-back <nom>` (ne fait que marquer l'échec ; à choisir
   en connaissance de cause).
2. Retirer du schéma Prisma les modèles et colonnes correspondants, dans une migration NOUVELLE.
3. Vérifier par `\d` que les objets ont disparu, puis lancer `prisma migrate status`.

## Non réversible : valeur d'énumération `message_prive`

`ALTER TYPE … ADD VALUE` (`20261101090000_guide_request_origine_message_prive`) ne s'annule pas en
PostgreSQL. Retirer la valeur impose de recréer le type (créer un type neuf sans elle, convertir
la colonne, supprimer l'ancien) après avoir réaffecté les lignes qui la portent. Procédure à
écrire au cas par cas ; non proposée ici.
