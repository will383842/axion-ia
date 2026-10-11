/**
 * Formateurs indépendants — RÈGLE COMPLÈTE d'activation (lot L9, 08c §a).
 *
 * Remplace la règle PROVISOIRE de S1 (`gardes.ts`) quand l'écran « Vérifier et
 * contresigner » est allumé (`formateurs.activation_auto`) et que la garde
 * d'activation n'est pas coupée (`formateurs.garde_activation`). Interrupteurs
 * absents : la règle provisoire s'applique, exactement comme aujourd'hui
 * (`activation.ts`, {@link regleActivationApplicable}).
 *
 * Huit conditions, toutes requises, lues EN BASE (jamais dans la saisie) :
 *   1. contrat-cadre CONTRESIGNÉ, version ≥ 3, non annulé ;
 *   2. dernier contrôle du registre vert, ou orange validé par un humain ;
 *      jamais rouge ; de moins de 30 jours ;
 *   3. SIRET présent, et le même que celui du contrôle ;
 *   4. numéro de déclaration vu sur la liste publique, ou orange validé
 *      (numéro « en cours » : l'activation passe, la mission reste gardée) ;
 *   5. attestation de vigilance validée, non échue, AVEC sa ligne
 *      `PreuveVigilance` valide (L4b) ;
 *   6. CV déposé (`TrainerDocument` `cv`) et validé, de moins de 24 mois ;
 *   7. régime de TVA, IBAN, déclarations versionnées, au moins une habilitation
 *      active ;
 *   8. aucune fin de collaboration.
 *
 * 🔴 Module PUR, garde FERMÉE : exception, date illisible, statut inconnu =
 * « non activable », avec la liste de ce qui manque. Salariés et dirigeants :
 * hors périmètre (ADR 0066 (a)), « activable » sans rien examiner.
 */

import {
  addMonths,
  type DocumentConformite,
  type TrainerStatutValue,
} from "@/server/qualiopi/trainers/conformite";
import { aUnFichier } from "@/server/qualiopi/trainers/piece-competence";

import { etatControle, type LigneControle } from "./controle-regles";
import { pieceGardeeProbante, type VerdictActivation } from "./gardes";

/**
 * Première version du contrat-cadre qui vaut « en vigueur » pour un nouvel
 * indépendant. Égale à `VERSION_CONTRAT_CADRE_AVEC_CODE` (signature L7c) —
 * un test le vérifie, ce module reste pur.
 */
export const VERSION_MINIMALE_CONTRAT_INDEPENDANT = 3;

/** Âge maximal du CV retenu (08c §a, condition 6). */
export const CV_VALIDITE_MOIS = 24;

export interface ContratLu {
  readonly version: number;
  readonly statutSignature: string;
  readonly annuleeAt: Date | null;
}

export interface ControleLu extends LigneControle {
  readonly siret: string | null;
}

export interface PieceLueActivation extends DocumentConformite {
  readonly id: string;
}

export interface PreuveVigilanceLue {
  readonly trainerDocumentId: string | null;
  readonly resultat: string;
}

/** Ce que la règle complète examine — rien de plus. */
export interface FaitsActivationComplete {
  readonly statut: TrainerStatutValue | string;
  readonly finCollaborationAt: Date | null;
  readonly siret: string | null;
  readonly ndaVerifieListeAt: Date | null;
  readonly regimeTvaHonoraires: string | null;
  readonly ibanPresent: boolean;
  readonly declarationsVersion: string | null;
  readonly habilitationsActives: number;
  readonly contrats: ReadonlyArray<ContratLu>;
  readonly controles: ReadonlyArray<ControleLu>;
  readonly pieces: ReadonlyArray<PieceLueActivation>;
  readonly preuvesVigilance: ReadonlyArray<PreuveVigilanceLue>;
}

export const MANQUES_COMPLETS = {
  statutInconnu: "Statut du formateur inconnu : activation impossible.",
  contrat: "Le contrat-cadre en vigueur n'est pas contresigné.",
  controle: "Le contrôle du registre n'est pas vert, ou son orange n'est pas validé.",
  siret: "Le SIRET manque, ou n'est pas celui du contrôle du registre.",
  nda: "Le numéro de déclaration n'est pas vu sur la liste publique, ni validé.",
  vigilance: "L'attestation URSSAF n'est pas vérifiée sur urssaf.fr, ou elle est échue.",
  cv: `Le CV validé manque, ou il a plus de ${CV_VALIDITE_MOIS} mois.`,
  tva: "Le régime de TVA n'est pas renseigné.",
  iban: "L'IBAN n'est pas renseigné.",
  declarations: "Les déclarations du dossier ne sont pas enregistrées.",
  habilitation: "Aucune formation n'est cochée.",
  fin: "La collaboration est terminée.",
  erreur: "Le contrôle des pièces n'a pas pu aboutir : activation refusée par prudence.",
} as const;

function dateLisible(d: Date | null | undefined): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function siretNormalise(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "");
}

/** Condition 1 : un contrat v3+ contresigné (`signee`) et non annulé. */
export function contratContresigne(contrats: ReadonlyArray<ContratLu>): boolean {
  return contrats.some(
    (c) =>
      c.version >= VERSION_MINIMALE_CONTRAT_INDEPENDANT &&
      c.statutSignature === "signee" &&
      c.annuleeAt === null,
  );
}

/** Condition 6 : un CV validé, avec fichier, non échu, de moins de 24 mois. */
export function cvProbant(pieces: ReadonlyArray<DocumentConformite>, maintenant: Date): boolean {
  return pieces.some((p) => {
    if (p.type !== "cv" || p.statutValidation !== "valide" || !aUnFichier(p.fichierUrl)) {
      return false;
    }
    if (!dateLisible(p.dateEmission) || p.dateEmission.getTime() > maintenant.getTime()) {
      return false;
    }
    if (addMonths(p.dateEmission, CV_VALIDITE_MOIS).getTime() <= maintenant.getTime()) {
      return false;
    }
    return p.dateExpiration === null || p.dateExpiration.getTime() > maintenant.getTime();
  });
}

/** Condition 5 : l'attestation probante porte sa preuve de vérification. */
export function vigilanceProuvee(
  pieces: ReadonlyArray<PieceLueActivation>,
  preuves: ReadonlyArray<PreuveVigilanceLue>,
  maintenant: Date,
): boolean {
  const prouvees = new Set(
    preuves
      .filter((p) => p.resultat === "valide" && p.trainerDocumentId !== null)
      .map((p) => p.trainerDocumentId as string),
  );
  return pieces.some(
    (p) => prouvees.has(p.id) && pieceGardeeProbante(p, "attestation_vigilance_urssaf", maintenant),
  );
}

/**
 * Un indépendant peut-il être ACTIVÉ selon la règle complète ? Les manques
 * sont rendus en clair, dans l'ordre des huit conditions.
 */
export function peutActiverFormateurIndependantComplet(
  f: FaitsActivationComplete,
  maintenant: Date = new Date(),
): VerdictActivation {
  try {
    if (f.statut === "salarie" || f.statut === "dirigeant") return { activable: true };
    if (f.statut !== "sous_traitant") {
      return { activable: false, manques: [MANQUES_COMPLETS.statutInconnu] };
    }

    const manques: string[] = [];
    if (!contratContresigne(f.contrats)) manques.push(MANQUES_COMPLETS.contrat);

    const etat = etatControle(f.controles, maintenant);
    if (!etat.probant) manques.push(MANQUES_COMPLETS.controle);

    const dernier = [...f.controles].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
    const siret = siretNormalise(f.siret);
    if (siret === "" || dernier === undefined || siretNormalise(dernier.siret) !== siret) {
      manques.push(MANQUES_COMPLETS.siret);
    }

    if (!dateLisible(f.ndaVerifieListeAt) && etat.statut !== "orange_valide") {
      manques.push(MANQUES_COMPLETS.nda);
    }
    if (!vigilanceProuvee(f.pieces, f.preuvesVigilance, maintenant)) {
      manques.push(MANQUES_COMPLETS.vigilance);
    }
    if (!cvProbant(f.pieces, maintenant)) manques.push(MANQUES_COMPLETS.cv);
    if ((f.regimeTvaHonoraires ?? "") === "") manques.push(MANQUES_COMPLETS.tva);
    if (!f.ibanPresent) manques.push(MANQUES_COMPLETS.iban);
    if ((f.declarationsVersion ?? "").trim() === "") manques.push(MANQUES_COMPLETS.declarations);
    if (!(f.habilitationsActives >= 1)) manques.push(MANQUES_COMPLETS.habilitation);
    if (f.finCollaborationAt !== null) manques.push(MANQUES_COMPLETS.fin);

    return manques.length === 0 ? { activable: true } : { activable: false, manques };
  } catch {
    return { activable: false, manques: [MANQUES_COMPLETS.erreur] };
  }
}

export type RegleActivation = "provisoire" | "complete";

/**
 * Quelle règle s'applique ? `activation_auto` éteint (ou absent) : la règle
 * provisoire de S1, comportement d'aujourd'hui. Allumé : la règle complète,
 * sauf si la garde d'activation est explicitement coupée (08 §8, L9 [P2]).
 */
export function regleActivationApplicable(etats: {
  readonly activation_auto: boolean;
  readonly garde_activation: boolean;
}): RegleActivation {
  return etats.activation_auto === true && etats.garde_activation !== false
    ? "complete"
    : "provisoire";
}
