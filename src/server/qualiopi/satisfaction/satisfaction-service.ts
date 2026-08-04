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
import { createEvaluation } from "@/server/qualiopi/evaluations/evaluations-service";
import { creerAppreciation } from "@/server/qualiopi/portail/appreciation-service";
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
    select: {
      id: true,
      type: true,
      // `reponduAt` AVANT écriture : c'est lui qui distingue la première
      // soumission d'une re-soumission — le versement aux registres ne doit
      // avoir lieu qu'une fois.
      reponduAt: true,
      enrollment: {
        select: {
          id: true,
          traineeId: true,
          session: { select: { clientId: true } },
        },
      },
    },
  });

  if (questionnaire === null) {
    return null;
  }

  const premiereSoumission = questionnaire.reponduAt === null;

  const updated = await prisma.questionnaire.update({
    where: { id: questionnaire.id },
    data: {
      reponses: input.reponses as never,
      reponduAt: new Date(),
      ...(input.noteGlobale !== undefined ? { noteGlobale: input.noteGlobale } : {}),
    },
    select: { id: true },
  });

  // ── Versement aux registres Qualiopi ────────────────────────────────────────
  //
  // 🔴 Constaté sur le premier dossier réel (Simone Blanc, 2026-08-04) : cette
  // fonction écrivait le questionnaire ET RIEN D'AUTRE. La stagiaire avait
  // répondu aux trois questionnaires, et les écrans de conformité affichaient
  // « 0 évaluation initiale » (off.8) et « 0 appréciation recueillie » (off.30)
  // — les registres que les indicateurs lisent ne recevaient rien. Il a fallu
  // TRANSCRIRE À LA MAIN, pièce par pièce. Neuvième et dixième occurrences du
  // motif dominant du dépôt : le code existe (`createEvaluation`,
  // `creerAppreciation`), personne ne l'appelait ici.
  //
  // Deux versements, à la PREMIÈRE soumission seulement :
  //
  // - positionnement → évaluation des acquis INITIALE, transcription de
  //   l'auto-évaluation `niveauParObjectif` (échelle 1..3, la même que la
  //   grille). La provenance est écrite dans `recommandations` : c'est un
  //   niveau DÉCLARÉ, pas mesuré, et l'auditeur doit pouvoir le lire.
  // - satisfaction (chaud/froid) notée → appréciation source « stagiaire »,
  //   verbatim conservé tel quel.
  //
  // ⚠️ Fail-soft, et c'est voulu : la soumission de la stagiaire ne doit JAMAIS
  // échouer parce qu'un versement de registre a échoué — son questionnaire est
  // enregistré, c'est l'essentiel. Mais l'échec est journalisé BRUYAMMENT :
  // un versement silencieusement perdu recréerait exactement le trou qu'on
  // vient de payer.
  if (premiereSoumission) {
    try {
      await verserAuxRegistres({
        type: questionnaire.type,
        enrollmentId: questionnaire.enrollment.id,
        traineeId: questionnaire.enrollment.traineeId,
        clientId: questionnaire.enrollment.session?.clientId ?? null,
        reponses: input.reponses,
        ...(input.noteGlobale !== undefined ? { noteGlobale: input.noteGlobale } : {}),
      });
    } catch (err) {
      console.error(
        `[satisfaction-service] versement aux registres ÉCHOUÉ (questionnaire ${questionnaire.id}, type ${questionnaire.type}) — à transcrire manuellement :`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return { id: updated.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// verserAuxRegistres
// ─────────────────────────────────────────────────────────────────────────────

/** Barème du positionnement — le même que la grille d'évaluation (1..3). */
const NIVEAUX_VALIDES = new Set([1, 2, 3]);

/**
 * Verse une réponse de questionnaire dans les registres que les indicateurs
 * lisent. Cf. le commentaire d'appel dans `soumettreReponses`.
 */
async function verserAuxRegistres(input: {
  type: QuestionnaireType;
  enrollmentId: string;
  traineeId: string | null;
  clientId: string | null;
  reponses: Record<string, unknown>;
  noteGlobale?: number;
}): Promise<void> {
  if (input.type === "positionnement") {
    const niveaux = input.reponses["niveauParObjectif"];
    if (typeof niveaux !== "object" || niveaux === null) return;

    // Seules les entrées au barème sont transcrites — une valeur hors 1..3
    // fausserait le score au lieu de l'éclairer.
    const competences = Object.entries(niveaux as Record<string, unknown>)
      .filter(([libelle, note]) => libelle.trim() !== "" && NIVEAUX_VALIDES.has(note as number))
      .map(([libelle, note]) => ({ libelle, note: note as 1 | 2 | 3 }));
    if (competences.length === 0) return;

    // ⚠️ JAMAIS deux initiales : si l'organisme en a déjà saisi une à la main,
    // la transcription automatique s'efface — la saisie humaine prime.
    const dejaUne = await prisma.evaluationAcquis.count({
      where: { enrollmentId: input.enrollmentId, type: "initiale" },
    });
    if (dejaUne > 0) return;

    await createEvaluation({
      enrollmentId: input.enrollmentId,
      type: "initiale",
      dateEvaluation: new Date().toISOString(),
      competences,
      recommandations:
        "Positionnement à l'entrée — transcription automatique de l'auto-évaluation déclarée par le ou la stagiaire dans le questionnaire de positionnement (niveau déclaré par objectif, à confirmer par le formateur).",
    });
    return;
  }

  if (
    (input.type === "satisfaction_chaud" || input.type === "satisfaction_froid") &&
    input.noteGlobale !== undefined
  ) {
    const libelle =
      input.type === "satisfaction_chaud"
        ? "Questionnaire de satisfaction à chaud"
        : "Questionnaire de satisfaction à froid";
    const verbatim =
      typeof input.reponses["commentaire"] === "string" &&
      (input.reponses["commentaire"] as string).trim() !== ""
        ? ` Verbatim : « ${(input.reponses["commentaire"] as string).trim()} »`
        : "";

    await creerAppreciation({
      source: "stagiaire",
      enrollmentId: input.enrollmentId,
      ...(input.traineeId !== null ? { traineeId: input.traineeId } : {}),
      ...(input.clientId !== null ? { clientId: input.clientId } : {}),
      note: input.noteGlobale,
      commentaire: `${libelle} — note ${input.noteGlobale}/5.${verbatim}`,
      dateAppreciation: new Date(),
    });
  }
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
