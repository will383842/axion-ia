import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const findUnique = vi.fn();
const logActivity = vi.fn();
const tx = {
  devisTexteBibliotheque: {
    create: (...a: unknown[]) => create(...a),
    updateMany: (...a: unknown[]) => updateMany(...a),
    findUnique: (...a: unknown[]) => findUnique(...a),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    devisTexteBibliotheque: {
      findMany: (...a: unknown[]) => findMany(...a),
      create: (...a: unknown[]) => create(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
    $transaction: async (f: (t: typeof tx) => unknown) => f(tx),
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1" })),
  logQualiopiActivity: (...a: unknown[]) => logActivity(...a),
}));

import { ajouterTexteAction, archiverTexteAction, modifierTexteAction } from "./devis-bibliotheque";

const ID = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  for (const m of [findMany, create, updateMany, findUnique, logActivity]) m.mockReset();
});

describe("bibliothèque de textes", () => {
  it("ajouter : projet « à valider », version 1", async () => {
    create.mockResolvedValue({ id: ID });
    const r = await ajouterTexteAction({ formule: "achat", nature: "avantage", texte: "Un texte" });
    expect(r).toEqual({ data: { id: ID } });
    expect(create.mock.calls[0]![0].data).toMatchObject({ aValider: true, version: 1 });
  });
  it("ajouter : refuse une formule, une nature ou un texte invalides", async () => {
    expect(
      "error" in
        (await ajouterTexteAction({ formule: "x", nature: "avantage", texte: "t" } as never)),
    ).toBe(true);
    expect(
      "error" in (await ajouterTexteAction({ formule: "achat", nature: "x", texte: "t" } as never)),
    ).toBe(true);
    expect(
      "error" in (await ajouterTexteAction({ formule: "achat", nature: "avantage", texte: "  " })),
    ).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });
  it("modifier : archive l'ancienne version (verrou) et crée la suivante", async () => {
    findUnique.mockResolvedValue({
      id: ID,
      formule: "achat",
      nature: "avantage",
      ordre: 2,
      version: 3,
      actifParDefaut: true,
      archiveAt: null,
    });
    updateMany.mockResolvedValue({ count: 1 });
    create.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
    const r = await modifierTexteAction(ID, "Nouveau texte");
    expect("data" in r).toBe(true);
    expect(updateMany.mock.calls[0]![0].where).toMatchObject({ id: ID, archiveAt: null });
    expect(create.mock.calls[0]![0].data).toMatchObject({
      version: 4,
      ordre: 2,
      texte: "Nouveau texte",
      aValider: true,
    });
  });
  it("modifier : deux onglets, le second perd (ancienne version déjà archivée) et rien n'est créé", async () => {
    findUnique.mockResolvedValue({
      id: ID,
      formule: "achat",
      nature: "avantage",
      ordre: 0,
      version: 1,
      actifParDefaut: false,
      archiveAt: null,
    });
    updateMany.mockResolvedValue({ count: 0 });
    const r = await modifierTexteAction(ID, "T");
    expect("error" in r).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });
  it("archiver : seulement une version non archivée, jamais de suppression", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    expect(await archiverTexteAction(ID)).toEqual({ data: { id: ID } });
    expect(updateMany.mock.calls[0]![0].where).toMatchObject({ id: ID, archiveAt: null });
    updateMany.mockResolvedValue({ count: 0 });
    expect("error" in (await archiverTexteAction(ID))).toBe(true);
  });
});
