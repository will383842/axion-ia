-- Une annulation vise les DEUX étapes, jamais une seule.
--
-- ## Ce que la migration précédente a manqué, et pourquoi
--
-- `20260909170000` fermait les relances `pending` dont l'ÉCHÉANCE ÉTAIT
-- DÉPASSÉE — au motif qu'une relance échue et non partie n'a plus de job
-- derrière elle. C'est vrai, mais ce n'est qu'une condition SUFFISANTE : elle
-- rate les lignes annulées dont l'échéance n'est pas encore arrivée.
--
-- Mesuré en production juste après son passage : 1 ligne fermée, et une
-- SECONDE ligne de la même personne (étape j7, échéance au 14/09) restée
-- `pending` alors que son job avait disparu de `bull:emails:delayed` avec sa
-- jumelle. Elle serait devenue une fausse alerte le 14 septembre.
--
-- 🔑 Un critère dérivé d'une conséquence observable rate les cas où la
-- conséquence n'est pas encore observable. Ici : « échue » n'est pas
-- « annulée », c'est seulement « annulée ET le temps a passé ».
--
-- ## Le critère juste, et il est expressible
--
-- `annulerRelancesLeadApporteur()` boucle sur `RELANCES_LEAD_APPORTEUR` et
-- annule TOUTES les étapes d'une adresse en un seul appel. Les deux lignes
-- d'une même adresse partagent donc toujours le même sort.
--
-- Le hash de l'adresse est le 5ᵉ segment de `job_id`
-- (`lead-apporteur-relance-{etape}-{hash}`, forme fixée par `jobIdRelance()`).
-- On ferme donc toute relance encore `pending` dont une SŒUR est déjà
-- `cancelled`.
--
-- ⚠️ Bornée aux lignes `pending` : une relance réellement PARTIE avant
-- l'annulation de sa jumelle garde son statut `sent`. On ne réécrit jamais la
-- preuve d'un envoi.

UPDATE "email_logs" AS a
   SET "status" = 'cancelled',
       "error"  = 'Relance annulée : le dossier complet est arrivé avant l''échéance. L''annulation vise les deux étapes ; ligne refermée par la migration 20260909200000.'
 WHERE a."status" = 'pending'
   AND a."template" = 'lead-apporteur-relance'
   AND a."job_id" IS NOT NULL
   AND EXISTS (
     SELECT 1
       FROM "email_logs" AS b
      WHERE b."template" = 'lead-apporteur-relance'
        AND b."status" = 'cancelled'
        AND b."job_id" IS NOT NULL
        AND split_part(b."job_id", '-', 5) = split_part(a."job_id", '-', 5)
   );
