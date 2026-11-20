// OUT-1 — un envoi approuvé depuis la corbeille ne peut jamais produire deux tâches.
//
// Redis coupé : `emailsQueue.add` attendait sans limite (file hors ligne d'ioredis, `maxRetriesPerRequest:
// null`), la transaction qui enfile se fermait, l'approbation était « abandonnée » au bout de 15 min,
// puis une 2e approbation enfilait SOUS UN AUTRE identifiant (`email-<uuid>`) : deux tâches, deux e-mails.
//
// Ici : la file refuse d'attendre, l'identifiant est celui de la ligne, et une issue inconnue est dite
// inconnue. Prisma, la file et la connexion sont simulés ; aucun e-mail réel.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  add: vi.fn(),
  getJob: vi.fn(),
  waitUntilReady: vi.fn(),
  connexion: { status: "ready" } as { status: string },
  journalCree: vi.fn(),
  marquerEchec: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Queue: class {
    readonly name: string;
    constructor(name: string) {
      this.name = name;
    }
    add = d.add;
    getJob = d.getJob;
    waitUntilReady = d.waitUntilReady;
    removeRepeatable = vi.fn();
    getRepeatableJobs = vi.fn().mockResolvedValue([]);
  },
}));
vi.mock("../connection", () => ({
  getBullConnection: () => d.connexion,
  getBullConnectionOrThrow: () => d.connexion,
  isBullmqDisabled: () => false,
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
vi.mock("@/server/email/email-log", () => ({
  journaliserEnAttente: async (e: unknown) => {
    d.journalCree(e);
    return "log-1";
  },
  marquerEchecMiseEnFile: (...a: unknown[]) => d.marquerEchec(...a),
}));

import { enqueueEmail, FileInjoignable, MiseEnFileIncertaine } from "../queues";

const CLE = "outbox-11111111-1111-4111-8111-111111111111";

/**
 * Avance l'horloge simulée par pas d'une seconde, en laissant la vraie boucle d'événements poser les
 * minuteries entre deux pas, jusqu'à ce que `p` soit réglée. `ms` : temps simulé attendu (documentaire).
 */
async function avancer(p: Promise<unknown>, _ms: number) {
  let reglee = false;
  void p.then(
    () => (reglee = true),
    () => (reglee = true),
  );
  for (let tour = 0; tour < 20_000 && !reglee; tour += 1) {
    await new Promise((r) => setImmediate(r));
    await vi.advanceTimersByTimeAsync(1_000);
  }
}

function approuver() {
  return enqueueEmail(
    "devis-envoi" as never,
    "client@exemple.fr",
    "fr",
    {},
    { bypassValidation: true, cleOutbox: CLE },
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  d.connexion.status = "ready";
  d.add.mockReset().mockResolvedValue({ id: CLE });
  d.getJob.mockReset().mockResolvedValue(undefined);
  d.waitUntilReady.mockReset().mockResolvedValue(undefined);
  d.journalCree.mockReset();
  d.marquerEchec.mockReset();
  delete process.env["DATABASE_URL"];
});
afterEach(() => {
  vi.useRealTimers();
});

describe("OUT-1 — la file injoignable n'avale rien", () => {
  it("connexion « reconnecting » : FileInjoignable, `add` jamais appelé, aucune ligne de journal", async () => {
    d.connexion.status = "reconnecting";
    d.waitUntilReady.mockReturnValue(new Promise(() => {})); // Redis ne revient pas
    const p = approuver();
    const verdict = expect(p).rejects.toBeInstanceOf(FileInjoignable);
    await avancer(p, 5_000);
    await verdict;
    expect(d.add).not.toHaveBeenCalled();
    expect(d.journalCree).not.toHaveBeenCalled();
  });

  it("file prête à l'appel mais connexion retombée entre-temps : même refus, rien n'entre", async () => {
    d.connexion.status = "reconnecting"; // waitUntilReady répond, le statut dit le contraire
    await expect(approuver()).rejects.toBeInstanceOf(FileInjoignable);
    expect(d.add).not.toHaveBeenCalled();
    expect(d.journalCree).not.toHaveBeenCalled();
  });

  it("`add` qui ne se résout jamais : MiseEnFileIncertaine à 20 s, la ligne du journal n'est pas close en échec", async () => {
    d.add.mockReturnValue(new Promise(() => {}));
    const p = approuver();
    const verdict = expect(p).rejects.toBeInstanceOf(MiseEnFileIncertaine);
    await avancer(p, 20_000);
    await verdict;
    expect(d.journalCree).toHaveBeenCalledTimes(1);
    expect(d.marquerEchec).not.toHaveBeenCalled();
  });

  it("`add` qui lève : l'échec reste un échec (ligne close, erreur inchangée)", async () => {
    d.add.mockRejectedValue(new Error("boum"));
    await expect(approuver()).rejects.toThrow("boum");
    expect(d.marquerEchec).toHaveBeenCalledTimes(1);
  });
});

describe("OUT-1 — un identifiant, une tâche", () => {
  it("tâche `failed` existante : retirée, puis `add` sous l'identifiant de la ligne (le « Réessayer »)", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    d.getJob.mockResolvedValue({ getState: async () => "failed", remove });
    const r = await approuver();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(d.add).toHaveBeenCalledTimes(1);
    expect(d.add.mock.calls[0]?.[2]).toMatchObject({ jobId: CLE });
    expect(r).toEqual({ enqueued: true });
  });

  it("tâche `completed` existante : aucun `add`, rendue « déjà en file »", async () => {
    const remove = vi.fn();
    d.getJob.mockResolvedValue({ getState: async () => "completed", remove });
    const r = await approuver();
    expect(d.add).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(r).toEqual({ enqueued: true, dejaEnFile: true });
    expect(d.journalCree).not.toHaveBeenCalled();
  });

  it("deux approbations successives de la même ligne : les deux `add` portent le même identifiant", async () => {
    await approuver();
    await approuver();
    expect(d.add).toHaveBeenCalledTimes(2);
    const ids = d.add.mock.calls.map((c) => (c[2] as { jobId: string }).jobId);
    expect(ids).toEqual([CLE, CLE]);
  });

  it("sans `cleOutbox` : comportement d'avant (identifiant `email-<uuid>`, aucune lecture de la file)", async () => {
    await enqueueEmail(
      "devis-envoi" as never,
      "client@exemple.fr",
      "fr",
      {},
      {
        bypassValidation: true,
      },
    );
    expect(d.getJob).not.toHaveBeenCalled();
    expect((d.add.mock.calls[0]?.[2] as { jobId: string }).jobId).toMatch(/^email-/);
  });
});
