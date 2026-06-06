/**
 * Qualiopi — Validations métier financement (T11 AGENT A).
 *
 * Chaque fonction prend l'entité en paramètre (fonctions pures, pas d'appel
 * DB direct). Le wrapper DB `getFinancementValidations` assemble les entités
 * depuis Prisma et retourne toutes les validations pour une session.
 *
 * Stub-aware : `getFinancementValidations` retourne [] si stub.invalid.
 */

import type {
  TrainingSession,
  Formation,
  Trainer,
  FranceTravailDispositif,
} from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Type de résultat
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  ok: boolean;
  alerte?: string;
  gravite?: "critique" | "warning";
}

// ─────────────────────────────────────────────────────────────────────────────
// Types partiels pour les paramètres (on n'a pas besoin de tout le modèle)
// ─────────────────────────────────────────────────────────────────────────────

type SessionFinancementFields = Pick<
  TrainingSession,
  | "financementType"
  | "opcoStatut"
  | "opcoSubrogation"
  | "numeroDossierOpco"
  | "edofVerifieAt"
  | "ftDispositif"
  | "ftAifPrescriptionDate"
  | "ftPoeiAccordFinancementAt"
  | "ftPoeiEngagementSigneAt"
  | "ftPoeiOffreEmploiNumero"
  | "statut"
>;

type FormationEdofFields = Pick<Formation, "edofVerifieAt">;

type FormationCpfEligibiliteFields = Pick<Formation, "cpfEligible">;

type TrainerSousTraitantFields = Pick<Trainer, "statut" | "sousTraitantVerifieAt">;

// ─────────────────────────────────────────────────────────────────────────────
// Validations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accord OPCO BLOQUANT : si financement=opco ET session non démarrée,
 * l'accord doit être reçu avant tout démarrage.
 */
export function validateOpcoAccord(session: SessionFinancementFields): ValidationResult {
  if (session.financementType !== "opco") return { ok: true };
  if (
    session.opcoStatut !== "accord_recu" &&
    session.opcoStatut !== "paiement_recu" &&
    session.statut === "planifiee"
  ) {
    return {
      ok: false,
      alerte: "Accord OPCO non reçu — JAMAIS commencer avant accord écrit.",
      gravite: "critique",
    };
  }
  return { ok: true };
}

/**
 * CPF/EDOF BLOQUANT : si financement=cpf, la vérification EDOF doit être faite
 * (sur la session OU la formation).
 */
export function validateCpfEdof(
  session: SessionFinancementFields,
  formation: FormationEdofFields,
): ValidationResult {
  if (session.financementType !== "cpf") return { ok: true };
  const edofOk = session.edofVerifieAt != null || formation.edofVerifieAt != null;
  if (!edofOk) {
    return {
      ok: false,
      alerte: "CPF sans vérification EDOF — session non éligible au CPF.",
      gravite: "critique",
    };
  }
  return { ok: true };
}

/**
 * France Travail : AIF requiert prescription ; POEI requiert les 3 preuves
 * (offre d'emploi, accord de financement, engagement signé).
 *
 * T17 CLUSTER 3 — POEI bloquant (off.9) :
 *   Si dispositif POEI ET session non démarrée (statut = `planifiee`) ET
 *   une des 3 preuves manque → gravité `critique` (bloquant).
 *   Preuves POEI : ftPoeiOffreEmploiNumero + ftPoeiAccordFinancementAt + ftPoeiEngagementSigneAt.
 */
export function validateFranceTravail(session: SessionFinancementFields): ValidationResult {
  if (session.financementType !== "france_travail") return { ok: true };
  const dispositif = session.ftDispositif as FranceTravailDispositif | null;
  if (!dispositif) {
    return {
      ok: false,
      alerte: "Dispositif France Travail non renseigné (AIF / POEI / CSP).",
      gravite: "critique",
    };
  }
  if (dispositif === "aif" && !session.ftAifPrescriptionDate) {
    return {
      ok: false,
      alerte: "AIF : date de prescription France Travail obligatoire.",
      gravite: "critique",
    };
  }
  if (dispositif === "poei") {
    const sessionNonDemarree = session.statut === "planifiee";
    // Vérification des 3 preuves POEI (bloquant si session non démarrée)
    if (!session.ftPoeiOffreEmploiNumero) {
      return {
        ok: false,
        alerte:
          "POEI : numéro d'offre d'emploi France Travail obligatoire avant démarrage de la session.",
        gravite: sessionNonDemarree ? "critique" : "warning",
      };
    }
    if (!session.ftPoeiAccordFinancementAt) {
      return {
        ok: false,
        alerte: "POEI : accord de financement France Travail obligatoire.",
        gravite: sessionNonDemarree ? "critique" : "warning",
      };
    }
    if (!session.ftPoeiEngagementSigneAt) {
      return {
        ok: false,
        alerte: "POEI : engagement signé France Travail obligatoire.",
        gravite: sessionNonDemarree ? "critique" : "warning",
      };
    }
  }
  return { ok: true };
}

/**
 * CPF éligibilité (T18 CLUSTER B) : si le financement est CPF et que
 * cpfEligible=false sur la formation → alerte critique.
 *
 * La formation n'est éligible CPF que si certificationType ≠ aucune,
 * un code RS/RNCP (ou des blocs) est renseigné ET la vérification EDOF
 * est effectuée (cf. computeCpfEligible dans certification-service).
 *
 * Règle : cpfEligible est dérivé automatiquement par setCertification ;
 * cette validation est un garde-fou avant démarrage de session.
 */
export function validateCpfEligibilite(
  session: SessionFinancementFields,
  formation: FormationCpfEligibiliteFields,
): ValidationResult {
  if (session.financementType !== "cpf") return { ok: true };
  if (!formation.cpfEligible) {
    return {
      ok: false,
      alerte:
        "Formation non finançable CPF : RS/RNCP/EDOF requis (certificationType ≠ aucune + code + vérification EDOF).",
      gravite: "critique",
    };
  }
  return { ok: true };
}

/**
 * Sous-traitant (off.19/27) : un formateur sous_traitant doit avoir
 * sousTraitantVerifieAt non nul pour être assigné formateur principal.
 */
export function validateSousTraitant(trainer: TrainerSousTraitantFields): ValidationResult {
  if (trainer.statut !== "sous_traitant") return { ok: true };
  if (!trainer.sousTraitantVerifieAt) {
    return {
      ok: false,
      alerte: "Sous-traitant non vérifié (data.gouv.fr) — ne peut pas être formateur principal.",
      gravite: "critique",
    };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper DB : getFinancementValidations
// ─────────────────────────────────────────────────────────────────────────────

export interface FinancementValidationEntry {
  code: string;
  result: ValidationResult;
}

/**
 * Assemble toutes les validations financement pour une session depuis Prisma.
 *
 * Stub-aware : retourne [] si DATABASE_URL contient "stub.invalid".
 *
 * @param sessionId UUID de la TrainingSession.
 * @returns tableau ordonné des résultats de validation (code + résultat).
 */
export async function getFinancementValidations(
  sessionId: string,
): Promise<FinancementValidationEntry[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }

  const session = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      formation: {
        select: {
          edofVerifieAt: true,
          cpfEligible: true,
        },
      },
    },
  });

  const results: FinancementValidationEntry[] = [
    { code: "opco_accord", result: validateOpcoAccord(session) },
    { code: "cpf_edof", result: validateCpfEdof(session, session.formation) },
    { code: "cpf_eligibilite", result: validateCpfEligibilite(session, session.formation) },
    { code: "france_travail", result: validateFranceTravail(session) },
  ];

  return results;
}
