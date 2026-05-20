/**
 * Sub-agent D Sprint S+5 P2-10 (2026-05-20) — Tests Vitest content-google-indexing-worker.
 *
 * Worker BullMQ rate-limited (200/jour Google quota gratuit). Pas de
 * `runTickForTest` hook → on mocke `bullmq.Worker` pour capturer le processor.
 *
 * Couvre :
 *  1. happy path : URL publiée OK via indexingPublishUrl
 *  2. failure path : indexingPublishUrl retourne false (API down/4xx) → log warn + continue
 *  3. edge case : OAuth credentials absents → skip silencieux (isIndexingApiReady false)
 *  4. edge case bis : kill-switch actif → skip total
 *
 * Quota cap : la limite 200/jour est gérée par BullMQ `limiter` au niveau du
 * Worker constructor — pas testable au niveau du processJob isolé. Couvert
 * implicitement par "URL déjà soumise dans 24h" = jobId dédupliqué côté
 * `enqueue.ts`.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  readConfigMock,
  isReadyMock,
  publishUrlMock,
  capturedProcessor,
  workerOnMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn().mockResolvedValue({ active: false }),
  isReadyMock: vi.fn().mockReturnValue(true),
  publishUrlMock: vi.fn().mockResolvedValue(true),
  workerOnMock: vi.fn(),
  capturedProcessor: { current: null as null | ((job: unknown) => Promise<void>) },
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation((_name: string, processor: (job: unknown) => Promise<void>) => {
    capturedProcessor.current = processor;
    return { on: workerOnMock, close: vi.fn() };
  }),
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: readConfigMock,
}));

vi.mock("@/server/content-gen/seo/indexing-client", () => ({
  isIndexingApiReady: isReadyMock,
  indexingPublishUrl: publishUrlMock,
}));

async function loadAndRun(jobData: { url: string; type: "URL_UPDATED" | "URL_DELETED" }): Promise<void> {
  const mod = await import("../content-google-indexing-worker");
  process.env.REDIS_URL = "redis://stub.invalid:6379";
  mod.startGoogleIndexingWorker();
  if (!capturedProcessor.current) {
    throw new Error("Processor not captured");
  }
  await capturedProcessor.current({ id: "test-job", data: jobData });
  await mod.stopGoogleIndexingWorker();
}

describe("content-google-indexing-worker — Sub-agent D Sprint S+5 P2-10", () => {
  beforeEach(() => {
    vi.resetModules();
    readConfigMock.mockReset().mockResolvedValue({ active: false });
    isReadyMock.mockReset().mockReturnValue(true);
    publishUrlMock.mockReset().mockResolvedValue(true);
    workerOnMock.mockReset();
    capturedProcessor.current = null;
  });

  it("happy path : URL_UPDATED publiée → indexingPublishUrl appelé avec bons args", async () => {
    // 4 verticales — exemple un-a-un (1-to-1)
    await loadAndRun({
      url: "https://axion-ia.com/fr/un-a-un/coaching-dirigeant-ia",
      type: "URL_UPDATED",
    });

    expect(publishUrlMock).toHaveBeenCalledTimes(1);
    expect(publishUrlMock).toHaveBeenCalledWith(
      "https://axion-ia.com/fr/un-a-un/coaching-dirigeant-ia",
      "URL_UPDATED",
    );
  });

  it("failure path : indexingPublishUrl retourne false (4xx) → pas de throw, pas de retry", async () => {
    publishUrlMock.mockResolvedValue(false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // verticale audit
    await loadAndRun({
      url: "https://axion-ia.com/fr/audit/conformite-ai-act",
      type: "URL_UPDATED",
    });

    expect(publishUrlMock).toHaveBeenCalledTimes(1);
    // Doctrine worker : pas de retry exponentiel sur 4xx (cf. commentaire L52-54).
    // On vérifie qu'aucun throw n'a eu lieu (loadAndRun resolves).
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("publish failed for"),
    );
    warnSpy.mockRestore();
  });

  it("edge case : OAuth credentials absents → isIndexingApiReady false → skip silencieux", async () => {
    isReadyMock.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // verticale implementation
    await loadAndRun({
      url: "https://axion-ia.com/fr/implementation/integration-ia-erp",
      type: "URL_DELETED",
    });

    expect(publishUrlMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("INDEXING_OAUTH_REFRESH_TOKEN ou GSC_OAUTH_CLIENT_* manquant"),
    );
    warnSpy.mockRestore();
  });

  it("edge case : kill-switch actif → 0 publish appelé, 0 readiness check", async () => {
    readConfigMock.mockResolvedValue({ active: true });

    // verticale interventions/formations
    await loadAndRun({
      url: "https://axion-ia.com/fr/interventions/formation-prompt-engineering",
      type: "URL_UPDATED",
    });

    expect(isReadyMock).not.toHaveBeenCalled();
    expect(publishUrlMock).not.toHaveBeenCalled();
  });
});
