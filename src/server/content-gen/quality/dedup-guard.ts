/**
 * Content Generator — Dedup guard (4 couches v1.7 § 25.5 master prompt).
 *
 * Anti-doublon PRÉ-IA (bloque appels LLM inutiles) :
 *
 * Couche A.1 — Levenshtein 0.85 vs 5 000 derniers titres → BLOCK
 * Couche A.2 — Primary KW + ville + fenêtre 90 j → BLOCK
 * Couche A.3 — Topic fingerprint (hash 8-12 KW) → BLOCK
 * Couche A.4 — Embedding cosine 0.85 vs corpus → BLOCK (V2 si KB embeddings prêts)
 * Couche A.5 — Exception multi-audiences : même primaryKW OK si couple
 *              (CompanySize × OrganisationType) différent
 *
 * V1 implémente Levenshtein + topic fingerprint + time decay.
 * V2 ajoute embedding cosine via KB V4 helpers (Voyage AI dim 1024).
 */

import { prisma } from "@/lib/prisma";
import type { CompanySize, OrganisationType } from "../../../../prisma/generated/client";
// B.7 P0-6 P1.5 — Couche A.3 outline SimHash dedup.
import {
  computeOutlineSimhash,
  outlineHammingDistance,
  classifyOutlineDedup,
  OUTLINE_DEDUP_THRESHOLDS,
} from "../dedup/outline-simhash";

export interface DedupGuardInput {
  readonly title: string;
  readonly primaryKeyword?: string;
  readonly topicKeywords?: ReadonlyArray<string>;
  readonly anchorVilleSlug?: string;
  readonly targetAudienceSize?: CompanySize;
  readonly targetAudienceOrganisation?: OrganisationType;
  /** Lookback window pour anti-doublon ville/keyword en jours. Default 90. */
  readonly windowDays?: number;
  /**
   * Job qui demande le contrôle : exclu de la comparaison, sinon un job en
   * file se reconnaît lui-même à 100 % et s'annule.
   */
  readonly excludeJobId?: string;
}

/**
 * Titre porté par la charge utile d'un job, quelle que soit sa provenance.
 *
 * 🔴 2026-09-02 — deux news RSS sur la MÊME dépêche (« Claude Fable 5.1 … AWS »)
 * publiées à la même minute par deux flux : la garde n'avait jamais vu passer
 * un job RSS. L'ingestion écrit `rssTitle`, la garde et le worker lisaient
 * `title` — vide, donc contrôle sauté. Une seule lecture, ici, pour les deux.
 */
export function titleOfPayload(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const p = payload as { title?: unknown; rssTitle?: unknown };
  if (typeof p.title === "string" && p.title.trim()) return p.title;
  if (typeof p.rssTitle === "string" && p.rssTitle.trim()) return p.rssTitle;
  return "";
}

export interface DedupGuardResult {
  readonly passed: boolean;
  readonly reason?: string;
  readonly matchedJobId?: string;
}

/**
 * Distance Levenshtein normalisée [0, 1] entre 2 chaînes lowercase.
 * 1 = identique, 0 = totalement différentes.
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const sa = a.toLowerCase().trim();
  const sb = b.toLowerCase().trim();
  if (sa === sb) return 1;
  if (sa.length === 0 || sb.length === 0) return 0;

  const m = sa.length;
  const n = sb.length;
  // Matrix DP
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = sa[i - 1] === sb[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        (dp[i - 1]?.[j] ?? 0) + 1,
        (dp[i]?.[j - 1] ?? 0) + 1,
        (dp[i - 1]?.[j - 1] ?? 0) + cost,
      );
    }
  }
  const distance = dp[m]![n]!;
  const maxLen = Math.max(m, n);
  return 1 - distance / maxLen;
}

/**
 * Génère un topic fingerprint stable depuis une liste de keywords.
 * Tri alphabétique + lowercase + hash via simple djb2.
 */
export function topicFingerprint(keywords: ReadonlyArray<string>): string {
  const normalized = [...keywords]
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length > 0)
    .sort()
    .join("|");
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

const LEVENSHTEIN_THRESHOLD = 0.85;
const LOOKBACK_LIMIT = 5000;

/**
 * Pre-flight dedup check avant tout appel LLM.
 * Returns passed=false si match trouvé sur l'une des couches.
 *
 * V0 transitoire : si DB pas accessible (P2021 / PrismaInit), bypass (return passed=true).
 */
export async function checkDedup(input: DedupGuardInput): Promise<DedupGuardResult> {
  try {
    const windowDays = input.windowDays ?? 90;
    const cutoff = new Date(Date.now() - windowDays * 24 * 3600 * 1000);

    // Couche A.1 — Levenshtein 0.85 vs 5000 derniers
    // `queued` / `running` / `needs_review` comparés aussi : deux jobs créés
    // à la même minute (rafale RSS de minuit) ne se voyaient pas, chacun ne
    // regardant que ce qui était déjà publié.
    const recent = await prisma.contentGenJob.findMany({
      where: {
        createdAt: { gte: cutoff },
        status: {
          in: ["published", "approved", "publishing", "needs_review", "queued", "running"],
        },
        ...(input.excludeJobId ? { id: { not: input.excludeJobId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: LOOKBACK_LIMIT,
      select: {
        id: true,
        inputPayload: true,
        anchorVilleSlug: true,
        targetAudienceSize: true,
        targetAudienceOrganisation: true,
      },
    });

    for (const job of recent) {
      const otherTitle = titleOfPayload(job.inputPayload);
      if (!otherTitle) continue;

      const sim = levenshteinSimilarity(input.title, otherTitle);
      if (sim >= LEVENSHTEIN_THRESHOLD) {
        // Couche A.5 — exception multi-audiences
        const sameSize = job.targetAudienceSize === (input.targetAudienceSize ?? null);
        const sameOrg =
          job.targetAudienceOrganisation === (input.targetAudienceOrganisation ?? null);
        if (sameSize && sameOrg) {
          return {
            passed: false,
            reason: `Title similarity ${(sim * 100).toFixed(0)}% with job ${job.id} (same audience)`,
            matchedJobId: job.id,
          };
        }
        // Sinon : exception multi-audiences autorisée → on continue
      }

      // Couche A.2 — primaryKeyword + ville + window
      if (input.primaryKeyword && input.anchorVilleSlug) {
        const otherPk =
          typeof job.inputPayload === "object" &&
          job.inputPayload !== null &&
          "primaryKeyword" in job.inputPayload &&
          typeof (job.inputPayload as { primaryKeyword: unknown }).primaryKeyword === "string"
            ? (job.inputPayload as { primaryKeyword: string }).primaryKeyword
            : null;
        if (
          otherPk?.toLowerCase() === input.primaryKeyword.toLowerCase() &&
          job.anchorVilleSlug === input.anchorVilleSlug
        ) {
          const sameSize = job.targetAudienceSize === (input.targetAudienceSize ?? null);
          const sameOrg =
            job.targetAudienceOrganisation === (input.targetAudienceOrganisation ?? null);
          if (sameSize && sameOrg) {
            return {
              passed: false,
              reason: `Same primaryKeyword '${otherPk}' + ville '${input.anchorVilleSlug}' (job ${job.id}, ${windowDays}j window, same audience)`,
              matchedJobId: job.id,
            };
          }
        }
      }
    }

    // Couche A.3 — topic fingerprint pre-IA (V1 minimal, no-op block —
    // la dedup outline reelle est faite POST-IA via checkOutlineDedup()
    // appele par content-gen-worker. Pre-IA on log seulement pour audit.)
    if (input.topicKeywords && input.topicKeywords.length >= 5) {
      const fingerprint = topicFingerprint(input.topicKeywords);
      // Audit-only : fingerprint utilise pour future analyse retro corpus.
      void fingerprint;
    }

    return { passed: true };
  } catch (err) {
    // P2021 / PrismaClientInitializationError → bypass V0 (tests sans DB)
    if (
      err instanceof Error &&
      (("code" in err && (err as { code: string }).code === "P2021") ||
        err.constructor.name === "PrismaClientInitializationError")
    ) {
      return { passed: true };
    }
    throw err;
  }
}

// ─── B.7 P0-6 P1.5 — Couche A.3 reelle (post-IA, pre-publish) ────────────────

export interface OutlineDedupCheckInput {
  readonly bodyHtml: string;
  /** Limite corpus a comparer (default 1000 derniers publies). */
  readonly corpusLimit?: number;
  /** Lookback window jours (default 365). */
  readonly windowDays?: number;
}

export interface OutlineDedupCheckResult {
  readonly verdict: "ok" | "similar" | "duplicate_template" | "skipped";
  readonly outlineSimhash: string | null;
  readonly minDistance: number;
  readonly matchedArticleId: string | null;
  readonly reason: string;
}

/**
 * Couche A.3 POST-IA : compare le outline d'un article candidat vs le corpus
 * publie. Utilise en pre-publish dans content-gen-worker.
 *
 * Skipped si :
 *  - bodyHtml ne contient pas de h2/h3 (article trop court)
 *  - DB unavailable (build SSG, tests)
 *
 * Verdict :
 *  - duplicate_template : Hamming <= 4 → BLOCK (flag pour review humain)
 *  - similar : Hamming 5-8 → WARN (publish autorise, signale dans logs)
 *  - ok : Hamming > 8 → pass
 */
export async function checkOutlineDedup(
  input: OutlineDedupCheckInput,
): Promise<OutlineDedupCheckResult> {
  const candidateSimhash = computeOutlineSimhash(input.bodyHtml);
  if (!candidateSimhash) {
    return {
      verdict: "skipped",
      outlineSimhash: null,
      minDistance: -1,
      matchedArticleId: null,
      reason: "no h2/h3 outline detected — outline dedup skipped",
    };
  }

  const windowDays = input.windowDays ?? 365;
  const cutoff = new Date(Date.now() - windowDays * 24 * 3600 * 1000);
  const corpusLimit = input.corpusLimit ?? 1000;

  try {
    const corpus = await prisma.article.findMany({
      where: {
        status: "published",
        publishedAt: { gte: cutoff },
        outlineSimhash: { not: null },
      },
      orderBy: { publishedAt: "desc" },
      take: corpusLimit,
      select: { id: true, outlineSimhash: true },
    });

    let minDistance = 64;
    let matchedId: string | null = null;
    for (const article of corpus) {
      if (!article.outlineSimhash) continue;
      const d = outlineHammingDistance(candidateSimhash, article.outlineSimhash);
      if (d >= 0 && d < minDistance) {
        minDistance = d;
        matchedId = article.id;
        // Early exit si dejas duplicate strict.
        if (d <= OUTLINE_DEDUP_THRESHOLDS.DUPLICATE) break;
      }
    }

    if (minDistance === 64) {
      return {
        verdict: "ok",
        outlineSimhash: candidateSimhash,
        minDistance: 64,
        matchedArticleId: null,
        reason: "no comparable corpus or all distances = 64 (totally distinct)",
      };
    }

    const verdict = classifyOutlineDedup(minDistance);
    return {
      verdict: verdict.verdict,
      outlineSimhash: candidateSimhash,
      minDistance,
      matchedArticleId: matchedId,
      reason: verdict.reason,
    };
  } catch (err) {
    // DB unavailable → skip silent.
    return {
      verdict: "skipped",
      outlineSimhash: candidateSimhash,
      minDistance: -1,
      matchedArticleId: null,
      reason: `DB error: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}
