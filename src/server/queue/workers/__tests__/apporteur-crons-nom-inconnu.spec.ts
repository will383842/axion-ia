// Lot 0 du relevé mensuel des apporteurs : un job de la file `apporteur-crons` dont le nom n'est
// pas connu ne doit PAS retomber sur les rappels d'invitation (arrêtés le 26/10). Il est
// journalisé et ignoré. Un ancien worker qui recevrait un futur nom (`releve-mensuel`) ne doit
// rien exécuter.

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  relances: vi.fn(),
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

import { NOMS_CONNUS, startApporteurCronsWorker } from "../apporteur-crons-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

function processeur(): Processeur {
  startApporteurCronsWorker();
  return d.ctor.mock.calls.at(-1)?.[1] as Processeur;
}

beforeEach(() => {
  process.env["REDIS_URL"] = "redis://doublure:6379";
  d.relances.mockReset();
  d.relances.mockResolvedValue({ personnes: 0, envoyees: { j3: 0, j7: 0 }, ecartees: {} });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("🔴 apporteur-crons : un nom inconnu est ignoré", () => {
  it("un nom inconnu n'exécute PAS les rappels d'invitation, et le dit au journal", async () => {
    await expect(
      processeur()({ name: "releve-mensuel", data: { type: "releve-mensuel" } }),
    ).resolves.toBeUndefined();
    expect(d.relances).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("releve-mensuel"));
  });

  it("un job sans nom connu ni type n'exécute pas les rappels non plus", async () => {
    await processeur()({ name: "autre-chose", data: {} });
    expect(d.relances).not.toHaveBeenCalled();
  });

  it("`relance-invitation` exact exécute les rappels", async () => {
    await processeur()({ name: "relance-invitation", data: { type: "relance-invitation" } });
    expect(d.relances).toHaveBeenCalledTimes(1);
  });
});

describe("🔴 apporteur-crons : la liste des noms connus est liée au type", () => {
  it("la liste exportée couvre chaque `ApporteurCronJobType` (le typecheck casse si un type manque)", () => {
    expect([...NOMS_CONNUS].sort()).toEqual(
      [
        "invitation-auto",
        "relance-invitation",
        "reponses-entrantes",
        "reseau-facturation",
        "reseau-quotidien",
      ].sort(),
    );
  });
});
