// Dates de publication des offres de recrutement STATIQUES (hors DB).
// Règle Google for Jobs : `datePosted` = date RÉELLE de (re)publication de
// l'annonce — jamais une constante de build qui fige l'offre dans le passé,
// jamais un bump automatique sans vraie republication (risque spam).
//
// À rafraîchir UNIQUEMENT lors d'une republication légitime : offre toujours
// ouverte ET contenu revu (le cron `job-offers-freshness` du worker rappelle
// sur Telegram quand une offre dépasse 45 jours).

/**
 * Date de référence des landings apporteurs d'affaires (/devenir-commercial-ia et ses pages
 * sœurs) : refonte complète depuis les maquettes validées, le 2026-11-09. Elle alimente le
 * « Mis à jour le » visible, le `dateModified` du JSON-LD et le `lastmod` du sitemap.
 * (Précédente republication « France entière » : 2026-08-12.)
 *
 * Elle ne date PAS l'offre Google : celle-ci a sa propre date,
 * `APPORTEUR_JOB_POSTING_DATE_POSTED`. Elle reste, avec elle, le `lastmod` de
 * `sitemap-recrutement.xml` — une date stable, qui n'avance pas à chaque
 * déploiement sans changement de page.
 */
export const COMMERCIAL_OFFER_DATE_POSTED = "2026-11-09T00:00:00.000Z";

/**
 * Date de publication du JobPosting prudent de `/fr/devenir-commercial-ia`.
 * B5 levée pour CETTE SEULE page par décision de Will du 25/11/2026, risques juridique
 * (salariat déguisé) et Google (règle affiliate) assumés ; `/memo-isere` reste exclue.
 * Republier = changer cette date ET relancer la page (le builder la lit ici).
 */
export const APPORTEUR_JOB_POSTING_DATE_POSTED = "2026-11-25T00:00:00.000Z";

/** Âge maximal (jours) avant que le cron fraîcheur signale une offre à republier. */
export const JOB_OFFER_FRESHNESS_MAX_DAYS = 45;

/**
 * Offres d'emploi STATIQUES (JobPosting inline hors DB) surveillées par le cron
 * fraîcheur (`formation-crons.offres-fraicheur`) et la pastille console.
 * Les offres DB (/carrieres/*) sont surveillées via Prisma, pas ici.
 *
 * Une seule entrée : `/fr/devenir-commercial-ia`. B5 levée pour CETTE SEULE page par décision
 * de Will du 25/11/2026, risques juridique et Google assumés ; `/memo-isere` reste exclue.
 * Le cron de fraîcheur la surveille comme toute offre statique : republier = changer la date
 * ici ET le contenu de la page.
 */
export const STATIC_JOB_POSTINGS: ReadonlyArray<{
  /** Chemin FR canonique de l'annonce. */
  path: string;
  label: string;
  /** ISO — doit égaler le datePosted du JobPosting inline de la page. */
  datePosted: string;
}> = [
  {
    path: "/fr/devenir-commercial-ia",
    label: "Apporteur d'affaires indépendant (page principale)",
    datePosted: APPORTEUR_JOB_POSTING_DATE_POSTED,
  },
];
