/**
 * TRADUCTION SQL du prédicat `estCandidatureFormateurFreelance`
 * (`formateur-freelance.ts`) — schéma n° 1 du chantier formateurs freelance, M-G.
 *
 * La migration `20261010150000_formateurs_socle` remplit
 * `job_offers.nature_collaboration` et `job_applications.nature_collaboration`
 * avec CES instructions, au caractère près (vérifié par
 * `le-sql-brut-du-socle-est-declare.spec.ts`). Le test d'intégration
 * `tests/integration/formateurs-socle/` les rejoue sur un corpus et compare
 * chaque ligne au prédicat TypeScript : la traduction n'est pas affirmée, elle
 * est mesurée.
 *
 * Fidélité au prédicat :
 *   · `plie()` = NFD, retrait des diacritiques U+0300–U+036F, minuscules. Le SQL
 *     fait EXACTEMENT cela (`normalize(…, NFD)`, `regexp_replace`, `lower`) —
 *     pas `unaccent`, dont les règles ne sont pas celles du prédicat ;
 *   · « contient » = sous-chaîne, comme `String.includes` (aucune borne de mot) ;
 *   · mots : `MOTS_FORMATEUR` et `MOTS_FREELANCE` pliés (« indépendant » et
 *     « independant » se confondent une fois pliés).
 *
 * ⚠️ Textes FIGÉS : ce sont ceux d'une migration appliquée. Si le prédicat
 * évolue, la colonne se maintient par le CODE (lot ultérieur), jamais en
 * réécrivant ces chaînes.
 *
 * ⚠️ Candidature AVEC offre : la colonne COPIE l'offre (décision du lot). Le
 * prédicat TypeScript, lui, lit aussi l'intitulé figé de la candidature : une
 * candidature « Formateur freelance » à une offre salariée y est freelance, ici
 * `salarie`. Écart voulu, montré par le test d'intégration.
 *
 * Module PUR (aucun import), lu seulement par les tests.
 */

/** Plie une expression SQL comme `plie()` : NFD, sans diacritiques, minuscules. */
const PLIE = (expr: string): string =>
  String.raw`lower(regexp_replace(normalize(coalesce(${expr}, ''), NFD), '[\u0300-\u036f]', '', 'g'))`;

/**
 * Le prédicat, sur une ligne `p` portant `slug`, `textes` (tableau de textes
 * pliés), `employment_type` et `secondary_employment_type`.
 */
const PREDICAT = `(
  coalesce(p."slug", '') = 'formateur-ia-freelance'
  OR (
    EXISTS (SELECT 1 FROM unnest(p."textes") AS t(v) WHERE t.v ~ '(formateur|formatrice)')
    AND (
      EXISTS (SELECT 1 FROM unnest(p."textes") AS t(v)
              WHERE t.v ~ '(formateur|formatrice)' AND t.v ~ '(freelance|independant)')
      OR coalesce(p."employment_type", '') = 'CONTRACTOR'
      OR coalesce(p."secondary_employment_type", '') = 'CONTRACTOR'
    )
  )
)`;

/** Offres : `freelance` là où le prédicat (appliqué à l'offre) est vrai. */
export const SQL_REMPLIR_NATURE_OFFRES = `UPDATE "job_offers" AS o
SET "nature_collaboration" = 'freelance'
FROM (
  SELECT j."id", j."slug", j."employment_type", j."secondary_employment_type",
         ARRAY[${PLIE('j."title_fr"')}, ${PLIE(`replace(j."slug", '-', ' ')`)}] AS "textes"
  FROM "job_offers" AS j
) AS p
WHERE p."id" = o."id" AND ${PREDICAT}`;

/** Candidatures à une offre : copie de la nature de l'offre (remplie juste avant). */
export const SQL_REMPLIR_NATURE_CANDIDATURES_DEPUIS_OFFRE = `UPDATE "job_applications" AS a
SET "nature_collaboration" = o."nature_collaboration"
FROM "job_offers" AS o
WHERE o."id" = a."offer_id"`;

/**
 * Candidatures SANS offre (spontanée, ou offre supprimée) : le prédicat
 * d'intitulé sur le titre figé. Faux → la colonne reste NULL (inconnu), jamais
 * `salarie` par défaut.
 */
export const SQL_REMPLIR_NATURE_CANDIDATURES_SPONTANEES = `UPDATE "job_applications" AS a
SET "nature_collaboration" = 'freelance'
FROM (
  SELECT x."id", NULL::text AS "slug", NULL::text AS "employment_type",
         NULL::text AS "secondary_employment_type",
         ARRAY[${PLIE('x."offer_title_snap"')}] AS "textes"
  FROM "job_applications" AS x
  WHERE x."offer_id" IS NULL
) AS p
WHERE p."id" = a."id" AND ${PREDICAT}`;
