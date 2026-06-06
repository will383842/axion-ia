/**
 * Qualiopi — Formation Engine Worker (T4).
 *
 * Consomme la queue `formation-engine`. Dispatch par `formation.statutGeneration` :
 *
 *   intention         → generateStructure  (appel IA structure)
 *   structure_generee → evaluateQuality    (grille + score)
 *   contenu_evalue    → refine ou          (si score < plancher && passes < max)
 *                        generateContent    (si valide ou passes épuisées)
 *   contenu_genere    → [attente validation humaine — FileValidation créée]
 *   contenu_valide    → assemble
 *   assemble          → (mark assemble, FileValidation assemblage en_attente)
 *
 * À chaque appel IA :
 *   1. assertCostCapAvailable (pré-call)
 *   2. buildCacheKey → getCachedIa (hit → skip appel IA)
 *   3. withRetry(anthropicProvider.generate)
 *   4. trackCost (post-call)
 *   5. setCachedIa
 *   6. FormationGenerationJob tracé (étape, status, tokens, cout, modele, cacheHit, dureeMs)
 *
 * Règle machine d'états : le worker NE met JAMAIS `validatedBy` (validation humaine = T3 publishFormationAction).
 *
 * Cloisonnement : `src/server/queue/workers/qualiopi-*-worker.ts` (ADR cloisonnement Qualiopi).
 */

import { Worker, UnrecoverableError, type Job } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { prisma } from "@/lib/prisma";
import { anthropicProvider } from "@/server/content-gen/providers/anthropic";
import { withRetry } from "@/server/content-gen/lib/retry";
import { assertCostCapAvailable, trackCost } from "@/server/content-gen/lib/cost-tracker";
import { getActiveGrille } from "@/server/qualiopi/engine/grille";
import { buildCacheKey, getCachedIa, setCachedIa } from "@/server/qualiopi/engine/cache";
import {
  buildStructureSystemPrompt,
  buildStructureUserPrompt,
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
  buildContentSystemPrompt,
  buildContentUserPrompt,
} from "@/server/qualiopi/engine/prompts";
import { evaluateFormationQuality } from "@/server/qualiopi/engine/evaluate";
import { hasUnsourcedClaims } from "@/server/qualiopi/engine/anti-hallucination";
import type {
  FormationStatutGeneration,
  ModaliteFormation,
} from "../../../../prisma/generated/client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FormationEngineJobData {
  formationId: string;
  /** Nombre de passes de raffinement déjà effectuées (pour boucle refine). */
  passesCourantes?: number;
}

// ── Formation type minimal pour le pipeline ──────────────────────────────────

interface FormationForEngine {
  id: string;
  titre: string;
  dureeHeures: number;
  modalite: ModaliteFormation;
  objectifsPedagogiques: unknown;
  programmeDetaille: unknown;
  methodesPedagogiques: string;
  seuilReussitePct: number;
  ratioPratiquePct: number | null;
  aiPromptVersion: number | null;
  langueGeneration: string;
}

// ── Trace FormationGenerationJob ─────────────────────────────────────────────

interface TraceJobInput {
  formationId: string;
  etape: string;
  tentative: number;
  status: "success" | "error" | "cache_hit";
  tokensIn: number;
  tokensOut: number;
  coutUsd: number;
  modele: string | null;
  dureeMs: number | null;
  cacheHit: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

async function traceGenerationJob(input: TraceJobInput): Promise<void> {
  try {
    await prisma.formationGenerationJob.create({
      data: {
        formationId: input.formationId,
        etape: input.etape,
        tentative: input.tentative,
        status: input.status,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        coutUsd: input.coutUsd,
        ...(input.modele !== null ? { modele: input.modele } : {}),
        ...(input.dureeMs !== null ? { dureeMs: input.dureeMs } : {}),
        cacheHit: input.cacheHit,
        ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata as never } : {}),
      },
    });
  } catch (err) {
    console.warn(
      "[qualiopi:engine] traceGenerationJob fail-soft:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ── Mise à jour statutGeneration + champs IA ──────────────────────────────────

async function advanceStatut(
  formationId: string,
  statut: FormationStatutGeneration,
  aiFields?: {
    aiGenerated?: boolean;
    aiModel?: string;
    aiPromptVersion?: number;
    programmeDetaille?: unknown;
    methodesPedagogiques?: string;
  },
): Promise<void> {
  await prisma.formation.update({
    where: { id: formationId },
    data: {
      statutGeneration: statut,
      ...(aiFields?.aiGenerated !== undefined ? { aiGenerated: aiFields.aiGenerated } : {}),
      ...(aiFields?.aiModel !== undefined ? { aiModel: aiFields.aiModel } : {}),
      ...(aiFields?.aiPromptVersion !== undefined
        ? { aiPromptVersion: aiFields.aiPromptVersion }
        : {}),
      ...(aiFields?.programmeDetaille !== undefined
        ? { programmeDetaille: aiFields.programmeDetaille as never }
        : {}),
      ...(aiFields?.methodesPedagogiques !== undefined
        ? { methodesPedagogiques: aiFields.methodesPedagogiques }
        : {}),
    },
  });
}

// ── Étape 1 : generateStructure ───────────────────────────────────────────────

async function stepGenerateStructure(
  formation: FormationForEngine,
  passesCourantes: number,
): Promise<void> {
  const grille = await getActiveGrille();
  const promptVersion = grille?.promptVersion ?? formation.aiPromptVersion ?? 1;
  const langue = formation.langueGeneration;

  const systemPrompt = buildStructureSystemPrompt(formation);
  const userPrompt = buildStructureUserPrompt(formation);

  const cacheKey = buildCacheKey(userPrompt, promptVersion, langue);
  const cached = await getCachedIa(cacheKey);

  if (cached) {
    await traceGenerationJob({
      formationId: formation.id,
      etape: "structure",
      tentative: passesCourantes + 1,
      status: "cache_hit",
      tokensIn: 0,
      tokensOut: 0,
      coutUsd: 0,
      modele: cached.modele,
      dureeMs: 0,
      cacheHit: true,
    });
    const output =
      typeof cached.valeur === "string" ? cached.valeur : JSON.stringify(cached.valeur);
    await advanceStatut(formation.id, "structure_generee", {
      aiGenerated: true,
      aiModel: cached.modele,
      aiPromptVersion: promptVersion,
      programmeDetaille: parseOutputSafe(output),
    });
    return;
  }

  await assertCostCapAvailable("anthropic", 0.1);
  const startMs = Date.now();

  const resp = await withRetry(() =>
    anthropicProvider.generate({
      jobId: formation.id,
      contentType: "formation_structure",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.2,
    }),
  );

  const dureeMs = Date.now() - startMs;

  await trackCost({
    jobId: formation.id,
    provider: "anthropic",
    model: resp.model,
    tokensInput:
      resp.tokensInput + (resp.cacheReadInputTokens ?? 0) + (resp.cacheCreationInputTokens ?? 0),
    tokensOutput: resp.tokensOutput,
    costUsd: resp.costUsd,
  });

  await setCachedIa({
    cle: cacheKey,
    valeur: resp.output,
    modele: resp.model,
    tokensIn: resp.tokensInput,
    tokensOut: resp.tokensOutput,
    coutUsd: resp.costUsd,
    promptVersion,
    ttlSeconds: 7 * 24 * 3600,
  });

  await traceGenerationJob({
    formationId: formation.id,
    etape: "structure",
    tentative: passesCourantes + 1,
    status: "success",
    tokensIn: resp.tokensInput,
    tokensOut: resp.tokensOutput,
    coutUsd: resp.costUsd,
    modele: resp.model,
    dureeMs,
    cacheHit: false,
  });

  await advanceStatut(formation.id, "structure_generee", {
    aiGenerated: true,
    aiModel: resp.model,
    aiPromptVersion: promptVersion,
    programmeDetaille: parseOutputSafe(resp.output),
  });
}

// ── Étape 2 : evaluateQuality ─────────────────────────────────────────────────

async function stepEvaluateQuality(
  formation: FormationForEngine,
  passesCourantes: number,
): Promise<{ scoreGlobal: number; valide: boolean; commentaire: string }> {
  const grille = await getActiveGrille();

  if (!grille) {
    // Pas de grille active → dégradé : considère valide
    await advanceStatut(formation.id, "contenu_evalue");
    return {
      scoreGlobal: 100,
      valide: true,
      commentaire: "Aucune grille qualité active — évaluation dégradée.",
    };
  }

  const contenu = JSON.stringify({
    objectifsPedagogiques: formation.objectifsPedagogiques,
    programmeDetaille: formation.programmeDetaille,
    methodesPedagogiques: formation.methodesPedagogiques,
  });

  const result = await evaluateFormationQuality({
    formationId: formation.id,
    contenu,
    criteres: grille.criteres,
    scorePlancher: grille.scorePlancher,
  });

  await traceGenerationJob({
    formationId: formation.id,
    etape: "evaluation",
    tentative: passesCourantes + 1,
    status: "success",
    tokensIn: result._meta.tokensInput,
    tokensOut: result._meta.tokensOutput,
    coutUsd: result._meta.costUsd,
    modele: result._meta.model,
    dureeMs: null,
    cacheHit: false,
    metadata: {
      scoreGlobal: result.scoreGlobal,
      valide: result.valide,
      parCritere: result.parCritere,
    },
  });

  await advanceStatut(formation.id, "contenu_evalue");

  return {
    scoreGlobal: result.scoreGlobal,
    valide: result.valide,
    commentaire: result.commentaire,
  };
}

// ── Étape 3 : refine ──────────────────────────────────────────────────────────

async function stepRefine(
  formation: FormationForEngine,
  passesCourantes: number,
  scoreActuel: number,
  commentaire: string,
): Promise<void> {
  const grille = await getActiveGrille();
  const promptVersion = grille?.promptVersion ?? formation.aiPromptVersion ?? 1;
  const langue = formation.langueGeneration;

  const formationWithConsigne: FormationForEngine = {
    ...formation,
    methodesPedagogiques: commentaire
      ? `${formation.methodesPedagogiques}\n\nConsigne de raffinement : ${commentaire}`
      : formation.methodesPedagogiques,
  };

  const systemPrompt = buildRefineSystemPrompt(formation);
  const userPrompt = buildRefineUserPrompt(formationWithConsigne);

  const cacheKey = buildCacheKey(userPrompt, promptVersion, langue);
  const cached = await getCachedIa(cacheKey);

  if (cached) {
    await traceGenerationJob({
      formationId: formation.id,
      etape: "refine",
      tentative: passesCourantes + 1,
      status: "cache_hit",
      tokensIn: 0,
      tokensOut: 0,
      coutUsd: 0,
      modele: cached.modele,
      dureeMs: 0,
      cacheHit: true,
    });
    const output =
      typeof cached.valeur === "string" ? cached.valeur : JSON.stringify(cached.valeur);
    await advanceStatut(formation.id, "contenu_evalue", {
      aiGenerated: true,
      aiModel: cached.modele,
      aiPromptVersion: promptVersion,
      programmeDetaille: parseOutputSafe(output),
    });
    return;
  }

  await assertCostCapAvailable("anthropic", 0.1);
  const startMs = Date.now();

  const resp = await withRetry(() =>
    anthropicProvider.generate({
      jobId: formation.id,
      contentType: "formation_refine",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.3,
    }),
  );

  const dureeMs = Date.now() - startMs;

  await trackCost({
    jobId: formation.id,
    provider: "anthropic",
    model: resp.model,
    tokensInput:
      resp.tokensInput + (resp.cacheReadInputTokens ?? 0) + (resp.cacheCreationInputTokens ?? 0),
    tokensOutput: resp.tokensOutput,
    costUsd: resp.costUsd,
  });

  await setCachedIa({
    cle: cacheKey,
    valeur: resp.output,
    modele: resp.model,
    tokensIn: resp.tokensInput,
    tokensOut: resp.tokensOutput,
    coutUsd: resp.costUsd,
    promptVersion,
    ttlSeconds: 3 * 24 * 3600,
  });

  await traceGenerationJob({
    formationId: formation.id,
    etape: "refine",
    tentative: passesCourantes + 1,
    status: "success",
    tokensIn: resp.tokensInput,
    tokensOut: resp.tokensOutput,
    coutUsd: resp.costUsd,
    modele: resp.model,
    dureeMs,
    cacheHit: false,
  });

  await advanceStatut(formation.id, "contenu_evalue", {
    aiGenerated: true,
    aiModel: resp.model,
    aiPromptVersion: promptVersion,
    programmeDetaille: parseOutputSafe(resp.output),
  });
}

// ── Étape 4 : generateContent ─────────────────────────────────────────────────

async function stepGenerateContent(
  formation: FormationForEngine,
  passesCourantes: number,
): Promise<void> {
  const grille = await getActiveGrille();
  const promptVersion = grille?.promptVersion ?? formation.aiPromptVersion ?? 1;
  const langue = formation.langueGeneration;

  const systemPrompt = buildContentSystemPrompt(formation);
  const userPrompt = buildContentUserPrompt(formation);

  const cacheKey = buildCacheKey(userPrompt, promptVersion, langue);
  const cached = await getCachedIa(cacheKey);

  let contenuFinal: string;
  let modeleUtilise: string;

  if (cached) {
    await traceGenerationJob({
      formationId: formation.id,
      etape: "contenu",
      tentative: passesCourantes + 1,
      status: "cache_hit",
      tokensIn: 0,
      tokensOut: 0,
      coutUsd: 0,
      modele: cached.modele,
      dureeMs: 0,
      cacheHit: true,
    });
    contenuFinal =
      typeof cached.valeur === "string" ? cached.valeur : JSON.stringify(cached.valeur);
    modeleUtilise = cached.modele;
  } else {
    await assertCostCapAvailable("anthropic", 0.2);
    const startMs = Date.now();

    const resp = await withRetry(() =>
      anthropicProvider.generate({
        jobId: formation.id,
        contentType: "formation_contenu",
        role: "text",
        systemPrompt,
        userPrompt,
        maxTokens: 8192,
        temperature: 0.2,
      }),
    );

    const dureeMs = Date.now() - startMs;

    await trackCost({
      jobId: formation.id,
      provider: "anthropic",
      model: resp.model,
      tokensInput:
        resp.tokensInput + (resp.cacheReadInputTokens ?? 0) + (resp.cacheCreationInputTokens ?? 0),
      tokensOutput: resp.tokensOutput,
      costUsd: resp.costUsd,
    });

    await setCachedIa({
      cle: cacheKey,
      valeur: resp.output,
      modele: resp.model,
      tokensIn: resp.tokensInput,
      tokensOut: resp.tokensOutput,
      coutUsd: resp.costUsd,
      promptVersion,
      ttlSeconds: 7 * 24 * 3600,
    });

    await traceGenerationJob({
      formationId: formation.id,
      etape: "contenu",
      tentative: passesCourantes + 1,
      status: "success",
      tokensIn: resp.tokensInput,
      tokensOut: resp.tokensOutput,
      coutUsd: resp.costUsd,
      modele: resp.model,
      dureeMs,
      cacheHit: false,
    });

    contenuFinal = resp.output;
    modeleUtilise = resp.model;
  }

  // Anti-hallucination (warning only — non bloquant en V1)
  if (hasUnsourcedClaims(contenuFinal)) {
    console.warn(
      `[qualiopi:engine] formation=${formation.id} — allégations non sourcées détectées (warning)`,
    );
  }

  // Avancer statut → contenu_genere + créer FileValidation (AI Act art. 50)
  await prisma.$transaction(async (tx) => {
    await tx.formation.update({
      where: { id: formation.id },
      data: {
        statutGeneration: "contenu_genere",
        aiGenerated: true,
        aiModel: modeleUtilise,
        aiPromptVersion: promptVersion,
      },
    });

    // FileValidation contenu (validation humaine obligatoire)
    await tx.fileValidation.create({
      data: {
        formationId: formation.id,
        etape: "contenu",
        statut: "en_attente",
        contenuPropose: {
          snapshot: contenuFinal.slice(0, 10_000),
          modele: modeleUtilise,
          promptVersion,
          generatedAt: new Date().toISOString(),
        } as never,
      },
    });
  });
}

// ── Étape 5 : assemble ────────────────────────────────────────────────────────

async function stepAssemble(formation: FormationForEngine): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.formation.update({
      where: { id: formation.id },
      data: { statutGeneration: "assemble" },
    });

    await tx.fileValidation.create({
      data: {
        formationId: formation.id,
        etape: "assemblage",
        statut: "en_attente",
        contenuPropose: {
          assembledAt: new Date().toISOString(),
          note: "Vérification assemblage final avant publication.",
        } as never,
      },
    });
  });
}

// ── Handler principal exporté ─────────────────────────────────────────────────

export async function formationEngineWorkerHandler(
  job: Job<FormationEngineJobData>,
): Promise<void> {
  const { formationId } = job.data;
  const passesCourantes = job.data.passesCourantes ?? 0;

  if (!formationId) {
    throw new UnrecoverableError("formationId manquant dans le job");
  }

  const row = await prisma.formation.findUnique({
    where: { id: formationId },
    select: {
      id: true,
      titre: true,
      dureeHeures: true,
      modalite: true,
      objectifsPedagogiques: true,
      programmeDetaille: true,
      methodesPedagogiques: true,
      seuilReussitePct: true,
      ratioPratiquePct: true,
      aiPromptVersion: true,
      langueGeneration: true,
      statutGeneration: true,
    },
  });

  if (!row) {
    throw new UnrecoverableError(`Formation introuvable : ${formationId}`);
  }

  const statut = row.statutGeneration;

  console.log(
    `[qualiopi:engine] formation=${formationId} statut=${statut} passes=${passesCourantes}`,
  );

  const f: FormationForEngine = {
    id: row.id,
    titre: row.titre,
    dureeHeures: row.dureeHeures,
    modalite: row.modalite,
    objectifsPedagogiques: row.objectifsPedagogiques,
    programmeDetaille: row.programmeDetaille,
    methodesPedagogiques: row.methodesPedagogiques,
    seuilReussitePct: row.seuilReussitePct,
    ratioPratiquePct: row.ratioPratiquePct,
    aiPromptVersion: row.aiPromptVersion,
    langueGeneration: row.langueGeneration,
  };

  switch (statut) {
    case "intention": {
      // Génération structure
      await stepGenerateStructure(f, passesCourantes);

      // Recharger la formation mise à jour (programmeDetaille changé)
      const updated = await prisma.formation.findUnique({
        where: { id: formationId },
        select: {
          programmeDetaille: true,
          methodesPedagogiques: true,
          objectifsPedagogiques: true,
        },
      });
      if (updated) {
        f.programmeDetaille = updated.programmeDetaille;
        f.methodesPedagogiques = updated.methodesPedagogiques;
        f.objectifsPedagogiques = updated.objectifsPedagogiques;
      }

      // Auto-chain vers évaluation + décision
      const evalResult = await stepEvaluateQuality(f, passesCourantes);
      await handleEvalDecision(f, passesCourantes, evalResult);
      break;
    }

    case "structure_generee": {
      const evalResult = await stepEvaluateQuality(f, passesCourantes);
      await handleEvalDecision(f, passesCourantes, evalResult);
      break;
    }

    case "contenu_evalue": {
      // Ré-évaluer puis décider
      const evalResult = await stepEvaluateQuality(f, passesCourantes);
      await handleEvalDecision(f, passesCourantes, evalResult);
      break;
    }

    case "contenu_valide": {
      await stepAssemble(f);
      break;
    }

    case "assemble":
    case "contenu_genere": {
      // Attente validation humaine
      console.log(
        `[qualiopi:engine] formation=${formationId} statut=${statut} — en attente validation humaine`,
      );
      break;
    }

    default:
      // Statuts terminaux (publie, archive) → no-op
      console.log(
        `[qualiopi:engine] formation=${formationId} statut=${statut} — aucune action (statut terminal)`,
      );
  }
}

// ── Helpers internes ─────────────────────────────────────────────────────────

async function handleEvalDecision(
  formation: FormationForEngine,
  passesCourantes: number,
  evalResult: { scoreGlobal: number; valide: boolean; commentaire: string },
): Promise<void> {
  const grille = await getActiveGrille();
  const nbPassesMax = grille?.nbPassesMax ?? 3;

  if (!evalResult.valide && passesCourantes < nbPassesMax) {
    console.log(
      `[qualiopi:engine] formation=${formation.id} score=${evalResult.scoreGlobal} < plancher → refine (passe ${passesCourantes + 1}/${nbPassesMax})`,
    );
    await stepRefine(formation, passesCourantes, evalResult.scoreGlobal, evalResult.commentaire);

    // Recharger et ré-évaluer
    const updated = await prisma.formation.findUnique({
      where: { id: formation.id },
      select: {
        programmeDetaille: true,
        methodesPedagogiques: true,
        objectifsPedagogiques: true,
      },
    });
    if (updated) {
      formation.programmeDetaille = updated.programmeDetaille;
      formation.methodesPedagogiques = updated.methodesPedagogiques;
      formation.objectifsPedagogiques = updated.objectifsPedagogiques;
    }

    const reEval = await stepEvaluateQuality(formation, passesCourantes + 1);
    if (reEval.valide || passesCourantes + 1 >= nbPassesMax) {
      if (!reEval.valide) {
        console.warn(
          `[qualiopi:engine] formation=${formation.id} — passes max atteintes, génération forcée`,
        );
      }
      await stepGenerateContent(formation, passesCourantes + 1);
    }
  } else {
    await stepGenerateContent(formation, passesCourantes);
  }
}

function parseOutputSafe(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}

// ── Worker BullMQ ─────────────────────────────────────────────────────────────

export function startFormationEngineWorker(): Worker<FormationEngineJobData> {
  const worker = new Worker<FormationEngineJobData>(
    "formation-engine",
    formationEngineWorkerHandler,
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 2,
      lockDuration: 300_000, // 5 min (génération IA longue)
      // Limite douce : 5 jobs IA par minute
      limiter: { max: 5, duration: 60_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  );

  worker.on("ready", () => console.log("[qualiopi:engine] worker ready"));
  worker.on("completed", (job) => console.log(`[qualiopi:engine] done: ${job.data.formationId}`));
  worker.on("failed", (job, err) => {
    console.error(`[qualiopi:engine] failed: ${job?.data?.formationId}: ${err.message}`);
  });

  return worker;
}
