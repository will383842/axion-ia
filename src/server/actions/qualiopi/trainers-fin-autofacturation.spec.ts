/**
 * Lot E (M14) — `updateTrainerFacturationAction` : F46 ne part qu'à la PREMIÈRE saisie
 * d'une date de révocation du mandat ; une correction de date ou une autre saisie
 * n'annonce rien.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ trainer: { findUnique: vi.fn(), update: vi.fn() } }));
const annoncer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireAdminDelete: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/formateurs-independants/fin-autofacturation", () => ({
  annoncerFinAutofacturation: annoncer,
}));

import { updateTrainerFacturationAction } from "./trainers";

const ID = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";
const SIGNE = new Date("2026-01-10T00:00:00Z");
const REVOQUE = new Date("2026-10-12T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  db.trainer.update.mockResolvedValue({ id: ID });
  annoncer.mockResolvedValue("envoi");
});

describe("révocation du mandat d'autofacturation → F46", () => {
  it("première révocation : F46 annoncée", async () => {
    db.trainer.findUnique.mockResolvedValue({ mandatAutofacturationRevoqueAt: null });
    const r = await updateTrainerFacturationAction({
      id: ID,
      mandatAutofacturationSigneAt: SIGNE,
      mandatAutofacturationRevoqueAt: REVOQUE,
    });
    expect(r).toEqual({ data: { id: ID } });
    expect(annoncer).toHaveBeenCalledWith({ trainerId: ID, revoqueAt: REVOQUE });
  });

  it("révocation déjà enregistrée (correction de date) : rien", async () => {
    db.trainer.findUnique.mockResolvedValue({
      mandatAutofacturationRevoqueAt: new Date("2026-10-01T00:00:00Z"),
    });
    await updateTrainerFacturationAction({
      id: ID,
      mandatAutofacturationSigneAt: SIGNE,
      mandatAutofacturationRevoqueAt: REVOQUE,
    });
    expect(annoncer).not.toHaveBeenCalled();
  });

  it("sans révocation : aucune lecture, rien", async () => {
    await updateTrainerFacturationAction({ id: ID, mandatAutofacturationSigneAt: SIGNE });
    expect(db.trainer.findUnique).not.toHaveBeenCalled();
    expect(annoncer).not.toHaveBeenCalled();
  });

  it("une annonce en échec ne défait pas l'enregistrement", async () => {
    db.trainer.findUnique.mockResolvedValue({ mandatAutofacturationRevoqueAt: null });
    annoncer.mockRejectedValue(new Error("panne"));
    const r = await updateTrainerFacturationAction({
      id: ID,
      mandatAutofacturationSigneAt: SIGNE,
      mandatAutofacturationRevoqueAt: REVOQUE,
    });
    expect(r).toEqual({ data: { id: ID } });
  });
});
