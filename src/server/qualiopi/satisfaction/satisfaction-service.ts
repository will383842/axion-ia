/**
 * Qualiopi — Service questionnaires de satisfaction (AGENT A — T10).
 *
 * creerQuestionnaire         : upsert idempotent (enrollmentId×type), token via makeQrToken.
 * soumettreReponses          : met à jour reponses + noteGlobale + reponduAt.
 * listQuestionnairesSession  : liste tous les questionnaires d'une session.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", les mutations lèvent
 * et les lectures retournent des valeurs vides (safe au build SSG).
 */

import { prisma } from "@/lib/prisma";
import { makeQrToken } from "@/server/qualiopi/documents/qr";
import type { Questionnaire, QuestionnaireType } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type { QuestionnaireType };

export interface CreerQuestionnaireInput {
  enrollmentId: string;
  type: QuestionnaireType;
}

export interface SoumettreReponsesInput {
  token: string;
  reponses: Record<string, unknown>;
  noteGlobale?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// creerQuestionnaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée ou récupère (upsert idempotent) un questionnaire pour une inscription × type.
 *
 * - Si le questionnaire existe déjà (même enrollmentId + type), retourne l'existant.
 * - Sinon, génère un token aléatoire et insère le questionnaire.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function creerQuestionnaire(
  input: CreerQuestionnaireInput,
): Promise<{ id: string; token: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("creerQuestionnaire: stub DB — non disponible au build");
  }

  const token = makeQrToken();

  // upsert idempotent : si déjà existant, on ne touche PAS au token existant.
  // On utilise create/findUnique pour préserver le token original (upsert écrase).
  const existing = await prisma.questionnaire.findUnique({
    where: {
      enrollmentId_type: {
        enrollmentId: input.enrollmentId,
        type: input.type,
      },
    },
    select: { id: true, token: true },
  });

  if (existing !== null) {
    return { id: existing.id, token: existing.token };
  }

  const created = await prisma.questionnaire.create({
    data: {
      enrollmentId: input.enrollmentId,
      type: input.type,
      token,
    },
    select: { id: true, token: true },
  });

  return { id: created.id, token: created.token };
}

// ─────────────────────────────────────────────────────────────────────────────
// soumettreReponses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre les réponses d'un stagiaire à son questionnaire (via token).
 *
 * - Valide noteGlobale ∈ [1..5] si fournie.
 * - Pose reponduAt = now() lors de la première soumission.
 * - Retourne null si le token est inconnu.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function soumettreReponses(
  input: SoumettreReponsesInput,
): Promise<{ id: string } | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("soumettreReponses: stub DB — non disponible au build");
  }

  if (
    input.noteGlobale !== undefined &&
    (input.noteGlobale < 1 || input.noteGlobale > 5 || !Number.isInteger(input.noteGlobale))
  ) {
    throw new Error(
      `noteGlobale invalide : ${input.noteGlobale} — doit être un entier entre 1 et 5`,
    );
  }

  const questionnaire = await prisma.questionnaire.findUnique({
    where: { token: input.token },
    select: { id: true },
  });

  if (questionnaire === null) {
    return null;
  }

  const updated = await prisma.questionnaire.update({
    where: { id: questionnaire.id },
    data: {
      reponses: input.reponses as never,
      reponduAt: new Date(),
      ...(input.noteGlobale !== undefined ? { noteGlobale: input.noteGlobale } : {}),
    },
    select: { id: true },
  });

  return { id: updated.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// listQuestionnairesSession
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste tous les questionnaires des inscriptions d'une session.
 * Retourne [] en mode stub.invalid.
 */
export async function listQuestionnairesSession(sessionId: string): Promise<Questionnaire[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }

  return prisma.questionnaire.findMany({
    where: {
      enrollment: {
        sessionId,
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
