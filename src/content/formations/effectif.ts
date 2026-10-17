/**
 * Effectif d'une session de formation — SOURCE UNIQUE de tout ce que le site
 * public en dit.
 *
 * 🔴 2026-10-16 (lot L16, NC2/NC3) — Décision de Will : de 2 à 15 stagiaires par
 * session, pour les formations. Le site annonçait, selon les pages, « jusqu'à 15 »
 * ou « de 2 à 15 » (et « jusqu'à 30 » dans les tranches de prix) : un stagiaire,
 * un financeur ou un auditeur lisait plusieurs effectifs pour une même offre, et le
 * programme remis ne correspondait plus à la fiche (exigence orale O9).
 *
 * ⚠️ EXCEPTION : le SÉMINAIRE (`seminaire === true`) garde son propre effectif,
 * « jusqu'à 50 participants, en tables de 6 à 8 » (`EFFECTIF_SEMINAIRE_*`). Sa
 * modalité reste celle d'avant la PR (présentiel) tant que Will n'a pas tranché.
 *
 * Module sans dépendance, comme `delai-acces.ts` : il est lu par les fiches, les
 * pages de synthèse, la FAQ et la base de connaissances du générateur.
 *
 * Verrouillé par `src/content/formations/__tests__/l16-concordance-du-site.spec.ts`.
 */

/** Plancher d'une session : en dessous, ce n'est plus un groupe. */
export const EFFECTIF_MIN = 2;

/** Plafond d'une session : au-delà, l'accompagnement écran par écran n'est plus tenable. */
export const EFFECTIF_MAX = 15;

/** Fragment à insérer dans une phrase : « de 2 à 15 stagiaires par session ». */
export const EFFECTIF_PLAGE_FR = `de ${EFFECTIF_MIN} à ${EFFECTIF_MAX} stagiaires par session`;

/** Valeur d'un champ déjà étiqueté « Effectif » (fiche formation) : même texte, initiale en capitale. */
export const EFFECTIF_VALEUR_FR = `${EFFECTIF_PLAGE_FR.charAt(0).toUpperCase()}${EFFECTIF_PLAGE_FR.slice(1)}`;

/** Forme courte, pour un badge ou une ligne de carte. */
export const EFFECTIF_COURT_FR = `${EFFECTIF_MIN} à ${EFFECTIF_MAX} stagiaires`;

/** Version anglaise, pour les pages bilingues. */
export const EFFECTIF_PLAGE_EN = `${EFFECTIF_MIN} to ${EFFECTIF_MAX} trainees per session`;

/** Plafond du séminaire d'entreprise (une journée, tables de 6 à 8). */
export const EFFECTIF_SEMINAIRE_MAX = 50;

/** Valeur du champ « Effectif » de la fiche séminaire (programme remis). */
export const EFFECTIF_SEMINAIRE_FR = `Jusqu’à ${EFFECTIF_SEMINAIRE_MAX} participants, en tables de 6 à 8`;

/** Forme courte, pour une phrase ou un badge. */
export const EFFECTIF_SEMINAIRE_COURT_FR = `jusqu'à ${EFFECTIF_SEMINAIRE_MAX} personnes`;
