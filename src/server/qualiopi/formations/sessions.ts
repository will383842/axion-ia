/**
 * Qualiopi — Lectures stub-safe des sessions de formation.
 *
 * Stub-aware (try/catch → []/null). Jamais de `*OrThrow`.
 * getSessionWithEnrollments charge les enrollments pour les feuilles
 * d'émargement et les bilans de fin de session.
 */

import { prisma } from "@/lib/prisma";
import type {
  TrainingSession,
  Enrollment,
  TrainingSessionStatut,
} from "@/server/qualiopi/formations/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types composés
// ─────────────────────────────────────────────────────────────────────────────

export type TrainingSessionWithEnrollments = TrainingSession & {
  enrollments: Enrollment[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Lectures
// ─────────────────────────────────────────────────────────────────────────────

export interface ListSessionsOpts {
  /** Filtre par formation parente. */
  formationId?: string;
  /** Filtre par statut. */
  statut?: TrainingSessionStatut;
}

/**
 * Liste les sessions (admin), triées par date de début desc.
 * Stub-safe → [] au build.
 */
export async function listSessions(opts?: ListSessionsOpts): Promise<TrainingSession[]> {
  try {
    const rows = await prisma.trainingSession.findMany({
      where: {
        ...(opts?.formationId !== undefined ? { formationId: opts.formationId } : {}),
        ...(opts?.statut !== undefined ? { statut: opts.statut } : {}),
      },
      orderBy: { dateDebut: "desc" },
    });
    return rows;
  } catch {
    return [];
  }
}

/**
 * Session par id UUID (sans enrollments, lecture légère). Stub-safe → null.
 */
export async function getSession(id: string): Promise<TrainingSession | null> {
  try {
    return await prisma.trainingSession.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Session par id UUID avec la liste des inscriptions.
 * Utilisé pour les feuilles d'émargement et les bilans.
 * Stub-safe → null.
 */
export async function getSessionWithEnrollments(
  id: string,
): Promise<TrainingSessionWithEnrollments | null> {
  try {
    const row = await prisma.trainingSession.findUnique({
      where: { id },
      include: { enrollments: true },
    });
    return row as TrainingSessionWithEnrollments | null;
  } catch {
    return null;
  }
}
