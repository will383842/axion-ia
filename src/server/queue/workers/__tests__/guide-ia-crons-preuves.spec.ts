// @vitest-environment node
//
// Le passage « preuves » du worker guide-ia-crons : il appelle la mise à l'écart et la
// réparation du registre, et JAMAIS le rattrapage des guides (le type inconnu y retombait avant).

import { beforeEach, describe, expect, it, vi } from "vitest";

const bd = vi.hoisted(() => ({
  processeur: null as null | ((job: unknown) => Promise<void>),
  appels: [] as string[],
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_nom: string, processeur: (job: unknown) => Promise<void>) {
      bd.processeur = processeur;
    }
    on() {
      return this;
    }
    async close() {}
  },
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: () => {} }));
vi.mock("@/server/guides-reseau/preuve-page-guide", () => ({
  ecarterPreuvesNonVerifiees: async () => {
    bd.appels.push("ecarter");
    return { lignes: 0, sansAdresse: 0, colonneAbsente: false };
  },
  reparerRegistrePreuves: async () => {
    bd.appels.push("reparer");
    return 0;
  },
}));
vi.mock("@/server/guide-ia/rattrapage", () => ({
  rattraperGuides: async () => {
    bd.appels.push("rattrapage");
    return { suspendu: false, candidates: 0, confirmationsRelancees: 0 };
  },
}));

beforeEach(() => {
  bd.appels.length = 0;
  process.env["REDIS_URL"] = "redis://stub.invalid:6379";
});

describe("worker guide-ia-crons — type « preuves »", () => {
  it("🔴 écarte puis répare, sans jamais lancer le rattrapage", async () => {
    const { startGuideIaCronsWorker } = await import("../guide-ia-crons-worker");
    startGuideIaCronsWorker();
    await bd.processeur!({ data: { type: "preuves" }, name: "preuves" });
    expect(bd.appels).toEqual(["ecarter", "reparer"]);
  });

  it("le rattrapage horaire reste inchangé", async () => {
    const { startGuideIaCronsWorker } = await import("../guide-ia-crons-worker");
    startGuideIaCronsWorker();
    await bd.processeur!({ data: { type: "rattrapage" }, name: "rattrapage" });
    expect(bd.appels).toEqual(["rattrapage"]);
  });
});

describe("répétable quotidien", () => {
  it("posé dans queues.ts avec le motif et le jobId du plan, par le même bloc remove + add", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/server/queue/queues.ts", "utf8");
    expect(src).toContain('"guides-reseau-preuves-cron"');
    expect(src.match(/pattern: "23 4 \* \* \*"/g)?.length).toBe(2); // removeRepeatable + add
    expect(src).toMatch(/removeRepeatable\(\s*"preuves"/);
  });
});
