import { describe, it, expect, vi, beforeEach } from "vitest";

const updateMany = vi.fn();
const logActivity = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { devis: { updateMany: (...a: unknown[]) => updateMany(...a) } },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1" })),
  logQualiopiActivity: (...a: unknown[]) => logActivity(...a),
}));

import { demarrerLivraisonDevisAction, marquerDevisLivreAction } from "./devis-livraison";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  updateMany.mockReset();
  logActivity.mockReset();
});

describe("demarrerLivraisonDevisAction", () => {
  it("refuse un identifiant invalide sans toucher la base", async () => {
    const r = await demarrerLivraisonDevisAction("pas-un-uuid");
    expect(r).toEqual({ error: "Identifiant invalide" });
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("pose livraison_debut_at seulement sur un devis accepté non démarré (verrou atomique)", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const r = await demarrerLivraisonDevisAction(ID);
    expect(r).toEqual({ data: { id: ID } });
    const arg = updateMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ id: ID, statut: "accepte", livraisonDebutAt: null });
    expect(arg.data.livraisonDebutAt).toBeInstanceOf(Date);
    expect(logActivity).toHaveBeenCalledOnce();
  });
  it("count 0 → refus explicite, aucune trace d'activité", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const r = await demarrerLivraisonDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe("marquerDevisLivreAction", () => {
  it("exige livraison démarrée et pas encore livré", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const r = await marquerDevisLivreAction(ID);
    expect(r).toEqual({ data: { id: ID } });
    const arg = updateMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ id: ID, livraisonDebutAt: { not: null }, livreAt: null });
    expect(arg.where.statut).toEqual({ in: ["accepte", "transforme_convention"] });
    expect(arg.data.livreAt).toBeInstanceOf(Date);
  });
  it("count 0 → refus", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    expect("error" in (await marquerDevisLivreAction(ID))).toBe(true);
  });
});
