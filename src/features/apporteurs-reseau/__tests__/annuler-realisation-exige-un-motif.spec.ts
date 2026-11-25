import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot L3a (B3) : annuler une réalisation exige un motif (3 à 500 caractères), et le geste et sa
// trace tiennent dans UNE MÊME transaction : si le journal échoue, le geste est annulé.
// Aucune commission n'est créée ni supprimée : seules les colonnes de réalisation bougent.

type Ligne = Record<string, unknown>;

const etat = vi.hoisted(() => ({
  lignes: [] as Ligne[],
  journal: [] as Array<Record<string, unknown>>,
  journalEnPanne: false,
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    commissionApporteur: {
      findUnique: vi.fn(async (a: { where: { id: string } }) => {
        const l = etat.lignes.find((x) => x["id"] === a.where.id);
        return l ? { ...l } : null;
      }),
      updateMany: vi.fn(async (a: { where: Ligne; data: Ligne }) => {
        const ls = etat.lignes.filter((l) =>
          Object.entries(a.where).every(([k, c]) => {
            if (c && typeof c === "object" && "in" in (c as object))
              return ((c as { in: unknown[] }).in as unknown[]).includes(l[k]);
            if (c instanceof Date)
              return l[k] instanceof Date && (l[k] as Date).getTime() === c.getTime();
            return c === null ? l[k] === null : l[k] === c;
          }),
        );
        for (const l of ls) Object.assign(l, a.data);
        return { count: ls.length };
      }),
    },
    activityLog: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        if (etat.journalEnPanne) throw new Error("journal en panne");
        etat.journal.push(a.data);
        return {};
      }),
    },
    // Transaction simulée : tout est défait si le callback lève.
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      const lignes = etat.lignes.map((l) => ({ ...l }));
      const journal = [...etat.journal];
      try {
        return await cb(prisma);
      } catch (e) {
        etat.lignes = lignes;
        etat.journal = journal;
        throw e;
      }
    },
  };
  return { prisma };
});

import { annulerRealisation, marquerPrestationRealisee } from "../realisation";

const REALISEE = new Date("2026-10-05T12:00:00Z");
const MARDI = new Date("2026-10-06T10:00:00Z");

function ligne(): Ligne {
  return {
    id: "c1",
    statut: "due",
    autofactureNumero: null,
    prestationRealiseeAt: REALISEE,
    prestationRealiseePar: "console",
  };
}

beforeEach(() => {
  etat.lignes = [ligne()];
  etat.journal = [];
  etat.journalEnPanne = false;
});

describe("annulerRealisation : motif obligatoire", () => {
  it.each([
    ["", "vide"],
    ["  ab ", "2 caractères"],
    ["x".repeat(501), "501 caractères"],
  ])("motif %#  (%s) : refus, rien ne change, rien n'est tracé", async (motif) => {
    const r = await annulerRealisation("c1", motif, "adm-1");
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("motif");
    expect(etat.lignes[0]!["prestationRealiseeAt"]).toEqual(REALISEE);
    expect(etat.lignes[0]!["prestationRealiseePar"]).toBe("console");
    expect(etat.journal).toHaveLength(0);
  });

  it("avec motif : réalisation annulée, le journal porte le motif et l'auteur", async () => {
    const r = await annulerRealisation("c1", "  Séance reportée, client absent  ", "adm-1");
    expect(r).toEqual({ ok: true });
    expect(etat.lignes[0]!["prestationRealiseeAt"]).toBeNull();
    expect(etat.lignes[0]!["prestationRealiseePar"]).toBe("annulee-console");
    expect(etat.journal).toHaveLength(1);
    expect(etat.journal[0]).toMatchObject({
      adminUserId: "adm-1",
      action: "commission_apporteur.realisation_annulee",
      targetId: "c1",
      changes: { motif: "Séance reportée, client absent", source: "console" },
    });
  });

  it("motif de 3 et de 500 caractères : admis", async () => {
    expect(await annulerRealisation("c1", "abc", null)).toEqual({ ok: true });
    etat.lignes = [ligne()];
    expect(await annulerRealisation("c1", "y".repeat(500), null)).toEqual({ ok: true });
  });

  it("journal en échec : le geste est annulé (la réalisation reste posée) et l'erreur remonte", async () => {
    etat.journalEnPanne = true;
    await expect(annulerRealisation("c1", "Motif valable", "adm-1")).rejects.toThrow();
    expect(etat.lignes[0]!["prestationRealiseeAt"]).toEqual(REALISEE);
    expect(etat.lignes[0]!["prestationRealiseePar"]).toBe("console");
    expect(etat.journal).toHaveLength(0);
  });

  it("commission déjà facturée : refus, rien n'est tracé", async () => {
    etat.lignes[0]!["autofactureNumero"] = "AXI-APP-2026-0001";
    const r = await annulerRealisation("c1", "Motif valable", "adm-1");
    expect(r).toMatchObject({ ok: false });
    expect(etat.journal).toHaveLength(0);
  });
});

describe("marquerPrestationRealisee : même transaction, sans motif", () => {
  beforeEach(() => {
    etat.lignes = [{ ...ligne(), prestationRealiseeAt: null, prestationRealiseePar: null }];
  });

  it("marque et trace ensemble", async () => {
    expect(await marquerPrestationRealisee("c1", REALISEE, MARDI, "adm-1")).toEqual({ ok: true });
    expect(etat.lignes[0]!["prestationRealiseeAt"]).toEqual(REALISEE);
    expect(etat.journal[0]).toMatchObject({
      action: "commission_apporteur.prestation_realisee",
      adminUserId: "adm-1",
    });
  });

  it("journal en échec : rien n'est marqué", async () => {
    etat.journalEnPanne = true;
    await expect(marquerPrestationRealisee("c1", REALISEE, MARDI, "adm-1")).rejects.toThrow();
    expect(etat.lignes[0]!["prestationRealiseeAt"]).toBeNull();
  });
});
