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
  IncidentFaitIntervenant,
} from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type { IncidentType, IncidentGravite, IncidentStatut, IncidentFaitIntervenant };

/**
 * Mise en cause d'un intervenant externe (art. 7 de la procédure de
 * sous-traitance, 2026-08-03).
 *
 * Les trois champs voyagent ENSEMBLE : un incident vise un intervenant et dit
 * quel fait lui est reproché, ou ne vise personne. Les séparer aurait permis
 * d'écrire une mise en cause sans fait, donc une accusation sans motif — que
 * l'article 8 interdit d'opposer à un formateur lors de sa reconduction.
 */
export interface MiseEnCauseIntervenant {
  /** Personne physique OU organisme — jamais les deux (contrainte en base). */
  trainerId?: string | null;
  sousTraitantId?: string | null;
  faitIntervenant?: IncidentFaitIntervenant | null;
}

export interface CreerIncidentInput extends MiseEnCauseIntervenant {
  type: IncidentType;
  gravite: IncidentGravite;
  titre: string;
  description?: string;
  sessionId?: string | null;
  dateIncident: Date;
  actionCorrective?: string;
  statut?: IncidentStatut;
}

export interface UpdateIncidentInput extends MiseEnCauseIntervenant {
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
  /** Restreint aux incidents mettant en cause ce formateur. */
  trainerId?: string;
  /** Restreint aux incidents mettant en cause cet organisme sous-traitant. */
  sousTraitantId?: string;
  skip?: number;
  take?: number;
}

/**
 * Refuse une mise en cause incohérente AVANT d'écrire.
 *
 * La base porte déjà la contrainte « jamais deux cibles », mais elle rejetterait
 * avec une erreur Postgres illisible. Ici le message dit ce qui ne va pas.
 */
function verifierMiseEnCause(input: MiseEnCauseIntervenant): void {
  if (input.trainerId && input.sousTraitantId) {
    throw new Error(
      "incidents-service: un incident met en cause un formateur OU un organisme, pas les deux",
    );
  }
  if ((input.trainerId || input.sousTraitantId) && input.faitIntervenant === null) {
    throw new Error(
      "incidents-service: mettre en cause un intervenant exige de préciser le fait reproché",
    );
  }
}

/** Champs de mise en cause, en spread conditionnel (exactOptionalPropertyTypes). */
function dataMiseEnCause(input: MiseEnCauseIntervenant) {
  return {
    ...(input.trainerId !== undefined ? { trainerId: input.trainerId } : {}),
    ...(input.sousTraitantId !== undefined ? { sousTraitantId: input.sousTraitantId } : {}),
    ...(input.faitIntervenant !== undefined ? { faitIntervenant: input.faitIntervenant } : {}),
  };
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
  verifierMiseEnCause(input);
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
      ...dataMiseEnCause(input),
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
  verifierMiseEnCause(input);
  return prisma.incident.update({
    where: { id },
    data: {
      ...dataMiseEnCause(input),
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
      ...(options.trainerId !== undefined ? { trainerId: options.trainerId } : {}),
      ...(options.sousTraitantId !== undefined ? { sousTraitantId: options.sousTraitantId } : {}),
    },
    include: {
      session: { select: { id: true, numero: true, titreSession: true } },
    },
    orderBy: { dateIncident: "desc" },
    skip: options.skip ?? 0,
    take: options.take ?? 200,
  });
}
