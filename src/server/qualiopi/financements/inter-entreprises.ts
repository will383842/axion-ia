/**
 * Qualiopi — Inter-entreprises (R-INTER) : financement & facturation PAR
 * participant. Modules purs (testables sans DB).
 *
 * En session inter-entreprises, chaque inscription (Enrollment) porte son propre
 * financeur / payeur / montant. `resolveEnrollmentFinancement` calcule le
 * financement EFFECTIF (override inscription, sinon fallback session) et
 * `destinataireFacture` en déduit le destinataire de la facture.
 */

import type {
  FinancementType,
  FranceTravailDispositif,
  FactureFormationDestinataire,
} from "../../../../prisma/generated/client";

export interface EnrollmentFinancementFields {
  financementType: FinancementType | null;
  clientId: string | null;
  numeroDossierOpco: string | null;
  edofVerifieAt: Date | null;
  ftDispositif: FranceTravailDispositif | null;
  montantHtCents: number | null;
}

export interface SessionFinancementFallback {
  financementType: FinancementType | null;
  clientId: string | null;
  numeroDossierOpco: string | null;
  edofVerifieAt: Date | null;
  ftDispositif: FranceTravailDispositif | null;
  montantHtCents: number;
}

export interface ResolvedFinancement {
  financementType: FinancementType | null;
  clientId: string | null;
  numeroDossierOpco: string | null;
  edofVerifieAt: Date | null;
  ftDispositif: FranceTravailDispositif | null;
  montantHtCents: number;
}

/**
 * Financement EFFECTIF d'une inscription : l'override porté par l'inscription
 * prime ; à défaut, on retombe sur le financement de la session (intra).
 * Le montant retombe sur le prix session si l'inscription n'a pas de prix de siège.
 */
export function resolveEnrollmentFinancement(
  enrollment: EnrollmentFinancementFields,
  session: SessionFinancementFallback,
): ResolvedFinancement {
  return {
    financementType: enrollment.financementType ?? session.financementType,
    clientId: enrollment.clientId ?? session.clientId,
    numeroDossierOpco: enrollment.numeroDossierOpco ?? session.numeroDossierOpco,
    edofVerifieAt: enrollment.edofVerifieAt ?? session.edofVerifieAt,
    ftDispositif: enrollment.ftDispositif ?? session.ftDispositif,
    montantHtCents: enrollment.montantHtCents ?? session.montantHtCents,
  };
}

/**
 * Destinataire de la facture selon le financement effectif :
 *  - opco            → OPCO
 *  - cpf             → stagiaire (reste à charge ; la part CPF passe par la CDC)
 *  - france_travail  → France Travail
 *  - direct / mixte / null → entreprise (l'employeur/payeur)
 */
export function destinataireFacture(
  financementType: FinancementType | null,
): FactureFormationDestinataire {
  switch (financementType) {
    case "opco":
      return "opco";
    case "cpf":
      return "stagiaire";
    case "france_travail":
      return "france_travail";
    default:
      return "entreprise";
  }
}

export interface FactureReadiness {
  ok: boolean;
  raison?: string;
}

/**
 * Une facture par inscription est-elle émettable ?
 *  - prix de siège (montant) requis (> 0)
 *  - OPCO + subrogation : n° de dossier requis (réutilise la règle session)
 *  - CPF : EDOF requis pour la part financée
 */
export function checkFactureParInscription(
  resolved: ResolvedFinancement,
  opts: { opcoSubrogation: boolean },
): FactureReadiness {
  if (!resolved.montantHtCents || resolved.montantHtCents <= 0) {
    return { ok: false, raison: "Prix du siège (montant HT) de l'inscription non défini." };
  }
  if (resolved.financementType === "opco" && opts.opcoSubrogation && !resolved.numeroDossierOpco) {
    return { ok: false, raison: "Subrogation OPCO : n° de dossier obligatoire." };
  }
  if (resolved.financementType === "cpf" && !resolved.edofVerifieAt) {
    return { ok: false, raison: "CPF : vérification EDOF requise avant facturation." };
  }
  return { ok: true };
}
