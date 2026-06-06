/**
 * Qualiopi — Service appréciations multi-parties (T14 — AGENT A — off.30).
 *
 * creerAppreciation  : enregistre une appréciation (stagiaire/entreprise/
 *                      financeur/formateur).
 * listAppreciations  : liste les appréciations avec filtres optionnels.
 * statsAppreciations : moyenne de note par source.
 *
 * off.30 : Recueil structuré des retours multi-parties (≠ réclamations off.31).
 * Note /5 facultative. dateAppreciation obligatoire.
 *
 * Stub-aware : mutations lèvent si stub.invalid ; lectures retournent []/stats vides.
 * exactOptionalPropertyTypes respecté.
 */

import { prisma } from "@/lib/prisma";
import type { AppreciationSource } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export type { AppreciationSource };

export interface CreerAppreciationInput {
  source: AppreciationSource;
  /** Lien à l'inscription (optionnel). */
  enrollmentId?: string;
  /** Lien au stagiaire (optionnel). */
  traineeId?: string;
  /** Lien au client/entreprise (optionnel). */
  clientId?: string;
  /** Note /5 (optionnel — entier 1..5). */
  note?: number;
  /** Commentaire libre (optionnel). */
  commentaire?: string;
  dateAppreciation: Date;
}

export interface AppreciationListOptions {
  source?: AppreciationSource;
  traineeId?: string;
  enrollmentId?: string;
  clientId?: string;
  limit?: number;
}

export interface AppreciationItem {
  id: string;
  source: AppreciationSource;
  enrollmentId: string | null;
  traineeId: string | null;
  clientId: string | null;
  note: number | null;
  commentaire: string | null;
  dateAppreciation: Date;
  createdAt: Date;
}

/** Statistiques de notes par source. */
export interface StatsAppreciations {
  global: { count: number; moyenne: number | null };
  parSource: Record<AppreciationSource, { count: number; moyenne: number | null }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// creerAppreciation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre une nouvelle appréciation multi-parties.
 *
 * - Valide note ∈ [1..5] si fournie.
 * - Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function creerAppreciation(input: CreerAppreciationInput): Promise<{ id: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("creerAppreciation: stub DB — non disponible au build");
  }

  if (
    input.note !== undefined &&
    (input.note < 1 || input.note > 5 || !Number.isInteger(input.note))
  ) {
    throw new Error(`note invalide : ${input.note} — doit être un entier entre 1 et 5`);
  }

  const created = await prisma.appreciation.create({
    data: {
      source: input.source,
      ...(input.enrollmentId !== undefined ? { enrollmentId: input.enrollmentId } : {}),
      ...(input.traineeId !== undefined ? { traineeId: input.traineeId } : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.commentaire !== undefined ? { commentaire: input.commentaire } : {}),
      dateAppreciation: input.dateAppreciation,
    },
    select: { id: true },
  });

  return { id: created.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// listAppreciations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste les appréciations avec filtres optionnels.
 *
 * Retourne [] en mode stub.invalid.
 */
export async function listAppreciations(
  options: AppreciationListOptions = {},
): Promise<AppreciationItem[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }

  const where: Record<string, unknown> = {};
  if (options.source !== undefined) where["source"] = options.source;
  if (options.traineeId !== undefined) where["traineeId"] = options.traineeId;
  if (options.enrollmentId !== undefined) where["enrollmentId"] = options.enrollmentId;
  if (options.clientId !== undefined) where["clientId"] = options.clientId;

  const items = await prisma.appreciation.findMany({
    where,
    orderBy: { dateAppreciation: "desc" },
    ...(options.limit !== undefined ? { take: options.limit } : {}),
    select: {
      id: true,
      source: true,
      enrollmentId: true,
      traineeId: true,
      clientId: true,
      note: true,
      commentaire: true,
      dateAppreciation: true,
      createdAt: true,
    },
  });

  return items.map((item) => ({
    id: item.id,
    source: item.source,
    enrollmentId: item.enrollmentId ?? null,
    traineeId: item.traineeId ?? null,
    clientId: item.clientId ?? null,
    note: item.note ?? null,
    commentaire: item.commentaire ?? null,
    dateAppreciation: item.dateAppreciation,
    createdAt: item.createdAt,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// statsAppreciations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule les statistiques de notes par source.
 *
 * Retourne des stats vides (count=0, moyenne=null) en mode stub.invalid.
 */
export async function statsAppreciations(): Promise<StatsAppreciations> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      global: { count: 0, moyenne: null },
      parSource: {
        stagiaire: { count: 0, moyenne: null },
        entreprise: { count: 0, moyenne: null },
        financeur: { count: 0, moyenne: null },
        formateur: { count: 0, moyenne: null },
      },
    };
  }

  // Agrégation globale
  const globalAgg = await prisma.appreciation.aggregate({
    _count: { _all: true },
    _avg: { note: true },
  });

  // Agrégation par source
  const parSourceAgg = await prisma.appreciation.groupBy({
    by: ["source"],
    _count: { _all: true },
    _avg: { note: true },
  });

  const sources: AppreciationSource[] = ["stagiaire", "entreprise", "financeur", "formateur"];

  const parSource = Object.fromEntries(
    sources.map((s) => {
      const found = parSourceAgg.find((r) => r.source === s);
      return [
        s,
        {
          count: found?._count._all ?? 0,
          moyenne: found?._avg.note ?? null,
        },
      ];
    }),
  ) as Record<AppreciationSource, { count: number; moyenne: number | null }>;

  return {
    global: {
      count: globalAgg._count._all,
      moyenne: globalAgg._avg.note ?? null,
    },
    parSource,
  };
}
