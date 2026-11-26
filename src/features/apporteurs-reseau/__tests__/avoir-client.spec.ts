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
  /** Le devis de la commande (base de signature), lu par `findUnique`. */
  devis?: { montantTotalHtCents: number } | null;
}

const d = vi.hoisted(() => ({
  factures: [] as F[],
  lignes: [] as Array<Record<string, unknown>>,
  reprisesDeja: [] as Array<{ montantCents: number; palier?: string; statut?: string }>,
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
  cree: vi.fn(async () => ({ id: "nouvelle" })),
  litige: true,
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
vi.mock("@/lib/prisma", () => {
  const prisma = {
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
      create: (...a: unknown[]) => d.cree(...(a as [])),
      findFirst: vi.fn(async () => d.filleulHorsGroupe),
    },
    activityLog: { create: vi.fn(async () => ({})) },
    apporteurReseau: {
      findUnique: vi.fn(async () => ({ prenom: "Essai", email: "essai@exemple.fr" })),
    },
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  return { prisma };
});
vi.mock("../litige", () => ({ litigeDisponible: async () => d.litige }));
// Tour 2/2 (défaut 7) : le complément passe par la vigilance comme toute commission neuve.
vi.mock("../commissions", () => ({
  statutApresVigilance: vi.fn(async () => ({ statut: "due", demander: false })),
  dejaEnvoye: vi.fn(async () => false),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn(async () => ({ enqueued: true })) }));
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
  d.litige = true;
});

describe("règle unique de l'avoir : la commission suit l'argent gardé, pour TOUS les produits", () => {
  it.each(["audit", "formation", "implementation", "site_web", "conference"])(
    "activité « %s » : avoir total → annulée (pas encore facturée), retenue (facturée) ou reprise (versée)",
    async (activite) => {
      d.lignes = [
        ligne({ activite }),
        ligne({ id: "c2", activite, autofactureNumero: "AXI-APP-2026-0001" }),
        ligne({ id: "c3", activite, statut: "versee", verseeAt: LE }),
      ];
      const b = await reprendreApresAvoirsClients(LE);
      expect(b).toMatchObject({ reduites: 0, annulees: 1, retenues: 1, reprises: 1 });
    },
  );
});

describe("tour 2", () => {
  it("coaching ancien (30 %) : un avoir partiel réduit la ligne au lieu de la laisser intacte", async () => {
    d.factures = [facture, avoir(-100)];
    d.lignes = [ligne({ activite: "un_a_un", montantCents: 100 })];
    await reprendreApresAvoirsClients(LE);
    expect(d.reduire).toHaveBeenCalledWith("c1", 234, expect.any(String));
    d.lignes = [ligne({ activite: "un_a_un", statut: "versee", verseeAt: LE, montantCents: 100 })];
    await reprendreApresAvoirsClients(LE);
    expect(d.reprise).toHaveBeenCalledTimes(1);
  });
  it("ligne déjà réduite avant facturation (factureHt = net) : aucune reprise au versement", async () => {
    d.factures = [facture, avoir(-100)];
    d.lignes = [ligne({ statut: "versee", verseeAt: LE, factureHtCents: 234, montantCents: 70 })];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.reprises).toBe(0);
    expect(d.reprise).not.toHaveBeenCalled();
  });
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
    expect(b).toMatchObject({ reduites: 0, annulees: 0, retenues: 0, reprises: 0 });
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
    expect(b).toMatchObject({ reduites: 0, annulees: 0, retenues: 0, reprises: 0 });
  });
});

describe("dettes de a1 sur #1398", () => {
  const versee = { statut: "versee", autofactureNumero: "AXI-APP-2026-0001", verseeAt: LE };

  it("(a) un avoir de PLUS de 24 mois ne donne lieu à aucune reprise, même à côté d'un récent", async () => {
    const vieux = avoir(-100, { id: "A0", emiseAt: new Date("2024-01-01T00:00:00Z") });
    d.factures = [facture, vieux];
    // Ligne créée AVANT le vieil avoir (donc sa base ne l'intègre pas).
    d.lignes = [ligne({ ...versee, creeAt: new Date("2023-06-01T00:00:00Z") })];
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

describe("tour 3 : avoir ancien déjà intégré à la base de la ligne", () => {
  it("C2 : avoir de 30 mois AVANT la ligne (base 234), avoir récent de 100 → reprise de la part du récent", async () => {
    const vieux = avoir(-100, { id: "A0", emiseAt: new Date("2024-01-01T00:00:00Z") });
    d.factures = [facture, vieux, avoir(-100, { id: "A1" })];
    d.lignes = [
      ligne({
        statut: "versee",
        verseeAt: LE,
        factureHtCents: 234,
        montantCents: 70,
        autofactureNumero: "X",
      }),
    ];
    await reprendreApresAvoirsClients(LE);
    expect(d.reprise).toHaveBeenCalledWith(expect.objectContaining({ demandeeCents: 30 }));
  });
});

describe("facture refaite sous le même devis, pas encore payée (point 1 de l'escalade)", () => {
  it("avoir total sur A payée + B refaite non payée : la commission c1 est annulée, pas conservée", async () => {
    d.factures = [
      { ...facture, devisId: "D1", montantHtCents: 200_000 },
      avoir(-200_000, { devisId: "D1" }),
      {
        ...facture,
        id: "B",
        devisId: "D1",
        statut: "emise",
        montantHtCents: 200_000,
        emiseAt: new Date("2026-11-05T10:00:00Z"),
      },
    ];
    d.lignes = [ligne({ factureHtCents: 200_000, montantCents: 60_000 })];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.annulees).toBe(1);
    expect(d.annuler).toHaveBeenCalledTimes(1);
  });

  it("avoir partiel sur le solde A2 + solde refait B non payé : aucune réduction (600 € restent 600 €)", async () => {
    d.factures = [
      { ...facture, id: "A1", devisId: "D1", montantHtCents: 60_000 },
      { ...facture, id: "F1", devisId: "D1", montantHtCents: 140_000 },
      avoir(-140_000, { devisId: "D1" }),
      { ...facture, id: "B", devisId: "D1", statut: "emise", montantHtCents: 140_000 },
    ];
    d.lignes = [ligne({ factureHtCents: 200_000, montantCents: 60_000 })];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b).toMatchObject({ reduites: 0, annulees: 0, retenues: 0, reprises: 0 });
    expect(d.reduire).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verdict Opus sur 900eb08f (défaut A) : le résultat ne doit PAS dépendre du moment du passage.
// Devis 2 000 € HT, intégration 15 % → cible 300 €. Chaque scénario rejoue l'état APRÈS le
// passage qui a réduit la ligne, puis l'état final : la ligne doit revenir à 300 €.
// ─────────────────────────────────────────────────────────────────────────────

const D = { montantTotalHtCents: 200_000 };
const fd = (id: string, montant: number, over: Partial<F> = {}): F => ({
  ...facture,
  id,
  devisId: "D1",
  montantHtCents: montant,
  devis: D,
  ...over,
});
const avD = (id: string, de: string, montant: number): F => ({
  ...avoir(-montant),
  id,
  avoirDeId: de,
  devisId: "D1",
  devis: D,
});
const ecritures = () =>
  d.maj.mock.calls.map((c) => (c as unknown as [{ data: Record<string, unknown> }])[0].data);

describe("défaut A : la commission cible ne dépend que de l'ÉTAT FINAL de la commande", () => {
  it("S45 — acompte 600 + solde 1 400 payés, avoir total sur le solde, passage (90 €), solde refait PAYÉ → 300 €", async () => {
    d.factures = [
      fd("AC", 60_000),
      fd("F1", 140_000),
      avD("AV", "F1", 140_000),
      fd("SR", 140_000, { emiseAt: new Date("2026-10-20T10:00:00Z") }),
    ];
    // État laissé par le passage d'avant : réduite à 90 € sur un net de 600 €.
    d.lignes = [ligne({ activite: "implementation", factureHtCents: 60_000, montantCents: 9_000 })];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.remontees).toBe(1);
    expect(ecritures()).toContainEqual({ montantCents: 30_000, factureHtCents: 200_000 });
    expect(d.reduire).not.toHaveBeenCalled();
  });

  it("S47 — même cas, commission déjà VERSÉE puis reprise de 210 € : complément de 210 € (net 300 €)", async () => {
    d.factures = [
      fd("AC", 60_000),
      fd("F1", 140_000),
      avD("AV", "F1", 140_000),
      fd("SR", 140_000, { emiseAt: new Date("2026-10-20T10:00:00Z") }),
    ];
    d.lignes = [
      ligne({
        activite: "implementation",
        statut: "versee",
        verseeAt: LE,
        autofactureNumero: "AXI-APP-2026-0001",
        factureHtCents: 200_000,
        montantCents: 30_000,
      }),
    ];
    d.reprisesDeja = [{ palier: "reprise:c1", montantCents: -21_000 }];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.complements).toBe(1);
    expect(d.cree).toHaveBeenCalledTimes(1);
    expect(d.cree).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          montantCents: 21_000,
          statut: "due",
          palier: "complement-de:c1",
        }),
      }),
    );
    expect(d.reprise).not.toHaveBeenCalled();
  });

  it("S47 rejoué : le complément est déjà là → aucun double effet", async () => {
    d.factures = [
      fd("AC", 60_000),
      fd("F1", 140_000),
      avD("AV", "F1", 140_000),
      fd("SR", 140_000, { emiseAt: new Date("2026-10-20T10:00:00Z") }),
    ];
    d.lignes = [
      ligne({
        activite: "implementation",
        statut: "versee",
        verseeAt: LE,
        autofactureNumero: "AXI-APP-2026-0001",
        factureHtCents: 200_000,
        montantCents: 30_000,
      }),
    ];
    d.reprisesDeja = [
      { palier: "reprise:c1", montantCents: -21_000 },
      { palier: "complement-de:c1", montantCents: 21_000, statut: "due" },
    ];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.complements).toBe(0);
    expect(d.cree).not.toHaveBeenCalled();
    expect(d.reprise).not.toHaveBeenCalled();
  });

  it("S63 — facture unique 2 000, avoir partiel 500, passage (225 €), complément 500 payé → 300 €", async () => {
    d.factures = [
      fd("F1", 200_000),
      avD("AV", "F1", 50_000),
      fd("CP", 50_000, { emiseAt: new Date("2026-10-20T10:00:00Z") }),
    ];
    d.lignes = [
      ligne({ activite: "implementation", factureHtCents: 150_000, montantCents: 22_500 }),
    ];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.remontees).toBe(1);
    expect(ecritures()).toContainEqual({ montantCents: 30_000, factureHtCents: 200_000 });
  });

  it("S65 — avoir total sur l'acompte, passage (210 €), acompte refait payé → 300 €", async () => {
    d.factures = [
      fd("F1", 60_000),
      fd("SO", 140_000),
      avD("AV", "F1", 60_000),
      fd("AR", 60_000, { emiseAt: new Date("2026-10-20T10:00:00Z") }),
    ];
    d.lignes = [
      ligne({ activite: "implementation", factureHtCents: 140_000, montantCents: 21_000 }),
    ];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.remontees).toBe(1);
    expect(ecritures()).toContainEqual({ montantCents: 30_000, factureHtCents: 200_000 });
  });

  it("la part du PARRAIN remonte avec le filleul (10 % de 300 € = 30 €)", async () => {
    d.factures = [
      fd("AC", 60_000),
      fd("F1", 140_000),
      avD("AV", "F1", 140_000),
      fd("SR", 140_000, { emiseAt: new Date("2026-10-20T10:00:00Z") }),
    ];
    d.lignes = [
      ligne({ activite: "implementation", factureHtCents: 60_000, montantCents: 9_000 }),
      ligne({
        id: "p1",
        apporteurId: "par",
        parrainage: true,
        activite: "implementation",
        factureHtCents: 200_000,
        montantCents: 900,
      }),
    ];
    await reprendreApresAvoirsClients(LE);
    expect(ecritures()).toContainEqual({ montantCents: 3_000 });
  });

  it("jamais plus que la cible : une ligne déjà à 300 € ne remonte pas au-delà", async () => {
    d.factures = [
      fd("AC", 60_000),
      fd("F1", 140_000),
      avD("AV", "F1", 140_000),
      fd("SR", 140_000, { emiseAt: new Date("2026-10-20T10:00:00Z") }),
    ];
    d.lignes = [
      ligne({ activite: "implementation", factureHtCents: 200_000, montantCents: 30_000 }),
    ];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.remontees).toBe(0);
    expect(d.maj).not.toHaveBeenCalled();
  });

  it("deux passages simultanés : l'écriture conditionnelle perdue ne compte rien (une seule remontée)", async () => {
    d.factures = [
      fd("AC", 60_000),
      fd("F1", 140_000),
      avD("AV", "F1", 140_000),
      fd("SR", 140_000, { emiseAt: new Date("2026-10-20T10:00:00Z") }),
    ];
    d.lignes = [ligne({ activite: "implementation", factureHtCents: 60_000, montantCents: 9_000 })];
    d.maj.mockResolvedValueOnce({ count: 0 });
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.remontees).toBe(0);
    expect(ecritures()[0]).toMatchObject({ montantCents: 30_000 });
    expect(ecritures()[0]).toHaveProperty("montantCents", 30_000);
  });
});

describe("défaut A : facture refaite émise mais IMPAYÉE → ni autofacture ni virement", () => {
  const enCours = () => {
    d.factures = [
      fd("AC", 60_000),
      fd("F1", 140_000),
      avD("AV", "F1", 140_000),
      fd("SR", 140_000, { statut: "emise", emiseAt: new Date("2026-10-20T10:00:00Z") }),
    ];
  };

  it("la ligne (due, facturée ou non) est SUSPENDUE, son montant ne bouge pas", async () => {
    enCours();
    d.lignes = [
      ligne({ activite: "audit", factureHtCents: 200_000, montantCents: 60_000 }),
      ligne({
        id: "c2",
        apporteurId: "a2",
        activite: "audit",
        factureHtCents: 200_000,
        montantCents: 60_000,
        autofactureNumero: "AXI-APP-2026-0009",
      }),
    ];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.suspendues).toBeGreaterThan(0);
    const w = d.maj.mock.calls[0] as unknown as [
      { where: { id: { in: string[] } }; data: Record<string, unknown> },
    ];
    expect(w[0].where.id.in).toEqual(["c1", "c2"]);
    expect(w[0].data.litigeDepuis).toEqual(LE);
    expect(String(w[0].data.litigeMotif)).toMatch(/^\[commande non soldée\]/);
    expect(d.reduire).not.toHaveBeenCalled();
    expect(d.retenir).not.toHaveBeenCalled();
  });

  it("une contestation saisie par Williams n'est ni écrasée ni levée", async () => {
    enCours();
    d.lignes = [
      ligne({
        litigeDepuis: LE,
        litigeMotif: "Contestation écrite du 01/10",
        montantCents: 60_000,
      }),
    ];
    await reprendreApresAvoirsClients(LE);
    expect(d.maj).not.toHaveBeenCalled();
  });

  it("refaite payée : la suspension automatique est LEVÉE (et la ligne suit la cible)", async () => {
    d.factures = [
      fd("AC", 60_000),
      fd("F1", 140_000),
      avD("AV", "F1", 140_000),
      fd("SR", 140_000, { emiseAt: new Date("2026-10-20T10:00:00Z") }),
    ];
    d.lignes = [
      ligne({
        activite: "audit",
        factureHtCents: 200_000,
        montantCents: 60_000,
        litigeDepuis: LE,
        litigeMotif: "[commande non soldée] facture refaite…",
      }),
    ];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.suspensionsLevees).toBe(1);
    expect(ecritures()).toContainEqual({ litigeDepuis: null, litigeMotif: null });
  });

  it("refaite jamais payée puis ANNULÉE : la ligne tombe à 180 € (30 % de 600 €) et repart", async () => {
    d.factures = [
      fd("AC", 60_000),
      fd("F1", 140_000),
      avD("AV", "F1", 140_000),
      fd("SR", 140_000, { statut: "annulee" }),
    ];
    d.lignes = [
      ligne({
        activite: "audit",
        factureHtCents: 200_000,
        montantCents: 60_000,
        litigeDepuis: LE,
        litigeMotif: "[commande non soldée] facture refaite…",
      }),
    ];
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.suspensionsLevees).toBe(1);
    expect(d.reduire).toHaveBeenCalledWith("c1", 60_000, expect.any(String));
  });
});

describe("tour 2/2 (défaut 4) : une reprise refusée n'est jamais silencieuse", () => {
  it("refus de `enregistrerReprise` → une alerte interne, clé unique par ligne et montant", async () => {
    const { enqueueEmail } = await import("@/server/queue/queues");
    d.lignes = [ligne({ statut: "versee", verseeAt: LE, autofactureNumero: "AXI-APP-2026-0001" })];
    d.reprise.mockResolvedValueOnce({ ok: false, message: "Plafond dépassé." } as never);
    await reprendreApresAvoirsClients(LE);
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(enqueueEmail).toHaveBeenCalledWith(
      "qualiopi-alerte-interne",
      expect.any(String),
      "fr",
      expect.objectContaining({ code: "apporteur_reprise_refusee" }),
      expect.objectContaining({ jobId: "apporteur-reprise-refusee-c1-100" }),
    );
  });
});
