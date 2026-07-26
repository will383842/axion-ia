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
  /**
   * Auteur de l'évaluation (`AdminUser.id`).
   *
   * Colonne restée MORTE jusqu'ici : jamais écrite, jamais lue. Sans elle, rien
   * ne permet de démontrer QUI a évalué — anodin avec un formateur unique,
   * critique dès que plusieurs intervenants coexistent. Renseignée par l'action
   * serveur à partir de la session admin ; optionnelle pour ne pas casser les
   * appelants existants (imports, seeds).
   */
  evalueParId?: string;
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
      ...(input.evalueParId !== undefined ? { evalueParId: input.evalueParId } : {}),
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
 * Résultats détaillés de l'évaluation finale, objectif par objectif.
 *
 * 🔴 Audit certification 2026-07-26 (F21). `getFinaleReussite` ne remontait
 * qu'un booléen, et l'attestation imprimait donc sous « Compétences acquises »
 * la liste COMPLÈTE des objectifs du catalogue — un stagiaire noté « non
 * acquis » sur trois objectifs sur cinq était attesté sur les cinq. L'article
 * L6353-1 exige les RÉSULTATS de l'évaluation des acquis, pas le programme.
 *
 * On remonte donc le détail, et c'est à l'appelant de ne pas le recopier.
 */
export interface ResultatsFinale {
  reussite: boolean;
  scorePct: number;
  niveauGlobal: string;
  /** Libellés répartis par note. Une compétence non notée n'est dans aucune. */
  acquis: string[];
  partiels: string[];
  nonAcquis: string[];
  /** Compétences attendues mais laissées sans note — à signaler, jamais à taire. */
  nonEvalues: string[];
}

/** Forme d'une compétence telle que stockée dans la colonne Json `competences`. */
interface CompetenceStockee {
  libelle?: unknown;
  note?: unknown;
}

/**
 * Retourne le détail de l'évaluation finale la plus récente, ou `null`.
 *
 * `competences` est une colonne `Json` : son contenu n'est pas garanti par le
 * typage. On la lit défensivement — un libellé manquant est ignoré plutôt que
 * de faire échouer la génération de l'attestation.
 */
export async function getFinaleResultats(enrollmentId: string): Promise<ResultatsFinale | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  const finale = await prisma.evaluationAcquis.findFirst({
    where: { enrollmentId, type: "finale" },
    orderBy: { dateEvaluation: "desc" },
    select: {
      reussite: true,
      scorePct: true,
      niveauGlobal: true,
      competences: true,
    },
  });
  if (finale === null) return null;

  const brut: unknown = finale.competences;
  const lignes: CompetenceStockee[] = Array.isArray(brut) ? (brut as CompetenceStockee[]) : [];

  const acquis: string[] = [];
  const partiels: string[] = [];
  const nonAcquis: string[] = [];
  const nonEvalues: string[] = [];

  for (const c of lignes) {
    if (c === null || typeof c !== "object") continue;
    const libelle = typeof c.libelle === "string" ? c.libelle.trim() : "";
    if (libelle === "") continue;
    if (c.note === 3) acquis.push(libelle);
    else if (c.note === 2) partiels.push(libelle);
    else if (c.note === 1) nonAcquis.push(libelle);
    else nonEvalues.push(libelle);
  }

  return {
    reussite: finale.reussite,
    scorePct: finale.scorePct,
    niveauGlobal: String(finale.niveauGlobal),
    acquis,
    partiels,
    nonAcquis,
    nonEvalues,
  };
}

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
