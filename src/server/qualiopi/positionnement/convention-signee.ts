/**
 * Chantier QNC, lot L04 — le positionnement ne part QUE si la convention est
 * signée (NC1).
 *
 * `handlePositionnement` réclamait le positionnement à J-15 dès qu'une
 * inscription existait, convention signée ou non : un stagiaire pouvait donc
 * détailler ses besoins pour une action que son entreprise n'avait pas encore
 * engagée. Derrière `qualiopi.positionnement.actif`, l'envoi attend désormais
 * une pièce contractuelle VIVANTE et SIGNÉE par toutes les parties de son
 * circuit (`statutSignature = signee`, calculé par `signerDocument` depuis
 * `partiesRequisesPour` — jamais recompté ici).
 *
 * ⚠️ Module PUR : la décision se teste sans base.
 */

/** Les pièces qui font « la convention » — même liste que `session-parcours.ts`. */
export const TYPES_PIECE_CONTRACTUELLE = [
  "convention",
  "convention_tripartite",
  "contrat",
] as const;

export interface PieceContractuelle {
  readonly type: string;
  readonly statutSignature: string;
  readonly annuleeAt: Date | null;
  /** Pièce propre à une entreprise (inter-entreprises) — `null` : toute la session. */
  readonly clientId: string | null;
  /** Pièce propre à une personne (contrat individuel) — `null` : toute la session. */
  readonly traineeId: string | null;
}

export interface InscriptionPourConvention {
  readonly traineeId: string;
  /** Employeur de CE participant, en inter-entreprises. `null` en intra. */
  readonly clientId: string | null;
}

/**
 * Une convention signée couvre-t-elle CETTE inscription ?
 *
 * Une pièce nominative (contrat d'une personne) ne couvre que sa titulaire ;
 * une convention d'une entreprise, en inter, ne couvre que ses salariés. Une
 * pièce de session couvre tout le monde.
 */
export function conventionSigneePourInscription(
  pieces: readonly PieceContractuelle[],
  inscription: InscriptionPourConvention,
): boolean {
  return pieces.some((p) => {
    if (!(TYPES_PIECE_CONTRACTUELLE as readonly string[]).includes(p.type)) return false;
    if (p.annuleeAt !== null || p.statutSignature !== "signee") return false;
    if (p.traineeId !== null) return p.traineeId === inscription.traineeId;
    if (p.clientId !== null && inscription.clientId !== null) {
      return p.clientId === inscription.clientId;
    }
    return true;
  });
}
