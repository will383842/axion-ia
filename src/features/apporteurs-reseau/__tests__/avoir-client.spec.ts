import { beforeEach, describe, expect, it, vi } from "vitest";

// Art. 4.5 — la facture du client annulée (ou réduite) par un avoir : la commission suit.
// Essai réel du 09/10/2026 : après l'avoir AXI-AVO-2026-001, la commission de 1 € restait « à
// verser » et aucun bouton ne permettait de l'annuler.

const d = vi.hoisted(() => ({
  factures: [] as Array<{
    id: string;
    devisId: string | null;
    montantHtCents: number;
    avoirDeId: string | null;
  }>,
  lignes: [] as Array<Record<string, unknown>>,
  reprisesDeja: [] as Array<{ montantCents: number }>,
  annuler: vi.fn(async () => ({ ok: true })),
  reduire: vi.fn(async () => ({ ok: true })),
  retenir: vi.fn(async () => ({
    ok: true,
    avoir: { r2Key: "k", filename: "AXI-APP-2026-0002.pdf" },
  })),
  reprise: vi.fn(async () => ({ ok: true, message: "" })),
  envoyer: vi.fn(async () => "envoye"),
}));

type Where = Record<string, unknown>;
const correspond = (f: (typeof d.factures)[number], w: Where): boolean => {
  if (w.statut) {
    /* brouillon exclu : aucun brouillon dans les données */
  }
  if (w.id !== undefined && f.id !== w.id) return false;
  if (w.avoirDeId === null && f.avoirDeId !== null) return false;
  const a = w.avoirDeId as { not?: null; in?: string[] } | undefined;
  if (a && typeof a === "object" && "not" in a && f.avoirDeId === null) return false;
  if (a && typeof a === "object" && a.in && !a.in.includes(f.avoirDeId ?? "")) return false;
  const dv = w.devisId as string | { in: string[] } | undefined;
  if (typeof dv === "string" && f.devisId !== dv) return false;
  if (dv && typeof dv === "object" && !dv.in.includes(f.devisId ?? "")) return false;
  return true;
};

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    factureFormation: {
      findMany: vi.fn(async ({ where }: { where: Where }) =>
        d.factures.filter((f) => correspond(f, where)),
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          d.factures.find((f) => f.id === where.id) ?? null,
      ),
    },
    commissionApporteur: {
      findMany: vi.fn(async ({ where }: { where: Where }) =>
        "palier" in where ? d.reprisesDeja : d.lignes,
      ),
    },
    apporteurReseau: {
      findUnique: vi.fn(async () => ({ prenom: "Essai", email: "essai@exemple.fr" })),
    },
  },
}));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => d.envoyer(...(a as [])) }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../manquement", () => ({ retenir: (...a: unknown[]) => d.retenir(...(a as [])) }));
vi.mock("../resiliation", () => ({
  PREFIXE_PALIER_REPRISE: "reprise:",
  enregistrerReprise: (...a: unknown[]) => d.reprise(...(a as [])),
}));
vi.mock("../ajustement", async (orig) => {
  const vrai = await orig<typeof import("../ajustement")>();
  return {
    commissionPourPrixConserve: vrai.commissionPourPrixConserve,
    partDuParrain: vrai.partDuParrain,
    annulerCommission: (...a: unknown[]) => d.annuler(...(a as [])),
    reduireCommission: (...a: unknown[]) => d.reduire(...(a as [])),
  };
});

import { prixNetCommande, reprendreApresAvoirsClients } from "../avoir-client";

const LE = new Date("2026-10-09T11:10:00Z");
const ligne = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  apporteurId: "a1",
  factureId: "F1",
  parrainage: false,
  statut: "due",
  activite: "audit",
  palier: null,
  prixPublicHtCents: null,
  factureHtCents: 334,
  montantCents: 100,
  autofactureNumero: null,
  autofactureEmiseAt: null,
  verseeAt: null,
  ...over,
});
const facture = { id: "F1", devisId: null, montantHtCents: 334, avoirDeId: null };
const avoirTotal = { id: "A1", devisId: null, montantHtCents: -334, avoirDeId: "F1" };
const avoirPartiel = { id: "A1", devisId: null, montantHtCents: -100, avoirDeId: "F1" };

beforeEach(() => {
  vi.clearAllMocks();
  d.factures = [facture, avoirTotal];
  d.lignes = [ligne()];
  d.reprisesDeja = [];
});

describe("prix net d'une commande", () => {
  it("factures moins avoirs (signe de l'avoir indifférent), jamais négatif", () => {
    expect(prixNetCommande([facture, avoirPartiel])).toEqual({
      brutCents: 334,
      netCents: 234,
      aDesAvoirs: true,
    });
    expect(prixNetCommande([facture, { ...avoirTotal, montantHtCents: 400 }]).netCents).toBe(0);
    expect(prixNetCommande([facture]).aDesAvoirs).toBe(false);
  });
});

describe("pas encore facturée : réduite ou annulée", () => {
  it("avoir total → annulée", async () => {
    const b = await reprendreApresAvoirsClients(LE);
    expect(d.annuler).toHaveBeenCalledWith("c1", expect.stringContaining("Art. 4.5"));
    expect(b).toMatchObject({ annulees: 1 });
  });

  it("avoir partiel → réduite au prix net ; une seconde fois (déjà au prix net) → rien", async () => {
    d.factures = [facture, avoirPartiel];
    await reprendreApresAvoirsClients(LE);
    expect(d.reduire).toHaveBeenCalledWith("c1", 234, expect.any(String));
    d.reduire.mockClear();
    d.lignes = [ligne({ factureHtCents: 234, montantCents: 70 })];
    await reprendreApresAvoirsClients(LE);
    expect(d.reduire).not.toHaveBeenCalled();
  });
});

describe("facturée, pas versée", () => {
  it("avoir total → retenue + avoir d'autofacture envoyé à l'apporteur", async () => {
    d.lignes = [ligne({ autofactureNumero: "AXI-APP-2026-0001" })];
    const b = await reprendreApresAvoirsClients(LE);
    expect(d.retenir).toHaveBeenCalledTimes(1);
    expect(b).toMatchObject({ retenues: 1 });
    expect(d.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        gabarit: "apporteur-commission-avoir-client",
        attachments: [expect.objectContaining({ filename: "AXI-APP-2026-0002.pdf" })],
      }),
    );
    expect(d.annuler).not.toHaveBeenCalled();
  });

  it("avoir partiel → rien tout de suite (la reprise suivra le versement)", async () => {
    d.factures = [facture, avoirPartiel];
    d.lignes = [ligne({ autofactureNumero: "AXI-APP-2026-0001" })];
    await reprendreApresAvoirsClients(LE);
    expect(d.retenir).not.toHaveBeenCalled();
    expect(d.reprise).not.toHaveBeenCalled();
  });
});

describe("déjà versée : reprise de la différence", () => {
  it("avoir total → reprise du montant entier", async () => {
    d.lignes = [ligne({ statut: "versee", autofactureNumero: "AXI-APP-2026-0001", verseeAt: LE })];
    const b = await reprendreApresAvoirsClients(LE);
    expect(d.reprise).toHaveBeenCalledWith(
      expect.objectContaining({ commissionId: "c1", demandeeCents: 100 }),
    );
    expect(b).toMatchObject({ reprises: 1 });
  });

  it("avoir partiel → reprise de la seule différence ; déjà reprise → rien (idempotent)", async () => {
    d.factures = [facture, avoirPartiel];
    d.lignes = [ligne({ statut: "versee", autofactureNumero: "AXI-APP-2026-0001", verseeAt: LE })];
    await reprendreApresAvoirsClients(LE);
    // 30 % de 2,34 € = 0,70 € : 0,30 € à reprendre.
    expect(d.reprise).toHaveBeenCalledWith(expect.objectContaining({ demandeeCents: 30 }));
    d.reprise.mockClear();
    d.reprisesDeja = [{ montantCents: -30 }];
    await reprendreApresAvoirsClients(LE);
    expect(d.reprise).not.toHaveBeenCalled();
  });
});

describe("sans avoir", () => {
  it("aucune facture d'avoir : rien n'est lu ni touché", async () => {
    d.factures = [facture];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b).toEqual({ reduites: 0, annulees: 0, retenues: 0, reprises: 0 });
    expect(d.annuler).not.toHaveBeenCalled();
    expect(d.retenir).not.toHaveBeenCalled();
  });
});
