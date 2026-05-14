/**
 * Content Generator — Fact-check worker (Sprint 12.5 V2).
 *
 * Hook post-publish : pour chaque article publié contenant des claims chiffrés
 * (%, montants, ratios, attributions), interroge Perplexity (role="data") pour
 * valider/refuter chaque claim. Remplit `Article.factCheckScore` (0-100).
 *
 * Pipeline :
 *  1. Lookup Article + ArticleTranslation FR
 *  2. extractClaims(body) → liste de ExtractedClaim
 *  3. Si aucun claim → score=100, done.
 *  4. Sinon : 1 call Perplexity avec systemPrompt fact-check + claims sérialisés
 *  5. Parse réponse → ClaimVerdict[] → computeFactCheckScore
 *  6. UPDATE Article.factCheckScore
 *
 * Coût : ~$0.005/article (1 call Perplexity Sonar). Concurrence limitée à 2
 * pour préserver le quota API.
 *
 * Idempotency : worker idempotent via Prisma UPDATE (rejouer = même résultat).
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  type ClaimVerdict,
  computeFactCheckScore,
  extractClaims,
} from "@/server/content-gen/fact-check/claims-extractor";
import { perplexityProvider } from "@/server/content-gen/providers/perplexity";

const QUEUE_NAME = "content-fact-check";

export interface FactCheckJobPayload {
  readonly articleId: string;
  readonly contentGenJobId: string;
}

const SYSTEM_PROMPT = `Tu es un fact-checker rigoureux. Pour chaque claim numéroté ci-dessous, retourne UNIQUEMENT un JSON array de la forme :
[{"id": 1, "status": "validated" | "refuted" | "unclear", "evidence": "url ou note"}, ...]

Règles :
- "validated" : claim cohérent avec sources publiques fiables récentes (≤ 3 ans).
- "refuted" : claim contredit par sources fiables OU chiffre manifestement faux.
- "unclear" : pas de source publique vérifiable rapidement OU ambiguïté de formulation.
- Ne pas reformuler les claims. Pas de prose hors JSON.`;

function buildUserPrompt(claims: ReadonlyArray<{ sentence: string; match: string }>): string {
  const lines = claims.map(
    (c, i) => `Claim ${i + 1} (match="${c.match}") : "${c.sentence}"`,
  );
  return `Vérifie les ${claims.length} claims suivants :\n\n${lines.join("\n")}`;
}

function parseVerdicts(
  raw: string,
  expectedCount: number,
): ReadonlyArray<ClaimVerdict> {
  try {
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) return [];
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Array<{
      status?: string;
    }>;
    const verdicts: ClaimVerdict[] = parsed
      .filter((p) => p && typeof p.status === "string")
      .map((p) => {
        const status = p.status === "validated" || p.status === "refuted" ? p.status : "unclear";
        return { status };
      });
    // Padding si Perplexity a omis certains claims
    while (verdicts.length < expectedCount) verdicts.push({ status: "unclear" });
    return verdicts.slice(0, expectedCount);
  } catch (err) {
    console.warn(
      "[fact-check] parseVerdicts failed:",
      err instanceof Error ? err.message : String(err),
    );
    return Array.from({ length: expectedCount }, () => ({ status: "unclear" }) as const);
  }
}

async function processJob(job: Job<FactCheckJobPayload>): Promise<void> {
  const { articleId, contentGenJobId } = job.data;

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { translations: { where: { locale: "fr" } } },
  });
  if (!article) {
    console.warn(`[fact-check] article ${articleId} not found, skip`);
    return;
  }
  const translation = article.translations[0];
  if (!translation) return;

  const body = translation.bodyText ?? translation.body;
  const claims = extractClaims(body);

  if (claims.length === 0) {
    await prisma.article.update({
      where: { id: articleId },
      data: { factCheckScore: 100 },
    });
    console.log(`[fact-check] article=${articleId} no_claims → score=100`);
    return;
  }

  let verdicts: ReadonlyArray<ClaimVerdict>;
  try {
    const response = await perplexityProvider.generate({
      jobId: contentGenJobId,
      contentType: "fact_check",
      role: "data",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(claims),
      maxTokens: 800,
      temperature: 0,
      searchRecencyMonths: 36,
    });
    verdicts = parseVerdicts(response.output, claims.length);
  } catch (err) {
    console.warn(
      `[fact-check] perplexity failed for article ${articleId}:`,
      err instanceof Error ? err.message : String(err),
    );
    // Soft-fail : on garde factCheckScore null (verra Sprint suivant)
    return;
  }

  const score = computeFactCheckScore(verdicts);
  await prisma.article.update({
    where: { id: articleId },
    data: { factCheckScore: score },
  });

  console.log(
    `[fact-check] article=${articleId} claims=${claims.length} verdicts=${verdicts
      .map((v) => v.status[0])
      .join("")} score=${score}`,
  );
}

let workerInstance: Worker<FactCheckJobPayload> | null = null;

export function startFactCheckWorker(): Worker<FactCheckJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — fact-check-worker cannot start");
  workerInstance = new Worker<FactCheckJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 2,
    limiter: { max: 60, duration: 60_000 },
  });
  workerInstance.on("failed", (j, err) => {
    console.error(`[content-fact-check-worker] job ${j?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopFactCheckWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
