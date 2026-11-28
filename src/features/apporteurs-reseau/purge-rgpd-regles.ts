// Réseau d'apporteurs — PR N (#2464, point 6) : QUAND les données d'identité et de paiement d'un
// apporteur sont effacées. Module PUR (aucune base, aucun `server-only`).
//
// ⚠️ À CONFIRMER PAR WILL : les cinq durées ci-dessous sont celles que le plan recommande ; Will ne
// les a pas encore validées. Source : docs/rgpd/apporteurs-durees-conservation.md.
//
// On n'efface JAMAIS une personne : fiche, présentations, commissions, autofactures, avoirs,
// relevés, contrat signé restent. On efface les octets des pièces d'identité et des RIB, et les IBAN
// chiffrés. Dans le doute (date absente, argent en jeu, litige, changement de compte en cours),
// l'échéance est `null` : on garde.

/** Autofactures, avoirs, relevés, contrat signé : 10 ans après la clôture (C. com. L.123-22). JAMAIS purgés ici. */
export const DUREE_COMPTABLE_ANS = 10; // À CONFIRMER PAR WILL
/** Contrat signé puis terminé : 5 ans après T0 (C. com. L.110-4, C. civ. 2224). */
export const DUREE_CONTRAT_TERMINE_ANS = 5; // À CONFIRMER PAR WILL
/** Dossier refusé : 6 mois après `refuseAt` (délai raisonnable de contestation). */
export const DUREE_REFUSE_MOIS = 6; // À CONFIRMER PAR WILL
/** Dossier jamais signé et inactif : 24 mois sans activité (`majAt`). */
export const DUREE_INACTIF_MOIS = 24; // À CONFIRMER PAR WILL
/** Pièce à retransmettre ou remplacée : 6 mois après le dépôt (minimisation). */
export const DUREE_PIECE_RETRANSMISE_MOIS = 6; // À CONFIRMER PAR WILL

export type ReglePurge = "contrat_termine_5ans" | "refuse_6mois" | "inactif_24mois" | "piece_6mois";

export interface DossierPurge {
  statut: "dossier_en_cours" | "a_verifier" | "a_completer" | "signe" | "refuse" | "resilie";
  refuseAt: Date | null;
  resilieAt: Date | null;
  majAt: Date;
  signeParSocieteAt: Date | null;
  /** Dernier virement versé (commissions ou compte de virement). */
  dernierVirementAt: Date | null;
  /** Dernière pièce d'autofacture (série AXI-APP). */
  dernierePieceAutofactureAt: Date | null;
  /** Une commission non soldée (hors versée ou annulée) : de l'argent peut encore partir ou revenir. */
  argentEnJeu: boolean;
  litigeOuvert: boolean;
  /** Une demande de changement de compte à confirmer ou à décider. */
  changementCompteEnCours: boolean;
}

export interface EcheancePurge {
  regle: ReglePurge;
  echeanceAt: Date;
}

/** Ajoute des mois en UTC, en bornant au dernier jour du mois (31 août + 6 mois = 28 février). */
export function ajouterMois(d: Date, mois: number): Date {
  const r = new Date(d.getTime());
  const jour = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + mois);
  const dernier = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(jour, dernier));
  return r;
}

function plusTardive(dates: Array<Date | null>): Date | null {
  let m: Date | null = null;
  for (const d of dates) if (d && (!m || d > m)) m = d;
  return m;
}

/** L'échéance de purge d'un dossier d'apporteur, ou `null` (rien à purger, ou doute). */
export function echeancePurge(d: DossierPurge): EcheancePurge | null {
  if (d.argentEnJeu || d.litigeOuvert || d.changementCompteEnCours) return null;

  if (d.statut === "refuse") {
    if (!d.refuseAt) return null;
    return { regle: "refuse_6mois", echeanceAt: ajouterMois(d.refuseAt, DUREE_REFUSE_MOIS) };
  }
  if (d.statut === "resilie") {
    if (!d.resilieAt) return null;
    const t0 = plusTardive([d.resilieAt, d.dernierVirementAt, d.dernierePieceAutofactureAt]);
    if (!t0) return null;
    return {
      regle: "contrat_termine_5ans",
      echeanceAt: ajouterMois(t0, 12 * DUREE_CONTRAT_TERMINE_ANS),
    };
  }
  if (
    (d.statut === "dossier_en_cours" || d.statut === "a_completer" || d.statut === "a_verifier") &&
    !d.signeParSocieteAt
  ) {
    return { regle: "inactif_24mois", echeanceAt: ajouterMois(d.majAt, DUREE_INACTIF_MOIS) };
  }
  return null;
}

export interface PiecePurge {
  type: string;
  statut: string;
  remplaceeAt: Date | null;
  deposeeAt: Date;
}

/** Pièce d'identité ou RIB à retransmettre ou remplacée : 6 mois après le dépôt. */
export function echeancePiece(p: PiecePurge): EcheancePurge | null {
  if (p.type !== "identite" && p.type !== "rib") return null;
  if (p.statut !== "a_retransmettre" && !p.remplaceeAt) return null;
  return {
    regle: "piece_6mois",
    echeanceAt: ajouterMois(p.deposeeAt, DUREE_PIECE_RETRANSMISE_MOIS),
  };
}
