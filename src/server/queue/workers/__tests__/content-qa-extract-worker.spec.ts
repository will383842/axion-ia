/**
 * Sprint S+5 P2-10 sub-agent C — Tests Vitest worker QA extract.
 *
 * Stratégie : mock BullMQ `Worker` ctor pour capter le processor au moment de
 * `startContentQaExtractWorker()`, puis l'invoquer directement.
 *
 * Couvre :
 *  1. Happy path : 2 Q/R extraites → 2 upserts FAQ + revalidatePath + logStep.
 *  2. Failure path : upsert Prisma échoue → logStepError + skipped, ne throw pas.
 *  3. Edge case : faqs vide → skip early avec logStep, 0 upsert.
 *  4. Kill switch actif → throw `kill_switch_active` (retry BullMQ).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const {
  faqUpsertMock,
  readConfigMock,
  logStepMock,
  logStepErrorMock,
  revalidatePathMock,
  workerCtorMock,
  capturedProcessor,
} = vi.hoisted(() => {
  const captured: { fn: ((job: Job) => Promise<void>) | null } = { fn: null };
  return {
    faqUpsertMock: vi.fn(),
    readConfigMock: vi.fn(),
    logStepMock: vi.fn().mockResolvedValue(undefined),
    logStepErrorMock: vi.fn().mockResolvedValue(undefined),
    revalidatePathMock: vi.fn(),
    workerCtorMock: vi.fn((_name: string, fn: (job: Job) => Promise<void>) => {
      captured.fn = fn;
      return {
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };
    }),
    capturedProcessor: captured,
  };
});

vi.mock("bullmq", () => ({
  Worker: workerCtorMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fAQ: { upsert: faqUpsertMock },
  },
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: readConfigMock,
}));

vi.mock("@/server/content-gen/shared/generation-log", () => ({
  logStep: logStepMock,
  logStepError: logStepErrorMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

interface QaJobData {
  readonly articleId: string;
  readonly contentGenJobId: string;
  readonly articleSlug: string;
  readonly articleTitle: string;
  readonly anchorVilleSlug?: string;
  readonly anchorRegionSlug?: string;
  readonly faqs: ReadonlyArray<{ question: string; answer: string }>;
}

async function getProcessor(): Promise<(job: Job<QaJobData>) => Promise<void>> {
  vi.resetModules();
  capturedProcessor.fn = null;
  process.env.REDIS_URL = "redis://test:6379";
  const mod = await import("../content-qa-extract-worker");
  mod.startContentQaExtractWorker();
  if (!capturedProcessor.fn) throw new Error("processor not captured");
  return capturedProcessor.fn as (job: Job<QaJobData>) => Promise<void>;
}

function fakeJob(data: QaJobData): Job<QaJobData> {
  return { data, id: "qa-job-1" } as unknown as Job<QaJobData>;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("content-qa-extract-worker — Sprint S+5 P2-10 sub-agent C", () => {
  beforeEach(() => {
    faqUpsertMock.mockReset();
    readConfigMock.mockReset();
    readConfigMock.mockResolvedValue({ active: false });
    logStepMock.mockClear();
    logStepErrorMock.mockClear();
    revalidatePathMock.mockClear();
    workerCtorMock.mockClear();
  });

  it("happy path — 2 Q/R → 2 upserts FAQ + revalidatePath + logStep", async () => {
    faqUpsertMock.mockResolvedValue({ id: "faq-1" });

    const processor = await getProcessor();
    await processor(
      fakeJob({
        articleId: "art-42",
        contentGenJobId: "cg-job-42",
        articleSlug: "audit-ia-pme-2026",
        articleTitle: "Audit IA pour PME en 2026",
        faqs: [
          {
            question: "Combien coûte un audit IA pour une PME ?",
            answer: "Le coût d'un audit IA en cabinet B2B varie entre 3 000 et 8 000 euros HT.",
          },
          {
            question: "Quelle est la durée d'une intervention 1-to-1 ?",
            answer: "Une intervention 1-to-1 dure typiquement 2 à 4 heures par session.",
          },
        ],
      }),
    );

    expect(faqUpsertMock).toHaveBeenCalledTimes(2);
    const slug1 = (faqUpsertMock.mock.calls[0]?.[0] as { where: { slug: string } }).where.slug;
    expect(slug1).toContain("audit-ia-pme-2026");
    expect(slug1).toContain("combien");
    expect(revalidatePathMock).toHaveBeenCalledWith("/fr/faq");
    // logStep "Extracting N Q/R" + logStep "Q/R post-process done" = 2 calls
    expect(logStepMock).toHaveBeenCalledTimes(2);
  });

  it("failure path — upsert Prisma échoue → logStepError, ne throw pas", async () => {
    faqUpsertMock.mockRejectedValue(new Error("FAQ unique constraint violated"));

    const processor = await getProcessor();
    await expect(
      processor(
        fakeJob({
          articleId: "art-43",
          contentGenJobId: "cg-job-43",
          articleSlug: "implementations-rag-juridique",
          articleTitle: "Implémentations RAG juridique",
          faqs: [
            {
              question: "Quelle stack pour un RAG juridique 2026 ?",
              answer: "Stack recommandée : Voyage embeddings + Pinecone + Claude Sonnet 4.6.",
            },
          ],
        }),
      ),
    ).resolves.toBeUndefined();

    expect(faqUpsertMock).toHaveBeenCalledTimes(1);
    expect(logStepErrorMock).toHaveBeenCalledTimes(1);
    const errMsg = logStepErrorMock.mock.calls[0]?.[2] as string;
    expect(errMsg).toContain("FAQ upsert failed");
  });

  it("edge case — faqs vide → skip early, 0 upsert, logStep 'No FAQs to extract'", async () => {
    const processor = await getProcessor();
    await processor(
      fakeJob({
        articleId: "art-44",
        contentGenJobId: "cg-job-44",
        articleSlug: "formation-ia-equipe",
        articleTitle: "Formation IA pour équipes",
        faqs: [],
      }),
    );

    expect(faqUpsertMock).not.toHaveBeenCalled();
    expect(logStepMock).toHaveBeenCalledTimes(1);
    const msg = logStepMock.mock.calls[0]?.[2] as string;
    expect(msg).toContain("No FAQs to extract");
  });

  it("kill switch actif → throw kill_switch_active (retry BullMQ)", async () => {
    readConfigMock.mockResolvedValue({ active: true });

    const processor = await getProcessor();
    await expect(
      processor(
        fakeJob({
          articleId: "art-45",
          contentGenJobId: "cg-job-45",
          articleSlug: "un-a-un-strategie",
          articleTitle: "Stratégie 1-to-1 dirigeants",
          faqs: [{ question: "Q?", answer: "A." }],
        }),
      ),
    ).rejects.toThrow("kill_switch_active");

    expect(faqUpsertMock).not.toHaveBeenCalled();
  });
});
