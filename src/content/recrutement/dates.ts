// Dates de publication des offres de recrutement STATIQUES (hors DB).
// Règle Google for Jobs : `datePosted` = date RÉELLE de (re)publication de
// l'annonce — jamais une constante de build qui fige l'offre dans le passé,
// jamais un bump automatique sans vraie republication (risque spam).
//
// À rafraîchir UNIQUEMENT lors d'une republication légitime : offre toujours
// ouverte ET contenu revu (le cron `job-offers-freshness` du worker rappelle
// sur Telegram quand une offre dépasse 45 jours).

/**
 * Offre commerciale France entière (/devenir-commercial-ia).
 * 2026-08-12 = republication lors de la refonte « France entière » (40 hubs).
 */
export const COMMERCIAL_OFFER_DATE_POSTED = "2026-08-12T00:00:00.000Z";

/** Âge maximal (jours) avant que le cron fraîcheur signale une offre à republier. */
export const JOB_OFFER_FRESHNESS_MAX_DAYS = 45;

/**
 * Offres d'emploi STATIQUES (JobPosting inline hors DB) surveillées par le cron
 * fraîcheur (`formation-crons.offres-fraicheur`) et la pastille console.
 * Les offres DB (/carrieres/*) sont surveillées via Prisma, pas ici.
 *
 * ⚠️ La date déclarée ici doit rester ALIGNÉE sur le `datePosted` inline de la
 * page correspondante — republier = changer les DEUX.
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
    label: "Commercial indépendant IA (France entière)",
    datePosted: COMMERCIAL_OFFER_DATE_POSTED,
  },
  {
    // Page introduite par la PR #578 (datePosted inline 2026-08-13) — la
    // surveiller dès maintenant ne coûte rien si la route n'existe pas encore.
    path: "/fr/memo-isere",
    label: "Commercial indépendant (Mémo de l'Isère)",
    datePosted: "2026-08-13T00:00:00.000Z",
  },
];
