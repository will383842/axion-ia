// La file `apporteur-crons` porte deux passages depuis le 2026-09-27 : les
// rappels de l'invitation (08:00 UTC) et le relevé des réponses Zoho (toutes
// les 15 minutes). Le processeur les aiguille par le NOM du job — un relevé
// qui lancerait les rappels toutes les 15 minutes, ou l'inverse, ne se verrait
// nulle part ailleurs.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  relances: vi.fn(),
  reponses: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(...args: unknown[]) {
      d.ctor(...args);
    }
    on(): this {
      return this;
    }
  },
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/features/commercial-application/relances-invitation-apporteur", () => ({
  passerRelancesInvitation: (...a: unknown[]) => d.relances(...a),
}));
vi.mock("@/features/commercial-application/reponses-entrantes-apporteur", () => ({
  passerReponsesEntrantes: (...a: unknown[]) => d.reponses(...a),
}));

import { startApporteurCronsWorker } from "../apporteur-crons-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

beforeEach(() => {
  process.env["REDIS_URL"] = "redis://doublure:6379";
  d.relances.mockResolvedValue({ personnes: 0, envoyees: { j3: 0, j7: 0 }, ecartees: {} });
  d.reponses.mockResolvedValue({
    lus: 0,
    reconnus: 0,
    enregistrees: { humaines: 0, automatiques: 0 },
    dejaConnues: 0,
    erreurs: 0,
  });
});

function processeur(): Processeur {
  startApporteurCronsWorker();
  return d.ctor.mock.calls.at(-1)?.[1] as Processeur;
}

describe("🔴 l'aiguillage de la file apporteur-crons", () => {
  it("un job `reponses-entrantes` relève les réponses, et ne lance PAS les rappels", async () => {
    await processeur()({ name: "reponses-entrantes", data: { type: "reponses-entrantes" } });
    expect(d.reponses).toHaveBeenCalledTimes(1);
    expect(d.relances).not.toHaveBeenCalled();
  });

  it("un job `relance-invitation` lance les rappels, et ne relève pas Zoho", async () => {
    d.reponses.mockClear();
    d.relances.mockClear();
    await processeur()({ name: "relance-invitation", data: { type: "relance-invitation" } });
    expect(d.relances).toHaveBeenCalledTimes(1);
    expect(d.reponses).not.toHaveBeenCalled();
  });

  it("le programme pose le relevé toutes les 15 minutes, jobId stable, à côté des rappels", () => {
    const queues = readFileSync(join(process.cwd(), "src/server/queue/queues.ts"), "utf8");
    expect(queues).toMatch(/PATTERN_REPONSES_ENTRANTES = "\*\/15 \* \* \* \*"/);
    expect(queues).toMatch(
      /type: "reponses-entrantes" as const,\s*pattern: PATTERN_REPONSES_ENTRANTES,\s*jobId: "apporteur-reponses-entrantes-cron"/,
    );
    expect(queues).toMatch(/jobId: "apporteur-relance-invitation-cron"/);
  });
});
