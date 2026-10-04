/**
 * Lot A8c — l'encaissement qui SOLDE une facture déclenche la préparation des
 * pièces de remboursement OPCO (le service décide ensuite si c'est le bon
 * circuit). Un encaissement partiel ne déclenche rien ; une panne de la
 * préparation ne fait jamais échouer l'encaissement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  encaisseAvant: 0,
  transmettre: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    factureFormation: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: "f-210",
        statut: "emise",
        montantTtcCents: 180000,
        montantHtCents: 150000,
        dossierFinancementId: null,
        avoirDeId: null,
      })),
      aggregate: vi.fn(async () => ({ _sum: { montantTtcCents: 0 } })),
      update: vi.fn(async () => ({})),
    },
    payment: {
      create: vi.fn(async () => ({ id: "p-1" })),
      findUnique: vi.fn(async () => null),
      aggregate: vi.fn(async () => ({ _sum: { amountCents: m.encaisseAvant } })),
    },
  };
  return {
    prisma: { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) },
  };
});

// `_guards` (chargé par `site-settings`) tire next-auth, introuvable sous
// Vitest : simulé sans `importOriginal`, comme dans les suites voisines.
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));

vi.mock("./transmission-remboursement-opco", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./transmission-remboursement-opco")>()),
  preparerTransmissionRemboursementOpco: (...a: unknown[]) => m.transmettre(...a),
}));

import { enregistrerPaiementFacture } from "./facture-libre";

const encaisser = (montantCents: number) =>
  enregistrerPaiementFacture({
    factureId: "f-210",
    montantCents,
    paidAt: new Date("2026-10-20T10:00:00Z"),
    mode: "manual_wire",
    recordedByAdminId: "admin",
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.transmettre.mockResolvedValue({ statut: "preparee", to: "compta@acme.test" });
});

describe("encaissement → pièces de remboursement OPCO", () => {
  it("🔴 l'encaissement qui solde la facture prépare la transmission", async () => {
    m.encaisseAvant = 180000;
    const r = await encaisser(180000);
    expect(r.statut).toBe("payee");
    expect(m.transmettre).toHaveBeenCalledWith("f-210");
  });

  it("un encaissement partiel ne prépare rien", async () => {
    m.encaisseAvant = 50000;
    const r = await encaisser(50000);
    expect(r.statut).toBe("partiellement_payee");
    expect(m.transmettre).not.toHaveBeenCalled();
  });

  it("une panne de la préparation ne fait pas échouer l'encaissement", async () => {
    m.encaisseAvant = 180000;
    m.transmettre.mockRejectedValue(new Error("R2 indisponible"));
    const r = await encaisser(180000);
    expect(r.statut).toBe("payee");
  });
});
