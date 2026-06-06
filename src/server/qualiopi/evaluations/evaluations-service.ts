/**
 * Qualiopi — Service Évaluations des acquis (AGENT A — T9).
 *
 * createEvaluation       : calcule score/niveau/réussite via scoring.ts,
 *                          insère EvaluationAcquis, retourne { id }.
 * listEvaluationsForEnrollment : liste toutes les évaluations d'une inscription.
 * getFinaleReussite      : retourne le résultat de l'évaluation finale la plus
 *                          récente (null si aucune).
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", toutes les mutations
 * lèvent et les lectures retournent des valeurs vides (safe au build SSG).
 */

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { computeEvaluationScore, niveauFromScore, reussiteFromScore } from "./scoring";
import type { EvaluationAcquis } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types internes
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateEvaluationInput {
  enrollmentId: string;
  type: "initiale" | "intermediaire" | "finale";
  dateEvaluation: string;
  competences: Array<{
    libelle: string;
    note?: 1 | 2 | 3;
    observations?: string;
    objectifRef?: string;
  }>;
  recommandations?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// createEvaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une évaluation des acquis.
 *
 * 1. Calcule score/niveau/réussite via scoring.ts (fonctions pures).
 * 2. Lit le seuil de réussite depuis la config Qualiopi.
 * 3. Insère `EvaluationAcquis` en DB.
 * 4. Retourne `{ id }`.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid" (pas de mutation au build).
 */
export async function createEvaluation(input: CreateEvaluationInput): Promise<{ id: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("createEvaluation: stub DB — non disponible au build");
  }

  const seuilReussitePct = await getQualiopiConfig("seuil_reussite_pct");

  const { scoreObtenu, scoreMax, scorePct } = computeEvaluationScore(input.competences);
  const niveauGlobal = niveauFromScore(scorePct);
  const reussite = reussiteFromScore(scorePct, seuilReussitePct);

  const created = await prisma.evaluationAcquis.create({
    data: {
      enrollmentId: input.enrollmentId,
      type: input.type,
      dateEvaluation: new Date(input.dateEvaluation),
      scoreObtenu,
      scoreMax,
      scorePct,
      niveauGlobal,
      reussite,
      competences: input.competences as never,
      ...(input.recommandations !== undefined ? { recommandations: input.recommandations } : {}),
    },
    select: { id: true },
  });

  return { id: created.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// listEvaluationsForEnrollment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne toutes les évaluations d'une inscription, triées par date décroissante.
 */
export async function listEvaluationsForEnrollment(
  enrollmentId: string,
): Promise<EvaluationAcquis[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  return prisma.evaluationAcquis.findMany({
    where: { enrollmentId },
    orderBy: { dateEvaluation: "desc" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getFinaleReussite
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne la réussite de l'évaluation finale la plus récente.
 * Retourne `null` si aucune évaluation finale n'existe.
 */
export async function getFinaleReussite(enrollmentId: string): Promise<boolean | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  const finale = await prisma.evaluationAcquis.findFirst({
    where: { enrollmentId, type: "finale" },
    orderBy: { dateEvaluation: "desc" },
    select: { reussite: true },
  });
  return finale?.reussite ?? null;
}
