/**
 * Qualiopi — Service certification RS/RNCP (T18 CLUSTER B).
 *
 * computeCpfEligible : logique pure (pas d'I/O) — détermine si une formation
 *   est éligible au CPF selon 3 conditions cumulatives :
 *     1. certificationType !== "aucune"
 *     2. codeRncp OU codeRs OU blocsCompetences non vide
 *     3. edofVerifieAt non null
 *
 * setCertification : persiste les champs certification sur la Formation et
 *   recalcule cpfEligible automatiquement.
 *
 * Stub-aware : setCertification retourne early si DATABASE_URL contient
 *   "stub.invalid" (jamais de mutation au build SSG).
 */

import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Champs certification d'une Formation nécessaires à computeCpfEligible. */
export interface CertificationFields {
  certificationType: "aucune" | "rs" | "rncp";
  codeRncp: string | null;
  codeRs: string | null;
  blocsCompetences: unknown;
  edofVerifieAt: Date | null;
}

/** Input de setCertification (tous les champs optionnels sauf formationId). */
export interface SetCertificationInput {
  formationId: string;
  certificationType?: "aucune" | "rs" | "rncp";
  codeRncp?: string | null;
  codeRs?: string | null;
  numeroEnregistrementFc?: string | null;
  certificateurNom?: string | null;
  estCertificateur?: boolean;
  numeroHabilitation?: string | null;
  dateEnregistrementCertif?: Date | null;
  dateEcheanceCertif?: Date | null;
  blocsCompetences?: unknown;
}

/** Résultat de setCertification. */
export interface SetCertificationResult {
  id: string;
  cpfEligible: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCpfEligible (fonction pure)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Détermine si une formation est éligible au CPF.
 *
 * Règles cumulatives :
 *   1. certificationType !== "aucune" (formation certifiante RS ou RNCP)
 *   2. Au moins un code RS/RNCP ou des blocs de compétences renseignés
 *   3. Vérification EDOF effectuée (edofVerifieAt non null)
 *
 * Fonction pure : aucun appel I/O, testable sans mock.
 */
export function computeCpfEligible(f: CertificationFields): boolean {
  if (f.certificationType === "aucune") return false;

  const aBlocsNonVide = Array.isArray(f.blocsCompetences)
    ? (f.blocsCompetences as unknown[]).length > 0
    : typeof f.blocsCompetences === "object" &&
      f.blocsCompetences !== null &&
      Object.keys(f.blocsCompetences as object).length > 0;

  const aCodeOuBlocs =
    (f.codeRncp !== null && f.codeRncp !== undefined && f.codeRncp.trim() !== "") ||
    (f.codeRs !== null && f.codeRs !== undefined && f.codeRs.trim() !== "") ||
    aBlocsNonVide;

  if (!aCodeOuBlocs) return false;
  if (f.edofVerifieAt === null || f.edofVerifieAt === undefined) return false;

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// setCertification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persiste les champs certification sur une Formation et recalcule cpfEligible.
 *
 * Stub-aware : retourne un résultat fictif si DATABASE_URL contient
 * "stub.invalid" (safe au build SSG — jamais de mutation réelle).
 *
 * @param input Champs à mettre à jour + formationId.
 * @returns id de la formation et nouveau statut cpfEligible calculé.
 */
export async function setCertification(
  input: SetCertificationInput,
): Promise<SetCertificationResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { id: input.formationId, cpfEligible: false };
  }

  const {
    formationId,
    certificationType,
    codeRncp,
    codeRs,
    numeroEnregistrementFc,
    certificateurNom,
    estCertificateur,
    numeroHabilitation,
    dateEnregistrementCertif,
    dateEcheanceCertif,
    blocsCompetences,
  } = input;

  // Lire les champs actuels pour recalcul cpfEligible
  const current = await prisma.formation.findUniqueOrThrow({
    where: { id: formationId },
    select: {
      certificationType: true,
      codeRncp: true,
      codeRs: true,
      blocsCompetences: true,
      edofVerifieAt: true,
    },
  });

  // Fusionner les nouvelles valeurs sur les champs courants pour le calcul
  const merged: CertificationFields = {
    certificationType:
      certificationType !== undefined ? certificationType : current.certificationType,
    codeRncp: codeRncp !== undefined ? codeRncp : current.codeRncp,
    codeRs: codeRs !== undefined ? codeRs : current.codeRs,
    blocsCompetences: blocsCompetences !== undefined ? blocsCompetences : current.blocsCompetences,
    edofVerifieAt: current.edofVerifieAt,
  };

  const cpfEligible = computeCpfEligible(merged);

  // Construire les données à mettre à jour (exactOptionalPropertyTypes)
  const data: Record<string, unknown> = { cpfEligible };

  if (certificationType !== undefined) data["certificationType"] = certificationType;
  if (codeRncp !== undefined) data["codeRncp"] = codeRncp;
  if (codeRs !== undefined) data["codeRs"] = codeRs;
  if (numeroEnregistrementFc !== undefined) data["numeroEnregistrementFc"] = numeroEnregistrementFc;
  if (certificateurNom !== undefined) data["certificateurNom"] = certificateurNom;
  if (estCertificateur !== undefined) data["estCertificateur"] = estCertificateur;
  if (numeroHabilitation !== undefined) data["numeroHabilitation"] = numeroHabilitation;
  if (dateEnregistrementCertif !== undefined)
    data["dateEnregistrementCertif"] = dateEnregistrementCertif;
  if (dateEcheanceCertif !== undefined) data["dateEcheanceCertif"] = dateEcheanceCertif;
  if (blocsCompetences !== undefined) data["blocsCompetences"] = blocsCompetences as never;

  await prisma.formation.update({
    where: { id: formationId },
    data: data as never,
  });

  return { id: formationId, cpfEligible };
}
