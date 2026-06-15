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
import { generate as routerGenerate } from "@/server/content-gen/providers/provider-router";
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";
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

const CORRECTION_SYSTEM_PROMPT = `Tu es un correcteur factuel. On te donne le corps HTML d'un article et une liste de phrases contenant des CHIFFRES vérifiés FAUX. Ta tâche :
- Corrige UNIQUEMENT ces chiffres faux : remplace par une donnée exacte et plausible, OU reformule la phrase SANS le chiffre.
- Ne réintroduis AUCUNE des valeurs signalées comme fausses.
- Ne change RIEN d'autre : conserve la structure HTML, les titres, les liens, le ton, le reste du texte à l'identique.
- Réponds UNIQUEMENT avec le corps HTML complet corrigé, sans commentaire ni balise de code.`;

/**
 * Correction EN PLACE des chiffres réfutés (décision Will « corriger plutôt que
 * désindexer »). 1 appel LLM ciblé qui renvoie le HTML corrigé. Fail-safe :
 * retourne null si l'appel échoue ou renvoie un résultat vide/incohérent → le
 * caller garde alors l'article inchangé (jamais cassé, jamais désindexé).
 */
async function correctRefutedClaimsInPlace(args: {
  readonly jobId: string;
  readonly bodyHtml: string;
  readonly refutedSentences: ReadonlyArray<string>;
}): Promise<string | null> {
  if (args.refutedSentences.length === 0) return null;
  try {
    const userPrompt =
      `Phrases à corriger (chiffres faux) :\n` +
      args.refutedSentences.map((s, i) => `${i + 1}. ${s}`).join("\n") +
      `\n\n--- CORPS HTML ---\n${args.bodyHtml}`;
    const res = await routerGenerate({
      jobId: args.jobId,
      contentType: "blog_article",
      role: "text",
      systemPrompt: CORRECTION_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.2,
    });
    const cleaned = sanitizeContentGenHtml(res.output.trim());
    // Garde-fou cohérence : un résultat trop court = correction ratée → on garde l'original.
    if (cleaned.length < Math.floor(args.bodyHtml.length * 0.5)) return null;
    return cleaned;
  } catch {
    return null;
  }
}

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
    // P0-3 (audit content-gen 2026-06-15) — propager AUSSI sur ContentGenJob.
    // Le gate de publication (content-publish-worker) lit `cgJob.factCheckScore` ;
    // sans cette écriture le champ restait toujours null → gate mort. Désormais
    // cohérent : le score est connu et le gate mord sur tout re-publish/retry.
    await prisma.contentGenJob
      .update({ where: { id: contentGenJobId }, data: { factCheckScore: 100 } })
      .catch(() => undefined);
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
  // P0-3 (audit content-gen 2026-06-15) — propager AUSSI sur ContentGenJob pour
  // que le gate de publication (content-publish-worker) ne lise plus un champ
  // éternellement null. Le flux nominal reste post-publish (décision Will
  // « corriger en place plutôt que désindexer ») ; le gate sert de filet de
  // sécurité sur les re-publish/retry d'un job dont le score est désormais connu.
  await prisma.contentGenJob
    .update({ where: { id: contentGenJobId }, data: { factCheckScore: score } })
    .catch(() => undefined);

  // 2026-06-14 (décision Will « corriger et garder en ligne ») — Quand des
  // chiffres sont RÉFUTÉS (score < refuteScore), on NE désindexe JAMAIS. On
  // corrige les chiffres faux EN PLACE (1 appel LLM ciblé qui réécrit le HTML),
  // l'article reste publié + indexé. Fail-safe : si la correction échoue ou
  // renvoie un résultat incohérent, l'article reste INCHANGÉ et EN LIGNE (signalé
  // pour revue manuelle). Pas de boucle : le fact-check ne tourne qu'une fois
  // après publication. Pas de doublon : on édite la traduction existante en place.
  const cfg = await readContentGenConfig<{ refuteScore: number }>("factcheck_correction", {
    refuteScore: 50,
  });
  if (score < cfg.refuteScore) {
    const refutedSentences = claims
      .filter((_, i) => verdicts[i]?.status === "refuted")
      .map((c) => c.sentence);
    const correctedHtml = await correctRefutedClaimsInPlace({
      jobId: contentGenJobId,
      bodyHtml: translation.body,
      refutedSentences,
    });
    const listPath = article.isNews ? "/fr/actualites" : "/fr/blog";
    if (correctedHtml) {
      const correctedText = correctedHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      await prisma.articleTranslation
        .update({
          where: { id: translation.id },
          data: { body: correctedHtml, bodyText: correctedText },
        })
        .catch(() => undefined);
      await revalidateContent({ paths: [`${listPath}/${translation.slug}`, listPath] }).catch(
        () => undefined,
      );
      console.warn(
        `[fact-check] article=${articleId} score=${score} < ${cfg.refuteScore} → ${refutedSentences.length} chiffre(s) CORRIGÉ(S) en place, article reste EN LIGNE + indexé`,
      );
    } else {
      // Correction auto impossible (échec LLM / résultat incohérent) : article
      // gardé EN LIGNE + indexé, signalé pour revue manuelle (PAS de désindexation).
      await prisma.contentGenJob
        .update({ where: { id: contentGenJobId }, data: { status: "quarantined_factcheck" } })
        .catch(() => undefined);
      console.warn(
        `[fact-check] article=${articleId} score=${score} < ${cfg.refuteScore} → correction auto impossible, reste EN LIGNE, revue manuelle signalée (PAS de désindexation)`,
      );
    }
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
