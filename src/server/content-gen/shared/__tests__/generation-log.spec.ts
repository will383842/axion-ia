/**
 * Pass B P0-1 — Tests generation-log helper (audit trail content-gen).
 *
 * Vérifie le mode V0 bypass (DB pas accessible → swallow + return) +
 * le contrat d'API public (logGeneration, logStep).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    generationLog: {
      create: vi.fn().mockRejectedValue(
        Object.assign(new Error("DB unreachable"), {
          code: "P2021",
        }),
      ),
    },
  },
}));

describe("generation-log — fail-soft (DB unreachable)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logGeneration ne throw pas quand prisma rejette (audit trail non-critique)", async () => {
    const { logGeneration } = await import("../generation-log");
    await expect(
      logGeneration({
        jobId: "job_test_123",
        level: "info",
        step: "kb_retrieve",
        message: "fetched 12 chunks",
      }),
    ).resolves.toBeUndefined();
  });

  it("logStep est un raccourci sur logGeneration (mêmes garanties fail-soft)", async () => {
    const { logStep } = await import("../generation-log");
    await expect(
      logStep("job_test_123", "llm_call", "openai gpt-4o 980 tokens", {
        cost_usd: 0.012,
      }),
    ).resolves.toBeUndefined();
  });

  it("logGeneration accepte tous les steps connus", async () => {
    const { logGeneration } = await import("../generation-log");
    const steps = [
      "kb_retrieve",
      "llm_call",
      "image_search",
      "validation",
      "publish",
      "quality_check",
      "plagiarism_check",
      "intent_check",
      "doctrine_check",
      "kill_switch_check",
      "dedup_check",
      "seo_score",
      "readability",
      "indexnow_ping",
      "google_indexing_ping",
      "rss_fetch",
      "qa_extract",
      "json_ld_news_article",
      "json_ld_qa_page",
      "fact_check_enqueue",
      "revalidate_path",
      "article_insert",
      "translation_insert",
      "faq_upsert",
      "web_vital_sample",
      "web_vital_alert",
      "cost_cap_check",
      "auto_kill_switch",
      "error",
    ] as const;
    for (const step of steps) {
      await expect(
        logGeneration({ jobId: "j", level: "debug", step, message: step }),
      ).resolves.toBeUndefined();
    }
  });
});
