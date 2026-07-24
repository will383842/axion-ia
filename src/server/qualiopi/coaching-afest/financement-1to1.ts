/**
 * Qualiopi 1-to-1 / AFEST — couche financement (parité formations, 2026-06-14).
 *
 * Validation des pré-requis (OPCO / CPF / France Travail) + calcul de la
 * facturation selon le dispositif. Réutilise opco-calcul (ventilation/forfait).
 * Pur (testable sans DB). Le coaching 1-to-1 = 1 bénéficiaire (nbParticipants=1).
 */

import {
  computeForfait,
  computeVentilationDossier,
  type ResultatVentilation,
} from "@/server/qualiopi/financements/opco-calcul";
import type {
  FinancementType,
  FranceTravailDispositif,
  PriseEnChargeUnite,
  FactureFormationDestinataire,
} from "../../../../prisma/generated/client";

/** Champs financement d'un CoachingContract nécessaires aux calculs/validations. */
export interface CoachingFinancementFields {
  financementType: FinancementType;
  montantHtCents: number;
  subrogation: boolean;
  numeroDossierOpco: string | null;
  conventionTripartiteSigneeAt: Date | null;
  // OPCO ventilation
  priseEnChargeMontantCents: number | null;
  priseEnChargeUnite: PriseEnChargeUnite | null;
  priseEnChargePlafondFormationCents: number | null;
  priseEnChargePlafondAnnuelCents: number | null;
  // CPF
  edofVerifieAt: Date | null;
  resteAChargeCents: number | null;
  // France Travail
  ftDispositif: FranceTravailDispositif | null;
  ftAifPrescriptionDate: Date | null;
  ftPoeiOffreEmploiNumero: string | null;
  ftPoeiAccordFinancementAt: Date | null;
  ftPoeiEngagementSigneAt: Date | null;
}

/**
 * Valide les pré-requis bloquants du dispositif avant émission d'une facture.
 * Retourne un message d'erreur si bloquant, sinon null.
 */
export function validateCoachingFinancement(c: CoachingFinancementFields): string | null {
  if (c.financementType === "opco") {
    if (c.subrogation && !c.numeroDossierOpco) {
      return "Subrogation OPCO : le numéro de dossier OPCO est obligatoire.";
    }
    if (c.subrogation && !c.conventionTripartiteSigneeAt) {
      return "Subrogation OPCO : la convention tripartite (L.6353-2) doit être signée avant facturation.";
    }
  }
  if (c.financementType === "cpf") {
    if (!c.edofVerifieAt) {
      return "Financement CPF : la vérification EDOF est obligatoire (action inscrite sur Mon Compte Formation).";
    }
  }
  if (c.financementType === "france_travail") {
    if (!c.ftDispositif) {
      return "France Travail : le dispositif (AIF / POEI / CSP) doit être renseigné.";
    }
    if (c.ftDispositif === "aif" && !c.ftAifPrescriptionDate) {
      return "AIF : la date de prescription France Travail est obligatoire.";
    }
    if (c.ftDispositif === "poei") {
      if (
        !c.ftPoeiOffreEmploiNumero ||
        !c.ftPoeiAccordFinancementAt ||
        !c.ftPoeiEngagementSigneAt
      ) {
        return "POEI : les 3 pièces sont requises (n° offre d'emploi, accord de financement, engagement signé).";
      }
    }
    // 🔴 Reste à charge France Travail : la facture 1-to-1 dérive UN destinataire
    // unique et lui facture le total plein. Or France Travail ne finance que
    // l'aide (total − reste à charge) ; le reste à charge est dû par le
    // bénéficiaire/l'entreprise. Facturer le total plein à France Travail
    // sur-facturerait un financeur public. La facturation en deux volets (aide FT
    // + reste à charge) n'est pas encore automatisée → on bloque plutôt que
    // d'émettre une facture erronée. Cas courant (FT 100 % financé, reste à
    // charge nul/absent) : inchangé.
    if ((c.resteAChargeCents ?? 0) > 0) {
      return "France Travail avec reste à charge : la facturation en deux volets (aide France Travail + reste à charge bénéficiaire) n'est pas encore automatisée. Émettez séparément la facture de l'aide France Travail et celle du reste à charge.";
    }
  }
  return null;
}

export interface CoachingFacturationResult {
  lignes: ResultatVentilation["lignes"];
  totalHtCents: number;
  destinataire: FactureFormationDestinataire;
  numeroDossier: string | null;
  subrogation: boolean;
  resteAChargeCents: number | null;
  montantAideFranceTravailCents: number | null;
}

/**
 * Calcule la facturation d'un parcours coaching selon le dispositif de
 * financement. heuresReelles = Σ CompteRenduSeance.dureeMinutes / 60.
 */
export function computeCoachingFacturation(
  c: CoachingFinancementFields,
  heuresReelles: number,
): CoachingFacturationResult {
  // Lignes : ventilation horaire OPCO si barème de prise en charge saisi, sinon forfait.
  let resultat: ResultatVentilation;
  if (c.priseEnChargeMontantCents != null && c.priseEnChargeUnite != null) {
    resultat = computeVentilationDossier({
      unite: c.priseEnChargeUnite,
      montantCents: c.priseEnChargeMontantCents,
      dureeHeures: heuresReelles,
      nbParticipants: 1,
      ...(c.priseEnChargePlafondFormationCents != null
        ? { plafondFormationCents: c.priseEnChargePlafondFormationCents }
        : {}),
      ...(c.priseEnChargePlafondAnnuelCents != null
        ? { plafondAnnuelCents: c.priseEnChargePlafondAnnuelCents }
        : {}),
    });
  } else {
    resultat = computeForfait(c.montantHtCents);
  }

  // Destinataire selon le dispositif.
  let destinataire: FactureFormationDestinataire;
  if (c.financementType === "opco" && c.subrogation) destinataire = "opco";
  else if (c.financementType === "france_travail") destinataire = "france_travail";
  else destinataire = "entreprise";

  // Reste à charge (CPF / FT) + aide France Travail.
  const resteAChargeCents = c.resteAChargeCents;
  const montantAideFranceTravailCents =
    c.financementType === "france_travail"
      ? Math.max(0, resultat.totalHtCents - (resteAChargeCents ?? 0))
      : null;

  return {
    lignes: resultat.lignes,
    totalHtCents: resultat.totalHtCents,
    destinataire,
    numeroDossier: c.numeroDossierOpco,
    subrogation: c.subrogation,
    resteAChargeCents,
    montantAideFranceTravailCents,
  };
}
