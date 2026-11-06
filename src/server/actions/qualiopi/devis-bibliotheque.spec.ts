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
const formulesActives = vi.fn();
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: (...a: unknown[]) => formulesActives(...a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1" })),
  logQualiopiActivity: (...a: unknown[]) => logActivity(...a),
}));

import {
  ajouterTexteAction,
  archiverTexteAction,
  definirActifParDefautAction,
  modifierTexteAction,
} from "./devis-bibliotheque";

const ID = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  for (const m of [findMany, create, updateMany, findUnique, logActivity, formulesActives])
    m.mockReset();
  formulesActives.mockResolvedValue(true);
});

describe("bibliothèque de textes — inertie", () => {
  it("interrupteur éteint : les trois écritures refusent sans toucher la base", async () => {
    formulesActives.mockResolvedValue(false);
    const rs = [
      await ajouterTexteAction({ formule: "achat", nature: "avantage", texte: "Un texte" }),
      await modifierTexteAction(ID, "Nouveau"),
      await archiverTexteAction(ID),
    ];
    for (const r of rs) expect("error" in r && r.error).toMatch(/pas activé/);
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });
  it("build GH Actions (stub.invalid) : les trois écritures refusent", async () => {
    const avant = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const rs = [
        await ajouterTexteAction({ formule: "achat", nature: "avantage", texte: "Un texte" }),
        await modifierTexteAction(ID, "Nouveau"),
        await archiverTexteAction(ID),
      ];
      for (const r of rs) expect("error" in r && r.error).toMatch(/build/);
      expect(create).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    } finally {
      if (avant === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = avant;
    }
  });
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

describe("réglage « actif par défaut »", () => {
  it("pose le drapeau sur la version active, sans créer de version ni toucher au texte", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const r = await definirActifParDefautAction(ID, true);
    expect(r).toEqual({ data: { id: ID } });
    const arg = updateMany.mock.calls[0]![0];
    expect(arg.where).toEqual({ id: ID, archiveAt: null });
    expect(arg.data).toMatchObject({ actifParDefaut: true, majParAdminId: "adm-1" });
    expect(arg.data).not.toHaveProperty("texte");
    expect(create).not.toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledOnce();
  });
  it("texte archivé ou introuvable : refus", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    expect("error" in (await definirActifParDefautAction(ID, false))).toBe(true);
    expect(logActivity).not.toHaveBeenCalled();
  });
  it("identifiant ou valeur invalides : refus avant la base", async () => {
    expect("error" in (await definirActifParDefautAction("x", true))).toBe(true);
    expect("error" in (await definirActifParDefautAction(ID, "oui" as never))).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("interrupteur éteint : inerte", async () => {
    formulesActives.mockResolvedValue(false);
    expect("error" in (await definirActifParDefautAction(ID, true))).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
