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
 *  - opco AVEC subrogation → OPCO
 *  - opco SANS subrogation → **entreprise** (voir ci-dessous)
 *  - cpf             → stagiaire (reste à charge ; la part CPF passe par la CDC)
 *  - france_travail  → France Travail
 *  - direct / mixte / null → entreprise (l'employeur/payeur)
 *
 * ## 🔴 Pourquoi la subrogation entre ici — le défaut corrigé le 16/08
 *
 * Cette fonction rendait `"opco"` dès que le financement était OPCO, **sans
 * jamais regarder la subrogation**. Or les deux circuits existent en droit, et
 * le plan les exige tous les deux (Lot 8, étape 6) :
 *
 * | Circuit | Qui paie l'organisme | Facture libellée à |
 * |---|---|---|
 * | **Avec** subrogation | l'OPCO, directement | l'OPCO |
 * | **Sans** subrogation | l'entreprise, qui se fait rembourser ensuite | **l'entreprise** |
 *
 * Sans subrogation, l'OPCO ne doit **rien** à l'organisme : il rembourse son
 * adhérent. Lui adresser la facture produisait une créance que personne ne
 * paierait jamais — **et l'entreprise, qui doit réellement, n'était facturée
 * nulle part**. L'argent n'était donc pas seulement en retard : il n'était pas
 * réclamé.
 *
 * ⚠️ `opcoSubrogation` est un champ de la SESSION, pas de l'inscription : le
 * régime de paiement est négocié avec le financeur pour l'action, pas par
 * participant. Il est donc passé à part et non lu depuis `ResolvedFinancement`.
 */
export function destinataireFacture(
  financementType: FinancementType | null,
  opts: { opcoSubrogation: boolean },
): FactureFormationDestinataire {
  switch (financementType) {
    case "opco":
      return opts.opcoSubrogation ? "opco" : "entreprise";
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
