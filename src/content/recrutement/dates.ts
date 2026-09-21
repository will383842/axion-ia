// Dates de publication des offres de recrutement STATIQUES (hors DB).
// Règle Google for Jobs : `datePosted` = date RÉELLE de (re)publication de
// l'annonce — jamais une constante de build qui fige l'offre dans le passé,
// jamais un bump automatique sans vraie republication (risque spam).
//
// À rafraîchir UNIQUEMENT lors d'une republication légitime : offre toujours
// ouverte ET contenu revu (le cron `job-offers-freshness` du worker rappelle
// sur Telegram quand une offre dépasse 45 jours).

/**
 * Date de référence de la page /devenir-commercial-ia (republication « France
 * entière » du 2026-08-12).
 *
 * Elle ne date plus d'offre d'emploi Google : le JSON-LD qu'elle alimentait a
 * été retiré le 2026-09-19 (décision Will B5, un apporteur indépendant n'est
 * pas un poste). Elle reste le `lastmod` de `sitemap-recrutement.xml` — une
 * date stable, qui n'avance pas à chaque déploiement sans changement de page.
 */
export const COMMERCIAL_OFFER_DATE_POSTED = "2026-08-12T00:00:00.000Z";

/** Âge maximal (jours) avant que le cron fraîcheur signale une offre à republier. */
export const JOB_OFFER_FRESHNESS_MAX_DAYS = 45;

/**
 * Offres d'emploi STATIQUES (JobPosting inline hors DB) surveillées par le cron
 * fraîcheur (`formation-crons.offres-fraicheur`) et la pastille console.
 * Les offres DB (/carrieres/*) sont surveillées via Prisma, pas ici.
 *
 * ⛔ VIDE depuis le 2026-09-19 (décision Will B5). Les deux seules entrées —
 * `/fr/devenir-commercial-ia` (2026-08-12) et `/fr/memo-isere` (2026-08-13) —
 * portaient un JobPosting inline pour recruter des apporteurs d'affaires. Ce
 * balisage est retiré : un apporteur est un indépendant qui recommande, pas un
 * poste. Laissées ici, elles auraient fait réclamer par le cron, chaque lundi,
 * la « republication » d'offres qui n'existent plus, et compter deux fantômes
 * dans la pastille console. Le mécanisme reste pour une vraie offre statique
 * future (salariée) : republier = changer la date ici ET dans la page.
 */
export const STATIC_JOB_POSTINGS: ReadonlyArray<{
  /** Chemin FR canonique de l'annonce. */
  path: string;
  label: string;
  /** ISO — doit égaler le datePosted du JobPosting inline de la page. */
  datePosted: string;
}> = [];
