import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot « grille » (contrat 2.8, annexe 1) : le PASSAGE crée les commissions selon la nouvelle grille.
// Journée IA reconnue par `devis.journee_ia` ; Journée IA non reconnue → ligne « à qualifier » et
// alerte interne dédoublonnée ; acompte sans devis → rien ; jamais de ligne à 0,00 €.

const etat = vi.hoisted(() => ({
  presentations: [] as unknown[],
  payees: [] as unknown[],
  lignes: [] as unknown[],
  journees: [] as Array<{ id: string; journeeIa: boolean }> | Error,
  crees: [] as Array<Record<string, unknown>>,
  alertes: [] as Array<{ payload: Record<string, unknown>; opts: Record<string, unknown> }>,
}));

vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, vrai.AVANT_2_6] as const)),
    lireSiretsDevis: async () => new Map(),
    lireDecisionsAAttribuer: async () => new Map(),
    lireAAttribuerEnAttente: async () => [],
    ouvrirAAttribuer: vi.fn(async () => true),
  };
});
vi.mock("../avoir-client", () => ({ reprendreApresAvoirsClients: vi.fn(async () => ({})) }));
vi.mock("../lignes-hors-grille", () => ({
  annulerLignesHorsGrille: vi.fn(async () => ({ annulees: 0, alertes: 0 })),
}));
vi.mock("../manquement", () => ({ regenererAvoirsSansPiece: vi.fn(async () => 0) }));
vi.mock("../facturation", () => ({
  facturerCommissionsDues: vi.fn(async () => ({
    autofactures: 0,
    commissions: 0,
    ecartees: 0,
    erreurs: 0,
  })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../alerte-vigilance", () => ({ alerterPiecesVigilanceDeposees: vi.fn(async () => 0) }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(
    async (
      _g: string,
      _d: string,
      _l: string,
      payload: Record<string, unknown>,
      opts: Record<string, unknown>,
    ) => {
      etat.alertes.push({ payload, opts });
      return { enqueued: true };
    },
  ),
}));
vi.mock("../commissions", () => ({
  libererSiPiecesValides: vi.fn(async () => 0),
  relancerVigilance: vi.fn(async () => false),
  demanderVigilance: vi.fn(async () => "deja"),
  dejaEnvoye: vi.fn(async () => false),
  piecesVigilanceValides: vi.fn(async () => true),
  statutApresVigilance: vi.fn(async () => ({ statut: "due", demander: false })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: {
      findMany: vi.fn(async (a: { where: { statut?: unknown } }) =>
        typeof a.where.statut === "string" ? [] : etat.presentations,
      ),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    factureFormation: {
      findMany: vi.fn(async (a: { where: { statut?: string; avoirDeId?: unknown } }) => {
        if (a.where.statut === "payee") return etat.payees;
        if (a.where.avoirDeId === null) return etat.lignes;
        return [];
      }),
    },
    commissionApporteur: {
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.crees.push(a.data);
        return a.data;
      }),
    },
    presentationReservation: { findMany: vi.fn(async () => []) },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    devis: {
      findMany: vi.fn(async (a: { where: { id?: unknown } }) => {
        if (!a.where.id) return [];
        if (etat.journees instanceof Error) throw etat.journees;
        return etat.journees;
      }),
    },
    apporteurReseau: { findMany: vi.fn(async () => []) },
  },
}));

import { passerFacturationApporteurs } from "../passage-quotidien";

const MAINTENANT = new Date("2026-11-26T08:00:00Z");
const protegee = (parrain = false) => ({
  id: "P1",
  apporteurId: "APP1",
  siren: "123456782",
  denomination: "Acme",
  recueAt: new Date("2026-08-01T00:00:00Z"),
  statut: "confirmee",
  confirmeeAt: new Date("2026-08-05T00:00:00Z"),
  protegeeJusquAt: new Date("2027-02-05T00:00:00Z"),
  apporteur: {
    prenom: "A",
    nom: "B",
    email: "a@b.fr",
    parrainId: parrain ? "PAR1" : null,
    signeParSocieteAt: parrain ? new Date("2026-08-01T00:00:00Z") : null,
  },
});
const ligneJ = (designation = "Journée IA", prix = 149_000, quantite = 1) => ({
  designation,
  quantite,
  prixUnitaireHtCents: prix,
});
const fac = (o: Record<string, unknown>) => ({
  id: "F",
  devisId: "D1",
  statut: "payee",
  avoirDeId: null,
  activite: "audit",
  montantHtCents: 149_000,
  emiseAt: new Date("2026-11-10T00:00:00Z"),
  lignes: [ligneJ()],
  devis: { acceptedAt: new Date("2026-11-01T00:00:00Z"), montantTotalHtCents: 149_000 },
  client: { siren: "123456782" },
  ...o,
});

beforeEach(() => {
  etat.presentations = [protegee()];
  etat.payees = [{ id: "F", devisId: "D1" }];
  etat.lignes = [fac({})];
  etat.journees = [];
  etat.crees = [];
  etat.alertes = [];
});

describe("Journée IA (A1.1, art. 4.1 bis)", () => {
  it("devis marqué `journee_ia` : 500 € au prix de référence, activité et palier « Journée IA »", async () => {
    etat.journees = [{ id: "D1", journeeIa: true }];
    const bilan = await passerFacturationApporteurs(MAINTENANT);
    expect(bilan.erreurs).toBe(0);
    expect(etat.crees).toEqual([
      expect.objectContaining({
        activite: "journee_ia",
        palier: "journee-ia",
        prixPublicHtCents: 149_000,
        montantCents: 50_000,
        factureHtCents: 149_000,
        statut: "due",
      }),
    ]);
  });

  it("payée 1 192 € HT (20 % de remise) : 400 €", async () => {
    etat.journees = [{ id: "D1", journeeIa: true }];
    etat.lignes = [
      fac({
        montantHtCents: 119_200,
        devis: { acceptedAt: new Date("2026-11-01T00:00:00Z"), montantTotalHtCents: 119_200 },
      }),
    ];
    await passerFacturationApporteurs(MAINTENANT);
    expect(etat.crees[0]).toMatchObject({ montantCents: 40_000 });
  });

  it("ligne « Journée IA » sur un devis NON marqué : ligne à qualifier + alerte interne dédoublonnée", async () => {
    etat.journees = [{ id: "D1", journeeIa: false }];
    await passerFacturationApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([
      expect.objectContaining({ statut: "a_qualifier", activite: "inconnue" }),
    ]);
    expect(etat.crees[0]).not.toHaveProperty("montantCents");
    const a = etat.alertes.filter((x) => x.payload.code === "apporteur_journee_ia_non_reconnue");
    expect(a).toHaveLength(1);
    expect(a[0]!.opts.jobId).toBe("apporteur-journee-ia-non-reconnue-F");
  });

  it("colonne `journee_ia` illisible (worker en avance sur la migration) : même prudence, pas d'échec", async () => {
    etat.journees = Object.assign(new Error("colonne absente"), { code: "P2022" });
    const bilan = await passerFacturationApporteurs(MAINTENANT);
    expect(bilan.erreurs).toBe(0);
    expect(etat.crees).toEqual([expect.objectContaining({ statut: "a_qualifier" })]);
  });
});

describe("jamais de ligne à 0,00 €, jamais d'acompte commissionné", () => {
  it("acompte SANS devis payé seul : aucune commission", async () => {
    etat.payees = [{ id: "A", devisId: null }];
    etat.lignes = [
      fac({
        id: "A",
        devisId: null,
        devis: null,
        activite: "implementation",
        montantHtCents: 300_000,
        lignes: [ligneJ("Acompte de 30 % — devis D-2026-004", 300_000)],
      }),
    ];
    await passerFacturationApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  it("commission arrondie à 0 € : aucune ligne créée", async () => {
    etat.lignes = [
      fac({
        activite: "implementation",
        montantHtCents: 3,
        lignes: [ligneJ("Automatisation", 3)],
        devis: { acceptedAt: new Date("2026-11-01T00:00:00Z"), montantTotalHtCents: 3 },
      }),
    ];
    await passerFacturationApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  it("part du parrain arrondie à 0 € : la commission du filleul seule", async () => {
    etat.presentations = [protegee(true)];
    etat.lignes = [
      fac({
        activite: "audit",
        montantHtCents: 10,
        lignes: [ligneJ("Audit", 10)],
        devis: { acceptedAt: new Date("2026-11-01T00:00:00Z"), montantTotalHtCents: 10 },
      }),
    ];
    await passerFacturationApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([expect.objectContaining({ apporteurId: "APP1", montantCents: 3 })]);
  });
});
