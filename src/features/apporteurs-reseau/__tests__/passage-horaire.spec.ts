import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  presentations: vi.fn(async () => [] as unknown[]),
  piecesCount: vi.fn(async () => 0),
  groupBy: vi.fn(async () => [] as unknown[]),
  pieces: vi.fn(async () => [] as unknown[]),
  devis: vi.fn(async () => [] as unknown[]),
  apporteurs: vi.fn(async () => [] as unknown[]),
  facturer: vi.fn(async () => ({ autofactures: 2, commissions: 3, ecartees: 0, erreurs: 0 })),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("../alerte-vigilance", () => ({ alerterPiecesVigilanceDeposees: vi.fn(async () => 0) }));
vi.mock("../facturation", () => ({ facturerCommissionsDues: () => d.facturer() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: { findMany: () => d.presentations() },
    commissionApporteur: { groupBy: () => d.groupBy(), findMany: vi.fn(async () => []) },
    pieceApporteur: { findMany: () => d.pieces(), count: () => d.piecesCount() },
    devis: { findMany: () => d.devis() },
    apporteurReseau: { findMany: () => d.apporteurs() },
    emailLog: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
  },
}));

import { passerFacturationApporteurs, passerReseauApporteurs } from "../passage-quotidien";

beforeEach(() => {
  for (const f of Object.values(d)) (f as ReturnType<typeof vi.fn>).mockClear();
});

describe("passage HORAIRE : seulement « commissions » et « autofacturation »", () => {
  it("lit les présentations protégées UNE fois (étape commissions), facture, et ne touche ni la vigilance ni les rappels", async () => {
    const bilan = await passerFacturationApporteurs(new Date("2026-10-06T09:10:00Z"));
    expect(d.presentations).toHaveBeenCalledTimes(1);
    expect(d.facturer).toHaveBeenCalledTimes(1);
    expect(d.groupBy).not.toHaveBeenCalled(); // étape vigilance
    expect(d.apporteurs).not.toHaveBeenCalled(); // rappels du dossier
    expect(d.devis).not.toHaveBeenCalled(); // commande signée
    expect(bilan).toMatchObject({ autofacturesEmises: 2, commissionsFacturees: 3, erreurs: 0 });
  });

  it("le passage quotidien garde toutes les étapes, autofacturation comprise", async () => {
    await passerReseauApporteurs(new Date("2026-10-06T07:00:00Z"));
    expect(d.facturer).toHaveBeenCalled();
    expect(d.groupBy).toHaveBeenCalled(); // vigilance
    expect(d.apporteurs).toHaveBeenCalled(); // rappels du dossier
  });

  it("une autofacturation en échec est comptée sans empêcher le passage de finir", async () => {
    d.facturer.mockRejectedValueOnce(new Error("R2 en panne"));
    const bilan = await passerFacturationApporteurs(new Date("2026-10-06T09:10:00Z"));
    expect(bilan.erreurs).toBe(1);
  });
});
