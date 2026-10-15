// V1-C-11 — un envoi, UNE ligne au journal des envois.
//
// `enqueueEmail` posait le job en file PUIS écrivait la ligne « en attente ». Un worker
// qui terminait l'envoi entre les deux ne trouvait aucune ligne à clore : il créait la
// sienne (« envoyé »), puis l'enfilage créait la seconde, restée « en attente » pour
// toujours. Les relances qui comptent ces lignes (F34, F40/F41) pouvaient sauter un rappel.
//
// Le correctif : l'identifiant du job est fixé AVANT la mise en file, et la ligne est
// écrite d'abord. Ce test garde l'ordre et l'identifiant, pour TOUS les e-mails du site —
// clients, apporteurs, formateurs —, puisque `enqueueEmail` est leur seul chemin.

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  ordre: [] as string[],
  add: vi.fn(),
  journaliser: vi.fn(),
  annuler: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Queue: class {
    readonly name: string;
    constructor(name: string) {
      this.name = name;
    }
    add = d.add;
    removeRepeatable = vi.fn();
    getRepeatableJobs = vi.fn().mockResolvedValue([]);
  },
}));
vi.mock("../connection", () => ({
  getBullConnection: () => ({ host: "doublure" }),
  getBullConnectionOrThrow: () => ({ host: "doublure" }),
  isBullmqDisabled: () => false,
}));
vi.mock("@/server/email/outbox-service", () => ({
  resoudreMode: vi.fn(async () => "auto"),
  garerPourValidation: vi.fn(),
}));
vi.mock("@/server/email/suppression", () => ({
  verdictAvantEnvoi: vi.fn(async () => ({ retenu: false })),
  signalerRetenue: vi.fn(),
}));
vi.mock("@/server/email/email-log", () => ({
  journaliserEnAttente: (...a: unknown[]) => d.journaliser(...a),
  marquerAnnule: (...a: unknown[]) => d.annuler(...a),
}));

import { enqueueEmail } from "../queues";

type OptionsAdd = { jobId?: string; delay?: number; priority?: number } | undefined;

beforeEach(() => {
  d.ordre = [];
  d.add.mockReset().mockImplementation(async (_n: string, _data: unknown, o: OptionsAdd) => {
    d.ordre.push("file");
    return { id: o?.jobId ?? "1" };
  });
  d.journaliser.mockReset().mockImplementation(async () => {
    d.ordre.push("journal");
    return true;
  });
  d.annuler.mockReset().mockResolvedValue(1);
});

describe("V1-C-11 — la ligne « en attente » est écrite AVANT la mise en file", () => {
  // Une famille de chaque : client, apporteur, formateur indépendant, interne.
  it.each([
    ["facture-envoi", "client@exemple.fr"],
    ["apporteur-invitation-relance", "apporteur@exemple.fr"],
    ["formateur-contresignature", "formateur@exemple.fr"],
    ["contact-confirmed", "visiteur@exemple.fr"],
  ] as const)("%s : journal, puis file, sous le MÊME identifiant", async (gabarit, to) => {
    const r = await enqueueEmail(gabarit as never, to, "fr", {});
    expect(r).toEqual({ enqueued: true });
    expect(d.ordre).toEqual(["journal", "file"]);
    const jobIdJournal = (d.journaliser.mock.calls[0]![0] as { jobId?: string }).jobId;
    const jobIdFile = (d.add.mock.calls[0]![2] as OptionsAdd)?.jobId;
    expect(jobIdJournal).toEqual(expect.any(String));
    expect(jobIdFile).toBe(jobIdJournal);
    // BullMQ refuse « : » et les identifiants entiers.
    expect(jobIdFile).not.toContain(":");
    expect(String(Number(jobIdFile))).not.toBe(jobIdFile);
  });

  it("deux envois sans clé d'idempotence ont deux identifiants distincts", async () => {
    await enqueueEmail("contact-confirmed", "a@exemple.fr", "fr", {});
    await enqueueEmail("contact-confirmed", "a@exemple.fr", "fr", {});
    const [a, b] = d.add.mock.calls.map((c) => (c[2] as OptionsAdd)?.jobId);
    expect(a).not.toBe(b);
  });

  it("la clé d'idempotence de l'appelant est gardée telle quelle", async () => {
    await enqueueEmail(
      "qualiopi-convocation" as never,
      "s@exemple.fr",
      "fr",
      {},
      {
        jobId: "qualiopi-convocation-42-2026-10-15",
        delayMs: 60_000,
        priority: 5,
      },
    );
    expect(d.ordre).toEqual(["journal", "file"]);
    expect(d.journaliser).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "qualiopi-convocation-42-2026-10-15" }),
    );
    expect(d.add).toHaveBeenCalledWith("qualiopi-convocation", expect.anything(), {
      jobId: "qualiopi-convocation-42-2026-10-15",
      delay: 60_000,
      priority: 5,
    });
  });

  it("file injoignable : la ligne posée par CET enfilage est close, l'erreur remonte", async () => {
    d.add.mockRejectedValue(new Error("Redis coupé"));
    await expect(enqueueEmail("facture-envoi", "c@exemple.fr", "fr", {})).rejects.toThrow(
      "Redis coupé",
    );
    const jobId = (d.journaliser.mock.calls[0]![0] as { jobId: string }).jobId;
    expect(d.annuler).toHaveBeenCalledWith(jobId, expect.stringMatching(/mise en file/i));
  });

  it("file injoignable, ligne déjà là (même clé, autre enfilage) : on n'y touche pas", async () => {
    d.journaliser.mockResolvedValue(false);
    d.add.mockRejectedValue(new Error("Redis coupé"));
    await expect(
      enqueueEmail("facture-envoi", "c@exemple.fr", "fr", {}, { jobId: "cle-1" }),
    ).rejects.toThrow();
    expect(d.annuler).not.toHaveBeenCalled();
  });

  it("submission-reply garde son suivi propre : ni journal, ni identifiant fabriqué", async () => {
    await enqueueEmail("submission-reply" as never, "", "fr", {});
    expect(d.journaliser).not.toHaveBeenCalled();
    expect(d.add).toHaveBeenCalledWith("submission-reply", expect.anything(), undefined);
  });
});
