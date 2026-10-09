import { beforeEach, describe, expect, it, vi } from "vitest";

// Relecture de a1 (09/10) : la décision « à attribuer » est unique et limitée aux candidates ;
// l'extension et sa trace sont écrites dans la MÊME transaction (sans trace, pas d'extension).

const d = vi.hoisted(() => ({
  ligne: null as null | { candidats: string[]; decideeAt: Date | null },
  maj: vi.fn(async () => ({ count: 1 })),
  trace: vi.fn(async () => ({})),
  presentation: { id: "p1", statut: "confirmee", siren: "732829320", apporteurId: "a1" },
  etab: {
    presentationId: "p1",
    siret: "73282932000074",
    entreprise: false,
    exclus: [],
    etendueAt: null,
  },
  clients: [] as Array<{ id: string; siret: string | null }>,
  facturesClient: 0,
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    commandeAAttribuer: { updateMany: (...a: unknown[]) => d.maj(...(a as [])) },
    presentationEtablissement: { updateMany: (...a: unknown[]) => d.maj(...(a as [])) },
    activityLog: { create: (...a: unknown[]) => d.trace(...(a as [])) },
  };
  return {
    prisma: {
      commandeAAttribuer: { findUnique: vi.fn(async () => d.ligne) },
      presentationEntreprise: {
        findUnique: vi.fn(async () => d.presentation),
        findMany: vi.fn(async () => []),
      },
      presentationEtablissement: { findMany: vi.fn(async () => [d.etab]) },
      client: { findMany: vi.fn(async () => d.clients) },
      factureFormation: { count: vi.fn(async () => d.facturesClient) },
      devis: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
      $transaction: async (f: (t: typeof tx) => unknown) => f(tx),
    },
  };
});

import { deciderAttribution, etendreALEntreprise } from "../etablissement-presentation";

beforeEach(() => {
  vi.clearAllMocks();
  d.ligne = { candidats: ["p1", "p2"], decideeAt: null };
  d.clients = [];
  d.facturesClient = 0;
});

describe("décision « à attribuer »", () => {
  it("une candidate : écrite une fois, tracée", async () => {
    expect(await deciderAttribution("f1", "p2", "admin")).toMatchObject({
      ok: true,
      ecartes: ["p1"],
    });
    expect(d.maj).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { factureId: "f1", decideeAt: null },
        data: expect.objectContaining({ presentationId: "p2", aucune: false }),
      }),
    );
    expect(d.trace).toHaveBeenCalledTimes(1);
  });
  it("relecture 2, défaut 2 : « aucun apporteur » SANS motif est refusé", async () => {
    expect((await deciderAttribution("f1", null, "admin")).ok).toBe(false);
    expect(d.maj).not.toHaveBeenCalled();
  });

  it("« aucun apporteur » motivé : aucune = vrai ; tous les candidats sont écartés", async () => {
    const r = await deciderAttribution(
      "f1",
      null,
      "admin",
      new Date(),
      "Commande du siège de Paris, non déclarée.",
    );
    expect(r).toMatchObject({ ok: true, ecartes: ["p1", "p2"] });
    expect(d.maj).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ presentationId: null, aucune: true }),
      }),
    );
  });

  it("une présentation NON candidate est refusée ; une commande déjà décidée aussi", async () => {
    expect((await deciderAttribution("f1", "p9", "admin")).ok).toBe(false);
    d.ligne = { candidats: ["p1"], decideeAt: new Date() };
    expect((await deciderAttribution("f1", "p1", "admin")).ok).toBe(false);
    expect(d.maj).not.toHaveBeenCalled();
  });
});

describe("extension à toute l'entreprise (réserve a)", () => {
  it("la trace est dans la transaction : si elle échoue, l'extension échoue", async () => {
    d.trace.mockRejectedValueOnce(new Error("journal indisponible"));
    await expect(etendreALEntreprise("p1", "admin")).rejects.toThrow("journal indisponible");
  });
  it("réussie : exclusions rendues (aucune ici)", async () => {
    expect(await etendreALEntreprise("p1", "admin")).toEqual({ ok: true, exclusions: [] });
  });
});

describe("relecture 2, défaut 1 : une fiche client SANS SIRET déjà facturée est signalée", () => {
  it("elle figure dans l'aperçu, mais jamais dans les SIRET exclus (ce n'est pas un SIRET)", async () => {
    d.clients = [{ id: "c1", siret: null }];
    d.facturesClient = 1;
    const r = await etendreALEntreprise("p1", "admin");
    expect(r).toMatchObject({ ok: true, exclusions: [{ siret: "fiche sans SIRET" }] });
    const ecrit = (d.maj.mock.calls[0] as unknown as [{ data: { exclus: string[] } }])[0];
    expect(ecrit.data.exclus).toEqual([]);
  });
});
