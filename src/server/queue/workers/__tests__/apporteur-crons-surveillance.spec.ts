// #2464 point 5 : seul un passage SANS étape en erreur est horodaté ; le contrôle de fraîcheur
// tourne avec le passage de 5 minutes et ne fait jamais échouer les invitations.
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  quotidien: vi.fn(),
  facturation: vi.fn(),
  noter: vi.fn(),
  verifier: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(...a: unknown[]) {
      d.ctor(...a);
    }
    on(): this {
      return this;
    }
  },
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/features/commercial-application/invitation-auto", () => ({
  passerInvitationsAuto: vi.fn(async () => ({
    fichesCreees: 0,
    envoyees: 0,
    ecartees: {},
    aReessayer: 0,
  })),
}));
vi.mock("@/features/commercial-application/archivage-auto-apporteurs", () => ({
  archiverApporteursTermines: vi.fn(async () => ({ archivees: 0, desarchivees: 0 })),
}));
vi.mock("@/features/apporteurs-reseau/passage-quotidien", () => ({
  passerReseauApporteurs: (...a: unknown[]) => d.quotidien(...a),
  passerFacturationApporteurs: (...a: unknown[]) => d.facturation(...a),
}));
vi.mock("@/features/apporteurs-reseau/surveillance-passages", () => ({
  noterPassageReussi: (...a: unknown[]) => d.noter(...a),
  verifierPassages: (...a: unknown[]) => d.verifier(...a),
}));

import { startApporteurCronsWorker } from "../apporteur-crons-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;
// Le worker est un singleton : le processeur se capture à la première construction.
let capture: Processeur | null = null;
const proc = (): Processeur => {
  startApporteurCronsWorker();
  if (d.ctor.mock.calls.length > 0) capture = d.ctor.mock.calls.at(-1)?.[1] as Processeur;
  return capture as Processeur;
};

beforeEach(() => {
  process.env["REDIS_URL"] = "redis://doublure:6379";
  for (const f of Object.values(d)) if (f !== d.ctor) f.mockReset();
  d.verifier.mockResolvedValue([]);
});

describe("horodatage du dernier passage réussi", () => {
  it("quotidien sans erreur : noté ; avec erreur : pas noté", async () => {
    d.quotidien.mockResolvedValueOnce({ erreurs: 0 });
    await proc()({ name: "reseau-quotidien", data: { type: "reseau-quotidien" } });
    expect(d.noter).toHaveBeenCalledWith("reseau-quotidien");
    d.noter.mockClear();
    d.quotidien.mockResolvedValueOnce({ erreurs: 1 });
    await proc()({ name: "reseau-quotidien", data: { type: "reseau-quotidien" } });
    expect(d.noter).not.toHaveBeenCalled();
  });
  it("facturation : même règle", async () => {
    d.facturation.mockResolvedValueOnce({ erreurs: 0 });
    await proc()({ name: "reseau-facturation", data: { type: "reseau-facturation" } });
    expect(d.noter).toHaveBeenCalledWith("reseau-facturation");
    d.noter.mockClear();
    d.facturation.mockResolvedValueOnce({ erreurs: 2 });
    await proc()({ name: "reseau-facturation", data: { type: "reseau-facturation" } });
    expect(d.noter).not.toHaveBeenCalled();
  });
});

describe("contrôle de fraîcheur", () => {
  it("tourne avec invitation-auto, et sa panne ne fait pas échouer le passage", async () => {
    await proc()({ name: "invitation-auto", data: { type: "invitation-auto" } });
    expect(d.verifier).toHaveBeenCalledTimes(1);
    d.verifier.mockRejectedValueOnce(new Error("redis"));
    await expect(
      proc()({ name: "invitation-auto", data: { type: "invitation-auto" } }),
    ).resolves.toBeUndefined();
  });
});
