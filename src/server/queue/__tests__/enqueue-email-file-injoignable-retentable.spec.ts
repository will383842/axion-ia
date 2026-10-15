// Relecture de la PR #1537, point bloquant 1 — une file injoignable ne doit pas « consommer »
// une relance.
//
// Depuis V1-C-11, la ligne « en attente » est posée AVANT la mise en file. Si la file est
// injoignable, aucun job n'existe et la ligne doit être refermée. La refermer « annulé » la
// faisait compter comme une relance déjà tentée : `dejaTente` et les lecteurs des campagnes
// ne mettent de côté que `failed`. La relance portant cette clé ne repartait donc JAMAIS.
//
// Ce test branche le VRAI journal (`email-log.ts`), le VRAI `enqueueEmail` et le VRAI
// `dejaTente` sur une table en mémoire : c'est la chaîne complète qui doit tenir, pas un
// appel de doublure.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Ligne {
  id: string;
  jobId?: string;
  status: string;
  error?: string;
  failedAt?: Date;
  sentAt?: Date;
  [cle: string]: unknown;
}

const d = vi.hoisted(() => ({
  lignes: [] as Ligne[],
  add: vi.fn(),
}));

function correspond(l: Ligne, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([cle, attendu]) => {
    const valeur = l[cle];
    if (attendu !== null && typeof attendu === "object" && "not" in attendu) {
      return valeur !== (attendu as { not: unknown }).not;
    }
    return valeur === attendu;
  });
}

vi.mock("@/lib/prisma", () => {
  const emailLog = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      d.lignes.find((l) => correspond(l, where)) ?? null,
    create: async ({ data }: { data: Omit<Ligne, "id"> }) => {
      const ligne = { ...data, id: `log-${d.lignes.length + 1}` } as Ligne;
      d.lignes.push(ligne);
      return { id: ligne.id };
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Partial<Ligne>;
    }) => {
      const visees = d.lignes.filter((l) => correspond(l, where));
      for (const l of visees) Object.assign(l, data);
      return { count: visees.length };
    },
  };
  const prisma = {
    emailLog,
    $executeRaw: async () => 1,
    $transaction: (f: (tx: unknown) => unknown) => f(prisma),
  };
  return { prisma };
});

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
  // Corbeille de validation vide : seul le journal décide.
  jobIdDejaGare: vi.fn(async () => false),
}));
vi.mock("@/server/email/suppression", () => ({
  verdictAvantEnvoi: vi.fn(async () => ({ retenu: false })),
  signalerRetenue: vi.fn(),
}));

import { enqueueEmail } from "../queues";
import { cloturerJournal } from "@/server/email/email-log";
import { dejaTente } from "@/server/relances/passer-campagnes";

const CLE = "fi-f27-relance-1-lettre-42";

function relancer() {
  return enqueueEmail(
    "formateur-contresignature" as never,
    "formateur@exemple.fr",
    "fr",
    {},
    { jobId: CLE, priority: 10 },
  );
}

beforeEach(() => {
  d.lignes = [];
  d.add.mockReset().mockResolvedValue({ id: CLE });
  delete process.env["DATABASE_URL"];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("file injoignable — la relance reste à faire", () => {
  it("l'erreur de la file remonte à l'appelant, telle quelle", async () => {
    const panne = new Error("Redis coupé");
    d.add.mockRejectedValue(panne);
    await expect(relancer()).rejects.toBe(panne);
  });

  it("la ligne posée est close en échec, pas « annulé » : dejaTente rend false", async () => {
    d.add.mockRejectedValue(new Error("Redis coupé"));
    await expect(relancer()).rejects.toThrow();

    expect(d.lignes).toHaveLength(1);
    expect(d.lignes[0]).toMatchObject({
      jobId: CLE,
      status: "failed",
      error: expect.stringMatching(/mise en file/i),
      failedAt: expect.any(Date),
    });
    expect(await dejaTente(CLE)).toBe(false);
  });

  it("le passage suivant retente sous la même clé, et l'envoi se lit alors une fois", async () => {
    d.add.mockRejectedValueOnce(new Error("Redis coupé"));
    await expect(relancer()).rejects.toThrow();
    expect(await dejaTente(CLE)).toBe(false);

    // Redis est revenu : le passage suivant retente.
    await expect(relancer()).resolves.toEqual({ enqueued: true });
    expect(d.add).toHaveBeenCalledTimes(2);
    expect(d.add.mock.calls[1]![2]).toMatchObject({ jobId: CLE });

    // Le worker clôt l'envoi : une seule ligne, « envoyé », et la relance est faite.
    await cloturerJournal({
      template: "formateur-contresignature",
      recipient: "formateur@exemple.fr",
      locale: "fr",
      marketing: false,
      jobId: CLE,
      attempts: 1,
      status: "sent",
      sentAt: new Date(),
    });
    expect(d.lignes).toHaveLength(1);
    expect(d.lignes[0]!.status).toBe("sent");
    expect(await dejaTente(CLE)).toBe(true);
  });

  it("la clôture ne touche QUE la ligne de cet enfilage, pas une autre ligne de la clé", async () => {
    // Une ligne « en attente » d'un autre enfilage de la même clé, dont le job vit.
    d.lignes.push({ id: "log-autre", jobId: CLE, status: "pending" });
    d.add.mockRejectedValue(new Error("Redis coupé"));
    await expect(relancer()).rejects.toThrow();
    // Cet enfilage n'a rien posé (la ligne existait) : il ne referme rien.
    expect(d.lignes).toEqual([{ id: "log-autre", jobId: CLE, status: "pending" }]);
  });
});
