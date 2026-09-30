/**
 * ⛔ UN NUMÉRO ÉMIS N'EST JAMAIS RÉATTRIBUÉ, MÊME QUAND SA LIGNE A DISPARU.
 *
 * Incident du 2026-09-15 : les données de deux actions ont été supprimées
 * directement en base le 19/08 ; `nextNumero` lisait MAX(séquence) des seules
 * lignes ENCORE PRÉSENTES dans `factures_formation`, la série est repartie à
 * 001, et `AXI-FACT-2026-001` a été émis une seconde fois (CGI, art. 242
 * nonies A ann. II : séquence continue, sans réemploi).
 *
 * Remède : le registre append-only `numeros_emis`, alimenté par déclencheur
 * sur chaque table porteuse, et lu par `nextNumero` en plus de la table
 * métier. La borne haute est le maximum des DEUX sources.
 *
 * Mutation qui fait rougir : retirer la lecture du registre dans
 * `nextNumero` → le premier cas rend `AXI-FACT-2026-001` au lieu de `-006`.
 *
 * Repli : tant que la migration n'est pas passée (fenêtre app/worker de
 * ~50 min, entrypoint best-effort), la table n'existe pas ; la lecture échoue
 * en P2021 et `nextNumero` retombe sur l'ancien comportement, avec un
 * avertissement — une facturation ne se bloque JAMAIS sur le registre.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registre = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { numeroEmis: registre },
}));

import { __reinitialiserAvertissementRegistre, nextNumero } from "../allocate";

type Ligne = { numero: string | null };
const lecteur = (lignes: Ligne[]) => vi.fn(async () => lignes);

beforeEach(() => {
  registre.findMany.mockReset();
  __reinitialiserAvertissementRegistre();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("nextNumero lit aussi le registre des numéros émis", () => {
  it("la borne tient quand la ligne métier du maximum a disparu", async () => {
    // Table métier vidée (suppression directe en base) ; le registre garde tout.
    registre.findMany.mockResolvedValue([
      { numero: "AXI-FACT-2026-001" },
      { numero: "AXI-FACT-2026-005" },
    ]);
    const numero = await nextNumero("facture", 2026, lecteur([]));
    expect(numero).toBe("AXI-FACT-2026-006");
  });

  it("interroge le registre sur le préfixe de la série, et lui seul", async () => {
    registre.findMany.mockResolvedValue([]);
    await nextNumero("facture", 2026, lecteur([]));
    expect(registre.findMany).toHaveBeenCalledWith({
      where: { numero: { startsWith: "AXI-FACT-2026-" } },
      select: { numero: true },
    });
  });

  it("prend le maximum des deux sources (la table métier peut être en avance)", async () => {
    registre.findMany.mockResolvedValue([{ numero: "AXI-FACT-2026-003" }]);
    const numero = await nextNumero(
      "facture",
      2026,
      lecteur([{ numero: "AXI-FACT-2026-004" }, { numero: "AXI-FACT-2026-002" }]),
    );
    expect(numero).toBe("AXI-FACT-2026-005");
  });

  it("le registre ne fait pas sortir de la série : brouillons, DEMO, autres séries", async () => {
    registre.findMany.mockResolvedValue([
      { numero: "AXI-FACT-2026-DEMO-900" },
      { numero: "AXI-FACT-2026-002" },
    ]);
    const numero = await nextNumero("facture", 2026, lecteur([{ numero: "BROUILLON-x" }]));
    expect(numero).toBe("AXI-FACT-2026-003");
  });

  it("série sans millésime : le client aussi est borné par le registre", async () => {
    registre.findMany.mockResolvedValue([{ numero: "AXI-CLI-007" }]);
    const numero = await nextNumero("client", null, lecteur([{ numero: "AXI-CLI-002" }]));
    expect(numero).toBe("AXI-CLI-008");
  });
});

describe("repli propre tant que le registre n'existe pas", () => {
  it("table inexistante (P2021) → ancien comportement, un avertissement, pas d'exception", async () => {
    const avert = vi.spyOn(console, "warn").mockImplementation(() => {});
    registre.findMany.mockRejectedValue(
      Object.assign(new Error("The table `public.numeros_emis` does not exist"), {
        code: "P2021",
      }),
    );
    const numero = await nextNumero("facture", 2026, lecteur([{ numero: "AXI-FACT-2026-004" }]));
    expect(numero).toBe("AXI-FACT-2026-005");
    expect(avert).toHaveBeenCalledTimes(1);
    expect(String(avert.mock.calls[0]?.[0])).toContain("numeros_emis");
  });

  it("l'avertissement P2021 n'est émis qu'une fois par processus", async () => {
    const avert = vi.spyOn(console, "warn").mockImplementation(() => {});
    registre.findMany.mockRejectedValue(Object.assign(new Error("absent"), { code: "P2021" }));
    await nextNumero("facture", 2026, lecteur([]));
    await nextNumero("facture", 2026, lecteur([]));
    expect(avert).toHaveBeenCalledTimes(1);
  });

  it("client Prisma sans le modèle (double de test, générateur en retard) → repli en avertissement", async () => {
    const avert = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { prisma } = await import("@/lib/prisma");
    const sauve = prisma.numeroEmis;
    (prisma as { numeroEmis?: unknown }).numeroEmis = undefined;
    try {
      const numero = await nextNumero("facture", 2026, lecteur([{ numero: "AXI-FACT-2026-002" }]));
      expect(numero).toBe("AXI-FACT-2026-003");
      expect(avert).toHaveBeenCalledTimes(1);
      expect(err).not.toHaveBeenCalled();
    } finally {
      (prisma as { numeroEmis?: unknown }).numeroEmis = sauve;
    }
  });

  it("toute autre erreur du registre → repli aussi, mais signalée en erreur", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    registre.findMany.mockRejectedValue(new Error("connexion perdue"));
    const numero = await nextNumero("devis", 2026, lecteur([{ numero: "AXI-DEV-2026-010" }]));
    expect(numero).toBe("AXI-DEV-2026-011");
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("une erreur de la TABLE MÉTIER, elle, remonte (on ne masque pas une base en panne)", async () => {
    registre.findMany.mockResolvedValue([]);
    const panne = vi.fn(async () => {
      throw new Error("base injoignable");
    });
    await expect(nextNumero("facture", 2026, panne)).rejects.toThrow("base injoignable");
  });
});
