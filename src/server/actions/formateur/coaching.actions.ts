"use server";

/**
 * Espace formateur — actions coaching 1-to-1 (2026-06-13).
 *
 * CRUD des séances et des 5 formulaires AFEST (cartographie, optimisations,
 * plan, compte-rendu, journal). TOUTES les actions :
 *   1. exigent une session formateur (`requireFormateurAction`) ;
 *   2. vérifient que la séance ciblée APPARTIENT au formateur (`assertOwnership`)
 *      — un formateur ne peut jamais écrire sur la séance d'un autre.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFormateurAction } from "@/server/formateur/guard";

export interface ActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly id?: string;
}

const OK: ActionResult = { ok: true };

/** Vérifie que la séance appartient au formateur connecté. Retourne le trainerId. */
async function assertOwnership(sessionId: string): Promise<string> {
  const { trainerId } = await requireFormateurAction();
  const owned = await prisma.coachingSession.findFirst({
    where: { id: sessionId, trainerId },
    select: { id: true },
  });
  if (!owned) throw new Error("forbidden");
  return trainerId;
}

function refresh(sessionId: string) {
  revalidatePath(`/fr/espace-formateur/seances/${sessionId}`);
  revalidatePath(`/fr/espace-formateur`);
}

// ─── Séance ────────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  interventionSlug: z.string().trim().min(1).max(80),
  dateSeance: z.string().min(1), // ISO date du <input type="date">
  beneficiaireNom: z.string().trim().max(200).optional(),
  beneficiaireEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  beneficiaireEntreprise: z.string().trim().max(250).optional(),
});

export async function createSessionAction(
  input: z.input<typeof createSessionSchema>,
): Promise<ActionResult> {
  const { trainerId } = await requireFormateurAction();
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };
  const d = parsed.data;
  const created = await prisma.coachingSession.create({
    data: {
      trainerId,
      interventionSlug: d.interventionSlug,
      dateSeance: new Date(d.dateSeance),
      beneficiaireNom: d.beneficiaireNom || null,
      beneficiaireEmail: d.beneficiaireEmail || null,
      beneficiaireEntreprise: d.beneficiaireEntreprise || null,
    },
    select: { id: true },
  });
  revalidatePath(`/fr/espace-formateur`);
  return { ok: true, id: created.id };
}

const statutSchema = z.object({
  sessionId: z.string().uuid(),
  statut: z.enum(["planifiee", "realisee", "annulee"]),
});

export async function updateSessionStatutAction(
  input: z.infer<typeof statutSchema>,
): Promise<ActionResult> {
  const parsed = statutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Statut invalide." };
  await assertOwnership(parsed.data.sessionId);
  await prisma.coachingSession.update({
    where: { id: parsed.data.sessionId },
    data: { statut: parsed.data.statut },
  });
  refresh(parsed.data.sessionId);
  return OK;
}

// ─── 1. Cartographie de l'activité ───────────────────────────────────────────

const cartographieSchema = z.object({
  sessionId: z.string().uuid(),
  taches: z.array(z.record(z.unknown())).max(100).default([]),
  chronophages: z.string().max(5000).optional(),
  irritants: z.string().max(5000).optional(),
  donneesSensibles: z.string().max(5000).optional(),
  contraintes: z.string().max(5000).optional(),
});

export async function upsertCartographieAction(
  input: z.input<typeof cartographieSchema>,
): Promise<ActionResult> {
  const parsed = cartographieSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Cartographie invalide." };
  const { sessionId, taches, ...rest } = parsed.data;
  await assertOwnership(sessionId);
  const data = {
    taches,
    chronophages: rest.chronophages || null,
    irritants: rest.irritants || null,
    donneesSensibles: rest.donneesSensibles || null,
    contraintes: rest.contraintes || null,
  };
  await prisma.cartographieActivite.upsert({
    where: { coachingSessionId: sessionId },
    create: { coachingSessionId: sessionId, ...data },
    update: data,
  });
  refresh(sessionId);
  return OK;
}

// ─── 2. Optimisations proposées (N par séance) ───────────────────────────────

const optimisationSchema = z.object({
  sessionId: z.string().uuid(),
  id: z.string().uuid().optional(),
  type: z.enum(["automatisation", "delegation", "simplification", "outillage", "organisation"]),
  titre: z.string().trim().min(1).max(250),
  situationActuelle: z.string().max(5000).optional(),
  piste: z.string().max(5000).optional(),
  gainTempsMinParOcc: z.number().int().min(0).max(100000).optional(),
  occurrencesSemaine: z.number().int().min(0).max(100000).optional(),
  gainEuroOuRisque: z.string().max(250).optional(),
  facilite: z.number().int().min(1).max(5).optional(),
  priorite: z.number().int().min(1).max(999).optional(),
  retenue: z.boolean().default(false),
});

export async function upsertOptimisationAction(
  input: z.input<typeof optimisationSchema>,
): Promise<ActionResult> {
  const parsed = optimisationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Optimisation invalide." };
  const { sessionId, id, ...rest } = parsed.data;
  await assertOwnership(sessionId);
  const data = {
    type: rest.type,
    titre: rest.titre,
    situationActuelle: rest.situationActuelle || null,
    piste: rest.piste || null,
    gainTempsMinParOcc: rest.gainTempsMinParOcc ?? null,
    occurrencesSemaine: rest.occurrencesSemaine ?? null,
    gainEuroOuRisque: rest.gainEuroOuRisque || null,
    facilite: rest.facilite ?? null,
    priorite: rest.priorite ?? null,
    retenue: rest.retenue,
  };
  if (id) {
    // Garde-fou : l'optimisation doit appartenir à CETTE séance.
    const res = await prisma.optimisationProposee.updateMany({
      where: { id, coachingSessionId: sessionId },
      data,
    });
    if (res.count === 0) return { ok: false, error: "Introuvable." };
  } else {
    await prisma.optimisationProposee.create({ data: { coachingSessionId: sessionId, ...data } });
  }
  refresh(sessionId);
  return OK;
}

const deleteOptimisationSchema = z.object({
  sessionId: z.string().uuid(),
  id: z.string().uuid(),
});

export async function deleteOptimisationAction(
  input: z.infer<typeof deleteOptimisationSchema>,
): Promise<ActionResult> {
  const parsed = deleteOptimisationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  await assertOwnership(parsed.data.sessionId);
  await prisma.optimisationProposee.deleteMany({
    where: { id: parsed.data.id, coachingSessionId: parsed.data.sessionId },
  });
  refresh(parsed.data.sessionId);
  return OK;
}

// ─── 3. Plan d'optimisation (1 par séance) ───────────────────────────────────

const planSchema = z.object({
  sessionId: z.string().uuid(),
  objectifs: z.string().max(8000).optional(),
  optimisationsRetenues: z.array(z.record(z.unknown())).max(100).default([]),
  prochainesEtapes: z.array(z.record(z.unknown())).max(100).default([]),
  pointsVigilance: z.string().max(5000).optional(),
  gainTempsHSemaine: z.number().min(0).max(168).optional(),
  suiviPropose: z.string().max(120).optional(),
});

export async function upsertPlanAction(input: z.input<typeof planSchema>): Promise<ActionResult> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Plan invalide." };
  const { sessionId, ...rest } = parsed.data;
  await assertOwnership(sessionId);
  const data = {
    objectifs: rest.objectifs || null,
    optimisationsRetenues: rest.optimisationsRetenues,
    prochainesEtapes: rest.prochainesEtapes,
    pointsVigilance: rest.pointsVigilance || null,
    gainTempsHSemaine: rest.gainTempsHSemaine ?? null,
    suiviPropose: rest.suiviPropose || null,
  };
  await prisma.planOptimisation.upsert({
    where: { coachingSessionId: sessionId },
    create: { coachingSessionId: sessionId, ...data },
    update: data,
  });
  refresh(sessionId);
  return OK;
}

// ─── 4. Compte-rendu de séance (N par séance) ────────────────────────────────

const compteRenduSchema = z.object({
  sessionId: z.string().uuid(),
  dateSeance: z.string().min(1),
  dureeMinutes: z.number().int().min(0).max(1440).optional(),
  objectifs: z.string().max(8000).optional(),
  misesEnSituation: z.array(z.record(z.unknown())).max(100).default([]),
  phasesReflexives: z.array(z.record(z.unknown())).max(100).default([]),
  planRemis: z.boolean().default(false),
  suite: z.string().max(120).optional(),
  notesConfidentielles: z.string().max(8000).optional(),
});

export async function addCompteRenduAction(
  input: z.input<typeof compteRenduSchema>,
): Promise<ActionResult> {
  const parsed = compteRenduSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Compte-rendu invalide." };
  const { sessionId, ...rest } = parsed.data;
  await assertOwnership(sessionId);
  const created = await prisma.compteRenduSeance.create({
    data: {
      coachingSessionId: sessionId,
      dateSeance: new Date(rest.dateSeance),
      dureeMinutes: rest.dureeMinutes ?? null,
      objectifs: rest.objectifs || null,
      misesEnSituation: rest.misesEnSituation,
      phasesReflexives: rest.phasesReflexives,
      planRemis: rest.planRemis,
      suite: rest.suite || null,
      notesConfidentielles: rest.notesConfidentielles || null,
    },
    select: { id: true },
  });
  refresh(sessionId);
  return { ok: true, id: created.id };
}

const deleteCompteRenduSchema = z.object({ sessionId: z.string().uuid(), id: z.string().uuid() });

export async function deleteCompteRenduAction(
  input: z.infer<typeof deleteCompteRenduSchema>,
): Promise<ActionResult> {
  const parsed = deleteCompteRenduSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  await assertOwnership(parsed.data.sessionId);
  await prisma.compteRenduSeance.deleteMany({
    where: { id: parsed.data.id, coachingSessionId: parsed.data.sessionId },
  });
  refresh(parsed.data.sessionId);
  return OK;
}

// ─── 5. Journal de progression (N par séance) ────────────────────────────────

const journalSchema = z.object({
  sessionId: z.string().uuid(),
  periode: z.string().max(60).optional(),
  acquisitions: z.string().max(8000).optional(),
  blocages: z.string().max(8000).optional(),
  prochainsFocus: z.string().max(8000).optional(),
  gainTempsCumuleHSem: z.number().min(0).max(168).optional(),
  engagement: z.number().int().min(1).max(5).optional(),
});

export async function addJournalAction(
  input: z.input<typeof journalSchema>,
): Promise<ActionResult> {
  const parsed = journalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Journal invalide." };
  const { sessionId, ...rest } = parsed.data;
  await assertOwnership(sessionId);
  const created = await prisma.journalProgression.create({
    data: {
      coachingSessionId: sessionId,
      periode: rest.periode || null,
      acquisitions: rest.acquisitions || null,
      blocages: rest.blocages || null,
      prochainsFocus: rest.prochainsFocus || null,
      gainTempsCumuleHSem: rest.gainTempsCumuleHSem ?? null,
      engagement: rest.engagement ?? null,
    },
    select: { id: true },
  });
  refresh(sessionId);
  return { ok: true, id: created.id };
}

const deleteJournalSchema = z.object({ sessionId: z.string().uuid(), id: z.string().uuid() });

export async function deleteJournalAction(
  input: z.infer<typeof deleteJournalSchema>,
): Promise<ActionResult> {
  const parsed = deleteJournalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  await assertOwnership(parsed.data.sessionId);
  await prisma.journalProgression.deleteMany({
    where: { id: parsed.data.id, coachingSessionId: parsed.data.sessionId },
  });
  refresh(parsed.data.sessionId);
  return OK;
}
