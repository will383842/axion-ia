/**
 * Le REGISTRE des campagnes de relance (lot CAMP-3, 08 §12.3 couche 2).
 *
 * Chaque campagne se DÉCLARE ici : son identifiant, son gabarit (un e-mail formateur
 * indépendant), sa classe, sa règle (moteur pur `lib/relances/campagne.ts`), les
 * interrupteurs dont elle dépend, et son lecteur de faits EN LOT. Aucune règle de
 * relance propre ailleurs : le passage horaire (`passer-campagnes.ts`) décide pour toutes.
 *
 * 🔴 ÉTEINT À LA LIVRAISON. Le registre était VIDE à CAMP-3 : chaque séquence (S1 à S12) est
 * déclarée par son lot, quand ses faits se lisent en base. Une campagne déclarée ne part
 * que si TOUS ses interrupteurs sont allumés (dépendance de coupure : couper une clé mère
 * suspend ses campagnes filles) et que son texte est validé.
 *
 * Module sans `server-only` : le passage tourne dans le worker.
 */

import type { GabaritFormateurIndependant } from "@/lib/email/templates/formateur-independant-textes";
import type { EtatCampagne, RegleCampagne } from "@/lib/relances/campagne";
import type { CleEnvoi } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import {
  CAMPAGNE_PIECES,
  CAMPAGNE_VIGILANCE,
  CAMPAGNE_VIGILANCE_SEUIL,
} from "@/server/qualiopi/formateurs-independants/pieces-relances";
import { CAMPAGNE_RELANCE_DOSSIER } from "@/server/qualiopi/formateurs-independants/relance-dossier";
import { CAMPAGNE_S1 } from "@/server/qualiopi/formateurs-independants/invitation-formateurs";
import { CAMPAGNE_BILAN } from "@/server/qualiopi/formateurs-independants/bilan-fin-formation/relance";
import {
  CAMPAGNE_CONTRAT,
  CAMPAGNE_LETTRE_1RE,
  CAMPAGNE_LETTRE_J3,
  CAMPAGNE_NDA,
  CAMPAGNE_NOUVELLE_VERSION,
} from "@/server/qualiopi/formateurs-independants/relances-missions";

/** A sollicitation (invitation) ; B obligation (pièce, signature) ; C information et argent. */
export type ClasseCampagne = "A" | "B" | "C";

/** Une personne à relancer, telle que le lecteur de la campagne l'a lue. */
export interface FaitsCampagne {
  /** La fiche concernée (journal des envois). */
  readonly entityId: string;
  /** Identifiant de la PERSONNE, jamais une adresse : sert au « un par jour ». */
  readonly personneId: string;
  /** Identifiant de l'ORIGINE (lien envoyé, contrat émis…) : entre dans la clé. */
  readonly origineId: string;
  readonly destinataire: string;
  /**
   * L'état lu. `derniereRelancePersonne` peut rester vide : le PASSAGE impose lui-même
   * « une relance par personne et par jour » sur toutes les campagnes (journal ET corbeille).
   */
  readonly etat: EtatCampagne;
  /**
   * Lot 8A — la date de l'ENVOI DE DÉPART de la campagne (l'e-mail auquel le formateur
   * répond). Une réponse humaine postérieure arrête la relance. Absente : l'origine, qui
   * l'est presque partout ; à poser quand l'origine n'est qu'un repère de calendrier
   * (F27 « J-3 » : 3 jours avant la mission, alors que la lettre F26 est partie avant).
   */
  readonly depart?: Date;
  /** Le payload de l'e-mail (valeurs des crochets, lien). */
  readonly payload: Record<string, unknown>;
  /**
   * Lot C (M16) — complète le payload AU MOMENT de l'envoi, jamais à la lecture (un lien de
   * signature neuf révoque le précédent : on ne l'émet que pour une relance qui part).
   * `null` : rien n'est envoyé à ce passage (la relance sera redécidée au suivant).
   */
  readonly completerPayload?: (
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  /**
   * V2-P-6 — appelé quand l'envoi complété n'a été ni enfilé ni garé : défait ce que
   * `completerPayload` a émis (le lien neuf est retiré, le précédent redevient valable).
   * Jamais de formateur sans lien de signature valable.
   */
  readonly renoncerPayload?: (payload: Record<string, unknown>) => Promise<void>;
}

export interface DeclarationCampagne<E extends string = string> {
  /** Court, sans `:` (il entre dans la clé d'envoi). */
  readonly id: string;
  readonly gabarit: GabaritFormateurIndependant;
  readonly entityType: "Trainer" | "JobApplication";
  readonly classe: ClasseCampagne;
  readonly regle: RegleCampagne<E>;
  /** Interrupteurs à allumer TOUS (le premier est la clé mère). */
  readonly interrupteurs: readonly [CleEnvoi, ...CleEnvoi[]];
  /**
   * La variante du texte (1, 2…) pour une étape. Absente : le rang de l'étape. Sert quand
   * le texte validé n'a pas une variante par étape (F41 : la 3e variante est le refus).
   */
  readonly variante?: (etape: string) => number;
  /**
   * Lot 8A (décision du dirigeant, #1511) — une réponse HUMAINE du formateur, reçue après
   * l'origine, arrête la relance (motif `reponse-humaine`). Réservé aux campagnes sur une
   * fiche formateur (`entityType: "Trainer"`) ; aucune campagne apporteur ni client ne le lit.
   */
  readonly arreteeParReponseFormateur?: boolean;
  /** Lecture en lot des personnes candidates. Lève : le passage saute la campagne. */
  readonly lireFaits: (maintenant: Date) => Promise<readonly FaitsCampagne[]>;
}

/**
 * Clé anti-doublon d'une relance : `fi-<campagne>-<entité>-<origine>-<étape>`, 200
 * caractères au plus, sans `:`. Jamais une adresse.
 */
export function cleRelance(
  campagne: string,
  entityId: string,
  origineId: string,
  etape: string,
): string {
  return `fi-${campagne}-${entityId}-${origineId}-${etape}`.replace(/:/g, "-").slice(0, 200);
}

/**
 * Les campagnes déclarées. VIDE à la livraison de CAMP-3 : S1 (L-INV), S3 et S5 (L6),
 * S4 (L7b), S6 à S7 (L13), S8 et S9 bis (L11c), S9 (L12c), S11 (L7d) s'y inscrivent.
 *
 * Inscrites : S3 et S5 (L6), derrière `relances_auto` ; S6 et S6 bis (L13b), derrière `pieces_cron`. S1 (L-INV), derrière `invitation_auto`.
 * Chacune reste éteinte tant que ses interrupteurs ne sont pas TOUS allumés.
 */
const DECLAREES: readonly DeclarationCampagne[] = [
  // L6 — S3 (et S5 par son origine F12) : relances du dossier en ligne.
  CAMPAGNE_RELANCE_DOSSIER as DeclarationCampagne,
  // L13b — S6 et S6 bis : relances des pièces à renouveler.
  CAMPAGNE_VIGILANCE,
  CAMPAGNE_PIECES,
  // Lot G1 — F40 à l'approche du seuil de vigilance, derrière les mêmes interrupteurs.
  CAMPAGNE_VIGILANCE_SEUIL as DeclarationCampagne,
  // S1 (L-INV) — rappels de l'invitation à l'échange formateur (F2), J+3 et J+7.
  CAMPAGNE_S1 as DeclarationCampagne,
  // Lot C (M16) — S4 : F18 (contrat) ; F45 (nouvelle version) ; F27 (lettre, deux relances) ;
  // F21 (numéro de déclaration « en cours »).
  CAMPAGNE_CONTRAT as DeclarationCampagne,
  CAMPAGNE_NOUVELLE_VERSION as DeclarationCampagne,
  CAMPAGNE_LETTRE_1RE as DeclarationCampagne,
  CAMPAGNE_LETTRE_J3 as DeclarationCampagne,
  CAMPAGNE_NDA as DeclarationCampagne,
  // Lot G2 — F61 : le bilan de fin de formation, J+2 et J+7 après la dernière journée,
  // derrière `formateurs.bilan_fin_formation` (lu par la campagne elle-même).
  CAMPAGNE_BILAN as DeclarationCampagne,
];

/**
 * Lot 8A — chaque campagne sur une fiche formateur s'arrête quand il répond. S1 (sur la
 * candidature) lit déjà ses réponses elle-même (`invitation-formateurs-faits.ts`).
 */
export const REGISTRE_CAMPAGNES: readonly DeclarationCampagne[] = DECLAREES.map((c) =>
  c.entityType === "Trainer" ? { ...c, arreteeParReponseFormateur: true } : c,
);
