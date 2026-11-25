// Cloisonnement de la lecture « Mes commissions » : chaque requête porte l'apporteur du dossier.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const h = vi.hoisted(() => ({
  appels: [] as Array<{ modele: string; where: Record<string, unknown> }>,
  pres: [] as unknown[],
  comm: [] as unknown[],
  piece: null as unknown,
}));
vi.mock("@/lib/prisma", () => {
  const modele = (nom: string, rendu: () => unknown) => ({
    findMany: async (a: { where: Record<string, unknown> }) => {
      h.appels.push({ modele: nom, where: a.where });
      return rendu();
    },
    findFirst: async (a: { where: Record<string, unknown> }) => {
      h.appels.push({ modele: nom, where: a.where });
      return h.piece;
    },
  });
  return {
    prisma: {
      presentationEntreprise: modele("presentation", () => h.pres),
      commissionApporteur: modele("commission", () => h.comm),
      presentationReservation: modele("reservation", () => []),
    },
  };
});

import { lireEspaceCommissions, numeroDePieceDeLApporteur } from "../espace-commissions";

const A = "aaaaaaaa-0000-4000-8000-000000000001";

beforeEach(() => {
  h.appels = [];
  h.pres = [];
  h.comm = [];
  h.piece = null;
  delete process.env.DATABASE_URL;
});

describe("lireEspaceCommissions", () => {
  it("les requêtes présentations et commissions portent apporteurId du dossier", async () => {
    h.pres = [
      {
        id: "p1",
        denomination: "X",
        recueAt: new Date(),
        statut: "reservee",
        contactEnvoyeAt: null,
        protegeeJusquAt: null,
      },
    ];
    await lireEspaceCommissions({ id: A, regimeTva: null });
    const ou = (m: string) => h.appels.find((c) => c.modele === m)!.where;
    expect(ou("presentation")).toEqual({ apporteurId: A });
    expect(ou("commission")).toEqual({ apporteurId: A });
    // Réservations : seulement par présentations déjà prouvées siennes.
    expect(ou("reservation")).toEqual({ presentationId: { in: ["p1"] } });
  });

  it("sans présentation, aucune requête de réservation", async () => {
    await lireEspaceCommissions({ id: A, regimeTva: null });
    expect(h.appels.some((c) => c.modele === "reservation")).toBe(false);
  });

  it("base factice (stub.invalid) : aucune requête", async () => {
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    const v = await lireEspaceCommissions({ id: A, regimeTva: null });
    expect(h.appels).toHaveLength(0);
    expect(v.entreprises).toEqual([]);
  });
});

describe("numeroDePieceDeLApporteur", () => {
  it("numéro mal formé ou trop long : aucune requête", async () => {
    for (const n of ["../x", "axi-app-2026-0001", `AXI-APP-2026-${"1".repeat(40)}`, "%2e%2e"]) {
      expect(await numeroDePieceDeLApporteur(A, n)).toBeNull();
    }
    expect(h.appels).toHaveLength(0);
  });
  it("la requête est filtrée par apporteur ; numéro d'un autre → null", async () => {
    expect(await numeroDePieceDeLApporteur(A, "AXI-APP-2026-0001")).toBeNull();
    expect(h.appels[0]!.where).toMatchObject({ apporteurId: A });
    h.piece = { id: "x" };
    expect(await numeroDePieceDeLApporteur(A, "AXI-APP-2026-0001")).toBe("AXI-APP-2026-0001");
  });
});
