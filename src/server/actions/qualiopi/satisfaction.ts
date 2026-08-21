/**
 * Qualiopi — Server Actions Satisfaction + Indicateurs + BPF (AGENT B — T10).
 *
 * genererQuestionnairesSessionAction : crée les questionnaires pour chaque enrollment actif.
 * saisirReponsesQuestionnaireAction  : enregistre les réponses + invalide le cache indicateurs.
 * recomputeIndicateursAction         : invalide le cache + recalcule les indicateurs.
 * exportBpfCsvAction                 : calcule le BPF et retourne le CSV.
 *
 * Pattern : "use server" + requireAdminWrite + Zod + ActionResult + logQualiopiActivity.
 * Délègue toute logique métier à AGENT A (services satisfaction / indicateurs / bpf).
 */

"use server";

import { z } from "zod";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerQuestionnaire,
  soumettreReponses,
} from "@/server/qualiopi/satisfaction/satisfaction-service";
import {
  getIndicateurs,
  invalidateIndicateursCache,
  type IndicateursResult,
} from "@/server/qualiopi/indicateurs/service";
import { computeBpf, bpfToCsv } from "@/server/qualiopi/bpf/service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

// Types STAGIAIRE — un questionnaire par inscription. L'enquête ENTREPRISE
// n'en fait PAS partie : elle est UNE par session (ancrée sur la première
// inscription par le cron enquete-entreprise-j30 / envoyerEnqueteEntreprise) —
// la générer ici en créerait une par stagiaire.
const QUESTIONNAIRE_TYPES = ["positionnement", "satisfaction_chaud", "satisfaction_froid"] as const;

const genererQuestionnairesSessionSchema = z.object({
  sessionId: z.string().uuid(),
  types: z.array(z.enum(QUESTIONNAIRE_TYPES)).optional(),
});

const saisirReponsesQuestionnaireSchema = z.object({
  // 🔴 `D4-5-S1` — c'était `token`. La console envoyait au navigateur le jeton
  // porteur de chaque questionnaire pour pouvoir saisir les réponses à la place
  // du stagiaire. Un administrateur authentifié désigne la ligne par son
  // identifiant : celui-ci n'ouvre rien.
  questionnaireId: z.string().uuid(),
  reponses: z.record(z.unknown()),
  noteGlobale: z.number().int().min(1).max(5).optional(),
});

const recomputeIndicateursSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
  formationId: z.string().uuid().optional(),
});

const exportBpfCsvSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
});

// ─────────────────────────────────────────────────────────────────────────────
// genererQuestionnairesSessionAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée les questionnaires pour tous les enrollments actifs d'une session.
 * Types par défaut : positionnement + satisfaction_chaud + satisfaction_froid.
 * Idempotent : si le questionnaire existe déjà (@@unique [enrollmentId, type]),
 * `creerQuestionnaire` retourne l'existant sans doublon.
 */
export async function genererQuestionnairesSessionAction(input: {
  sessionId: string;
  types?: Array<(typeof QUESTIONNAIRE_TYPES)[number]>;
}): Promise<ActionResult<{ crees: number; total: number }>> {
  const session = await requireAdminWrite();
  const parsed = genererQuestionnairesSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, types } = parsed.data;

  const typesEffectifs = types ?? [...QUESTIONNAIRE_TYPES];

  // Enrollments actifs (non abandon, non exclu)
  let enrollments: { id: string }[];
  try {
    enrollments = await prisma.enrollment.findMany({
      where: {
        sessionId,
        ...inscriptionsActives(),
      },
      select: { id: true },
    });
  } catch {
    return { error: "Erreur lors de la récupération des inscriptions" };
  }

  let crees = 0;
  const total = enrollments.length * typesEffectifs.length;

  for (const enrollment of enrollments) {
    for (const type of typesEffectifs) {
      try {
        await creerQuestionnaire({ enrollmentId: enrollment.id, type });
        crees++;
      } catch {
        // fail-soft par questionnaire
      }
    }
  }

  await logQualiopiActivity({
    action: "qualiopi.satisfaction.generer_questionnaires",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { sessionId, typesEffectifs, enrollments: enrollments.length, crees, total },
    session,
  });

  return { data: { crees, total } };
}

// ─────────────────────────────────────────────────────────────────────────────
// saisirReponsesQuestionnaireAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre les réponses d'un questionnaire (identifié par token).
 * Invalide le cache indicateurs de l'année de la session concernée.
 * Retourne { error: "Questionnaire introuvable" } si le token n'existe pas.
 */
export async function saisirReponsesQuestionnaireAction(input: {
  questionnaireId: string;
  reponses: Record<string, unknown>;
  noteGlobale?: number;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = saisirReponsesQuestionnaireSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { questionnaireId, reponses, noteGlobale } = parsed.data;

  let result: { id: string } | null;
  try {
    result = await soumettreReponses({
      questionnaireId,
      reponses,
      ...(noteGlobale !== undefined ? { noteGlobale } : {}),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de la saisie des réponses" };
  }

  if (result === null) {
    return { error: "Questionnaire introuvable" };
  }

  // Invalide le cache indicateurs de l'année de la session
  try {
    const questionnaire = await prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
      select: {
        enrollment: {
          select: {
            session: { select: { dateDebut: true } },
          },
        },
      },
    });
    const annee = questionnaire?.enrollment.session.dateDebut.getFullYear();
    if (annee !== undefined) {
      await invalidateIndicateursCache(annee);
    }
  } catch {
    // fail-soft : l'invalidation cache ne bloque pas
  }

  await logQualiopiActivity({
    action: "qualiopi.satisfaction.saisir_reponses",
    targetType: "Questionnaire",
    targetId: result.id,
    changes: {
      // 🔴 `D4-5-S1` — le journal inscrivait les huit premiers caractères du
      // JETON. Tronqué ou non, un fragment de sésame n'a rien à faire dans un
      // registre d'activité que l'on relit à froid ; et il n'identifiait rien
      // de plus que `targetId`, qui porte déjà l'identifiant du questionnaire.
      ...(noteGlobale !== undefined ? { noteGlobale } : {}),
    },
    session,
  });

  return { data: { id: result.id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// recomputeIndicateursAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Force le recalcul des indicateurs : invalide le cache puis calcule.
 * Retourne les indicateurs recalculés.
 */
export async function recomputeIndicateursAction(input: {
  annee: number;
  formationId?: string;
}): Promise<ActionResult<IndicateursResult>> {
  const session = await requireAdminWrite();
  const parsed = recomputeIndicateursSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { annee, formationId } = parsed.data;

  try {
    await invalidateIndicateursCache(annee);
    const indicateurs = await getIndicateurs(annee, formationId);

    await logQualiopiActivity({
      action: "qualiopi.indicateurs.recompute",
      targetType: "Indicateurs",
      targetId: String(annee),
      changes: { annee, ...(formationId !== undefined ? { formationId } : {}) },
      session,
    });

    return { data: indicateurs };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erreur lors du recalcul des indicateurs",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// exportBpfCsvAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le BPF de l'année et retourne le CSV + nom de fichier suggéré.
 */
export async function exportBpfCsvAction(input: {
  annee: number;
}): Promise<ActionResult<{ csv: string; filename: string }>> {
  const session = await requireAdminWrite();
  const parsed = exportBpfCsvSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { annee } = parsed.data;

  try {
    const bpf = await computeBpf(annee);
    const csv = bpfToCsv(bpf);
    const filename = `bpf-${annee}-axion-ia.csv`;

    await logQualiopiActivity({
      action: "qualiopi.bpf.export_csv",
      targetType: "BPF",
      targetId: String(annee),
      changes: { annee, nbSessions: bpf.nbSessions, caTotalHtCents: bpf.caTotalHtCents },
      session,
    });

    return { data: { csv, filename } };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erreur lors de l'export BPF",
    };
  }
}
