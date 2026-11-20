// OUT-1 — un envoi approuvé depuis la corbeille ne produit jamais deux tâches, même si Redis
// tombe : l'identifiant de tâche est `outbox-<id>`, la file doit répondre AVANT tout, et un
// ajout sans réponse est une issue INCONNUE (jamais un échec).

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  statut: { v: "ready" as string },
  add: vi.fn(),
  getJob: vi.fn(),
  prete: vi.fn(),
  journaliser: vi.fn(),
  echec: vi.fn(),
  dernier: { v: null as null | { id: string; status: string; error: string | null } },
}));

vi.mock("bullmq", () => ({
  Queue: class {
    readonly name: string;
    constructor(name: string) {
      this.name = name;
    }
    add = d.add;
    getJob = d.getJob;
    waitUntilReady = d.prete;
    removeRepeatable = vi.fn();
    getRepeatableJobs = vi.fn().mockResolvedValue([]);
  },
}));
vi.mock("../connection", () => ({
  getBullConnection: () => ({ status: d.statut.v }),
  getBullConnectionOrThrow: () => ({ status: d.statut.v }),
  isBullmqDisabled: () => false,
}));
vi.mock("@/server/email/email-log", () => ({
  journaliserEnAttente: (...a: unknown[]) => d.journaliser(...a),
  marquerEchecMiseEnFile: (...a: unknown[]) => d.echec(...a),
  lireDernierJournal: async () => d.dernier.v,
}));
vi.mock("@/server/email/outbox-service", () => ({
  resoudreMode: vi.fn(async () => "auto"),
  garerPourValidation: vi.fn(),
  jobIdDejaGare: vi.fn(async () => false),
}));
vi.mock("@/server/email/suppression", () => ({
  verdictAvantEnvoi: vi.fn(async () => ({ retenu: false })),
  signalerRetenue: vi.fn(),
}));

import { enqueueEmail, FileInjoignable, MiseEnFileIncertaine } from "../queues";

const ID = "ligne-42";
const CLE = `outbox-${ID}`;

const envoyer = () =>
  enqueueEmail(
    "devis-envoi" as never,
    "client@exemple.fr",
    "fr",
    {},
    {
      bypassValidation: true,
      cleOutbox: CLE,
    },
  );

beforeEach(() => {
  vi.useRealTimers();
  d.statut.v = "ready";
  d.add.mockReset().mockResolvedValue({ id: CLE });
  d.getJob.mockReset().mockResolvedValue(undefined);
  d.prete.mockReset().mockResolvedValue(undefined);
  d.journaliser.mockReset().mockResolvedValue("log-1");
  d.echec.mockReset();
  d.dernier.v = null;
  delete process.env["DATABASE_URL"];
});

describe("OUT-1 — file d'envoi de la corbeille", () => {
  it("connexion qui se reconnecte : FileInjoignable, rien dans la file, aucune ligne de journal", async () => {
    d.statut.v = "reconnecting";
    await expect(envoyer()).rejects.toBeInstanceOf(FileInjoignable);
    expect(d.add).not.toHaveBeenCalled();
    expect(d.journaliser).not.toHaveBeenCalled();
  });

  it("file jamais prête (5 s) : FileInjoignable, aucun ajout", async () => {
    vi.useFakeTimers();
    d.prete.mockReturnValue(new Promise(() => {}));
    const p = envoyer();
    const verdict = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5_001);
    expect(await verdict).toBeInstanceOf(FileInjoignable);
    expect(d.add).not.toHaveBeenCalled();
    expect(d.journaliser).not.toHaveBeenCalled();
  });

  it("ajout sans réponse : MiseEnFileIncertaine à 20 s, la ligne n'est PAS close en échec", async () => {
    vi.useFakeTimers();
    d.add.mockReturnValue(new Promise(() => {}));
    const verdict = envoyer().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(20_001);
    expect(await verdict).toBeInstanceOf(MiseEnFileIncertaine);
    expect(d.echec).not.toHaveBeenCalled();
    expect(d.journaliser).toHaveBeenCalledTimes(1);
  });

  it("tâche échouée (« Réessayer ») : retirée, puis ajoutée sous outbox-<id>", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    d.getJob.mockResolvedValue({ getState: async () => "failed", remove });
    const r = await envoyer();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(d.add).toHaveBeenCalledTimes(1);
    expect(d.add.mock.calls[0]?.[2]).toMatchObject({ jobId: CLE });
    expect(r).toEqual({ enqueued: true });
  });

  it("tâche déjà là (terminée) : rien n'est ajouté, dejaEnFile", async () => {
    d.getJob.mockResolvedValue({ getState: async () => "completed", remove: vi.fn() });
    const r = await envoyer();
    expect(r).toEqual({ enqueued: true, dejaEnFile: true });
    expect(d.add).not.toHaveBeenCalled();
    expect(d.journaliser).not.toHaveBeenCalled();
  });

  it("deux approbations successives de la même ligne : les deux ajouts portent le même jobId", async () => {
    await envoyer();
    await envoyer();
    expect(d.add).toHaveBeenCalledTimes(2);
    expect(d.add.mock.calls[0]?.[2]).toMatchObject({ jobId: CLE });
    expect(d.add.mock.calls[1]?.[2]).toMatchObject({ jobId: CLE });
  });
});

describe("OUT-1 — sonde de la file avant tout ajout", () => {
  it("`getJob` qui ne répond jamais : FileInjoignable en moins de 10 s, `add` jamais appelé", async () => {
    vi.useFakeTimers();
    d.getJob.mockReturnValue(new Promise(() => {}));
    const debut = Date.now();
    const verdict = envoyer().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await verdict).toBeInstanceOf(FileInjoignable);
    expect(Date.now() - debut).toBeLessThanOrEqual(10_000);
    expect(d.add).not.toHaveBeenCalled();
    expect(d.journaliser).not.toHaveBeenCalled();
  });

  it("tâche absente (purgée) + dernier journal `sent` : dejaEnFile, ni `add` ni ligne de journal", async () => {
    d.getJob.mockResolvedValue(undefined);
    d.dernier.v = { id: "log-0", status: "sent", error: null };
    const r = await envoyer();
    expect(r).toEqual({ enqueued: true, dejaEnFile: true });
    expect(d.add).not.toHaveBeenCalled();
    expect(d.journaliser).not.toHaveBeenCalled();
  });
});
