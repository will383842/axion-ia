/**
 * Chantier QNC, lot L03 — RECUEIL DU BESOIN, TEMPS 1 (avec l'entreprise, AVANT
 * le devis et la convention). Qualiopi, indicateur 4.
 *
 * Constantes partagées. Module PUR : ni Prisma, ni `next/*`.
 */

/** L'interrupteur du lot : `qualiopi.recueil.actif` (cf. `socle/interrupteurs.ts`). */
export const LOT_RECUEIL = "recueil";

/** `questionnaires_cadrage.modele` d'un questionnaire du recueil. */
export const MODELE_RECUEIL_BESOIN = "recueil_besoin_v1";

/** `remises_retours.objet` / `relances_journal.objet`. */
export const OBJET_RECUEIL_BESOIN = "recueil_besoin";

/** Journal (`activity_logs`) — ajout seul, c'est lui qui porte l'horodatage et l'auteur. */
export const ACTION_ANALYSE_VALIDEE = "qualiopi.recueil.analyse_validee";
export const ACTION_DEROGATION_ACCORDEE = "qualiopi.recueil.derogation_accordee";
export const ACTION_DEROGATION_UTILISEE = "qualiopi.recueil.derogation_utilisee";
export const ACTION_RECUEIL_LANCE = "qualiopi.recueil.lance";

/** Un motif de dérogation dit POURQUOI : en dessous, il ne dit rien. */
export const MOTIF_DEROGATION_MIN = 20;
export const MOTIF_DEROGATION_MAX = 1000;

/** Relance : sans réponse après N jours pleins, au plus MAX_RELANCES fois. */
export const DELAI_RELANCE_JOURS = 3;
export const MAX_RELANCES = 2;

/** Effectif d'un groupe (rubrique « participants »). */
export const PARTICIPANTS_MIN = 2;
export const PARTICIPANTS_MAX = 15;

/** Statuts de devis qui valent « devis accepté ». */
export const STATUTS_DEVIS_ACCEPTE: ReadonlyArray<string> = ["accepte", "transforme_convention"];

/** Types de pièces qui sont une CONVENTION, et parties auxquelles on l'envoie. */
export const TYPES_CONVENTION: ReadonlyArray<string> = ["convention", "convention_tripartite"];
export const PARTIES_DESTINATAIRES_CONVENTION: ReadonlyArray<string> = ["client", "financeur"];
