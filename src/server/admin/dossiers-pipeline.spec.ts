/**
 * Tests — dérivation du statut de pipeline de la vue « 📁 Dossiers »
 * (refonte console phase 2, 2026-08-01).
 *
 * Chaque règle du plan a AU MOINS un test. Le test qui compte vraiment :
 * « réalisée mais impayée N'EST PAS soldée » — c'est la ligne qui empêche
 * d'oublier de se faire payer, et elle ne doit JAMAIS sortir de l'écran,
 * même vieille de six mois.
 *
 * Stratégie : la fonction pure se teste sans mock ; `lireDossiersPipeline`
 * avec un mock de `@/lib/prisma` (même approche que bareme-opco.spec.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  deriverStatutDossier,
  estDossierArchive,
  lireDossiersPipeline,
  libellerProchaineAction,
  COLONNES_PIPELINE,
  FENETRE_SOLDES_JOURS,
  type DossierSource,
} from "./dossiers-pipeline";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findMany: vi.fn() },
    trainingSession: { findMany: vi.fn() },
    coachingSession: { findMany: vi.fn() },
    auditMission: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

const MAINTENANT = new Date("2026-08-01T12:00:00Z");
/** updatedAt bien à l'intérieur de la fenêtre des 30 jours. */
const RECENT = new Date("2026-07-25T12:00:00Z");
/** updatedAt au-delà de la fenêtre (45 jours). */
const VIEUX = new Date("2026-06-17T12:00:00Z");

/** Session de base : planifiée, rien en attente — chaque test surcharge. */
const sessionBase = {
  source: "session",
  statut: "planifiee",
  signatureEnAttente: false,
  factureImpayee: false,
  financementNonSolde: false,
  updatedAt: RECENT,
} satisfies DossierSource;

// ─────────────────────────────────────────────────────────────────────────────
// Devis
// ─────────────────────────────────────────────────────────────────────────────

describe("deriverStatutDossier — devis", () => {
  it("envoye → « Devis en attente »", () => {
    expect(deriverStatutDossier({ source: "devis", statut: "envoye" }, MAINTENANT)).toBe(
      "devis_attente",
    );
  });

  it("brouillon → exclu (pas encore une affaire)", () => {
    expect(deriverStatutDossier({ source: "devis", statut: "brouillon" }, MAINTENANT)).toBeNull();
  });

  it.each(["accepte", "transforme_convention"] as const)(
    "%s → exclu (l'affaire continue via sa session, pas via le devis)",
    (statut) => {
      expect(deriverStatutDossier({ source: "devis", statut }, MAINTENANT)).toBeNull();
    },
  );

  it.each(["refuse", "expire"] as const)("%s → exclu (affaire terminée)", (statut) => {
    expect(deriverStatutDossier({ source: "devis", statut }, MAINTENANT)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sessions de formation
// ─────────────────────────────────────────────────────────────────────────────

describe("deriverStatutDossier — session de formation", () => {
  it("planifiee + pièce en attente de signature → « Signature en attente »", () => {
    expect(deriverStatutDossier({ ...sessionBase, signatureEnAttente: true }, MAINTENANT)).toBe(
      "signature_attente",
    );
  });

  it("planifiee sans signature en attente → « À préparer »", () => {
    expect(deriverStatutDossier(sessionBase, MAINTENANT)).toBe("a_preparer");
  });

  it("en_cours → « En cours », MÊME avec une signature encore en attente (le jour J prime)", () => {
    expect(
      deriverStatutDossier(
        { ...sessionBase, statut: "en_cours", signatureEnAttente: true },
        MAINTENANT,
      ),
    ).toBe("en_cours");
  });

  // 🔴 LE piège métier de la phase 2 : « réalisée » ne veut pas dire « finie ».
  // Tant que l'argent n'est pas rentré, l'affaire reste sous les yeux.
  it("realisee + facture impayée N'EST PAS soldée → « À solder »", () => {
    expect(
      deriverStatutDossier(
        { ...sessionBase, statut: "realisee", factureImpayee: true },
        MAINTENANT,
      ),
    ).toBe("a_solder");
  });

  it("realisee + dossier de financement non clos → « À solder » (même sans facture impayée)", () => {
    expect(
      deriverStatutDossier(
        { ...sessionBase, statut: "realisee", financementNonSolde: true },
        MAINTENANT,
      ),
    ).toBe("a_solder");
  });

  it("realisee + impayée reste « À solder » MÊME au-delà de 30 jours — une créance ne se périme pas", () => {
    expect(
      deriverStatutDossier(
        { ...sessionBase, statut: "realisee", factureImpayee: true, updatedAt: VIEUX },
        MAINTENANT,
      ),
    ).toBe("a_solder");
  });

  it("realisee + tout payé/clos et récente → « Soldés »", () => {
    expect(deriverStatutDossier({ ...sessionBase, statut: "realisee" }, MAINTENANT)).toBe("soldes");
  });

  it("realisee + aucune facture attendue (ni dossier) → « Soldés » aussi", () => {
    // Cas d'une session gratuite / interne : rien à encaisser = soldée d'office.
    expect(
      deriverStatutDossier(
        { ...sessionBase, statut: "realisee", factureImpayee: false, financementNonSolde: false },
        MAINTENANT,
      ),
    ).toBe("soldes");
  });

  it(`realisee + soldée depuis plus de ${FENETRE_SOLDES_JOURS} j → sort de la vue (null)`, () => {
    expect(
      deriverStatutDossier({ ...sessionBase, statut: "realisee", updatedAt: VIEUX }, MAINTENANT),
    ).toBeNull();
  });

  it.each(["annulee", "reportee"] as const)("%s → exclue de la vue (pas des données)", (statut) => {
    expect(deriverStatutDossier({ ...sessionBase, statut }, MAINTENANT)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Coaching 1-to-1
// ─────────────────────────────────────────────────────────────────────────────

describe("deriverStatutDossier — coaching", () => {
  const coachingBase = {
    source: "coaching",
    statut: "planifiee",
    factureImpayee: false,
    updatedAt: RECENT,
  } satisfies DossierSource;

  it("planifiee → « À préparer » (pas de circuit de signature suivi ici)", () => {
    expect(deriverStatutDossier(coachingBase, MAINTENANT)).toBe("a_preparer");
  });

  it("realisee + facture (contrat) impayée → « À solder »", () => {
    expect(
      deriverStatutDossier(
        { ...coachingBase, statut: "realisee", factureImpayee: true },
        MAINTENANT,
      ),
    ).toBe("a_solder");
  });

  it("realisee + payée et récente → « Soldés »", () => {
    expect(deriverStatutDossier({ ...coachingBase, statut: "realisee" }, MAINTENANT)).toBe(
      "soldes",
    );
  });

  it("realisee + payée mais vieille → sort de la vue", () => {
    expect(
      deriverStatutDossier({ ...coachingBase, statut: "realisee", updatedAt: VIEUX }, MAINTENANT),
    ).toBeNull();
  });

  it.each(["annulee", "reportee"] as const)("%s → exclue", (statut) => {
    expect(deriverStatutDossier({ ...coachingBase, statut }, MAINTENANT)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Missions d'audit
// ─────────────────────────────────────────────────────────────────────────────

describe("deriverStatutDossier — audit", () => {
  const auditBase = {
    source: "audit",
    statut: "planifiee",
    factureImpayee: false,
    updatedAt: RECENT,
  } satisfies DossierSource;

  it("planifiee → « À préparer »", () => {
    expect(deriverStatutDossier(auditBase, MAINTENANT)).toBe("a_preparer");
  });

  it("en_cours → « En cours » (l'enum audit a ce statut, contrairement au coaching)", () => {
    expect(deriverStatutDossier({ ...auditBase, statut: "en_cours" }, MAINTENANT)).toBe("en_cours");
  });

  it("realisee + facture impayée → « À solder »", () => {
    expect(
      deriverStatutDossier({ ...auditBase, statut: "realisee", factureImpayee: true }, MAINTENANT),
    ).toBe("a_solder");
  });

  it("realisee + payée et récente → « Soldés »", () => {
    expect(deriverStatutDossier({ ...auditBase, statut: "realisee" }, MAINTENANT)).toBe("soldes");
  });

  it.each(["annulee", "reportee"] as const)("%s → exclue", (statut) => {
    expect(deriverStatutDossier({ ...auditBase, statut }, MAINTENANT)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Frontière exacte de la fenêtre des 30 jours
// ─────────────────────────────────────────────────────────────────────────────

describe("fenêtre « Soldés »", () => {
  it("exactement 30 jours → encore affichée (borne incluse)", () => {
    const pile30j = new Date(MAINTENANT.getTime() - FENETRE_SOLDES_JOURS * 24 * 60 * 60 * 1000);
    expect(
      deriverStatutDossier({ ...sessionBase, statut: "realisee", updatedAt: pile30j }, MAINTENANT),
    ).toBe("soldes");
  });

  it("30 jours + 1 ms → sortie de la vue", () => {
    const trop = new Date(MAINTENANT.getTime() - FENETRE_SOLDES_JOURS * 24 * 60 * 60 * 1000 - 1);
    expect(
      deriverStatutDossier({ ...sessionBase, statut: "realisee", updatedAt: trop }, MAINTENANT),
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Prochaine action — une consigne par colonne, jamais vide
// ─────────────────────────────────────────────────────────────────────────────

describe("libellerProchaineAction", () => {
  it("chaque colonne × chaque activité produit une consigne non vide", () => {
    for (const { id } of COLONNES_PIPELINE) {
      for (const activite of ["formation", "coaching", "audit"] as const) {
        expect(libellerProchaineAction(id, activite).length).toBeGreaterThan(0);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// lireDossiersPipeline — mapping, groupage, stub-safe
// ─────────────────────────────────────────────────────────────────────────────

describe("lireDossiersPipeline", () => {
  beforeEach(() => {
    vi.mocked(prisma.devis.findMany).mockResolvedValue([]);
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([]);
    vi.mocked(prisma.coachingSession.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditMission.findMany).mockResolvedValue([]);
  });

  it("retourne les 6 colonnes vides quand il n'y a aucune affaire", async () => {
    const pipeline = await lireDossiersPipeline(MAINTENANT);
    expect(Object.keys(pipeline).sort()).toEqual(COLONNES_PIPELINE.map((c) => c.id).sort());
    expect(Object.values(pipeline).every((lignes) => lignes.length === 0)).toBe(true);
  });

  it("est stub-safe : TOUTES les sources en échec (build sans DB) → pipeline vide, pas de throw", async () => {
    vi.mocked(prisma.devis.findMany).mockRejectedValue(new Error("stub.invalid"));
    vi.mocked(prisma.trainingSession.findMany).mockRejectedValue(new Error("stub.invalid"));
    vi.mocked(prisma.coachingSession.findMany).mockRejectedValue(new Error("stub.invalid"));
    vi.mocked(prisma.auditMission.findMany).mockRejectedValue(new Error("stub.invalid"));

    const pipeline = await lireDossiersPipeline(MAINTENANT);
    expect(Object.values(pipeline).every((lignes) => lignes.length === 0)).toBe(true);
  });

  it("une source en échec ne prive pas la vue des trois autres", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockRejectedValue(new Error("boom"));
    vi.mocked(prisma.devis.findMany).mockResolvedValue([
      {
        id: "d1",
        numero: "AXI-DEV-2026-001",
        activite: "formation",
        statut: "envoye",
        sentAt: RECENT,
        dateValidite: new Date("2026-08-24T00:00:00Z"),
        client: { raisonSociale: "INVEST SUN" },
        // Le mock ne porte que les champs du `select` — cast inévitable.
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT);
    expect(pipeline.devis_attente).toHaveLength(1);
    expect(pipeline.devis_attente[0]?.client).toBe("INVEST SUN");
    expect(pipeline.devis_attente[0]?.cheminFiche).toBe("/qualiopi/devis/d1");
  });

  it("mappe une session complète : colonne dérivée des pièces/factures liées, lien vers la fiche", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([
      // Planifiée avec une pièce en attente → « Signature en attente ».
      {
        id: "s1",
        numero: "AXI-SESS-2026-001",
        titreSession: "Automatiser avec l'IA",
        statut: "planifiee",
        dateDebut: new Date("2026-08-10T08:00:00Z"),
        dateFin: new Date("2026-08-11T16:00:00Z"),
        updatedAt: RECENT,
        client: { raisonSociale: "INVEST SUN" },
        documents: [{ id: "doc1" }],
        facturesFormation: [],
        dossiersFinancement: [],
      } as never,
      // Réalisée avec facture impayée → « À solder » (LE piège, en intégration).
      {
        id: "s2",
        numero: "AXI-SESS-2026-002",
        titreSession: "Prompt engineering",
        statut: "realisee",
        dateDebut: new Date("2026-07-01T08:00:00Z"),
        dateFin: new Date("2026-07-02T16:00:00Z"),
        updatedAt: RECENT,
        client: null,
        documents: [],
        facturesFormation: [{ id: "f1" }],
        dossiersFinancement: [],
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT);
    expect(pipeline.signature_attente).toHaveLength(1);
    expect(pipeline.signature_attente[0]?.cheminFiche).toBe("/qualiopi/sessions/s1");
    expect(pipeline.signature_attente[0]?.activite).toBe("formation");
    expect(pipeline.a_solder).toHaveLength(1);
    expect(pipeline.a_solder[0]?.reference).toBe("AXI-SESS-2026-002");
    // Session sans client rattaché → tiret, jamais un crash.
    expect(pipeline.a_solder[0]?.client).toBe("—");
  });

  it("coaching : le client vient du contrat, la facture impayée aussi", async () => {
    vi.mocked(prisma.coachingSession.findMany).mockResolvedValue([
      {
        id: "c1",
        interventionSlug: "dirigeant-vision-strategique",
        statut: "realisee",
        dateSeance: new Date("2026-07-20T09:00:00Z"),
        dateSeanceFin: null,
        updatedAt: RECENT,
        beneficiaireNom: "Simone Blanc",
        beneficiaireEntreprise: null,
        coachingContract: {
          client: { raisonSociale: "INVEST SUN" },
          factures: [{ id: "f2" }],
        },
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT);
    expect(pipeline.a_solder).toHaveLength(1);
    expect(pipeline.a_solder[0]?.client).toBe("INVEST SUN");
    expect(pipeline.a_solder[0]?.activite).toBe("coaching");
    expect(pipeline.a_solder[0]?.cheminFiche).toBe("/coaching/seances/c1");
  });

  it("coaching ad hoc sans contrat : retombe sur le bénéficiaire, et sans facture → séance payée d'office", async () => {
    vi.mocked(prisma.coachingSession.findMany).mockResolvedValue([
      {
        id: "c2",
        interventionSlug: "coaching-decouverte",
        statut: "realisee",
        dateSeance: new Date("2026-07-28T09:00:00Z"),
        dateSeanceFin: null,
        updatedAt: RECENT,
        beneficiaireNom: "Simone Blanc",
        beneficiaireEntreprise: "INVEST SUN",
        coachingContract: null,
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT);
    expect(pipeline.soldes).toHaveLength(1);
    expect(pipeline.soldes[0]?.client).toBe("INVEST SUN");
  });

  it("audit : mission en cours → colonne « En cours », badge 🔍", async () => {
    vi.mocked(prisma.auditMission.findMany).mockResolvedValue([
      {
        id: "a1",
        numero: "AXI-AUD-2026-001",
        titre: "Audit IA process commerciaux",
        statut: "en_cours",
        dateDebut: new Date("2026-07-30T08:00:00Z"),
        dateFin: new Date("2026-08-05T16:00:00Z"),
        updatedAt: RECENT,
        client: { raisonSociale: "ACURIA" },
        facturesFormation: [],
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT);
    expect(pipeline.en_cours).toHaveLength(1);
    expect(pipeline.en_cours[0]?.activite).toBe("audit");
    expect(pipeline.en_cours[0]?.cheminFiche).toBe("/qualiopi/audits/a1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — estDossierArchive (le complément exact du null « soldé trop vieux »)
// ─────────────────────────────────────────────────────────────────────────────

describe("estDossierArchive", () => {
  it("session réalisée, payée, au-delà de la fenêtre → archivée", () => {
    expect(
      estDossierArchive({ ...sessionBase, statut: "realisee", updatedAt: VIEUX }, MAINTENANT),
    ).toBe(true);
  });

  it("session réalisée, payée, RÉCENTE → pas archivée (elle vit en « Soldés »)", () => {
    expect(estDossierArchive({ ...sessionBase, statut: "realisee" }, MAINTENANT)).toBe(false);
  });

  // 🔴 LE garde-fou de la phase 3 : l'archivage ne doit jamais devenir la
  // porte de sortie discrète d'une créance oubliée.
  it("session réalisée mais IMPAYÉE, même très vieille → JAMAIS archivée", () => {
    expect(
      estDossierArchive(
        { ...sessionBase, statut: "realisee", factureImpayee: true, updatedAt: VIEUX },
        MAINTENANT,
      ),
    ).toBe(false);
  });

  it("session au financement non clos, même très vieille → JAMAIS archivée", () => {
    expect(
      estDossierArchive(
        { ...sessionBase, statut: "realisee", financementNonSolde: true, updatedAt: VIEUX },
        MAINTENANT,
      ),
    ).toBe(false);
  });

  it("session annulée, même vieille → pas une archive (jamais soldée)", () => {
    expect(
      estDossierArchive({ ...sessionBase, statut: "annulee", updatedAt: VIEUX }, MAINTENANT),
    ).toBe(false);
  });

  it("un devis n'est jamais archivé (il ne se « solde » pas)", () => {
    expect(estDossierArchive({ source: "devis", statut: "refuse" }, MAINTENANT)).toBe(false);
    expect(estDossierArchive({ source: "devis", statut: "expire" }, MAINTENANT)).toBe(false);
  });

  it("coaching et audit réalisés, payés, vieux → archivés aussi", () => {
    expect(
      estDossierArchive(
        { source: "coaching", statut: "realisee", factureImpayee: false, updatedAt: VIEUX },
        MAINTENANT,
      ),
    ).toBe(true);
    expect(
      estDossierArchive(
        { source: "audit", statut: "realisee", factureImpayee: false, updatedAt: VIEUX },
        MAINTENANT,
      ),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — badge Qualiopi + mode archives dans lireDossiersPipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("lireDossiersPipeline — badge périmètre Qualiopi (phase 3)", () => {
  beforeEach(() => {
    vi.mocked(prisma.devis.findMany).mockResolvedValue([]);
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([]);
    vi.mocked(prisma.coachingSession.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditMission.findMany).mockResolvedValue([]);
  });

  it("devis : le badge suit l'activité RÉELLE — formation ✅, audit ❌, null ❌ (jamais Qualiopi par accident)", async () => {
    vi.mocked(prisma.devis.findMany).mockResolvedValue([
      {
        id: "d-form",
        numero: "AXI-DEV-2026-010",
        activite: "formation",
        statut: "envoye",
        sentAt: RECENT,
        dateValidite: null,
        client: { raisonSociale: "INVEST SUN" },
      } as never,
      {
        id: "d-audit",
        numero: "AXI-DEV-2026-011",
        activite: "audit",
        statut: "envoye",
        sentAt: RECENT,
        dateValidite: null,
        client: { raisonSociale: "ACURIA" },
      } as never,
      // `Devis.activite` est nullable : sans activité déclarée, on n'affiche
      // JAMAIS « Qualiopi » — c'est un engagement d'audit, pas une décoration.
      {
        id: "d-null",
        numero: "AXI-DEV-2026-012",
        activite: null,
        statut: "envoye",
        sentAt: RECENT,
        dateValidite: null,
        client: { raisonSociale: "INVEST SUN" },
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT);
    const parCle = new Map(pipeline.devis_attente.map((l) => [l.cle, l.qualiopi]));
    expect(parCle.get("devis:d-form")).toBe(true);
    expect(parCle.get("devis:d-audit")).toBe(false);
    expect(parCle.get("devis:d-null")).toBe(false);
  });

  it("devis site_web : badge d'activité « Formation » (agrégat) mais périmètre HORS Qualiopi", async () => {
    vi.mocked(prisma.devis.findMany).mockResolvedValue([
      {
        id: "d-web",
        numero: "AXI-DEV-2026-013",
        activite: "site_web",
        statut: "envoye",
        sentAt: RECENT,
        dateValidite: null,
        client: { raisonSociale: "INVEST SUN" },
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT);
    expect(pipeline.devis_attente[0]?.activite).toBe("formation");
    expect(pipeline.devis_attente[0]?.qualiopi).toBe(false);
  });

  it("session → ✅ Qualiopi · coaching (un_a_un / AFEST) → ✅ · mission d'audit → ❌", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([
      {
        id: "s1",
        numero: "AXI-SESS-2026-010",
        titreSession: "Automatiser avec l'IA",
        statut: "planifiee",
        dateDebut: null,
        dateFin: null,
        updatedAt: RECENT,
        client: { raisonSociale: "INVEST SUN" },
        documents: [],
        facturesFormation: [],
        dossiersFinancement: [],
      } as never,
    ]);
    vi.mocked(prisma.coachingSession.findMany).mockResolvedValue([
      {
        id: "c1",
        interventionSlug: "dirigeant-vision-strategique",
        statut: "planifiee",
        dateSeance: null,
        dateSeanceFin: null,
        updatedAt: RECENT,
        beneficiaireNom: "Simone Blanc",
        beneficiaireEntreprise: null,
        coachingContract: null,
      } as never,
    ]);
    vi.mocked(prisma.auditMission.findMany).mockResolvedValue([
      {
        id: "a1",
        numero: "AXI-AUD-2026-010",
        titre: "Audit IA process",
        statut: "planifiee",
        dateDebut: null,
        dateFin: null,
        updatedAt: RECENT,
        client: { raisonSociale: "ACURIA" },
        facturesFormation: [],
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT);
    const parCle = new Map(pipeline.a_preparer.map((l) => [l.cle, l.qualiopi]));
    expect(parCle.get("session:s1")).toBe(true);
    expect(parCle.get("coaching:c1")).toBe(true);
    expect(parCle.get("audit:a1")).toBe(false);
  });

  it("en lecture normale, toutes les lignes portent archive: false", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([
      {
        id: "s1",
        numero: "AXI-SESS-2026-011",
        titreSession: "Prompt engineering",
        statut: "realisee",
        dateDebut: null,
        dateFin: null,
        updatedAt: RECENT,
        client: null,
        documents: [],
        facturesFormation: [],
        dossiersFinancement: [],
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT);
    expect(pipeline.soldes).toHaveLength(1);
    expect(pipeline.soldes[0]?.archive).toBe(false);
  });
});

describe("lireDossiersPipeline — mode archives (phase 3)", () => {
  /** Session soldée depuis 45 jours — LE cas que la vue normale exclut. */
  const sessionSoldeeVieille = {
    id: "s-arch",
    numero: "AXI-SESS-2026-020",
    titreSession: "Session archivée",
    statut: "realisee",
    dateDebut: new Date("2026-06-15T08:00:00Z"),
    dateFin: new Date("2026-06-16T16:00:00Z"),
    updatedAt: VIEUX,
    client: { raisonSociale: "INVEST SUN" },
    documents: [],
    facturesFormation: [],
    dossiersFinancement: [],
  } as never;

  beforeEach(() => {
    vi.mocked(prisma.devis.findMany).mockResolvedValue([]);
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([sessionSoldeeVieille]);
    vi.mocked(prisma.coachingSession.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditMission.findMany).mockResolvedValue([]);
  });

  it("un soldé de 45 j est ABSENT de la lecture normale (comportement phase 2 intact)", async () => {
    const pipeline = await lireDossiersPipeline(MAINTENANT);
    expect(Object.values(pipeline).every((lignes) => lignes.length === 0)).toBe(true);
  });

  it("le même soldé de 45 j apparaît en mode avecArchives — colonne « Soldés », archive: true", async () => {
    const pipeline = await lireDossiersPipeline(MAINTENANT, { avecArchives: true });
    expect(pipeline.soldes).toHaveLength(1);
    expect(pipeline.soldes[0]?.cle).toBe("session:s-arch");
    expect(pipeline.soldes[0]?.archive).toBe(true);
    // Archivée mais toujours une formation : le badge Qualiopi reste dérivé.
    expect(pipeline.soldes[0]?.qualiopi).toBe(true);
  });

  it("avecArchives ne repêche PAS une créance : réalisée impayée de 45 j reste « À solder », archive: false", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([
      {
        id: "s-due",
        numero: "AXI-SESS-2026-021",
        titreSession: "Créance oubliée",
        statut: "realisee",
        dateDebut: null,
        dateFin: null,
        updatedAt: VIEUX,
        client: { raisonSociale: "INVEST SUN" },
        documents: [],
        facturesFormation: [{ id: "f1" }],
        dossiersFinancement: [],
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT, { avecArchives: true });
    expect(pipeline.a_solder).toHaveLength(1);
    expect(pipeline.a_solder[0]?.archive).toBe(false);
    expect(pipeline.soldes).toHaveLength(0);
  });

  it("avecArchives ne repêche pas non plus une session annulée vieille (null ≠ archive)", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([
      {
        id: "s-ann",
        numero: "AXI-SESS-2026-022",
        titreSession: "Annulée",
        statut: "annulee",
        dateDebut: null,
        dateFin: null,
        updatedAt: VIEUX,
        client: null,
        documents: [],
        facturesFormation: [],
        dossiersFinancement: [],
      } as never,
    ]);

    const pipeline = await lireDossiersPipeline(MAINTENANT, { avecArchives: true });
    expect(Object.values(pipeline).every((lignes) => lignes.length === 0)).toBe(true);
  });

  it("stub-safe aussi en mode archives : les 4 sources en échec → pipeline vide, pas de throw", async () => {
    vi.mocked(prisma.devis.findMany).mockRejectedValue(new Error("stub.invalid"));
    vi.mocked(prisma.trainingSession.findMany).mockRejectedValue(new Error("stub.invalid"));
    vi.mocked(prisma.coachingSession.findMany).mockRejectedValue(new Error("stub.invalid"));
    vi.mocked(prisma.auditMission.findMany).mockRejectedValue(new Error("stub.invalid"));

    const pipeline = await lireDossiersPipeline(MAINTENANT, { avecArchives: true });
    expect(Object.values(pipeline).every((lignes) => lignes.length === 0)).toBe(true);
  });
});
