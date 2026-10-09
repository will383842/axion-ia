import { beforeEach, describe, expect, it, vi } from "vitest";

// Art. 4.5 — la facture du client annulée (ou réduite) par un avoir : la commission suit.
// Essai réel du 09/10/2026 : après l'avoir AXI-AVO-2026-001, la commission de 1 € restait « à
// verser » et aucun bouton ne permettait de l'annuler. Relecture de a1 (5 défauts) couverte ici.

interface F {
  id: string;
  devisId: string | null;
  statut: string;
  montantHtCents: number;
  avoirDeId: string | null;
  emiseAt: Date | null;
  createdAt: Date | null;
}

const d = vi.hoisted(() => ({
  factures: [] as F[],
  lignes: [] as Array<Record<string, unknown>>,
  reprisesDeja: [] as Array<{ montantCents: number }>,
  filleulHorsGroupe: null as null | Record<string, unknown>,
  annuler: vi.fn(async () => ({ ok: true })),
  reduire: vi.fn(async () => ({ ok: true })),
  retenir: vi.fn(async () => ({
    ok: true,
    numero: "AXI-APP-2026-0002",
    avoir: { r2Key: "k", filename: "AXI-APP-2026-0002.pdf" },
  })),
  reprise: vi.fn(async () => ({ ok: true, message: "" })),
  envoyer: vi.fn(async () => "envoye"),
  maj: vi.fn(async () => ({ count: 1 })),
}));

type Where = Record<string, unknown>;
const correspond = (f: F, w: Where): boolean => {
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
      updateMany: (...a: unknown[]) => d.maj(...(a as [])),
      findFirst: vi.fn(async () => d.filleulHorsGroupe),
    },
    activityLog: { create: vi.fn(async () => ({})) },
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

import { dateDeLAnnulation, reprendreApresAvoirsClients } from "../avoir-client";

const LE = new Date("2026-10-09T11:10:00Z");
const DATE_AVOIR = new Date("2026-03-02T08:00:00Z");
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
  // Ligne créée avant les avoirs des jeux d'essai (qui la réduisent donc tous).
  creeAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});
const facture: F = {
  id: "F1",
  devisId: null,
  statut: "payee",
  montantHtCents: 334,
  avoirDeId: null,
  emiseAt: LE,
  createdAt: LE,
};
const avoir = (montant: number, over: Partial<F> = {}): F => ({
  id: "A1",
  devisId: null,
  statut: "emise",
  montantHtCents: montant,
  avoirDeId: "F1",
  emiseAt: DATE_AVOIR,
  createdAt: DATE_AVOIR,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  d.factures = [facture, avoir(-334)];
  d.lignes = [ligne()];
  d.reprisesDeja = [];
  d.filleulHorsGroupe = null;
});

describe("pas encore facturée : réduite ou annulée", () => {
  it("avoir total → annulée", async () => {
    const b = await reprendreApresAvoirsClients(LE);
    expect(d.annuler).toHaveBeenCalledWith("c1", expect.stringContaining("Art. 4.5"));
    expect(b).toMatchObject({ annulees: 1 });
  });

  it("avoir partiel → réduite au prix net ; déjà au prix net → rien", async () => {
    d.factures = [facture, avoir(-100)];
    await reprendreApresAvoirsClients(LE);
    expect(d.reduire).toHaveBeenCalledWith("c1", 234, expect.any(String));
    d.reduire.mockClear();
    d.lignes = [ligne({ factureHtCents: 234, montantCents: 70 })];
    await reprendreApresAvoirsClients(LE);
    expect(d.reduire).not.toHaveBeenCalled();
  });
});

describe("défaut 3 (a1) : un avoir annulé ou brouillon est sans effet (source unique)", () => {
  it.each(["annulee", "brouillon"])("avoir « %s » → rien n'est touché", async (statut) => {
    d.factures = [facture, avoir(-334, { statut })];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b).toEqual({ reduites: 0, annulees: 0, retenues: 0, reprises: 0 });
    expect(d.annuler).not.toHaveBeenCalled();
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
  });

  it("défaut 4 (a1) : la clé de l'e-mail porte le numéro de l'AVOIR, pas celui de l'autofacture", async () => {
    d.lignes = [
      ligne({ id: "c1", autofactureNumero: "AXI-APP-2026-0005" }),
      ligne({
        id: "c2",
        factureId: "F1",
        autofactureNumero: "AXI-APP-2026-0005",
        parrainage: true,
      }),
    ];
    d.retenir
      .mockResolvedValueOnce({
        ok: true,
        numero: "AXI-APP-2026-0006",
        avoir: { r2Key: "a", filename: "a.pdf" },
      })
      .mockResolvedValueOnce({
        ok: true,
        numero: "AXI-APP-2026-0007",
        avoir: { r2Key: "b", filename: "b.pdf" },
      });
    await reprendreApresAvoirsClients(LE);
    const cles = (d.envoyer.mock.calls as unknown as Array<[{ jobId: string }]>).map(
      (c) => c[0].jobId,
    );
    expect(cles).toEqual([
      "apporteur-commission-avoir-client-AXI-APP-2026-0006",
      "apporteur-commission-avoir-client-AXI-APP-2026-0007",
    ]);
  });

  it("avoir partiel → rien tout de suite (la reprise suivra le versement)", async () => {
    d.factures = [facture, avoir(-100)];
    d.lignes = [ligne({ autofactureNumero: "AXI-APP-2026-0001" })];
    await reprendreApresAvoirsClients(LE);
    expect(d.retenir).not.toHaveBeenCalled();
    expect(d.reprise).not.toHaveBeenCalled();
  });
});

describe("déjà versée : reprise de la différence", () => {
  const versee = { statut: "versee", autofactureNumero: "AXI-APP-2026-0001", verseeAt: LE };

  it("défaut 1 (a1) : la reprise est datée de l'AVOIR (délai de 24 mois), pas du passage", async () => {
    d.lignes = [ligne(versee)];
    await reprendreApresAvoirsClients(LE);
    expect(d.reprise).toHaveBeenCalledWith(
      expect.objectContaining({ commissionId: "c1", demandeeCents: 100, annulationLe: DATE_AVOIR }),
    );
    expect(dateDeLAnnulation([{ emiseAt: null, createdAt: DATE_AVOIR }])).toEqual(DATE_AVOIR);
  });

  it("avoir partiel → reprise de la seule différence ; déjà reprise → rien", async () => {
    d.factures = [facture, avoir(-100)];
    d.lignes = [ligne(versee)];
    await reprendreApresAvoirsClients(LE);
    // 30 % de 2,34 € = 0,70 € : 0,30 € à reprendre.
    expect(d.reprise).toHaveBeenCalledWith(expect.objectContaining({ demandeeCents: 30 }));
    d.reprise.mockClear();
    d.reprisesDeja = [{ montantCents: -30 }];
    await reprendreApresAvoirsClients(LE);
    expect(d.reprise).not.toHaveBeenCalled();
  });
});

describe("défaut 2 (a1) : la part du parrain n'est jamais reprise deux fois", () => {
  it("filleul pas encore facturé, parrain versé : seul ajustement.ts la porte (aucune reprise ici)", async () => {
    d.factures = [facture, avoir(-100)];
    d.lignes = [
      ligne({
        id: "parrain",
        parrainage: true,
        apporteurId: "p1",
        montantCents: 10,
        ...{ statut: "versee", autofactureNumero: "AXI-APP-2026-0001", verseeAt: LE },
      }),
      ligne({ id: "filleul" }),
    ];
    await reprendreApresAvoirsClients(LE);
    expect(d.reduire).toHaveBeenCalledWith("filleul", 234, expect.any(String));
    expect(d.reprise).not.toHaveBeenCalled();
  });

  it("filleul facturé, part du parrain pas encore facturée : réduite par écriture conditionnelle", async () => {
    d.lignes = [
      ligne({ id: "filleul", autofactureNumero: "AXI-APP-2026-0001" }),
      ligne({ id: "parrain", parrainage: true, apporteurId: "p1", montantCents: 10 }),
    ];
    await reprendreApresAvoirsClients(LE);
    expect(d.maj).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "parrain" }),
        data: { statut: "annulee" },
      }),
    );
    expect(d.retenir).toHaveBeenCalledTimes(1); // le filleul seul
  });
});

describe("sans avoir", () => {
  it("aucune facture d'avoir : rien n'est touché", async () => {
    d.factures = [facture];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b).toEqual({ reduites: 0, annulees: 0, retenues: 0, reprises: 0 });
  });
});

describe("dettes de a1 sur #1398", () => {
  const versee = { statut: "versee", autofactureNumero: "AXI-APP-2026-0001", verseeAt: LE };

  it("(a) un avoir de PLUS de 24 mois ne donne lieu à aucune reprise, même à côté d'un récent", async () => {
    const vieux = avoir(-100, { id: "A0", emiseAt: new Date("2024-01-01T00:00:00Z") });
    d.factures = [facture, vieux];
    d.lignes = [ligne(versee)];
    await reprendreApresAvoirsClients(LE);
    expect(d.reprise).not.toHaveBeenCalled();
    // Un avoir récent s'y ajoute : seule SA part est reprise (30 % de 1 € = 0,30 €).
    d.factures = [facture, vieux, avoir(-100, { id: "A1" })];
    await reprendreApresAvoirsClients(LE);
    expect(d.reprise).toHaveBeenCalledWith(
      expect.objectContaining({ demandeeCents: 30, annulationLe: DATE_AVOIR }),
    );
  });

  it("(b) filleul déjà annulé : la part VERSÉE du parrain est recalculée sur le filleul d'origine", async () => {
    d.factures = [facture, avoir(-334)];
    d.lignes = [
      ligne({ id: "parrain", parrainage: true, apporteurId: "p1", montantCents: 10, ...versee }),
    ];
    d.filleulHorsGroupe = ligne({ id: "filleul", statut: "annulee" });
    await reprendreApresAvoirsClients(LE);
    expect(d.reprise).toHaveBeenCalledWith(
      expect.objectContaining({ commissionId: "parrain", demandeeCents: 10 }),
    );
  });
});

describe("relecture de a1 sur #1402 : base = prix de la ligne à sa création", () => {
  it("vieil avoir déjà déduit à la création (234 €, 70 €), nouvel avoir de 100 € → 30 € repris", async () => {
    const ancien = avoir(-100, { id: "A0", emiseAt: new Date("2025-12-01T00:00:00Z") });
    d.factures = [facture, ancien, avoir(-100, { id: "A1" })];
    d.lignes = [
      ligne({
        statut: "versee",
        autofactureNumero: "AXI-APP-2026-0001",
        verseeAt: LE,
        factureHtCents: 23_400,
        montantCents: 7_020,
      }),
    ];
    d.factures = [
      { ...facture, montantHtCents: 33_400 },
      { ...ancien, montantHtCents: -10_000 },
      avoir(-10_000, { id: "A1" }),
    ];
    await reprendreApresAvoirsClients(LE);
    // 30 % de 134 € = 40,20 € : 70,20 − 40,20 = 30 € repris.
    expect(d.reprise).toHaveBeenCalledWith(expect.objectContaining({ demandeeCents: 3_000 }));
  });
});
