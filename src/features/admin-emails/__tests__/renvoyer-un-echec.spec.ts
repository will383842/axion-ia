// « Renvoyer » depuis le journal — lot 3 (2026-09-02).
//
// Gardé : seul un échec se rejoue ; le job BullMQ est repris tel quel et la
// ligne repasse « en attente » (une seule ligne par job, lot 2) ; les cas
// impossibles rendent un motif lisible, jamais un faux succès.

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  getJob: vi.fn(),
  requireAdminWrite: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findUnique: (...a: unknown[]) => d.findUnique(...a),
      update: (...a: unknown[]) => d.update(...a),
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: (...a: unknown[]) => d.requireAdminWrite(...a),
}));
vi.mock("@/server/queue/queues", () => ({
  emailsQueue: { getJob: (...a: unknown[]) => d.getJob(...a) },
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => d.revalidatePath(...a) }));

import { renvoyerEmailAction } from "../actions";

const ID = "6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const LIGNE = { id: ID, status: "failed", jobId: "job-42", template: "x", recipient: "a@b.fr" };

beforeEach(() => {
  vi.clearAllMocks();
  d.requireAdminWrite.mockResolvedValue({ userId: "u1" });
  d.findUnique.mockResolvedValue(LIGNE);
  d.update.mockResolvedValue({});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("renvoyerEmailAction", () => {
  it("🔴 reprend le job BullMQ en échec et repasse la ligne « en attente »", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    d.getJob.mockResolvedValue({ getState: async () => "failed", retry });
    const r = await renvoyerEmailAction({ id: ID });
    expect(r).toEqual({ ok: true, jobId: "job-42" });
    expect(d.getJob).toHaveBeenCalledWith("job-42");
    expect(retry).toHaveBeenCalledTimes(1);
    expect(d.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { status: "pending", failedAt: null },
    });
  });

  it("exige un administrateur en écriture avant tout", async () => {
    d.requireAdminWrite.mockRejectedValue(new Error("interdit"));
    await expect(renvoyerEmailAction({ id: ID })).rejects.toThrow("interdit");
    expect(d.getJob).not.toHaveBeenCalled();
  });

  it("refuse une ligne qui n'est pas en échec", async () => {
    d.findUnique.mockResolvedValue({ ...LIGNE, status: "sent" });
    const r = await renvoyerEmailAction({ id: ID });
    expect(r).toEqual({ ok: false, error: "Seul un envoi en échec se rejoue." });
    expect(d.getJob).not.toHaveBeenCalled();
  });

  it("dit quand le job a été purgé de la file, sans faux succès", async () => {
    d.getJob.mockResolvedValue(null);
    const r = await renvoyerEmailAction({ id: ID });
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toContain("purgé");
    expect(d.update).not.toHaveBeenCalled();
  });

  it("ne rejoue pas un job qui n'est pas en échec côté BullMQ", async () => {
    const retry = vi.fn();
    d.getJob.mockResolvedValue({ getState: async () => "completed", retry });
    const r = await renvoyerEmailAction({ id: ID });
    expect(r.ok).toBe(false);
    expect(retry).not.toHaveBeenCalled();
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    const r = await renvoyerEmailAction({ id: "pas-un-uuid" });
    expect(r).toEqual({ ok: false, error: "Identifiant invalide." });
  });
});
