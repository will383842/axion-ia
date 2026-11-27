import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  presentations: [] as unknown[],
  payees: [] as unknown[],
  lignes: [] as unknown[],
  avoirs: [] as unknown[],
  commissions: [] as unknown[],
  reprises: [] as unknown[],
  crees: [] as Array<Record<string, unknown>>,
}));

// Contrat 2.6 : présentations d'avant la 2.6 (sans établissement), elles couvrent l'entreprise.
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
// Étape « avoirs-clients » (art. 4.5) : testée à part (avoir-client.spec.ts).
vi.mock("../avoir-client", () => ({ reprendreApresAvoirsClients: vi.fn(async () => ({})) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../alerte-vigilance", () => ({ alerterPiecesVigilanceDeposees: vi.fn(async () => 0) }));
vi.mock("../commissions", () => ({
  libererSiPiecesValides: vi.fn(async () => 0),
  relancerVigilance: vi.fn(async () => false),
  demanderVigilance: vi.fn(async () => "deja"),
  dejaEnvoye: vi.fn(async () => true),
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
        return etat.avoirs;
      }),
    },
    commissionApporteur: {
      findMany: vi.fn(async (a?: { where?: { palier?: unknown } }) =>
        a?.where?.palier
          ? etat.reprises
          : // Les lignes existantes sont nées au paiement de la première facture (10/09), avant
            // toute facture refaite : c'est leur date de création qui borne la commande « rendue ».
            etat.commissions.map((c) => ({
              creeAt: new Date("2026-09-10T00:00:00Z"),
              ...(c as Record<string, unknown>),
            })),
      ),
      groupBy: vi.fn(async () => []),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.crees.push(a.data);
        return a.data;
      }),
    },
    presentationReservation: { findMany: vi.fn(async () => []) },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    devis: { findMany: vi.fn(async () => []) },
    apporteurReseau: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => ({ signatureApporteur: { version: "2.6" } })),
    },
  },
}));

import { passerReseauApporteurs } from "../passage-quotidien";

const MAINTENANT = new Date("2026-10-05T08:00:00Z");
const protegee = {
  id: "P1",
  apporteurId: "APP1",
  siren: "123456782",
  denomination: "Acme",
  recueAt: new Date("2026-08-01T00:00:00Z"),
  confirmeeAt: new Date("2026-08-05T00:00:00Z"),
  protegeeJusquAt: new Date("2027-02-05T00:00:00Z"),
  apporteur: {
    prenom: "A",
    nom: "B",
    email: "a@b.fr",
    parrainId: null,
    signeParSocieteAt: null,
    // Contrat 2.8 : grille v3 (décision du 27/11, la version signée choisit la grille).
    signatureApporteur: { version: "2.8" } as unknown,
  },
};
const fac = (o: Record<string, unknown>) => ({
  id: "F",
  devisId: "D1",
  statut: "payee",
  avoirDeId: null,
  activite: "audit",
  montantHtCents: 100_000,
  emiseAt: new Date("2026-09-01T00:00:00Z"),
  devis: { acceptedAt: new Date("2026-08-20T00:00:00Z") },
  client: { siren: "123456782" },
  ...o,
});

beforeEach(() => {
  etat.presentations = [protegee];
  etat.payees = [];
  etat.lignes = [];
  etat.avoirs = [];
  etat.commissions = [];
  etat.reprises = [];
  etat.crees = [];
});

describe("passage quotidien : commission par commande soldée", () => {
  it("acompte payé seul : aucune commission", async () => {
    etat.payees = [{ id: "A", devisId: "D1" }];
    etat.lignes = [
      fac({ id: "A", montantHtCents: 60_000 }),
      fac({ id: "S", statut: "emise", montantHtCents: 140_000 }),
    ];
    const bilan = await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
    expect(bilan.commissionsCreees).toBe(0);
  });

  it("acompte + solde payés : une commission, 30 % du total HT facturé (audit)", async () => {
    etat.payees = [
      { id: "A", devisId: "D1" },
      { id: "S", devisId: "D1" },
    ];
    etat.lignes = [
      fac({ id: "A", montantHtCents: 60_000, emiseAt: new Date("2026-09-01T00:00:00Z") }),
      fac({ id: "S", montantHtCents: 140_000, emiseAt: new Date("2026-09-20T00:00:00Z") }),
    ];
    const bilan = await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toHaveLength(1);
    expect(etat.crees[0]).toMatchObject({
      factureId: "S",
      apporteurId: "APP1",
      factureHtCents: 200_000,
      montantCents: 60_000,
    });
    expect(bilan.commissionsCreees).toBe(1);
  });

  it("avoir partiel avant le passage : la commission suit l'argent gardé (décision du 25/11)", async () => {
    etat.payees = [{ id: "A", devisId: "D1" }];
    etat.lignes = [fac({ id: "A", montantHtCents: 200_000 })];
    etat.avoirs = [
      {
        id: "AV",
        devisId: "D1",
        statut: "emise",
        avoirDeId: "A",
        montantHtCents: -50_000,
        emiseAt: null,
      },
    ];
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees[0]).toMatchObject({ factureHtCents: 150_000, montantCents: 45_000 });
  });

  it("commission déjà créée sur l'acompte (ancien comportement) : jamais doublée sur le solde", async () => {
    etat.payees = [
      { id: "A", devisId: "D1" },
      { id: "S", devisId: "D1" },
    ];
    etat.lignes = [fac({ id: "A" }), fac({ id: "S", emiseAt: new Date("2026-09-20T00:00:00Z") })];
    etat.commissions = [{ factureId: "A", apporteurId: "APP1", parrainage: false }];
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  describe("avoir total puis facture refaite sous le même devis (tour 3)", () => {
    it("annulation volontaire sur une facture NON remboursée : continue de bloquer", async () => {
      etat.payees = [
        { id: "A", devisId: "D1" },
        { id: "B", devisId: "D1" },
      ];
      etat.lignes = [fac({ id: "A" }), fac({ id: "B", emiseAt: new Date("2026-09-20T00:00:00Z") })];
      etat.commissions = [
        { factureId: "A", apporteurId: "APP1", parrainage: false, statut: "annulee" },
      ];
      await passerReseauApporteurs(MAINTENANT);
      expect(etat.crees).toEqual([]);
    });
    const avecParrain = () => {
      etat.presentations = [
        {
          ...protegee,
          apporteur: {
            ...protegee.apporteur,
            parrainId: "PAR1",
            signeParSocieteAt: new Date("2026-06-01T00:00:00Z"),
          },
        },
      ];
      etat.payees = [
        { id: "A", devisId: "D1" },
        { id: "B", devisId: "D1" },
      ];
      etat.lignes = [
        fac({ id: "A", montantHtCents: 200_000 }),
        fac({ id: "B", montantHtCents: 200_000, emiseAt: new Date("2026-09-20T00:00:00Z") }),
      ];
      etat.avoirs = [
        {
          id: "AV",
          devisId: "D1",
          statut: "emise",
          avoirDeId: "A",
          montantHtCents: -200_000,
          emiseAt: null,
        },
      ];
    };
    it("filleul et parrain annulés : refaite → une commission ET sa part (même résultat qu'avant le passage)", async () => {
      avecParrain();
      etat.commissions = [
        { factureId: "A", apporteurId: "APP1", parrainage: false, statut: "annulee" },
        { factureId: "A", apporteurId: "PAR1", parrainage: true, statut: "annulee" },
      ];
      await passerReseauApporteurs(MAINTENANT);
      expect(etat.crees).toHaveLength(2);
    });
    it("filleul versé puis repris en totalité (facture A rendue), parrain annulé : refaite → filleul ET part recréés", async () => {
      avecParrain();
      etat.commissions = [
        {
          id: "C1",
          factureId: "A",
          apporteurId: "APP1",
          parrainage: false,
          statut: "versee",
          montantCents: 60_000,
        },
        { factureId: "A", apporteurId: "PAR1", parrainage: true, statut: "annulee" },
      ];
      etat.reprises = [{ palier: "reprise-de:C1", montantCents: -60_000 }];
      await passerReseauApporteurs(MAINTENANT);
      expect(etat.crees).toHaveLength(2);
    });
    it("filleul versé, reprise PARTIELLE (300 € sur 600 €) : la refaite ne recrée rien (600 € au total)", async () => {
      avecParrain();
      etat.commissions = [
        {
          id: "C1",
          factureId: "A",
          apporteurId: "APP1",
          parrainage: false,
          statut: "versee",
          montantCents: 60_000,
        },
        { factureId: "A", apporteurId: "PAR1", parrainage: true, statut: "due" },
      ];
      etat.reprises = [{ palier: "reprise-de:C1", montantCents: -30_000 }];
      await passerReseauApporteurs(MAINTENANT);
      expect(etat.crees).toEqual([]);
    });
    it("verdict E : filleul déjà recréé VIVANT sur B, part du parrain manquante (l'ancienne annulée) → elle renaît", async () => {
      avecParrain();
      etat.commissions = [
        { factureId: "A", apporteurId: "APP1", parrainage: false, statut: "annulee" },
        { factureId: "A", apporteurId: "PAR1", parrainage: true, statut: "annulee" },
        {
          factureId: "B",
          apporteurId: "APP1",
          parrainage: false,
          statut: "due",
          montantCents: 60_000,
          creeAt: new Date("2026-10-01T00:00:00Z"),
        },
      ];
      await passerReseauApporteurs(MAINTENANT);
      expect(etat.crees).toHaveLength(1);
      expect(etat.crees[0]).toMatchObject({ apporteurId: "PAR1", parrainage: true });
    });
    it("verdict F : avoir total rattaché à l'ACOMPTE, ligne sur le solde annulée, refaite payée → recréée", async () => {
      etat.payees = [
        { id: "AC", devisId: "D1" },
        { id: "SO", devisId: "D1" },
        { id: "R", devisId: "D1" },
      ];
      etat.lignes = [
        fac({ id: "AC", montantHtCents: 60_000 }),
        fac({ id: "SO", montantHtCents: 140_000, emiseAt: new Date("2026-09-05T00:00:00Z") }),
        fac({ id: "R", montantHtCents: 200_000, emiseAt: new Date("2026-09-20T00:00:00Z") }),
      ];
      etat.avoirs = [
        {
          id: "AV",
          devisId: "D1",
          statut: "emise",
          avoirDeId: "AC",
          montantHtCents: -200_000,
          emiseAt: null,
        },
      ];
      etat.commissions = [
        { factureId: "SO", apporteurId: "APP1", parrainage: false, statut: "annulee" },
      ];
      await passerReseauApporteurs(MAINTENANT);
      expect(etat.crees).toHaveLength(1);
      expect(etat.crees[0]).toMatchObject({ apporteurId: "APP1", factureId: "R" });
    });
    it("c1 encore « due » (avoir pas encore traité), A rendue, B payée : aucune seconde commission", async () => {
      avecParrain();
      etat.commissions = [
        {
          id: "C1",
          factureId: "A",
          apporteurId: "APP1",
          parrainage: false,
          statut: "due",
          montantCents: 60_000,
        },
        { factureId: "A", apporteurId: "PAR1", parrainage: true, statut: "due" },
      ];
      await passerReseauApporteurs(MAINTENANT);
      expect(etat.crees).toEqual([]);
    });
  });

  it("client sans SIREN : aucune commission", async () => {
    etat.payees = [{ id: "A", devisId: "D1" }];
    etat.lignes = [fac({ id: "A", client: { siren: null } })];
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  it("commande signée avant la présentation : aucune commission", async () => {
    etat.payees = [{ id: "A", devisId: "D1" }];
    etat.lignes = [fac({ id: "A", devis: { acceptedAt: new Date("2026-07-01T00:00:00Z") } })];
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  const unePayee = (o: Record<string, unknown> = {}) => {
    etat.payees = [{ id: "A", devisId: "D1" }];
    etat.lignes = [fac({ id: "A", ...o })];
  };

  it("SIREN pas encore confirmé par l'entreprise à la date de commande : aucune commission", async () => {
    etat.presentations = [{ ...protegee, confirmeeAt: null, protegeeJusquAt: null }];
    unePayee();
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  it("commande signée après la fin de la protection : aucune commission", async () => {
    unePayee({ devis: { acceptedAt: new Date("2027-02-06T00:00:00Z") } });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  it("SIREN attribué à un autre apporteur seulement : l'apporteur sans présentation ne touche rien", async () => {
    unePayee({ client: { siren: "552100554" } });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  it("développement web : 15 % du HT facturé (A1.5 du contrat 2.8), soldé et attribué", async () => {
    unePayee({
      activite: "site_web",
      montantHtCents: 200_000,
      devis: { acceptedAt: new Date("2026-12-01T00:00:00Z") },
    });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees[0]).toMatchObject({ montantCents: 30_000 });
  });

  it("développement web signé AVANT la date d'effet : aucune commission rétroactive", async () => {
    unePayee({ activite: "site_web", montantHtCents: 400_000 });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  it("conférence signée AVANT le 26/11/2026 : forfait de l'ancien contrat ; APRÈS : aucune commission", async () => {
    unePayee({ activite: "conference", montantHtCents: 300_000 });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees[0]).toMatchObject({ montantCents: 50_000 });
    etat.crees = [];
    unePayee({
      activite: "conference",
      montantHtCents: 300_000,
      devis: { acceptedAt: new Date("2026-11-26T09:00:00Z") },
    });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  describe("maintenance sur la même facture que la mise en service", () => {
    const LM = [
      { designation: "Mise en service du site", quantite: 1, prixUnitaireHtCents: 400_000 },
      { designation: "Maintenance mensuelle", quantite: 1, prixUnitaireHtCents: 15_000 },
    ];
    const DEVIS = {
      acceptedAt: new Date("2026-12-01T00:00:00Z"),
      montantTotalHtCents: 415_000,
      journeeIa: false,
      lignes: LM,
    };
    const f = (id: string) =>
      fac({ id, activite: "site_web", montantHtCents: 415_000, lignes: LM, devis: DEVIS });

    it("mise en service 4 000 € + maintenance 150 € → 600 €", async () => {
      etat.payees = [{ id: "F1", devisId: "D1" }];
      etat.lignes = [f("F1")];
      await passerReseauApporteurs(MAINTENANT);
      expect(etat.crees[0]).toMatchObject({ factureHtCents: 400_000, montantCents: 60_000 });
    });

    it("facture refaite après un avoir total : 600 €, jamais 622,50 €", async () => {
      etat.payees = [{ id: "F2", devisId: "D1" }];
      etat.lignes = [f("F1"), f("F2")];
      etat.avoirs = [
        {
          id: "AV",
          devisId: "D1",
          statut: "emise",
          avoirDeId: "F1",
          montantHtCents: -415_000,
          emiseAt: null,
          lignes: [
            { designation: "Mise en service du site", quantite: 1, prixUnitaireHtCents: -400_000 },
            { designation: "Maintenance mensuelle", quantite: 1, prixUnitaireHtCents: -15_000 },
          ],
        },
      ];
      await passerReseauApporteurs(MAINTENANT);
      expect(etat.crees[0]).toMatchObject({ montantCents: 60_000 });
    });

    // PLAFOND STRICT (décision du pilote 26/11) : base ≤ total HT du devis − récurrent brut.
    describe("plafond strict : « total HT du devis − récurrent brut »", () => {
      const L1000 = [
        { designation: "Mise en service du site", quantite: 1, prixUnitaireHtCents: 400_000 },
        { designation: "Maintenance mensuelle", quantite: 1, prixUnitaireHtCents: 100_000 },
      ];
      const D1000 = { ...DEVIS, montantTotalHtCents: 500_000, lignes: L1000 };
      const avoirTotal = (id: string, deId: string, lignes: unknown[], montant: number) => ({
        id,
        devisId: "D1",
        statut: "emise",
        avoirDeId: deId,
        montantHtCents: -montant,
        emiseAt: null,
        lignes,
      });
      const ligneUnique = (montant: number, designation = "Prestation selon devis") => [
        { designation, quantite: 1, prixUnitaireHtCents: montant },
      ];

      it("devis 4 000 € + 1 000 € de maintenance, F1 détaillée, avoir total, F2 « Prestation selon devis » 5 000 € → 600 €", async () => {
        etat.payees = [{ id: "F2", devisId: "D1" }];
        etat.lignes = [
          fac({
            id: "F1",
            activite: "site_web",
            montantHtCents: 500_000,
            lignes: L1000,
            devis: D1000,
          }),
          fac({
            id: "F2",
            activite: "site_web",
            montantHtCents: 500_000,
            lignes: ligneUnique(500_000),
            devis: D1000,
          }),
        ];
        etat.avoirs = [
          avoirTotal(
            "AV",
            "F1",
            [
              {
                designation: "Mise en service du site",
                quantite: 1,
                prixUnitaireHtCents: -400_000,
              },
              { designation: "Maintenance mensuelle", quantite: 1, prixUnitaireHtCents: -100_000 },
            ],
            500_000,
          ),
        ];
        await passerReseauApporteurs(MAINTENANT);
        expect(etat.crees).toHaveLength(1);
        expect(etat.crees[0]).toMatchObject({ factureHtCents: 400_000, montantCents: 60_000 });
        // Le plafond a réduit la base (taux_ht) : la règle posée est plafond_base.
        expect(etat.crees[0]).toMatchObject({ regleAppliquee: "plafond_base" });
      });

      it("devis 4 000 € + 150 €, facture refaite en ligne unique 4 150 € → 600 €", async () => {
        etat.payees = [{ id: "F2", devisId: "D1" }];
        etat.lignes = [
          fac({
            id: "F1",
            activite: "site_web",
            montantHtCents: 415_000,
            lignes: LM,
            devis: DEVIS,
          }),
          fac({
            id: "F2",
            activite: "site_web",
            montantHtCents: 415_000,
            lignes: ligneUnique(415_000),
            devis: DEVIS,
          }),
        ];
        etat.avoirs = [
          avoirTotal(
            "AV",
            "F1",
            [
              {
                designation: "Mise en service du site",
                quantite: 1,
                prixUnitaireHtCents: -400_000,
              },
              { designation: "Maintenance mensuelle", quantite: 1, prixUnitaireHtCents: -15_000 },
            ],
            415_000,
          ),
        ];
        await passerReseauApporteurs(MAINTENANT);
        expect(etat.crees[0]).toMatchObject({ factureHtCents: 400_000, montantCents: 60_000 });
      });

      it("deux acomptes à ligne unique, avoir partiel « maintenance », complément « Maintenance » → 600 €", async () => {
        const acompte = (id: string) =>
          fac({
            id,
            activite: "site_web",
            montantHtCents: 207_500,
            lignes: ligneUnique(207_500, "Acompte de 50 % — devis D1"),
            devis: DEVIS,
          });
        etat.payees = [{ id: "C", devisId: "D1" }];
        etat.lignes = [
          acompte("A1"),
          acompte("A2"),
          fac({
            id: "C",
            activite: "site_web",
            montantHtCents: 15_000,
            lignes: ligneUnique(15_000, "Maintenance"),
            devis: DEVIS,
          }),
        ];
        etat.avoirs = [
          avoirTotal("AV", "A1", ligneUnique(-15_000, "Avoir partiel — maintenance"), 15_000),
        ];
        await passerReseauApporteurs(MAINTENANT);
        for (const c of etat.crees) {
          expect(c.factureHtCents).toBeLessThanOrEqual(400_000);
          expect(c.montantCents).toBeLessThanOrEqual(60_000);
        }
        expect(etat.crees[0]).toMatchObject({ montantCents: 60_000 });
      });

      it("non-régression : avoir annulé → 600 € (l'avoir sans effet ne change rien)", async () => {
        etat.payees = [{ id: "F1", devisId: "D1" }];
        etat.lignes = [f("F1")];
        etat.avoirs = [
          {
            ...avoirTotal("AV", "F1", ligneUnique(-10_000, "Avoir partiel"), 10_000),
            statut: "annulee",
          },
        ];
        await passerReseauApporteurs(MAINTENANT);
        expect(etat.crees[0]).toMatchObject({ factureHtCents: 400_000, montantCents: 60_000 });
      });

      it("non-régression : avoir « Maintenance » + facture complémentaire « Maintenance » → 600 €", async () => {
        const maint = (m: number) => [
          { designation: "Maintenance mensuelle", quantite: 1, prixUnitaireHtCents: m },
        ];
        etat.payees = [{ id: "F2", devisId: "D1" }];
        etat.lignes = [
          f("F1"),
          fac({
            id: "F2",
            activite: "site_web",
            montantHtCents: 15_000,
            lignes: maint(15_000),
            devis: DEVIS,
          }),
        ];
        etat.avoirs = [avoirTotal("AV", "F1", maint(-15_000), 15_000)];
        await passerReseauApporteurs(MAINTENANT);
        expect(etat.crees).toHaveLength(1);
        expect(etat.crees[0]).toMatchObject({ factureHtCents: 400_000, montantCents: 60_000 });
      });

      it("non-régression : acompte + solde détaillés → 600 €", async () => {
        const part = (id: string) =>
          fac({ id, activite: "site_web", montantHtCents: 207_500, lignes: LM, devis: DEVIS });
        etat.payees = [{ id: "B", devisId: "D1" }];
        etat.lignes = [part("A"), part("B")];
        await passerReseauApporteurs(MAINTENANT);
        expect(etat.crees[0]).toMatchObject({ montantCents: 60_000 });
      });

      it("non-régression : avoir de 100 € → 585 € (le calcul actuel donne moins que le plafond)", async () => {
        etat.payees = [{ id: "F1", devisId: "D1" }];
        etat.lignes = [f("F1")];
        etat.avoirs = [avoirTotal("AV", "F1", ligneUnique(-10_000, "Avoir partiel"), 10_000)];
        await passerReseauApporteurs(MAINTENANT);
        expect(etat.crees[0]).toMatchObject({ montantCents: 58_500 });
      });

      it("devis sans ligne récurrente : plafond = total HT du devis", async () => {
        etat.payees = [{ id: "F1", devisId: "D1" }];
        etat.lignes = [
          fac({
            id: "F1",
            activite: "site_web",
            montantHtCents: 400_000,
            lignes: ligneUnique(400_000),
            devis: { ...DEVIS, montantTotalHtCents: 400_000, lignes: ligneUnique(400_000) },
          }),
        ];
        await passerReseauApporteurs(MAINTENANT);
        expect(etat.crees[0]).toMatchObject({ factureHtCents: 400_000, montantCents: 60_000 });
      });
    });
  });

  it("implémentation : 15 % du HT ; 1-to-1 : aucune commission", async () => {
    unePayee({ activite: "implementation", montantHtCents: 200_000 });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees[0]).toMatchObject({ montantCents: 30_000 });
    etat.crees = [];
    unePayee({ activite: "un_a_un", montantHtCents: 200_000 });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  it("formation : ligne « à qualifier » sans montant (le palier se choisit à la main)", async () => {
    unePayee({ activite: "formation", montantHtCents: 190_000 });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees[0]).toMatchObject({ statut: "a_qualifier", activite: "formation" });
    expect(etat.crees[0]).not.toHaveProperty("montantCents");
  });

  it("parrain : 10 % de la commission du filleul quand la commande tombe dans les 6 mois", async () => {
    etat.presentations = [
      {
        ...protegee,
        apporteur: {
          ...protegee.apporteur,
          parrainId: "PAR1",
          signeParSocieteAt: new Date("2026-06-01T00:00:00Z"),
        },
      },
    ];
    unePayee({ montantHtCents: 200_000 });
    const bilan = await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toHaveLength(2);
    expect(etat.crees[0]).toMatchObject({ apporteurId: "APP1", montantCents: 60_000 });
    expect(etat.crees[1]).toMatchObject({
      apporteurId: "PAR1",
      parrainage: true,
      montantCents: 6_000,
      regleAppliquee: "parrainage_10",
      versionContrat: "2.6",
    });
    expect(bilan.partsParrainage).toBe(1);
  });

  it("parrain : rien au-delà de 6 mois après la signature du filleul", async () => {
    etat.presentations = [
      {
        ...protegee,
        apporteur: {
          ...protegee.apporteur,
          parrainId: "PAR1",
          signeParSocieteAt: new Date("2026-01-01T00:00:00Z"),
        },
      },
    ];
    unePayee({ montantHtCents: 200_000 });
    const bilan = await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toHaveLength(1);
    expect(bilan.partsParrainage).toBe(0);
  });
});

describe("décision du 27/11 : grille du contrat SIGNÉ au passage quotidien", () => {
  const signataire = (version: unknown) => {
    etat.presentations = [
      { ...protegee, apporteur: { ...protegee.apporteur, signatureApporteur: { version } } },
    ];
  };
  const unePayee = (o: Record<string, unknown> = {}) => {
    etat.payees = [{ id: "A", devisId: "D1" }];
    etat.lignes = [fac({ id: "A", devis: { acceptedAt: new Date("2026-12-10T00:00:00Z") }, ...o })];
  };

  it("signataire 2.6, coaching 1 390 € HT signé après le 26/11 : 417 €", async () => {
    signataire("2.6");
    unePayee({ activite: "un_a_un", montantHtCents: 139_000 });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees[0]).toMatchObject({ montantCents: 41_700, statut: "due" });
  });
  it("signataire 2.6, conférence 2 400 € HT signée après le 26/11 : 500 €", async () => {
    signataire("2.6");
    unePayee({ activite: "conference", montantHtCents: 240_000 });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees[0]).toMatchObject({ montantCents: 50_000, palier: "conference" });
  });
  it("signataire 2.6, développement web : aucune commission", async () => {
    signataire("2.6");
    unePayee({ activite: "site_web", montantHtCents: 600_000 });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });
  it("signataire 2.8 : coaching et conférence sans commission, site web 15 %", async () => {
    signataire("2.8");
    unePayee({ activite: "un_a_un", montantHtCents: 139_000 });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
    unePayee({ activite: "site_web", montantHtCents: 600_000 });
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees[0]).toMatchObject({ montantCents: 90_000 });
  });
  it.each([["2.7"], ["2.2"], [undefined]])(
    "version %j inconnue : ligne « à qualifier » (escalade), même pour un coaching",
    async (v) => {
      signataire(v);
      unePayee({ activite: "un_a_un", montantHtCents: 139_000 });
      await passerReseauApporteurs(MAINTENANT);
      expect(etat.crees).toHaveLength(1);
      expect(etat.crees[0]).toMatchObject({ statut: "a_qualifier" });
      expect(etat.crees[0]).not.toHaveProperty("montantCents");
    },
  );
});
