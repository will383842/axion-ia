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
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";

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
  | "conventionTripartiteSigneeAt"
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
 * Financement mutualisé demandé alors que la certification n'est PAS obtenue.
 *
 * 🔴 Constat du 2026-07-28, soulevé par Will : « si on n'a pas Qualiopi, on ne
 * peut pas faire de demande OPCO non ? ». C'est exact — art. L.6316-1 du Code
 * du travail et décret 2019-564 : la certification conditionne l'accès aux
 * fonds mutualisés et publics (OPCO, CPF, France Travail, État, régions). Elle
 * ne conditionne PAS le droit de dispenser des formations : un organisme non
 * certifié vend et forme légalement, le client paie simplement sur ses fonds
 * propres.
 *
 * Les surfaces publiques sont déjà protégées depuis l'audit de certification
 * (`isQualiopiCertificationObtenue`) : `/certification-qualiopi` et
 * `/financement-opco-france-travail` renvoient 404 tant que le certificat n'est
 * pas délivré. Mais RIEN n'avertissait côté console : on pouvait typer une
 * session « OPCO » et bâtir un devis dessus. Le jour où quelqu'un d'autre que
 * Will saisit un dossier, il promet à un client une prise en charge
 * impossible — argument de vente intenable, et l'accord n'arrivera jamais.
 *
 * ⚠️ AVERTISSEMENT, PAS BLOCAGE. Deux raisons de ne pas bloquer :
 *   - on prépare légitimement des sessions en anticipant la certification ;
 *   - `validateOpcoAccord` bloque déjà le DÉMARRAGE sans accord écrit, donc
 *     aucune session mutualisée ne peut réellement partir entre-temps.
 *
 * L'alerte disparaît d'elle-même le jour où `QUALIOPI_CERTIFICATION_OBTENUE`
 * passe à `"true"` — aucune dette à reprendre.
 */
export function validateFinancementMutualiseSansCertification(
  session: SessionFinancementFields,
  certificationObtenue: boolean,
): ValidationResult {
  if (certificationObtenue) return { ok: true };
  // `direct` et `mixte` ne sont pas visés : le premier est intégralement sur
  // fonds propres, le second reste finançable pour sa part directe.
  const MUTUALISES = ["opco", "france_travail", "cpf"];
  if (!MUTUALISES.includes(session.financementType ?? "")) return { ok: true };
  return {
    ok: false,
    alerte:
      "Financement mutualisé demandé alors que la certification Qualiopi n'est pas obtenue. " +
      "L'accès aux fonds OPCO, CPF et France Travail l'exige (art. L.6316-1). " +
      "Tant qu'elle n'est pas délivrée, cette session doit être facturée directement au client.",
    gravite: "warning",
  };
}

/**
 * Un financement relève-t-il d'un OPCO ?
 *
 * 🔴 `mixte` EN FAIT PARTIE, et son omission était un défaut réel corrigé le
 * 16/08. Le dépôt traitait déjà `mixte` comme de l'OPCO à **trois** endroits —
 * refus de facturer sans accord (`financements.ts`), validation manuelle de
 * l'accord, et choix du financeur à la création du dossier — mais les deux
 * gardes de DÉMARRAGE ci-dessous testaient `!== "opco"` strict.
 *
 * Conséquence : une session `mixte` pouvait démarrer **sans accord du
 * financeur**, et en subrogation **sans convention tripartite** — irrégulier au
 * regard de l'art. L.6353-2. La divergence était même documentée comme un test
 * (« ne dit rien non plus sur un financement mixte ») : un comportement
 * constaté avait été verrouillé au lieu d'être corrigé.
 *
 * Un `mixte` porte une part mutualisée. Cette part obéit aux mêmes règles que
 * si elle était seule ; c'est le fait qu'une autre part soit directe qui ne
 * change rien à l'obligation.
 */
function estFinancementOpco(financementType: string | null | undefined): boolean {
  return financementType === "opco" || financementType === "mixte";
}

/**
 * Accord OPCO BLOQUANT : si financement=opco (ou mixte) ET session non démarrée,
 * l'accord doit être reçu avant tout démarrage.
 */
export function validateOpcoAccord(session: SessionFinancementFields): ValidationResult {
  if (!estFinancementOpco(session.financementType)) return { ok: true };
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
 * Convention tripartite OPCO BLOQUANTE (audit E2E 2026-06-06, R2) :
 * en cas de **subrogation de paiement** (l'OPCO paie directement Axion-IA), une
 * convention tripartite (financeur ↔ Axion-IA ↔ bénéficiaire) doit être signée
 * AVANT le démarrage (art. L.6353-2). Sans elle, la subrogation est irrégulière.
 *
 * Règle : financement=opco ET subrogation ET session non démarrée (planifiee)
 * ET conventionTripartiteSigneeAt manquant → gravité critique (bloque en_cours).
 * Complète l'alerte post-hoc `convention_tripartite` (evaluateur.ts) par un
 * vrai blocage en amont.
 */
export function validateOpcoConventionTripartite(
  session: SessionFinancementFields,
): ValidationResult {
  if (!estFinancementOpco(session.financementType)) return { ok: true };
  if (!session.opcoSubrogation) return { ok: true };
  if (session.statut === "planifiee" && !session.conventionTripartiteSigneeAt) {
    return {
      ok: false,
      alerte:
        "Subrogation OPCO : convention tripartite non signée — interdit de démarrer avant signature (art. L.6353-2).",
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
    // En tête : c'est la condition d'ACCÈS au financement mutualisé. Les
    // validations qui suivent portent sur un dossier qu'on ne peut de toute
    // façon pas ouvrir tant que celle-ci n'est pas levée.
    {
      code: "certification_requise",
      result: validateFinancementMutualiseSansCertification(
        session,
        isQualiopiCertificationObtenue(),
      ),
    },
    { code: "opco_accord", result: validateOpcoAccord(session) },
    { code: "opco_tripartite", result: validateOpcoConventionTripartite(session) },
    { code: "cpf_edof", result: validateCpfEdof(session, session.formation) },
    { code: "cpf_eligibilite", result: validateCpfEligibilite(session, session.formation) },
    { code: "france_travail", result: validateFranceTravail(session) },
  ];

  return results;
}
