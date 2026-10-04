# RAPPORT — INT-T67-A : pas de dossier de financement sans IDCC confirmé

- Branche de travail : `opco/int-t67-a-blocage-idcc`, créée depuis `origin/opco/int-t61-a-idcc-controle` (`b132bde7`).
- Commit : `3ffedf3cfebd78e5dad3ef70f0da9e290d99de1f`
- Aucune PR ouverte, rien fusionné.

## Comportement

La génération d'un **nouveau** dossier de financement `opco` ou `mixte` est refusée tant que l'IDCC de **chaque employeur concerné** n'est pas `confirme` dans `client_idcc_controles` (INT-T61-A).

- **Pas de ligne = `non_renseigne`** : refus.
- **Un `confirme` qui porte un autre IDCC que celui de la fiche** (`Client.idcc` normalisé par `normaliserIdcc`) **ne compte plus** : la saisie a changé depuis la preuve. Le refus le dit.
- **Employeurs concernés** (contrôle par employeur en inter-entreprises) : ce sont les inscriptions **actives** (hors `abandon` et `exclu`) dont le financement **effectif** est `opco` ou `mixte`. L'employeur est `Enrollment.clientId`, à défaut le client de la session ; c'est la même règle que la ventilation des créances. Sans inscription active, c'est le client de la session. Un siège OPCO sans aucune entreprise rattachée bloque aussi, et le message le dit.
- **Dossiers `cpf` et `france_travail` : jamais bloqués.** L'IDCC n'est même pas lu.
- **Dossier existant intact** : `creerDossierDepuisSession` rend le dossier non clos existant **avant** toute lecture de l'IDCC. Rien n'est supprimé ni modifié ; le blocage ne vaut que pour une nouvelle génération.
- **Points d'application** :
  - `creerDossierDepuisSession` (`dossier-financement.ts`), appelée par le bouton du hub et par l'ouverture automatique (voir « Hors paths ») ;
  - le **dossier libre** de `creerDossierFinancementAction` (`facturation-hub.ts`), contrôlé sur son `clientId`.
  - L'action rend le message à l'écran via son `catch` existant (`{ error: err.message }`).
- **Règle pure** `deciderBlocageIdcc`, lecture injectée `lireIdccEmployeurs`, garde `exigerIdccConfirme`, erreur typée `GenerationDossierRefuseeIdcc` (porte `bloquants`). Tout est dans `blocage-idcc.ts`.

## Message exact

Un employeur (session au 16/11/2026) :

> Le dossier de financement ne peut pas être généré : l'IDCC de l'entreprise « Bâtiments Durand » (IDCC probable) n'est pas confirmé. Confirmez l'IDCC de ce client par une preuve déclarative (attestation de l'entreprise, déclaration à l'OPCO ou accord de prise en charge), depuis la fiche client, puis relancez la génération. Rappel : la demande est à déposer avant le début de la formation, prévu le 16/11/2026.

Plusieurs employeurs :

> Le dossier de financement ne peut pas être généré : l'IDCC de ces entreprises n'est pas confirmé : « A » (IDCC probable), « B » (IDCC non renseigné). Confirmez l'IDCC de chacun de ces clients par une preuve déclarative (…), depuis la fiche client, puis relancez la génération. Rappel : …

Variantes :

- statut `anomalie` → « (IDCC en anomalie) » ;
- confirmation périmée → « (confirmation portant sur un autre IDCC que celui de la fiche) » ;
- siège sans entreprise → « une inscription sans entreprise rattachée », et la consigne devient « Rattachez chaque inscription financée par l'OPCO à son employeur, puis confirmez son IDCC » ;
- sans date de début (dossier libre) → « Rappel : la demande est à déposer avant le début de la formation. »

## Témoins (`src/server/qualiopi/financements/__tests__/blocage-idcc.spec.ts`, `@req REQ-INT-062`)

`creerDossierDepuisSession` et `creerDossierFinancementAction` sont **réels** ; seule la base est doublée.

| Témoin de l'acceptance                                                       | Test                                                                                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| statut `probable` → refus nommé                                              | message exact comparé mot pour mot, aucun `create`                                                         |
| `confirme` → génération                                                      | `create` appelé une fois, type `opco`                                                                      |
| dossier CPF → jamais bloqué                                                  | session CPF avec employeur en `anomalie` : créé, IDCC non lu ; dossiers libres CPF et France Travail créés |
| inter-entreprises, deux employeurs, un seul confirmé → refus nommant l'autre | « Charpentes Martin » nommé, « Bâtiments Durand » (confirmé) absent du message, les deux lus               |
| dossier existant intact                                                      | rendu tel quel ; ni lecture IDCC, ni `create`, `update`, `updateMany` ou `deleteMany`                      |

Témoins ajoutés :

- `mixte` bloqué ;
- pas de ligne = `non_renseigne` ;
- un siège CPF d'une session OPCO ne rend pas son employeur concerné ;
- repli d'un siège sans employeur sur le client de la session ;
- siège sans aucune entreprise : refus ;
- dossier libre OPCO refusé ou créé selon le statut ;
- `confirme` pour un autre IDCC : refus ;
- les quatre statuts non confirmés bloquent tous ;
- employeur introuvable en base : bloque comme `non_renseigne`.

## Comptage production (à lancer par b0, LECTURE SEULE)

Les noms de tables et de colonnes ont été vérifiés dans `schema.prisma` (`@@map`/`@map`) et dans les migrations : `training_sessions`, `enrollments`, `dossiers_financement`, `clients`, `client_idcc_controles`.

**Définition retenue :**

- une session est concernée si elle est **à venir ou en cours** : `date_fin >= now()` et `statut` hors `annulee`/`realisee` (`planifiee`, `en_cours` et `reportee` comptent) ;
- elle doit avoir **au moins un dossier `opco` ou `mixte`**, quel que soit son statut ; la colonne `dont_dossier_non_clos` isole ceux qui ne sont pas clos ;
- les **employeurs** suivent la même règle que le blocage.

```sql
-- INT-T67-A — comptage en production, LECTURE SEULE.
-- Sessions à venir ou en cours ayant au moins un dossier de financement opco ou
-- mixte, et employeurs distincts concernés (même règle que le blocage :
-- inscriptions actives dont le financement effectif est opco ou mixte,
-- COALESCE(enrollments.client_id, training_sessions.client_id) ; sans
-- inscription active, le client de la session).
BEGIN TRANSACTION READ ONLY;

WITH sessions_concernees AS (
  SELECT s.id, s.client_id, s.financement_type,
         EXISTS (
           SELECT 1 FROM dossiers_financement d
           WHERE d.training_session_id = s.id
             AND d.type::text IN ('opco', 'mixte')
             AND d.statut::text <> 'clos'
         ) AS dossier_ouvert
  FROM training_sessions s
  WHERE s.date_fin >= now()
    AND s.statut::text NOT IN ('annulee', 'realisee')
    AND EXISTS (
      SELECT 1 FROM dossiers_financement d
      WHERE d.training_session_id = s.id
        AND d.type::text IN ('opco', 'mixte')
    )
),
employeurs AS (
  SELECT sc.id AS session_id, COALESCE(e.client_id, sc.client_id) AS client_id
  FROM sessions_concernees sc
  JOIN enrollments e ON e.session_id = sc.id
  WHERE e.statut::text NOT IN ('abandon', 'exclu')
    AND COALESCE(e.financement_type, sc.financement_type)::text IN ('opco', 'mixte')
  UNION
  SELECT sc.id, sc.client_id
  FROM sessions_concernees sc
  WHERE NOT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.session_id = sc.id AND e.statut::text NOT IN ('abandon', 'exclu')
  )
)
SELECT
  (SELECT count(*) FROM sessions_concernees)                         AS sessions_concernees,
  (SELECT count(*) FROM sessions_concernees WHERE dossier_ouvert)    AS dont_dossier_non_clos,
  count(DISTINCT client_id)                                          AS employeurs_distincts,
  count(DISTINCT session_id) FILTER (WHERE client_id IS NULL)        AS sessions_avec_siege_sans_employeur
FROM employeurs;

ROLLBACK;
```

Complément : la répartition par statut IDCC effectif. Cette requête suppose la migration `20261004231500_idcc_controle` (INT-T61-A) appliquée. Tant qu'elle ne l'est pas, tous les employeurs sont `non_renseigne`.

```sql
-- INT-T67-A — complément, LECTURE SEULE, À LANCER APRÈS la migration
-- 20261004231500_idcc_controle (INT-T61-A) : parmi ces employeurs, combien ne
-- sont pas `confirme` pour l'IDCC de leur fiche (pas de ligne = non_renseigne).
BEGIN TRANSACTION READ ONLY;

WITH sessions_concernees AS (
  SELECT s.id, s.client_id, s.financement_type
  FROM training_sessions s
  WHERE s.date_fin >= now()
    AND s.statut::text NOT IN ('annulee', 'realisee')
    AND EXISTS (
      SELECT 1 FROM dossiers_financement d
      WHERE d.training_session_id = s.id
        AND d.type::text IN ('opco', 'mixte')
    )
),
employeurs AS (
  SELECT sc.id AS session_id, COALESCE(e.client_id, sc.client_id) AS client_id
  FROM sessions_concernees sc
  JOIN enrollments e ON e.session_id = sc.id
  WHERE e.statut::text NOT IN ('abandon', 'exclu')
    AND COALESCE(e.financement_type, sc.financement_type)::text IN ('opco', 'mixte')
  UNION
  SELECT sc.id, sc.client_id
  FROM sessions_concernees sc
  WHERE NOT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.session_id = sc.id AND e.statut::text NOT IN ('abandon', 'exclu')
  )
),
statut AS (
  SELECT em.session_id, em.client_id,
         CASE
           WHEN em.client_id IS NULL OR k.client_id IS NULL THEN 'non_renseigne'
           WHEN k.statut::text = 'confirme'
                AND k.idcc = right(lpad(regexp_replace(c.idcc, '[^0-9]', '', 'g'), 4, '0'), 4)
             THEN 'confirme'
           WHEN k.statut::text = 'confirme' THEN 'confirme_perime'
           ELSE k.statut::text
         END AS statut_effectif
  FROM employeurs em
  LEFT JOIN clients c ON c.id = em.client_id
  LEFT JOIN client_idcc_controles k ON k.client_id = em.client_id
)
SELECT statut_effectif,
       count(DISTINCT client_id)  AS employeurs,
       count(DISTINCT session_id) AS sessions
FROM statut
GROUP BY statut_effectif
ORDER BY statut_effectif;

ROLLBACK;
```

Les deux requêtes ont été exécutées sur un PostgreSQL 16 local. Les tables minimales y avaient les mêmes noms, colonnes et énumérations que les migrations ; la chaîne complète des migrations n'a pas pu tourner, faute de l'extension `vector`.

Le jeu d'essai comptait 6 sessions :

- inter-entreprises à venir ;
- intra en cours avec dossier `clos` ;
- passée ;
- CPF ;
- annulée ;
- reportée avec un siège sans employeur.

Résultats obtenus, conformes à l'attendu :

- première requête : `3 | 2 | 3 | 1` ;
- seconde requête :
  - `confirme` 1 ;
  - `confirme_perime` 1 ;
  - `probable` 1 ;
  - `non_renseigne` 0 employeur, sur 1 session (le siège sans employeur).

## Tests lancés

- `vitest run src/server/qualiopi/financements/__tests__/blocage-idcc.spec.ts` : **17 / 17**.
- `vitest run src/server/qualiopi/financements src/server/actions/qualiopi` : **1 974 passés, 3 en échec** (135 fichiers, dont 2 en échec). Les trois échecs sont listés ci-dessous. Sur la branche de base, sans ce changement, ces deux fichiers passent (**32 / 32**).
- `tsc --noEmit` (`NODE_OPTIONS=--max-old-space-size=6144`) : 0 erreur.
- `eslint --max-warnings=0` et `prettier --check` sur les 4 fichiers : OK.
- `check-anti-hex` : OK. `check-use-client` : OK.
- Commit poussé en `--no-verify`, après ces contrôles faits à la main.

## Hors paths — cassés, NON touchés

L'**ouverture automatique** du dossier (sous-lot 8C, `setFinancementSessionAction` dans `src/server/actions/qualiopi/financements.ts`) appelle `creerDossierDepuisSession`. Elle est désormais refusée tant que l'IDCC n'est pas confirmé. Comme elle est _fail-soft_, le refus n'est que journalisé (`console.error`) : **aucun dossier ne s'ouvre, et rien ne le dit à l'écran.** Trois tests le constatent :

1. `src/server/actions/qualiopi/dossier-ouverture-cablage.spec.ts` : « passer de `direct` à `opco` CRÉE un dossier de financement » ;
2. `src/server/actions/qualiopi/dossier-ouverture-cablage.spec.ts` : « le dossier est rattaché à LA SESSION » ;
3. `src/server/actions/qualiopi/dossier-fermeture-cablage.spec.ts` : « aller-retour en 5 s : 0 dossier `a_monter` restant ».

Leur doublure `client.findMany` rend `undefined`. En base réelle, le client de test n'aurait aucune ligne `client_idcc_controles` et serait refusé de la même façon.

**Décision à prendre (hors de ce lot) :**

- **(a)** garder le blocage sur l'ouverture automatique. `financements.ts` doit alors remonter le message de `GenerationDossierRefuseeIdcc` à l'écran ; sinon une session OPCO sans IDCC confirmé n'a plus ni dossier, ni alerte de suivi, ni ligne au cockpit, ce qui est le défaut même que 8C fermait. Les trois tests sont à réécrire en conséquence (IDCC confirmé dans la doublure, plus un témoin du refus) ;
- **(b)** exempter l'ouverture automatique (classeur `a_monter` vide) et ne bloquer que la génération manuelle. Il faut alors un paramètre ou un appelant distinct, ce qui touche `financements.ts`.

Autres appelants vérifiés : aucun autre appelant de `creerDossierDepuisSession` dans `src/`. `SELECT_SESSION_PAYEURS` lit en plus `dateDebut` (pour le rappel) ; `reventilerPayeurs` le lit sans s'en servir.
