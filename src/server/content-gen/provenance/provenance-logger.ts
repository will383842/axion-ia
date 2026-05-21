/**
 * Content Generator — Provenance Logger (B.4 P1.5 2026-05-21).
 *
 * Tracabilite par appel LLM pour conformite AI Act art. 50 + SOC2.
 * Chaque appel LLM implique dans la generation d'un article est enregistre
 * dans `generation_provenance` avec un hash SHA-256 chaine (previousHash → hash).
 *
 * Le hash chaine garantit l'integrite de la trace : toute modification
 * retro-active d'un enregistrement invalide les hashes suivants.
 *
 * Fire-and-forget : un echec de log ne doit pas bloquer la generation.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface LogProvenanceInput {
  readonly articleId: string;
  readonly step: string;
  readonly provider: string;
  readonly model: string;
  readonly modelVersion?: string;
  readonly promptHash: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens?: number;
  readonly costUsd: number;
}

/**
 * Calcule le hash SHA-256 d'un enregistrement provenance (hash chaine).
 * Input : previousHash (ou "") + promptHash + timestamp ISO.
 */
export function computeProvenanceHash(
  previousHash: string,
  promptHash: string,
  timestamp: Date,
): string {
  return createHash("sha256")
    .update(`${previousHash}:${promptHash}:${timestamp.toISOString()}`)
    .digest("hex")
    .slice(0, 64);
}

/**
 * Calcule un hash SHA-256 du prompt (pour audit trail sans stocker le prompt complet).
 * Tronque a 64 hex chars (256 bits — suffisant pour deduplication / audit).
 */
export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 64);
}

/**
 * Persiste un enregistrement provenance pour un appel LLM.
 *
 * Fire-and-forget : toute erreur est loggee en console mais ne propage pas.
 * Retourne l'ID de l'enregistrement cree (ou null si echec).
 */
export async function logProvenance(input: LogProvenanceInput): Promise<string | null> {
  try {
    // Recuperer le hash precedent pour chainer.
    const previous = await prisma.generationProvenance.findFirst({
      where: { articleId: input.articleId },
      orderBy: { timestamp: "desc" },
      select: { hash: true },
    });
    const previousHash = previous?.hash ?? "";
    const timestamp = new Date();
    const hash = computeProvenanceHash(previousHash, input.promptHash, timestamp);

    const record = await prisma.generationProvenance.create({
      data: {
        articleId: input.articleId,
        step: input.step,
        provider: input.provider,
        model: input.model,
        modelVersion: input.modelVersion ?? null,
        promptHash: input.promptHash,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cacheReadInputTokens: input.cacheReadInputTokens ?? 0,
        cost: input.costUsd,
        regulationVersion: "AI-Act-2024/1689",
        previousHash: previousHash || null,
        hash,
        timestamp,
      },
    });
    return record.id;
  } catch (err) {
    console.warn(
      "[provenance-logger] failed to log provenance:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Recupere toute la trace provenance d'un article (pour endpoint admin).
 * Retourne [] si article inconnu ou table absente (bootstrap-safe).
 */
export async function getProvenanceForArticle(articleId: string): Promise<
  Array<{
    id: string;
    step: string;
    provider: string;
    model: string;
    modelVersion: string | null;
    promptHash: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cost: string;
    regulationVersion: string;
    previousHash: string | null;
    hash: string;
    timestamp: Date;
  }>
> {
  try {
    const rows = await prisma.generationProvenance.findMany({
      where: { articleId },
      orderBy: { timestamp: "asc" },
    });
    return rows.map((r) => ({
      ...r,
      cost: r.cost.toString(),
    }));
  } catch {
    return [];
  }
}
