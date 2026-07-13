/**
 * Qualiopi — Service registre des incidents (LOT 4 — pilotage réel).
 *
 * creerIncident     : déclare un incident (pédagogique/administratif/technique/autre).
 * updateIncident    : met à jour un incident (champs fournis uniquement) —
 *                     passe resoluAt automatiquement quand statut → resolu.
 * supprimerIncident : suppression physique (registre interne, pattern veille).
 * getIncident       : lecture unitaire.
 * listIncidents     : liste filtrée (statut/type optionnels) avec la session liée.
 *
 * Alimente M7 (incidents réels) et M9 (actions correctives) du pilotage.
 * Stub-aware : early-exit/mutations interdites si DATABASE_URL contient "stub.invalid".
 * exactOptionalPropertyTypes : champs optionnels transmis via spread conditionnel.
 */

import { prisma } from "@/lib/prisma";
import type {
  Incident,
  IncidentType,
  IncidentGravite,
  IncidentStatut,
} from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type { IncidentType, IncidentGravite, IncidentStatut };

export interface CreerIncidentInput {
  type: IncidentType;
  gravite: IncidentGravite;
  titre: string;
  description?: string;
  sessionId?: string | null;
  dateIncident: Date;
  actionCorrective?: string;
  statut?: IncidentStatut;
}

export interface UpdateIncidentInput {
  type?: IncidentType;
  gravite?: IncidentGravite;
  titre?: string;
  description?: string;
  /** `null` détache la session. */
  sessionId?: string | null;
  dateIncident?: Date;
  actionCorrective?: string;
  statut?: IncidentStatut;
}

export interface ListIncidentsOptions {
  statut?: IncidentStatut;
  type?: IncidentType;
  skip?: number;
  take?: number;
}

export type IncidentWithSession = Incident & {
  session: { id: string; numero: string; titreSession: string } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// creerIncident
// ─────────────────────────────────────────────────────────────────────────────

/** Déclare un incident dans le registre. */
export async function creerIncident(input: CreerIncidentInput): Promise<Incident> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("incidents-service: mutations interdites en mode stub.invalid");
  }
  const statut = input.statut ?? "ouvert";
  return prisma.incident.create({
    data: {
      type: input.type,
      gravite: input.gravite,
      titre: input.titre,
      dateIncident: input.dateIncident,
      statut,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      ...(input.actionCorrective !== undefined ? { actionCorrective: input.actionCorrective } : {}),
      ...(statut === "resolu" ? { resoluAt: new Date() } : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// updateIncident
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Met à jour les champs fournis d'un incident. Quand le statut passe à
 * `resolu`, `resoluAt` est posé (s'il ne l'était pas déjà) ; quand il repasse
 * à `ouvert`/`en_cours`, `resoluAt` est remis à null.
 */
export async function updateIncident(id: string, input: UpdateIncidentInput): Promise<Incident> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("incidents-service: mutations interdites en mode stub.invalid");
  }
  return prisma.incident.update({
    where: { id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.gravite !== undefined ? { gravite: input.gravite } : {}),
      ...(input.titre !== undefined ? { titre: input.titre } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      ...(input.dateIncident !== undefined ? { dateIncident: input.dateIncident } : {}),
      ...(input.actionCorrective !== undefined ? { actionCorrective: input.actionCorrective } : {}),
      ...(input.statut !== undefined
        ? {
            statut: input.statut,
            resoluAt: input.statut === "resolu" ? new Date() : null,
          }
        : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// supprimerIncident
// ─────────────────────────────────────────────────────────────────────────────

/** Supprime un incident (registre interne — pattern veille). */
export async function supprimerIncident(id: string): Promise<Incident> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("incidents-service: mutations interdites en mode stub.invalid");
  }
  return prisma.incident.delete({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// getIncident
// ─────────────────────────────────────────────────────────────────────────────

/** Lecture unitaire d'un incident. Retourne null si introuvable. */
export async function getIncident(id: string): Promise<Incident | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  return prisma.incident.findUnique({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// listIncidents
// ─────────────────────────────────────────────────────────────────────────────

/** Liste les incidents (plus récents d'abord), avec la session liée éventuelle. */
export async function listIncidents(
  options: ListIncidentsOptions = {},
): Promise<IncidentWithSession[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  return prisma.incident.findMany({
    where: {
      ...(options.statut !== undefined ? { statut: options.statut } : {}),
      ...(options.type !== undefined ? { type: options.type } : {}),
    },
    include: {
      session: { select: { id: true, numero: true, titreSession: true } },
    },
    orderBy: { dateIncident: "desc" },
    skip: options.skip ?? 0,
    take: options.take ?? 200,
  });
}
