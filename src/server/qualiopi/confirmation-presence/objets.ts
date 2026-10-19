/**
 * Chantier QNC, NC6 — constantes pures de la confirmation de présence.
 *
 * Module PUR, sans import : le worker, la page de réponse et la console le
 * lisent tous. Les objets de trace tiennent dans `relances_journal.objet`
 * (≤ 80 caractères).
 */

/** Une demande de confirmation (ou sa relance) est partie vers le stagiaire. */
export const OBJET_PRESENCE_DEMANDE = "presence_confirmation" as const;

/** Réponse « je serai présent ». */
export const OBJET_PRESENCE_OUI = "presence_confirmation:oui" as const;

/** Réponse « je ne serai pas présent ». */
export const OBJET_PRESENCE_NON = "presence_confirmation:non" as const;

/** L'entreprise a été informée qu'un stagiaire n'a pas confirmé. */
export const OBJET_PRESENCE_INFO_ENTREPRISE = "presence_info_entreprise" as const;

/** Rang de la demande dans le journal : 1 = demande, 2 = relance. */
export const RANG_DEMANDE = 1 as const;
export const RANG_RELANCE = 2 as const;

/** Rang de l'information de l'entreprise (une seule). */
export const RANG_INFO_ENTREPRISE = 1 as const;

/** Plages d'envoi, en minutes depuis minuit, heure de Paris. */
export const PLAGE_STAGIAIRE = { debut: 9 * 60, fin: 19 * 60 } as const;
export const PLAGE_ENTREPRISE = { debut: 12 * 60, fin: 19 * 60 } as const;

/** Délai minimal entre la demande et l'information de l'entreprise. */
export const DELAI_AVANT_INFO_ENTREPRISE_MS = 3 * 60 * 60 * 1000;

/** Jours avant J : la demande part de J-3 à J-1, la relance de J-2 à J-1. */
export const JOURS_DEMANDE_PREMIER = 3 as const;
export const JOURS_RELANCE_PREMIER = 2 as const;
export const JOUR_DERNIER = 1 as const;

/** Plafond du jeton de confirmation. */
export const TTL_MAX_JETON_PRESENCE_MS = 30 * 24 * 60 * 60 * 1000;

export type ReponsePresence = "oui" | "non";
