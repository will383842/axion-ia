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
  buildBackwardDesignSystemPrompt,
  buildBackwardDesignUserPrompt,
  buildPersonaSystemPrompt,
  buildPersonaUserPrompt,
  buildModuleContentStructuredSystemPrompt,
  buildModuleContentStructuredUserPrompt,
  buildContentCritiqueSystemPrompt,
  buildContentCritiqueUserPrompt,
  type ModuleADetailler,
} from "@/server/qualiopi/engine/prompts";
import {
  ModuleContenuSchema,
  CONTENU_DETAILLE_VERSION,
  stripNullsDeep,
  type ContenuDetaille,
  type ModuleContenu,
} from "@/server/qualiopi/engine/content-schema";
import { evaluateContenuDetailleQuality } from "@/server/qualiopi/engine/content-quality";
import { normaliserModalite } from "@/server/qualiopi/engine/modalite-pedagogie";
import { axionIaStackGrounding } from "@/server/qualiopi/engine/grounding";
import { evaluateFormationQuality } from "@/server/qualiopi/engine/evaluate";
import { hasUnsourcedClaims } from "@/server/qualiopi/engine/anti-hallucination";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
// Modules créés par l'autre agent — importés en avance (erreurs "Cannot find module" transitoires)
import { runAdversarialCritique } from "@/server/qualiopi/engine/adversarial-critique";
import { validateExcellence } from "@/server/qualiopi/engine/validation-excellence";
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
  /**
   * Public visé — dérivé de offreSite.publicViseFr (optionnel).
   * Absent si l'offre n'est pas chargée (fail-soft → buildPersonaUserPrompt accepte "").
   */
  publicVise?: string | null;
  // Paramètres pédagogiques (chantier Excellence) — enrichissent la génération.
  niveau?: string | null;
  prerequis?: string | null;
  secteurCible?: string | null;
  outilsClient?: string | null;
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

/**
 * Fusionne la structure générée dans le programme courant SANS écraser les blocs
 * amont coûteux (backwardDesign, persona, adversarialCritique). La structure
 * apporte titre/objectifs/modules/fil_rouge ; on préserve le reste (cf. revue
 * M2 : l'ancien remplacement complet perdait persona + backwardDesign en base).
 */
function mergeStructureIntoProgramme(current: unknown, structureRaw: string): unknown {
  const structure = parseOutputSafe(structureRaw);
  // Si la structure n'est pas un objet exploitable, on la conserve telle quelle
  // (cas de bord : sortie non-JSON → l'étape contenu échouera en fail-loud B2).
  if (structure === null || typeof structure !== "object" || Array.isArray(structure)) {
    return structure;
  }
  const base =
    current !== null && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...(structure as Record<string, unknown>) };
}

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
      programmeDetaille: mergeStructureIntoProgramme(formation.programmeDetaille, output),
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
    programmeDetaille: mergeStructureIntoProgramme(formation.programmeDetaille, resp.output),
  });
}

// ── Étape T5-A : backwardDesign ───────────────────────────────────────────────

/**
 * Phase -1 : Backward Design.
 * Idempotent : si programmeDetaille.backwardDesign déjà présent, retourne-le sans appel IA.
 */
async function stepBackwardDesign(
  formation: FormationForEngine,
  passesCourantes: number,
): Promise<Record<string, unknown>> {
  // Idempotence — ne pas refaire si déjà calculé
  const current =
    formation.programmeDetaille !== null && formation.programmeDetaille !== undefined
      ? (formation.programmeDetaille as Record<string, unknown>)
      : null;
  if (current?.backwardDesign !== undefined && current.backwardDesign !== null) {
    console.log(
      `[qualiopi:engine] formation=${formation.id} backwardDesign — cache hit (idempotent)`,
    );
    return current.backwardDesign as Record<string, unknown>;
  }

  const grille = await getActiveGrille();
  const promptVersion = grille?.promptVersion ?? formation.aiPromptVersion ?? 1;
  const langue = formation.langueGeneration;

  const systemPrompt = buildBackwardDesignSystemPrompt();
  const userPrompt = buildBackwardDesignUserPrompt({
    titre: formation.titre,
    dureeHeures: formation.dureeHeures,
    modalite: formation.modalite as string,
    objectifsPedagogiques: formation.objectifsPedagogiques,
    ...(formation.publicVise != null ? { publicVise: formation.publicVise } : {}),
  });

  const cacheKey = buildCacheKey(userPrompt, promptVersion, langue);
  const cached = await getCachedIa(cacheKey);

  if (cached) {
    await traceGenerationJob({
      formationId: formation.id,
      etape: "backward_design",
      tentative: passesCourantes + 1,
      status: "cache_hit",
      tokensIn: 0,
      tokensOut: 0,
      coutUsd: 0,
      modele: cached.modele,
      dureeMs: 0,
      cacheHit: true,
    });
    const val = typeof cached.valeur === "string" ? parseOutputSafe(cached.valeur) : cached.valeur;
    return (val ?? {}) as Record<string, unknown>;
  }

  await assertCostCapAvailable("anthropic", 0.05);
  const startMs = Date.now();

  const resp = await withRetry(() =>
    anthropicProvider.generate({
      jobId: formation.id,
      contentType: "formation_backward_design",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
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
    etape: "backward_design",
    tentative: passesCourantes + 1,
    status: "success",
    tokensIn: resp.tokensInput,
    tokensOut: resp.tokensOutput,
    coutUsd: resp.costUsd,
    modele: resp.model,
    dureeMs,
    cacheHit: false,
  });

  const parsed = parseOutputSafe(resp.output);
  return (parsed ?? {}) as Record<string, unknown>;
}

// ── Étape T5-B : persona ──────────────────────────────────────────────────────

/**
 * Phase -1 : Persona stagiaire.
 * Idempotent : si programmeDetaille.persona déjà présent, retourne-le sans appel IA.
 */
async function stepPersona(
  formation: FormationForEngine,
  passesCourantes: number,
): Promise<Record<string, unknown>> {
  // Idempotence — ne pas refaire si déjà calculé
  const current =
    formation.programmeDetaille !== null && formation.programmeDetaille !== undefined
      ? (formation.programmeDetaille as Record<string, unknown>)
      : null;
  if (current?.persona !== undefined && current.persona !== null) {
    console.log(`[qualiopi:engine] formation=${formation.id} persona — cache hit (idempotent)`);
    return current.persona as Record<string, unknown>;
  }

  const grille = await getActiveGrille();
  const promptVersion = grille?.promptVersion ?? formation.aiPromptVersion ?? 1;
  const langue = formation.langueGeneration;

  const publicVise = formation.publicVise ?? "";
  // contexteIa : si modalité sur-mesure ou si publicVise mentionne l'IA
  const contexteIa =
    typeof formation.modalite === "string" && formation.modalite.includes("sur_mesure")
      ? "Formation sur mesure — adapter le persona à un contexte spécifique d'entreprise"
      : undefined;

  const systemPrompt = buildPersonaSystemPrompt();
  const userPrompt = buildPersonaUserPrompt(publicVise, contexteIa);

  const cacheKey = buildCacheKey(userPrompt, promptVersion, langue);
  const cached = await getCachedIa(cacheKey);

  if (cached) {
    await traceGenerationJob({
      formationId: formation.id,
      etape: "persona",
      tentative: passesCourantes + 1,
      status: "cache_hit",
      tokensIn: 0,
      tokensOut: 0,
      coutUsd: 0,
      modele: cached.modele,
      dureeMs: 0,
      cacheHit: true,
    });
    const val = typeof cached.valeur === "string" ? parseOutputSafe(cached.valeur) : cached.valeur;
    return (val ?? {}) as Record<string, unknown>;
  }

  await assertCostCapAvailable("anthropic", 0.05);
  const startMs = Date.now();

  const resp = await withRetry(() =>
    anthropicProvider.generate({
      jobId: formation.id,
      contentType: "formation_persona",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
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
    ttlSeconds: 7 * 24 * 3600,
  });

  await traceGenerationJob({
    formationId: formation.id,
    etape: "persona",
    tentative: passesCourantes + 1,
    status: "success",
    tokensIn: resp.tokensInput,
    tokensOut: resp.tokensOutput,
    coutUsd: resp.costUsd,
    modele: resp.model,
    dureeMs,
    cacheHit: false,
  });

  const parsed = parseOutputSafe(resp.output);
  return (parsed ?? {}) as Record<string, unknown>;
}

// ── Étape T5-C : adversarialCritique ─────────────────────────────────────────

/**
 * Critique adversariale de la structure générée.
 * Idempotent : si programmeDetaille.adversarialCritique déjà présent, retourne-le sans appel IA.
 * Fail-soft : si le module n'est pas encore disponible, retourne null sans bloquer le pipeline.
 */
// Type du résultat de critique (aligné sur ce que runAdversarialCritique retourne)
type AdversarialCritiqueResult = Awaited<ReturnType<typeof runAdversarialCritique>>;

async function stepAdversarialCritique(
  formation: FormationForEngine,
  passesCourantes: number,
): Promise<AdversarialCritiqueResult | null> {
  // Idempotence — ne pas refaire si déjà calculé
  const current =
    formation.programmeDetaille !== null && formation.programmeDetaille !== undefined
      ? (formation.programmeDetaille as Record<string, unknown>)
      : null;
  if (current?.adversarialCritique !== undefined && current.adversarialCritique !== null) {
    console.log(
      `[qualiopi:engine] formation=${formation.id} adversarialCritique — cache hit (idempotent)`,
    );
    return current.adversarialCritique as AdversarialCritiqueResult;
  }

  try {
    const structure = formation.programmeDetaille
      ? JSON.stringify(formation.programmeDetaille)
      : "{}";
    const persona =
      current?.persona !== undefined && current.persona !== null
        ? (current.persona as Record<string, unknown>)
        : undefined;
    const backwardDesign =
      current?.backwardDesign !== undefined && current.backwardDesign !== null
        ? (current.backwardDesign as Record<string, unknown>)
        : undefined;

    const result = await runAdversarialCritique({
      formationId: formation.id,
      structure,
      persona,
      backwardDesign,
    });

    await traceGenerationJob({
      formationId: formation.id,
      etape: "adversarial_critique",
      tentative: passesCourantes + 1,
      status: "success",
      tokensIn: result.meta.tokensInput,
      tokensOut: result.meta.tokensOutput,
      coutUsd: result.meta.costUsd,
      modele: result.meta.model,
      dureeMs: null,
      cacheHit: false,
      metadata: {
        scoreGlobal: result.scoreGlobal,
        verdict: result.verdict,
        axesAmelioration: result.axesAmelioration,
      },
    });

    return result;
  } catch (err) {
    // Fail-soft : module peut ne pas encore exister — ne bloque pas le pipeline
    console.warn(
      `[qualiopi:engine] formation=${formation.id} adversarialCritique fail-soft:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ── Étape 2 : evaluateQuality ─────────────────────────────────────────────────

async function stepEvaluateQuality(
  formation: FormationForEngine,
  passesCourantes: number,
): Promise<{ scoreGlobal: number; valide: boolean; commentaire: string }> {
  const grille = await getActiveGrille();

  if (!grille) {
    // FAIL-LOUD (audit Qualiopi E2E 2026-06-06) — une grille qualité ACTIVE est
    // OBLIGATOIRE. L'ancien comportement (scoreGlobal=100, valide=true) contournait
    // SILENCIEUSEMENT l'exigence RNQ « score ≥ 80/100 » : toute formation IA était
    // certifiée « qualité OK » sans aucune évaluation. En prod la grille est seedée
    // au boot via prisma/migrations_fts/20260606300000_qualiopi_grille_seed.sql
    // (appliqué par scripts/docker-entrypoint.sh, idempotent). Si elle est absente,
    // on ÉCHOUE le job de façon visible (worker.on("failed")) au lieu de publier une
    // qualité non vérifiée. Remédiation : `pnpm qualiopi:seed` puis relancer la
    // génération (statut RELANCABLE).
    throw new Error(
      "[qualiopi:engine] Aucune grille qualité active (grille_qualite_v1) : génération " +
        "bloquée pour ne pas contourner le contrôle qualité ≥80/100. Seed/active la grille " +
        "(pnpm qualiopi:seed) avant de relancer.",
    );
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

  // T5 — validateExcellence (fail-soft si module absent)
  let excellenceResult: ReturnType<typeof validateExcellence> | null = null;
  try {
    excellenceResult = validateExcellence(formation.programmeDetaille as Record<string, unknown>);
  } catch (err) {
    // Fail-soft : module peut ne pas encore exister
    console.warn(
      `[qualiopi:engine] formation=${formation.id} validateExcellence fail-soft:`,
      err instanceof Error ? err.message : String(err),
    );
  }

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
      // T5 — excellence metadata
      ...(excellenceResult !== null
        ? {
            excellenceVerdict: excellenceResult.verdict,
            excellenceAxesCorrection: excellenceResult.axesCorrection,
            filRougeOk: excellenceResult.filRougeOk,
            livrablesOk: excellenceResult.livrablesOk,
          }
        : {}),
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

/**
 * Plafond dur du nombre de modules détaillés par formation. Chaque module = 1
 * appel IA séquentiel (~30-60 s) ; borner évite de dépasser le lockDuration du
 * worker (5 min) et de faire exploser le cost cap. Une formation Qualiopi de 1-3
 * jours dépasse rarement ~10 modules ; au-delà on tronque en le signalant.
 */
const MAX_MODULES_CONTENU = 12;

/** Extrait la liste des modules structurés depuis programmeDetaille (objet ou tableau). */
function extractModulesADetailler(programmeDetaille: unknown): ModuleADetailler[] {
  let modulesRaw: unknown = null;
  if (Array.isArray(programmeDetaille)) {
    modulesRaw = programmeDetaille;
  } else if (programmeDetaille !== null && typeof programmeDetaille === "object") {
    modulesRaw = (programmeDetaille as Record<string, unknown>)["modules"];
  }
  if (!Array.isArray(modulesRaw)) return [];

  if (modulesRaw.length > MAX_MODULES_CONTENU) {
    console.warn(
      `[qualiopi:engine] programmeDetaille contient ${modulesRaw.length} modules — tronqué à ${MAX_MODULES_CONTENU} pour le contenu détaillé.`,
    );
    modulesRaw = modulesRaw.slice(0, MAX_MODULES_CONTENU);
  }

  return (modulesRaw as unknown[]).map((m, i): ModuleADetailler => {
    const mo = (m ?? {}) as Record<string, unknown>;
    const ordre = typeof mo["ordre"] === "number" ? (mo["ordre"] as number) : i + 1;
    const seqRaw = mo["sequences"];
    const sequences = Array.isArray(seqRaw)
      ? seqRaw.map((s) => {
          const so = (s ?? {}) as Record<string, unknown>;
          return {
            titre: String(so["titre"] ?? ""),
            ...(typeof so["dureeMin"] === "number" ? { dureeMin: so["dureeMin"] as number } : {}),
            ...(typeof so["description"] === "string"
              ? { description: so["description"] as string }
              : {}),
          };
        })
      : undefined;
    return {
      moduleId: String(mo["moduleId"] ?? `M${ordre}`),
      titre: String(mo["titre"] ?? `Module ${ordre}`),
      ...(typeof mo["dureeMinutes"] === "number"
        ? { dureeMin: mo["dureeMinutes"] as number }
        : typeof mo["dureeMin"] === "number"
          ? { dureeMin: mo["dureeMin"] as number }
          : {}),
      ...(Array.isArray(mo["objectifsCouverts"])
        ? { objectifsCouverts: (mo["objectifsCouverts"] as unknown[]).map(String) }
        : {}),
      ...(Array.isArray(mo["activites"])
        ? { activites: (mo["activites"] as unknown[]).map(String) }
        : {}),
      ...(sequences ? { sequences } : {}),
    };
  });
}

/** Génère le contenu structuré d'UN module (cache + cost + trace). */
async function generateModuleContent(
  formation: FormationForEngine,
  module: ModuleADetailler,
  promptVersion: number,
  passesCourantes: number,
  grounding: string,
  consignes?: string,
): Promise<{ contenu: ModuleContenu; modele: string } | null> {
  const langue = formation.langueGeneration;
  const systemPrompt = buildModuleContentStructuredSystemPrompt(grounding);
  const userPrompt = buildModuleContentStructuredUserPrompt({
    formationTitre: formation.titre,
    modalite: formation.modalite as string,
    ...(formation.publicVise != null ? { publicVise: formation.publicVise } : {}),
    objectifsFormation: formation.objectifsPedagogiques,
    module,
    ...(formation.niveau != null ? { niveau: formation.niveau } : {}),
    ...(formation.prerequis != null ? { prerequis: formation.prerequis } : {}),
    ...(formation.secteurCible != null ? { secteurCible: formation.secteurCible } : {}),
    ...(formation.outilsClient != null ? { outilsClient: formation.outilsClient } : {}),
    ...(consignes ? { consignes } : {}),
  });

  const cacheKey = buildCacheKey(userPrompt, promptVersion, langue);
  const cached = await getCachedIa(cacheKey);

  let raw: unknown;
  let modele: string;
  if (cached) {
    raw = typeof cached.valeur === "string" ? parseOutputSafe(cached.valeur) : cached.valeur;
    modele = cached.modele;
    await traceGenerationJob({
      formationId: formation.id,
      etape: `contenu_module:${module.moduleId}`,
      tentative: passesCourantes + 1,
      status: "cache_hit",
      tokensIn: 0,
      tokensOut: 0,
      coutUsd: 0,
      modele,
      dureeMs: 0,
      cacheHit: true,
    });
  } else {
    await assertCostCapAvailable("anthropic", 0.15);
    const startMs = Date.now();
    const resp = await withRetry(() =>
      anthropicProvider.generate({
        jobId: formation.id,
        contentType: "formation_contenu_module",
        role: "text",
        systemPrompt,
        userPrompt,
        maxTokens: 6144,
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
      ttlSeconds: 7 * 24 * 3600,
    });
    await traceGenerationJob({
      formationId: formation.id,
      etape: `contenu_module:${module.moduleId}`,
      tentative: passesCourantes + 1,
      status: "success",
      tokensIn: resp.tokensInput,
      tokensOut: resp.tokensOutput,
      coutUsd: resp.costUsd,
      modele: resp.model,
      dureeMs,
      cacheHit: false,
    });
    raw = parseOutputSafe(resp.output);
    modele = resp.model;
  }

  // Validation Zod — un module mal formé est loggué et ignoré (fail-soft),
  // le reste de la formation continue. `stripNullsDeep` normalise d'abord les
  // `null` renvoyés par le LLM en `undefined` (sinon .optional()/.default()
  // rejettent le champ et invalident tout le module — cf. revue B1).
  const parsed = ModuleContenuSchema.safeParse(stripNullsDeep(raw));
  if (!parsed.success) {
    console.warn(
      `[qualiopi:engine] formation=${formation.id} module=${module.moduleId} contenu invalide (ignoré) : ${parsed.error.message.slice(0, 300)}`,
    );
    return null;
  }
  return { contenu: parsed.data as ModuleContenu, modele };
}

/** Nombre max de passes d'auto-correction du contenu (best-of). Borne le coût. */
const MAX_CONTENT_REFINE_PASSES = 1;

/** Génère TOUS les modules d'une formation (optionnellement avec consignes de raffinement). */
async function generateAllModules(
  formation: FormationForEngine,
  modules: ModuleADetailler[],
  promptVersion: number,
  passesCourantes: number,
  grounding: string,
  consignes?: string,
): Promise<{ modules: ModuleContenu[]; modele: string }> {
  const out: ModuleContenu[] = [];
  let modele = "";
  for (const mod of modules) {
    const r = await generateModuleContent(
      formation,
      mod,
      promptVersion,
      passesCourantes,
      grounding,
      consignes,
    );
    if (r) {
      out.push(r.contenu);
      modele = r.modele;
    }
  }
  return { modules: out, modele };
}

/**
 * Lever « critique adversariale du contenu » : un appel IA qui challenge le
 * contenu détaillé et renvoie des axes d'amélioration. Fail-soft (retourne []).
 */
async function critiqueContenuAxes(
  formation: FormationForEngine,
  contenuJson: string,
  passesCourantes: number,
): Promise<string[]> {
  try {
    await assertCostCapAvailable("anthropic", 0.05);
    const startMs = Date.now();
    const resp = await withRetry(() =>
      anthropicProvider.generate({
        jobId: formation.id,
        contentType: "formation_contenu_critique",
        role: "text",
        systemPrompt: buildContentCritiqueSystemPrompt(),
        userPrompt: buildContentCritiqueUserPrompt(contenuJson.slice(0, 20_000)),
        maxTokens: 1024,
        temperature: 0.4,
      }),
    );
    await trackCost({
      jobId: formation.id,
      provider: "anthropic",
      model: resp.model,
      tokensInput:
        resp.tokensInput + (resp.cacheReadInputTokens ?? 0) + (resp.cacheCreationInputTokens ?? 0),
      tokensOutput: resp.tokensOutput,
      costUsd: resp.costUsd,
    });
    const parsed = parseOutputSafe(resp.output) as { axes?: unknown; verdict?: unknown } | null;
    const axes = parsed?.axes;
    const list = Array.isArray(axes) ? axes.map((a) => String(a)).slice(0, 6) : [];
    await traceGenerationJob({
      formationId: formation.id,
      etape: "contenu_critique",
      tentative: passesCourantes + 1,
      status: "success",
      tokensIn: resp.tokensInput,
      tokensOut: resp.tokensOutput,
      coutUsd: resp.costUsd,
      modele: resp.model,
      dureeMs: Date.now() - startMs,
      cacheHit: false,
      metadata: { verdict: parsed?.verdict, axes: list },
    });
    return list;
  } catch (err) {
    console.warn(
      `[qualiopi:engine] formation=${formation.id} critiqueContenu fail-soft:`,
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

async function stepGenerateContent(
  formation: FormationForEngine,
  passesCourantes: number,
): Promise<void> {
  const grille = await getActiveGrille();
  const promptVersion = grille?.promptVersion ?? formation.aiPromptVersion ?? 1;
  const modalite = normaliserModalite(formation.modalite as string);

  const modules = extractModulesADetailler(formation.programmeDetaille);
  const grounding = axionIaStackGrounding();

  const buildContenu = (mods: ModuleContenu[], modele: string): ContenuDetaille => ({
    version: CONTENU_DETAILLE_VERSION,
    modalite,
    modules: mods,
    ...(modele ? { genereAvec: modele } : {}),
    genereLe: new Date().toISOString(),
  });

  // ── Passe 0 : génération initiale de tous les modules ──
  let bestGen = await generateAllModules(
    formation,
    modules,
    promptVersion,
    passesCourantes,
    grounding,
  );
  let best = buildContenu(bestGen.modules, bestGen.modele);
  let bestQ = evaluateContenuDetailleQuality(best, formation.dureeHeures);
  let refinePasses = 0;

  // ── Leviers 1 + 3 : auto-correction pilotée par les manques déterministes ET
  //    la critique adversariale du contenu, tant que la qualité n'est pas
  //    « excellent » (best-of : on ne garde que si le score s'améliore). ──
  while (
    bestGen.modules.length > 0 &&
    bestQ.verdict !== "excellent" &&
    refinePasses < MAX_CONTENT_REFINE_PASSES
  ) {
    refinePasses++;
    const axes = await critiqueContenuAxes(
      formation,
      JSON.stringify(best.modules),
      passesCourantes,
    );
    const consignes = [...bestQ.manques, ...axes].slice(0, 12).join("\n");
    if (!consignes.trim()) break;
    console.log(
      `[qualiopi:engine] formation=${formation.id} — auto-correction contenu passe ${refinePasses} (score ${bestQ.score}).`,
    );
    const retryGen = await generateAllModules(
      formation,
      modules,
      promptVersion,
      passesCourantes + refinePasses,
      grounding,
      consignes,
    );
    if (retryGen.modules.length === 0) break;
    const retry = buildContenu(retryGen.modules, retryGen.modele);
    const retryQ = evaluateContenuDetailleQuality(retry, formation.dureeHeures);
    if (retryQ.score > bestQ.score) {
      bestGen = retryGen;
      best = retry;
      bestQ = retryQ;
    }
  }

  const modulesContenu = bestGen.modules;
  const modeleUtilise = bestGen.modele;
  const contenuDetaille = best;
  const qualite = bestQ;

  // B2 — FAIL-LOUD si aucun module valide : ne JAMAIS avancer le statut avec un
  // contenu vide (qui violerait de toute façon ContenuDetailleSchema.min(1) et
  // ferait retomber les supports en squelette sans alerte). On lève une erreur
  // visible + une alerte système, et le statut reste relançable.
  if (modulesContenu.length === 0) {
    void creerOuDedup({
      code: "job_ia_echoue",
      niveau: "important",
      titre: "Contenu détaillé vide",
      message:
        `La génération du contenu détaillé de la formation ${formation.id} n'a produit ` +
        `aucun module exploitable (${modules.length} module(s) en entrée). Relancer la génération.`,
      cibleType: "Formation",
      cibleId: formation.id,
    }).catch(() => {});
    throw new Error(
      `[qualiopi:engine] formation=${formation.id} — 0 module de contenu valide généré ` +
        `(${modules.length} en entrée). Statut non avancé (relançable).`,
    );
  }

  // Anti-hallucination (warning only) — analyse le TEXTE pédagogique concaténé
  // (pas le JSON brut : clés/échappements fausseraient la détection).
  const contenuTexte = modulesContenu
    .flatMap((m) => [
      m.introduction,
      m.synthese,
      ...m.sequences.flatMap((s) => [s.exempleConcret, ...s.concepts.map((c) => c.explication)]),
    ])
    .join("\n");
  if (hasUnsourcedClaims(contenuTexte)) {
    console.warn(
      `[qualiopi:engine] formation=${formation.id} — allégations non sourcées détectées (warning)`,
    );
  }

  if (qualite.verdict === "insuffisant") {
    console.warn(
      `[qualiopi:engine] formation=${formation.id} — qualité contenu ${qualite.score}/100 après ${refinePasses} auto-correction(s) (${qualite.manques.length} manque(s)).`,
    );
  }

  // M3 — Fusion array-safe : si programmeDetaille est un TABLEAU (formation
  // catalogue), l'envelopper dans { modules: [...] } au lieu de le spreader
  // (sinon corruption en clés numériques). Objet → merge de clés classique.
  let currentProgramme: Record<string, unknown>;
  if (Array.isArray(formation.programmeDetaille)) {
    currentProgramme = { modules: formation.programmeDetaille };
  } else if (
    formation.programmeDetaille !== null &&
    typeof formation.programmeDetaille === "object"
  ) {
    currentProgramme = formation.programmeDetaille as Record<string, unknown>;
  } else {
    currentProgramme = {};
  }
  const mergedProgramme = { ...currentProgramme, contenuDetaille };

  // Avancer statut → contenu_genere + persister le contenu + FileValidation (AI Act art. 50)
  await prisma.$transaction(async (tx) => {
    await tx.formation.update({
      where: { id: formation.id },
      data: {
        statutGeneration: "contenu_genere",
        aiGenerated: true,
        ...(modeleUtilise ? { aiModel: modeleUtilise } : {}),
        aiPromptVersion: promptVersion,
        programmeDetaille: mergedProgramme as never,
      },
    });

    // m3 — Idempotence : purge une éventuelle FileValidation « contenu » en
    // attente d'une génération précédente avant d'en recréer une (évite les
    // doublons dans l'UI de validation lors d'une relance).
    await tx.fileValidation.deleteMany({
      where: { formationId: formation.id, etape: "contenu", statut: "en_attente" },
    });

    // FileValidation contenu (validation humaine obligatoire)
    await tx.fileValidation.create({
      data: {
        formationId: formation.id,
        etape: "contenu",
        statut: "en_attente",
        contenuPropose: {
          nbModules: modulesContenu.length,
          modele: modeleUtilise,
          promptVersion,
          modalite,
          qualiteScore: qualite.score,
          qualiteVerdict: qualite.verdict,
          qualiteManques: qualite.manques.slice(0, 20),
          refinePasses,
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
      niveau: true,
      prerequis: true,
      secteurCible: true,
      outilsClient: true,
      aiPromptVersion: true,
      langueGeneration: true,
      statutGeneration: true,
      // T5 — Backward Design + Persona : charger publicVise depuis l'offre rattachée
      offreSite: {
        select: { publicViseFr: true },
      },
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
    // T5 — Public visé depuis l'offre (fail-soft : null si absent)
    publicVise: row.offreSite?.publicViseFr ?? null,
    // Paramètres pédagogiques (chantier Excellence)
    niveau: row.niveau,
    prerequis: row.prerequis,
    secteurCible: row.secteurCible,
    outilsClient: row.outilsClient,
  };

  switch (statut) {
    case "intention": {
      // T5 — Phase -1 : Backward Design + Persona (en parallèle, avant la structure)
      const [backwardDesign, persona] = await Promise.all([
        stepBackwardDesign(f, passesCourantes),
        stepPersona(f, passesCourantes),
      ]);

      // Merger backward design + persona dans programmeDetaille AVANT de générer la structure
      // (pour que buildStructureUserPrompt injecte le persona)
      const currentProgramme =
        f.programmeDetaille !== null && f.programmeDetaille !== undefined
          ? (f.programmeDetaille as Record<string, unknown>)
          : {};
      const mergedPreStructure = { ...currentProgramme, backwardDesign, persona };

      // Persister les résultats T5 pré-structure en DB
      await advanceStatut(formationId, "intention", {
        programmeDetaille: mergedPreStructure,
      });

      // Mettre à jour f en mémoire pour que stepGenerateStructure ait le persona
      f.programmeDetaille = mergedPreStructure;

      // Génération structure (buildStructureUserPrompt injectera le persona)
      await stepGenerateStructure(f, passesCourantes);

      // Recharger la formation mise à jour (programmeDetaille changé par stepGenerateStructure)
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
      // T5 — Critique adversariale AVANT l'évaluation qualité
      const critique = await stepAdversarialCritique(f, passesCourantes);

      if (critique !== null) {
        // Persister adversarialCritique dans programmeDetaille
        const currentProg =
          f.programmeDetaille !== null && f.programmeDetaille !== undefined
            ? (f.programmeDetaille as Record<string, unknown>)
            : {};
        const mergedWithCritique = { ...currentProg, adversarialCritique: critique };

        // Conserver le statut structure_generee (pas de transition de statut ici — juste update champ)
        await advanceStatut(formationId, "structure_generee", {
          programmeDetaille: mergedWithCritique,
        });
        f.programmeDetaille = mergedWithCritique;

        // Si verdict CRITIQUE → forcer un refine en injectant les axes d'amélioration
        if (
          critique.verdict === "CRITIQUE" &&
          Array.isArray(critique.axesAmelioration) &&
          critique.axesAmelioration.length > 0
        ) {
          console.log(
            `[qualiopi:engine] formation=${formationId} adversarialCritique verdict=CRITIQUE → refine forcé`,
          );
          const consignesCritique = [
            "⚠️ Critique adversariale — axes d'amélioration prioritaires :",
            ...critique.axesAmelioration.map((a) => `- ${String(a)}`),
          ].join("\n");

          await stepRefine(f, passesCourantes, 0, consignesCritique);

          // Recharger après refine
          const updatedAfterRefine = await prisma.formation.findUnique({
            where: { id: formationId },
            select: {
              programmeDetaille: true,
              methodesPedagogiques: true,
              objectifsPedagogiques: true,
            },
          });
          if (updatedAfterRefine) {
            f.programmeDetaille = updatedAfterRefine.programmeDetaille;
            f.methodesPedagogiques = updatedAfterRefine.methodesPedagogiques;
            f.objectifsPedagogiques = updatedAfterRefine.objectifsPedagogiques;
          }
        }
      }

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
    // Alerte système job_ia_echoue — UNIQUEMENT sur échec définitif (tentatives
    // épuisées), pas à chaque retry intermédiaire. creerOuDedup est stub-aware
    // et dé-duplique par (code, cibleId=formationId). Fail-soft.
    const formationId = job?.data?.formationId;
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 1;
    if (formationId && attemptsMade >= maxAttempts) {
      void creerOuDedup({
        code: "job_ia_echoue",
        niveau: "important",
        titre: "Job IA en échec (dead letter queue)",
        message:
          `La génération IA de la formation ${formationId} a échoué après ${attemptsMade} ` +
          `tentative(s) : ${err.message}`.slice(0, 1000),
        cibleType: "Formation",
        cibleId: formationId,
      }).catch((e) =>
        console.error(
          "[qualiopi:engine] alerte job_ia_echoue fail-soft:",
          e instanceof Error ? e.message : String(e),
        ),
      );
    }
  });

  return worker;
}
