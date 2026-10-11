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
import { CAMPAGNE_RELANCE_DOSSIER } from "@/server/qualiopi/formateurs-independants/relance-dossier";
import { CAMPAGNE_S1 } from "@/server/qualiopi/formateurs-independants/invitation-formateurs";

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
  /** Le payload de l'e-mail (valeurs des crochets, lien). */
  readonly payload: Record<string, unknown>;
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
 * Chacune reste éteinte tant que ses interrupteurs ne sont pas TOUS allumés.
 */
export const REGISTRE_CAMPAGNES: readonly DeclarationCampagne[] = [
  // L6 — S3 (et S5 par son origine F12) : relances du dossier en ligne.
  CAMPAGNE_RELANCE_DOSSIER as DeclarationCampagne,
  // S1 (L-INV) — rappels de l'invitation à l'échange formateur (F2), J+3 et J+7.
  CAMPAGNE_S1 as DeclarationCampagne,
];
