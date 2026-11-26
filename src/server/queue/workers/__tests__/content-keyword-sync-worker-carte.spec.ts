/**
 * Interrupteur CONTENT_EQUIPE_EDITORIALE sur le worker de synchro des
 * mots-clés : éteint = aucune lecture de la carte ; allumé ("true" exactement)
 * = carte reconstruite et journalisée, sans jamais faire échouer le run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { chargerMock, capturedProcessor } = vi.hoisted(() => ({
  chargerMock: vi.fn(),
  capturedProcessor: { current: null as null | ((job: unknown) => Promise<void>) },
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation((_n: string, p: (job: unknown) => Promise<void>) => {
    capturedProcessor.current = p;
    return { on: vi.fn(), close: vi.fn() };
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { article: { findMany: vi.fn().mockResolvedValue([]) } },
}));
vi.mock("@/server/content-gen/indexing/url-builder", () => ({ buildArticleUrl: () => "u" }));
vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: vi.fn().mockResolvedValue({ active: false }),
}));
vi.mock("@/server/content-gen/seo/gsc-client", () => ({ gscTopKeywordsForUrl: vi.fn() }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/content-gen/strategie/carte-requetes-source", () => ({
  chargerCarteRequetes: chargerMock,
  equipeEditorialeActive: () => process.env.CONTENT_EQUIPE_EDITORIALE === "true",
}));

const spies: Array<{ mockRestore: () => void }> = [];

async function run(): Promise<void> {
  const mod = await import("../content-keyword-sync-worker");
  process.env.REDIS_URL = "redis://stub.invalid:6379";
  mod.startKeywordSyncWorker();
  await capturedProcessor.current!({ id: "j", data: { trigger: "test" } });
  await mod.stopKeywordSyncWorker();
}

describe("content-keyword-sync-worker — interrupteur équipe éditoriale", () => {
  beforeEach(() => {
    vi.resetModules();
    chargerMock
      .mockReset()
      .mockResolvedValue({ carte: new Map([["a", "u"]]), cannibalisations: [] });
    spies.push(
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    );
  });
  afterEach(() => {
    delete process.env.CONTENT_EQUIPE_EDITORIALE;
    for (const s of spies.splice(0)) s.mockRestore();
  });

  it("éteint (absent) : la carte n'est pas lue", async () => {
    await run();
    expect(chargerMock).not.toHaveBeenCalled();
  });

  it('valeur autre que "true" : la carte n\'est pas lue', async () => {
    process.env.CONTENT_EQUIPE_EDITORIALE = "1";
    await run();
    expect(chargerMock).not.toHaveBeenCalled();
  });

  it('"true" : la carte est lue', async () => {
    process.env.CONTENT_EQUIPE_EDITORIALE = "true";
    await run();
    expect(chargerMock).toHaveBeenCalledTimes(1);
  });

  it("une erreur de lecture de la carte ne fait pas échouer le run", async () => {
    process.env.CONTENT_EQUIPE_EDITORIALE = "true";
    chargerMock.mockRejectedValue(new Error("db"));
    await expect(run()).resolves.toBeUndefined();
  });
});
