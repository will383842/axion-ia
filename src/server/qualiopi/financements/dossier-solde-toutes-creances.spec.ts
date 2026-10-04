/**
 * Lot A8c — un dossier n'est « paiement reçu » que quand TOUT ce qu'il doit
 * rapporter est facturé ET payé.
 *
 * 🔴 Défaut constaté à l'audit : en subrogation avec accord partiel, la facture
 * de l'OPCO payée suffisait à passer le dossier `paiement_recu` alors que le
 * reste à charge de l'entreprise n'était pas encore facturé : le pilotage
 * annonçait soldée une affaire dont une créance n'était même pas réclamée.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  dossier: null as Record<string, unknown> | null,
  updateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dossierFinancement: {
      findUnique: vi.fn(async () => m.dossier),
      updateMany: (a: unknown) => m.updateMany(a),
    },
  },
}));

import { marquerPaiementRecuSiSoldee } from "./dossier-financement";

const creance = (factureFormationId: string | null, montantAttenduCents = 50000) => ({
  factureFormationId,
  montantAttenduCents,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.updateMany.mockResolvedValue({ count: 1 });
});

describe("marquerPaiementRecuSiSoldee", () => {
  it("🔴 facture OPCO payée mais reste à charge NON facturé → le dossier reste « facturé »", async () => {
    m.dossier = {
      statut: "facture",
      factures: [{ statut: "payee" }],
      payeurs: [creance("f-opco", 100000), creance(null, 50000)],
    };
    await marquerPaiementRecuSiSoldee("dos-1");
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("toutes les créances facturées et toutes les factures payées → paiement reçu", async () => {
    m.dossier = {
      statut: "facture",
      factures: [{ statut: "payee" }, { statut: "payee" }],
      payeurs: [creance("f-opco", 100000), creance("f-ent", 50000)],
    };
    await marquerPaiementRecuSiSoldee("dos-1");
    expect(m.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: "paiement_recu" }) }),
    );
  });

  it("une créance NULLE non facturée (reste à charge à 0 €) ne retient pas le dossier", async () => {
    m.dossier = {
      statut: "facture",
      factures: [{ statut: "payee" }],
      payeurs: [creance("f-opco", 150000), creance(null, 0)],
    };
    await marquerPaiementRecuSiSoldee("dos-1");
    expect(m.updateMany).toHaveBeenCalled();
  });

  it("remboursement : la seule facture (entreprise) payée → paiement reçu", async () => {
    m.dossier = {
      statut: "facture",
      factures: [{ statut: "payee" }],
      payeurs: [creance("f-ent", 150000)],
    };
    await marquerPaiementRecuSiSoldee("dos-1");
    expect(m.updateMany).toHaveBeenCalled();
  });

  it("une facture encore partiellement payée → rien ne bouge", async () => {
    m.dossier = {
      statut: "facture",
      factures: [{ statut: "payee" }, { statut: "partiellement_payee" }],
      payeurs: [creance("f-opco", 100000), creance("f-ent", 50000)],
    };
    await marquerPaiementRecuSiSoldee("dos-1");
    expect(m.updateMany).not.toHaveBeenCalled();
  });
});
