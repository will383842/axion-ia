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
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { revalidateContent } from "@/server/content-gen/shared/revalidate-content";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

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
  const lines = claims.map((c, i) => `Claim ${i + 1} (match="${c.match}") : "${c.sentence}"`);
  return `Vérifie les ${claims.length} claims suivants :\n\n${lines.join("\n")}`;
}

function parseVerdicts(raw: string, expectedCount: number): ReadonlyArray<ClaimVerdict> {
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

  // Audit 2026-05-15 P1-8 — kill-switch check (Perplexity coût ~$0.005/article,
  // critique de pouvoir stopper la cascade post-publish quand Will pause).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log(`[fact-check] kill switch active, skip article ${articleId}`);
    return;
  }

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

  // P0-6 — Persistance individuelle des claims + gate quarantaine.
  if (claims.length > 0) {
    await prisma.factCheckClaim
      .createMany({
        data: claims.map((claim, i) => ({
          articleId,
          claim: claim.sentence,
          status:
            verdicts[i]?.status === "validated"
              ? "verified"
              : verdicts[i]?.status === "refuted"
                ? "contradicted"
                : "unverified",
          confidence:
            verdicts[i]?.status === "validated"
              ? 0.85
              : verdicts[i]?.status === "refuted"
                ? 0.1
                : 0.4,
        })),
        skipDuplicates: true,
      })
      .catch((err: unknown) => {
        console.warn(
          `[fact-check] claims insert failed:`,
          err instanceof Error ? err.message : String(err),
        );
      });
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { factCheckScore: score },
  });

  if (score < 50) {
    // P0 2026-06-13 (décision Will) — Chiffre RÉFUTÉ (vérifié faux par Perplexity).
    // On ne laisse PAS une affirmation fausse indexée : on RETIRE l'article de
    // l'index (tier_3 noindex → exclu du sitemap + meta robots noindex) et on
    // déclenche une revalidation immédiate (sans attendre l'ISR 1h). L'URL reste
    // vivante (rétractation douce, pas de 404), réversible après correction.
    // Le job passe en quarantaine pour correction humaine.
    await prisma.article
      .update({
        where: { id: articleId },
        data: { indexationTier: "tier_3_noindex_nofollow" },
      })
      .catch(() => undefined);
    await prisma.contentGenJob
      .update({ where: { id: contentGenJobId }, data: { status: "quarantined_factcheck" } })
      .catch(() => undefined);
    const listPath = article.isNews ? "/fr/actualites" : "/fr/blog";
    await revalidateContent({
      paths: [`${listPath}/${translation.slug}`, listPath, "/sitemap.xml"],
    }).catch(() => undefined);
    console.warn(
      `[fact-check] article=${articleId} score=${score} < 50 → RETRACTÉ (tier_3 noindex) + revalidate + quarantined_factcheck`,
    );
  }

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
    lockDuration: 120_000,
    limiter: { max: 60, duration: 60_000 },
    // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
    // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
    // Évite saturation Redis long-terme sur high-volume workers.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
  // Sprint Final 2026-05-22 (P0-4 audit final) — Sentry capture sur worker
  // chokepoint AI Act gating. Avant ce fix, outages Perplexity = silent fail
  // console only → articles publiés sans claims vérifiés invisible.
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-fact-check-worker] job ${job?.id} failed:`, err);
    captureWorkerError("fact-check", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopFactCheckWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
