// ─── PREUVES SOCIALES — règles d'affichage (2026-10-09) ─────────────────────
// Le bandeau de logos clients et les avis clients ont été retirés le 2026-10-09
// après un message de la DGCCRF (décision de Will). Les deux ne reviennent pas
// de la même façon.
//
// LOGOS — interrupteur MANUEL, ci-dessous. Une marque ne s'affiche qu'avec
// l'accord écrit du client, jamais automatiquement. Pour rallumer : remplir
// `CLIENT_LOGOS` (src/content/home-data.ts) avec des clients réels ayant donné
// leur accord écrit, déposer leurs SVG dans `public/logos/clients/`, puis passer
// `LOGOS_CLIENTS_AFFICHES` à `true` — sur décision de Will uniquement.
//
// AVIS — règle AUTOMATIQUE, plus d'interrupteur. Les avis s'affichent d'eux-mêmes
// dès qu'au moins un avis `status = published` existe en base (validé par Will
// dans la console) : helper unique `avisPublies()` / `statsAvisPublies()`
// (src/server/reviews/presence.ts, cache 5 min).
// - 0 avis publié : RIEN. Pages /avis (hub, facettes, détail) et flux RSS en 404,
//   sitemap-avis absent de sitemap-index, pas de bloc, pas de lien de pied de
//   page, pas de ligne d'avis dans les e-mails.
// - 1 à 4 avis : les avis s'affichent, SANS note globale ni AggregateRating.
// - 5 avis ou plus (`AGGREGATE_MIN_COUNT`, src/lib/reviews/config.ts) : note
//   globale, étoiles et AggregateRating JSON-LD.
// Tout revient sans redéploiement : les pages sont dynamiques ou en ISR, et un
// 404 rendu en ISR est régénéré au bout de son `revalidate`.
//
// DÉPÔT — /avis/deposer reste TOUJOURS ouvert (200), même avec 0 avis publié :
// c'est par ce formulaire qu'arrivent les nouveaux avis.
//
// ⛔ Les témoignages écrits en dur (pages implémentation, pages villes,
// `SocialProof`) et les faits du savoir tirés des anciens avis ont été SUPPRIMÉS,
// pas éteints : aucun réglage ne peut les rallumer. Seuls de vrais avis publiés
// servent de preuve sociale.

/** Bandeau de logos clients (accueil, villes, régions, pages service, fiches). */
export const LOGOS_CLIENTS_AFFICHES = false;
