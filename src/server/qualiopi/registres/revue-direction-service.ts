/**
 * Qualiopi — Service revue de direction annuelle (off.32, indicateur 32).
 *
 * creerRevue  : crée la revue de direction d'une année avec snapshot indicateurs.
 * updateRevue : met à jour une revue existante (participants, décisions, etc.).
 * getRevue    : lecture unitaire par année.
 * listRevues  : liste toutes les revues.
 *
 * `creerRevue` importe `getIndicateurs` de @/server/qualiopi/indicateurs/service
 * pour construire le snapshot JSON (indicateurs de l'année).
 *
 * Stub-aware. exactOptionalPropertyTypes.
 */

import { prisma } from "@/lib/prisma";
import type { RevueDirection } from "../../../../prisma/generated/client";
import { getIndicateurs } from "@/server/qualiopi/indicateurs/service";

// ─────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────────────

export interface CreerRevueInput {
  dateRevue: Date;
  participants?: unknown[];
  decisions?: unknown[];
  planActions?: unknown[];
  statut?: string;
}

export interface UpdateRevueInput {
  dateRevue?: Date;
  participants?: unknown[];
  decisions?: unknown[];
  planActions?: unknown[];
  statut?: string;
  indicateursSnapshot?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// creerRevue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée la revue de direction pour une année donnée.
 * Génère automatiquement un snapshot des indicateurs via `getIndicateurs`.
 * Lève si une revue existe déjà pour l'année (contrainte @unique sur `annee`).
 */
export async function creerRevue(annee: number, input: CreerRevueInput): Promise<RevueDirection> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("revue-direction-service: mutations interdites en mode stub.invalid");
  }

  const indicateurs = await getIndicateurs(annee);

  return prisma.revueDirection.create({
    data: {
      annee,
      dateRevue: input.dateRevue,
      participants: (input.participants ?? []) as never,
      decisions: (input.decisions ?? []) as never,
      planActions: (input.planActions ?? []) as never,
      statut: input.statut ?? "brouillon",
      indicateursSnapshot: indicateurs as never,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// updateRevue
// ─────────────────────────────────────────────────────────────────────────────

/** Met à jour les champs fournis d'une revue de direction (par son id). */
export async function updateRevue(id: string, input: UpdateRevueInput): Promise<RevueDirection> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("revue-direction-service: mutations interdites en mode stub.invalid");
  }
  return prisma.revueDirection.update({
    where: { id },
    data: {
      ...(input.dateRevue !== undefined ? { dateRevue: input.dateRevue } : {}),
      ...(input.participants !== undefined ? { participants: input.participants as never } : {}),
      ...(input.decisions !== undefined ? { decisions: input.decisions as never } : {}),
      ...(input.planActions !== undefined ? { planActions: input.planActions as never } : {}),
      ...(input.statut !== undefined ? { statut: input.statut } : {}),
      ...(input.indicateursSnapshot !== undefined
        ? { indicateursSnapshot: input.indicateursSnapshot as never }
        : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getRevue
// ─────────────────────────────────────────────────────────────────────────────

/** Lecture unitaire de la revue de direction d'une année. Retourne null si absente. */
export async function getRevue(annee: number): Promise<RevueDirection | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  return prisma.revueDirection.findUnique({ where: { annee } });
}

// ─────────────────────────────────────────────────────────────────────────────
// listRevues
// ─────────────────────────────────────────────────────────────────────────────

/** Liste toutes les revues de direction, de la plus récente à la plus ancienne. */
export async function listRevues(): Promise<RevueDirection[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  return prisma.revueDirection.findMany({
    orderBy: { annee: "desc" },
  });
}
