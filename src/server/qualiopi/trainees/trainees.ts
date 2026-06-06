/**
 * Qualiopi — Lecture stagiaires (Trainee). R10 audit E2E 2026-06-06.
 *
 * Stub-aware (try/catch → [] / null). Exclut par défaut les stagiaires anonymisés
 * (deletedAt non nul, droit à l'effacement RGPD art. 17). Ne JAMAIS exposer
 * `handicapDetailsChiffre` déchiffré dans les listes (référent uniquement).
 */

import { prisma } from "@/lib/prisma";
import type { Trainee } from "../../../../prisma/generated/client";

export interface ListTraineesOpts {
  /** Recherche texte simple (nom / prénom / email / entreprise). */
  search?: string;
  /** Inclure les stagiaires anonymisés (deletedAt non nul). Défaut false. */
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/** Stagiaires (non anonymisés par défaut), triés par nom. Stub-safe → []. */
export async function listTrainees(opts?: ListTraineesOpts): Promise<Trainee[]> {
  try {
    const where: Record<string, unknown> = {};
    if (!opts?.includeDeleted) where.deletedAt = null;
    if (opts?.search && opts.search.trim() !== "") {
      const q = opts.search.trim();
      where.OR = [
        { nom: { contains: q, mode: "insensitive" } },
        { prenom: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { entreprise: { contains: q, mode: "insensitive" } },
      ];
    }
    return await prisma.trainee.findMany({
      ...(Object.keys(where).length > 0 ? { where } : {}),
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      ...(opts?.limit !== undefined ? { take: opts.limit } : {}),
      ...(opts?.offset !== undefined ? { skip: opts.offset } : {}),
    });
  } catch {
    return [];
  }
}

/** Stagiaire par id UUID. Stub-safe → null. */
export async function getTrainee(id: string): Promise<Trainee | null> {
  try {
    return await prisma.trainee.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/** Stagiaire par email. Stub-safe → null. */
export async function getTraineeByEmail(email: string): Promise<Trainee | null> {
  try {
    return await prisma.trainee.findUnique({ where: { email } });
  } catch {
    return null;
  }
}
