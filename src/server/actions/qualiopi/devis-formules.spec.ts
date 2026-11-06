import { beforeEach, describe, expect, it, vi } from "vitest";

import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";

const updateMany = vi.fn();
const findUnique = vi.fn();
const logActivity = vi.fn();
const formulesActives = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: {
      updateMany: (...a: unknown[]) => updateMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1" })),
  logQualiopiActivity: (...a: unknown[]) => logActivity(...a),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: (...a: unknown[]) => formulesActives(...a),
}));

import { modifierDevisBrouillonAction } from "./devis-formules";

const ID = "11111111-1111-4111-8111-111111111111";
const MAJ = "2026-11-06T10:00:00.000Z";

beforeEach(() => {
  updateMany.mockReset();
  findUnique.mockReset();
  logActivity.mockReset();
  formulesActives.mockReset();
  formulesActives.mockResolvedValue(true);
});

const appel = (over: Record<string, unknown> = {}) =>
  modifierDevisBrouillonAction({ id: ID, attenduMajLe: MAJ, offre: offreFictive(), ...over });

describe("modifierDevisBrouillonAction", () => {
  it("interrupteur éteint : inerte, aucune lecture ni écriture", async () => {
    formulesActives.mockResolvedValue(false);
    const r = await appel();
    expect("error" in r).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });
  it("identifiant ou date de lecture invalides : refus", async () => {
    expect("error" in (await appel({ id: "x" }))).toBe(true);
    expect("error" in (await appel({ attenduMajLe: "hier" }))).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("offre invalide : refus avant toute écriture", async () => {
    const r = await appel({ offre: { ...offreFictive(), extra: 1 } });
    expect("error" in r).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("verrou : brouillon, déjà une offre, et même version lue", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const r = await appel();
    expect(r).toEqual({ data: { id: ID } });
    const arg = updateMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({
      id: ID,
      statut: "brouillon",
      updatedAt: new Date(MAJ),
      offreSha256: { not: null },
    });
    expect(arg.data.offreSha256).toMatch(/^[0-9a-f]{64}$/);
    // deux formules : lignes vides et total 0 jusqu'au choix du client
    expect(arg.data.lignes).toEqual([]);
    expect(arg.data.montantTotalHtCents).toBe(0);
    expect(logActivity).toHaveBeenCalledOnce();
  });
  it("une seule formule : lignes et total de cette formule", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await appel({ offre: { ...offreFictive(), formulesProposees: ["achat"] } });
    const arg = updateMany.mock.calls[0]![0];
    expect(arg.data.montantTotalHtCents).toBe(120000);
    expect(arg.data.lignes).toHaveLength(2);
  });
  it("deux onglets : le premier enregistre, le second est refusé (version périmée)", async () => {
    let majCourante = MAJ;
    updateMany.mockImplementation(async (a: { where: { updatedAt: Date } }) => {
      if (a.where.updatedAt.toISOString() !== majCourante) return { count: 0 };
      majCourante = "2026-11-06T10:05:00.000Z";
      return { count: 1 };
    });
    findUnique.mockResolvedValue({ statut: "brouillon" });
    const [a, b] = [await appel(), await appel()];
    expect("data" in a).toBe(true);
    expect("error" in b && b.error).toMatch(/modifié ailleurs|rechargez/i);
    expect(logActivity).toHaveBeenCalledTimes(1);
  });
  it("un devis envoyé ne se modifie pas : message de révision", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue({ statut: "envoye" });
    const r = await appel();
    expect("error" in r && r.error).toMatch(/révision|révis/i);
    expect(logActivity).not.toHaveBeenCalled();
  });
  it("devis introuvable : refus", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(null);
    expect("error" in (await appel())).toBe(true);
  });
  it("total hors borne : refus clair, pas d'écriture", async () => {
    const o = offreFictive();
    const gros = {
      ...o,
      formulesProposees: ["achat" as const],
      achat: {
        ...o.achat!,
        lignes: [{ libelle: "G", quantite: 1000, prixHtCents: 2_000_000_000, tauxTvaBps: 2000 }],
      },
    };
    const r = await appel({ offre: gros });
    expect("error" in r).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
