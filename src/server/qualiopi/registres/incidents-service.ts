/**
 * Qualiopi — Service registre des incidents (LOT 4 — pilotage réel).
 *
 * creerIncident        : déclare un incident (pédagogique/administratif/technique/autre),
 *                        avec sa nature, son déclarant et son origine.
 * completerIncident    : complète ce qui n'est pas renseigné ou décide d'un
 *                        changement de statut — dans la MÊME transaction que la
 *                        note signée qui le documente (L09).
 * ajouterNoteIncident  : note de suivi, en ajout seul.
 * getIncident          : lecture unitaire.
 * listIncidents        : liste filtrée (statut/type optionnels) avec la session
 *                        liée et les notes.
 *
 * 🔴 Chantier QNC, L09 — il n'existe plus ni `updateIncident` libre ni
 * `supprimerIncident` : un incident déclaré est une pièce du registre (ind. 31
 * et 32). Les règles de ce qui reste permis vivent, pures, dans
 * `incident-complement.ts` ; `registres-rien-ne-s-efface.spec.ts` rougit au
 * premier effacement réintroduit.
 *
 * Alimente M7 (incidents réels) et M9 (actions correctives) du pilotage.
 * Stub-aware : early-exit/mutations interdites si DATABASE_URL contient "stub.invalid".
 * exactOptionalPropertyTypes : champs optionnels transmis via spread conditionnel.
 */

import { prisma } from "@/lib/prisma";
import type {
  Incident,
  IncidentNote,
  IncidentType,
  IncidentGravite,
  IncidentStatut,
  IncidentFaitIntervenant,
} from "../../../../prisma/generated/client";
import {
  planifierComplement,
  type DeclarantIncident,
  type DemandeComplement,
  type NatureIncident,
  type OrigineIncident,
} from "./incident-complement";

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

/** L'auteur RÉEL d'un geste : la personne connectée, ou l'automate qui agit. */
export interface AuteurRegistre {
  readonly id: string | null;
  readonly nom: string;
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
  /** L09 — aléa, dysfonctionnement ou difficulté. */
  nature?: NatureIncident;
  /** L09 — la partie prenante qui l'a signalé. */
  declarant?: DeclarantIncident;
  /** L09 — par où il est arrivé. */
  origine?: OrigineIncident;
  /** L09 — l'administrateur qui le saisit (NULL pour un automate). */
  declareParId?: string | null;
  /**
   * L09 — note d'ouverture, écrite dans la même transaction. Sert aux
   * ouvertures automatiques (examen d'une note faible) : la note dit d'où
   * vient l'incident et qui l'a ouvert.
   */
  noteOuverture?: { texte: string; auteur: AuteurRegistre };
}

export interface ListIncidentsOptions {
  statut?: IncidentStatut;
  type?: IncidentType;
  /** Restreint aux incidents mettant en cause ce formateur. */
  trainerId?: string;
  /** Restreint aux incidents mettant en cause cet organisme sous-traitant. */
  sousTraitantId?: string;
  /** Restreint aux incidents d'une session (dossier de session). */
  sessionId?: string;
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

export type NoteIncidentLue = Pick<IncidentNote, "id" | "texte" | "auteurNom" | "creeLe">;

export type IncidentWithSession = Incident & {
  session: { id: string; numero: string; titreSession: string } | null;
  notes: NoteIncidentLue[];
};

function interditAuBuild(): void {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("incidents-service: mutations interdites en mode stub.invalid");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// creerIncident
// ─────────────────────────────────────────────────────────────────────────────

/** Déclare un incident dans le registre. */
export async function creerIncident(input: CreerIncidentInput): Promise<Incident> {
  interditAuBuild();
  verifierMiseEnCause(input);
  const statut = input.statut ?? "ouvert";
  const data = {
    type: input.type,
    gravite: input.gravite,
    titre: input.titre,
    dateIncident: input.dateIncident,
    statut,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    ...(input.actionCorrective !== undefined ? { actionCorrective: input.actionCorrective } : {}),
    ...(statut === "resolu" ? { resoluAt: new Date() } : {}),
    ...(input.nature !== undefined ? { nature: input.nature } : {}),
    ...(input.declarant !== undefined ? { declarant: input.declarant } : {}),
    ...(input.origine !== undefined ? { origine: input.origine } : {}),
    ...(input.declareParId !== undefined ? { declareParId: input.declareParId } : {}),
    ...dataMiseEnCause(input),
  };
  const note = input.noteOuverture;
  if (note === undefined) return prisma.incident.create({ data });
  return prisma.$transaction(async (tx) => {
    const incident = await tx.incident.create({ data });
    await tx.incidentNote.create({
      data: {
        incidentId: incident.id,
        texte: note.texte,
        auteurId: note.auteur.id,
        auteurNom: note.auteur.nom,
      },
    });
    return incident;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// completerIncident
// ─────────────────────────────────────────────────────────────────────────────

export type ResultatCompleter =
  { ok: true; incident: Incident; note: string } | { ok: false; erreur: string };

/**
 * Complète un incident ou décide de son statut. L'état est RELU dans la
 * transaction, la règle appliquée sur cet état, et la note signée écrite avec
 * la modification : sans note, pas de modification.
 */
export async function completerIncident(
  id: string,
  demande: DemandeComplement,
  auteur: AuteurRegistre,
): Promise<ResultatCompleter> {
  interditAuBuild();
  return prisma.$transaction(async (tx) => {
    // Deux compléments simultanés se suivent au lieu de s'écraser.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`incident:${id}`}))`;
    const actuel = await tx.incident.findUnique({ where: { id } });
    if (actuel === null) return { ok: false as const, erreur: "Incident introuvable" };
    const plan = planifierComplement(actuel, demande, new Date());
    if (!plan.ok) return { ok: false as const, erreur: plan.erreur };
    const incident =
      Object.keys(plan.data).length > 0
        ? await tx.incident.update({ where: { id }, data: plan.data })
        : actuel;
    await tx.incidentNote.create({
      data: { incidentId: id, texte: plan.note, auteurId: auteur.id, auteurNom: auteur.nom },
    });
    return { ok: true as const, incident, note: plan.note };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ajouterNoteIncident
// ─────────────────────────────────────────────────────────────────────────────

/** Ajoute une note de suivi. Une note fausse se corrige par une note suivante. */
export async function ajouterNoteIncident(
  incidentId: string,
  texte: string,
  auteur: AuteurRegistre,
): Promise<NoteIncidentLue> {
  interditAuBuild();
  return prisma.incidentNote.create({
    data: { incidentId, texte, auteurId: auteur.id, auteurNom: auteur.nom },
    select: { id: true, texte: true, auteurNom: true, creeLe: true },
  });
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

/** Liste les incidents (plus récents d'abord), avec la session liée et les notes. */
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
      ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
    },
    include: {
      session: { select: { id: true, numero: true, titreSession: true } },
      notes: {
        select: { id: true, texte: true, auteurNom: true, creeLe: true },
        orderBy: { creeLe: "asc" },
      },
    },
    orderBy: { dateIncident: "desc" },
    skip: options.skip ?? 0,
    take: options.take ?? 200,
  });
}
