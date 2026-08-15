/**
 * Tests — qualiopi-formation-crons-worker.ts (T17 CLUSTER 3).
 *
 * Couvre :
 *   - formationCronsHandler : dispatch par type (happy path + unknown type)
 *   - handleConvocationJ5   : convocation réglementaire J-5 (nouveau, off.9)
 *
 * Stratégie :
 *   - Mock @/lib/prisma pour éviter les appels DB réels.
 *   - Mock notifications-service pour vérifier les appels envoyerConvocation.
 *   - handleConvocationJ5 exporté via formationCronsHandler (pas directement).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findMany: vi.fn(),
    },
    enrollment: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    // Rattrapage questionnaires 2026-08-03 — marquage `envoyeAt` après envoi.
    // Relances 2026-08-04 — sélection des questionnaires dus (findMany).
    questionnaire: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    alerteSysteme: {
      findMany: vi.fn(),
    },
    // Recouvrement 2026-08-02 — réparation des échéances manquantes.
    factureFormation: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    relanceProposee: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    // Parcours vente 2026-08-05 — expiration des devis + relance J+3.
    devis: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/qualiopi/notifications/notifications-service", () => ({
  envoyerConvocation: vi.fn(),
  envoyerRappelJ7: vi.fn(),
  envoyerSatisfactionJ1: vi.fn(),
  envoyerSuiviJ30: vi.fn(),
  envoyerRelanceQuestionnaire: vi.fn(),
  envoyerEnqueteEntreprise: vi.fn(),
  notifierAlerteInterne: vi.fn(),
}));

vi.mock("@/server/qualiopi/evaluations/attestation-service", () => ({
  genererAttestationPourEnrollment: vi.fn(),
}));

vi.mock("@/server/qualiopi/indicateurs/service", () => ({
  invalidateIndicateursCache: vi.fn(),
}));

vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  synchroniserAlertes: vi.fn().mockResolvedValue({ crees: 0, resolues: 0 }),
}));

vi.mock("@/server/qualiopi/formations/state-machine", () => ({
  assertSessionTransition: vi.fn(),
}));

vi.mock("@/server/qualiopi/formations/crons", () => ({
  decideSessionTransitions: vi.fn().mockReturnValue([]),
}));

vi.mock("@/server/qualiopi/formations/transition-helper", () => ({
  writeSessionTransition: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  envoyerConvocation,
  envoyerRelanceQuestionnaire,
  envoyerEnqueteEntreprise,
  notifierAlerteInterne,
} from "@/server/qualiopi/notifications/notifications-service";
import { synchroniserAlertes } from "@/server/qualiopi/alertes/alertes-service";
import { decideSessionTransitions } from "@/server/qualiopi/formations/crons";
import { formationCronsHandler } from "./qualiopi-formation-crons-worker";

const mockPrisma = prisma as unknown as {
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  questionnaire: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  alerteSysteme: { findMany: ReturnType<typeof vi.fn> };
  factureFormation: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  relanceProposee: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  devis: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockEnvoyerConvocation = envoyerConvocation as ReturnType<typeof vi.fn>;
const mockEnvoyerRelance = envoyerRelanceQuestionnaire as ReturnType<typeof vi.fn>;
const mockEnvoyerEnquete = envoyerEnqueteEntreprise as ReturnType<typeof vi.fn>;
const mockNotifierAlerteInterne = notifierAlerteInterne as ReturnType<typeof vi.fn>;
const mockSynchroniserAlertes = synchroniserAlertes as ReturnType<typeof vi.fn>;
const mockDecide = decideSessionTransitions as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Tests formationCronsHandler — dispatch
// ─────────────────────────────────────────────────────────────────────────────

describe("formationCronsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatche vers handleConvocationJ5 pour type convocation-j5", async () => {
    // La sélection porte désormais sur les INSCRIPTIONS non convoquées, plus
    // sur les sessions d'une fenêtre de date (cf. le bloc dédié plus bas).
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    mockPrisma.enrollment.count.mockResolvedValue(0);

    await expect(
      formationCronsHandler({
        type: "formation-crons.convocation-j5",
        tick: "2026-06-06T08:00:00Z",
      }),
    ).resolves.toBeUndefined();
  });

  it("ne throw pas sur un type inconnu (warn silencieux)", async () => {
    await expect(
      // @ts-expect-error — test d'un type non enregistré
      formationCronsHandler({ type: "formation-crons.unknown-type", tick: "2026-06-06T08:00:00Z" }),
    ).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests handleConvocationJ5 (via formationCronsHandler)
// ─────────────────────────────────────────────────────────────────────────────

describe("handleConvocationJ5 — sélection par ÉTAT, pas par fenêtre de date", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
    mockPrisma.enrollment.count.mockResolvedValue(0);
  });

  it("skip si DATABASE_URL = stub.invalid (stub-aware)", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await formationCronsHandler({
        type: "formation-crons.convocation-j5",
        tick: "2026-06-06T08:00:00Z",
      });
      expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();
      expect(mockEnvoyerConvocation).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  it("ne fait rien si aucune inscription n'est candidate", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([]);

    await formationCronsHandler({
      type: "formation-crons.convocation-j5",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockEnvoyerConvocation).not.toHaveBeenCalled();
  });

  it("convoque chaque inscription candidate", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([
      { id: "enroll-uuid-1" },
      { id: "enroll-uuid-2" },
      { id: "enroll-uuid-3" },
    ]);
    mockEnvoyerConvocation.mockResolvedValue(undefined);

    await formationCronsHandler({
      type: "formation-crons.convocation-j5",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockEnvoyerConvocation).toHaveBeenCalledTimes(3);
    expect(mockEnvoyerConvocation).toHaveBeenCalledWith("enroll-uuid-1");
    expect(mockEnvoyerConvocation).toHaveBeenCalledWith("enroll-uuid-3");
  });

  it("continue en cas d'erreur sur une inscription (fail-soft)", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([
      { id: "enroll-ok-1" },
      { id: "enroll-ko-1" },
      { id: "enroll-ok-2" },
    ]);
    mockEnvoyerConvocation
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Email service down"))
      .mockResolvedValueOnce(undefined);

    await expect(
      formationCronsHandler({
        type: "formation-crons.convocation-j5",
        tick: "2026-06-06T08:00:00Z",
      }),
    ).resolves.toBeUndefined();

    expect(mockEnvoyerConvocation).toHaveBeenCalledTimes(3);
  });

  /**
   * 🔴 LE TEST QUI VERROUILLE LE CORRECTIF.
   *
   * L'ancienne sélection exigeait `dateDebut` dans [J+4,5 ; J+5,5] — un
   * PLANCHER autant qu'un plafond. Vérifié en base de production le 15/08/2026 :
   * aucune session réelle n'a jamais existé cinq jours avant son début (celle du
   * 31/07 créée le 31/07 à 14h51 pour un début à 07h00, celle du 16/08 la
   * veille). Une session créée à l'intérieur de sa propre fenêtre n'y entrait
   * jamais — d'où ZÉRO convocation envoyée sur tout l'historique.
   *
   * Ce test échoue si quelqu'un réintroduit un plancher : c'était l'ancien test
   * « scanne les sessions dans la fenêtre [J+4.5j, J+5.5j] », qui verrouillait
   * le défaut au lieu de le dénoncer.
   */
  it("🔴 AUCUN plancher de date : une session créée la veille reste candidate", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([]);

    await formationCronsHandler({
      type: "formation-crons.convocation-j5",
      tick: "2026-06-06T08:00:00Z",
    });

    const appel = mockPrisma.enrollment.findMany.mock.calls[0]?.[0] as {
      where: {
        convocationEnvoyeeAt: null;
        session: { statut: string; dateDebut: { gt: Date; lte: Date; gte?: Date } };
      };
    };
    expect(appel).toBeDefined();

    // L'ÉTAT est la garde : tant que la colonne est nulle, on est candidat.
    expect(appel.where.convocationEnvoyeeAt).toBeNull();

    // Le plafond haut demeure (on ne convoque pas trois mois à l'avance)…
    const plafondAttendu = Date.now() + 5.5 * 24 * 60 * 60 * 1000;
    expect(Math.abs(appel.where.session.dateDebut.lte.getTime() - plafondAttendu)).toBeLessThan(
      5000,
    );

    // …mais la borne basse est « pas encore commencée », PAS « dans 4,5 jours ».
    expect(
      appel.where.session.dateDebut.gte,
      "un plancher de date a été réintroduit : les sessions créées tardivement redeviennent invisibles",
    ).toBeUndefined();
    expect(Math.abs(appel.where.session.dateDebut.gt.getTime() - Date.now())).toBeLessThan(5000);
  });

  /**
   * Ce que le rattrapage ne peut PAS réparer, il doit le DIRE. Convoquer après
   * le démarrage fabriquerait une pièce fausse : l'écart se consigne.
   */
  it("compte et journalise les sessions DÉJÀ démarrées sans convocation", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    mockPrisma.enrollment.count.mockResolvedValue(2);
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await formationCronsHandler({
        type: "formation-crons.convocation-j5",
        tick: "2026-06-06T08:00:00Z",
      });

      expect(mockPrisma.enrollment.count).toHaveBeenCalled();
      const messages = erreur.mock.calls.map((c) => String(c[0])).join(" | ");
      expect(messages).toContain("DÉMARRÉ sans convocation");
      // Et surtout : aucun envoi rétroactif.
      expect(mockEnvoyerConvocation).not.toHaveBeenCalled();
    } finally {
      erreur.mockRestore();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests handleClotureAuto — garde émargement (conformité ind.12 / R.6313-3)
// ─────────────────────────────────────────────────────────────────────────────

describe("handleClotureAuto — garde émargement (audit E2E 2026-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
  });

  const decision = { sessionId: "sess-1", from: "en_cours", to: "realisee" };

  it("IGNORE la clôture auto d'une session avec inscrits mais SANS émargement", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      { id: "sess-1", statut: "en_cours", dateDebut: new Date(), dateFin: new Date() },
    ]);
    mockDecide.mockReturnValue([decision]);
    // 1er count = total inscrits (2), 2e count = avec émargement (0) → skip
    mockPrisma.enrollment.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    await formationCronsHandler({
      type: "formation-crons.cloture-auto",
      tick: "2026-06-06T08:00:00Z",
    });

    // La transition NE doit PAS être appliquée → $transaction jamais appelé.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("APPLIQUE la clôture auto si au moins un émargement est présent", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      { id: "sess-1", statut: "en_cours", dateDebut: new Date(), dateFin: new Date() },
    ]);
    mockDecide.mockReturnValue([decision]);
    // total = 2, avec émargement = 1 → applique
    mockPrisma.enrollment.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await formationCronsHandler({
      type: "formation-crons.cloture-auto",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it("APPLIQUE la clôture auto d'une session SANS aucun inscrit (0 inscrit = pas de garde)", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      { id: "sess-1", statut: "en_cours", dateDebut: new Date(), dateFin: new Date() },
    ]);
    mockDecide.mockReturnValue([decision]);
    mockPrisma.enrollment.count.mockResolvedValueOnce(0);
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await formationCronsHandler({
      type: "formation-crons.cloture-auto",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests handleAlertes — notification interne des alertes critiques
// ─────────────────────────────────────────────────────────────────────────────

describe("handleAlertes (via formationCronsHandler)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
    mockSynchroniserAlertes.mockResolvedValue({ crees: 0, resolues: 0 });
  });

  it("notifie chaque alerte critique non-résolue et non-notifiée", async () => {
    mockPrisma.alerteSysteme.findMany.mockResolvedValue([{ id: "alerte-1" }, { id: "alerte-2" }]);
    mockNotifierAlerteInterne.mockResolvedValue(undefined);

    await formationCronsHandler({
      type: "formation-crons.alertes",
      tick: "2026-06-06T07:00:00Z",
    });

    // Filtre = non-résolue + non-notifiée, ET (critique OU code de déblocage
    // du parcours vente) — le seuil critique reste l'anti-spam par défaut.
    const findArgs = mockPrisma.alerteSysteme.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(findArgs.where).toMatchObject({
      resolue: false,
      notifiedAt: null,
      OR: [
        { niveau: "critique" },
        { code: { in: ["devis_signe_convention", "moteur_assemble_a_publier"] } },
      ],
    });
    expect(mockNotifierAlerteInterne).toHaveBeenCalledTimes(2);
    expect(mockNotifierAlerteInterne).toHaveBeenCalledWith("alerte-1");
    expect(mockNotifierAlerteInterne).toHaveBeenCalledWith("alerte-2");
  });

  it("les DÉBLOCAGES vente sont notifiés même sans être critiques", async () => {
    // Promesse du plan « Nouvelle vente » §1a : devis signé et fin de cycle
    // moteur préviennent l'équipe par email — sans camper l'écran d'alertes.
    mockPrisma.alerteSysteme.findMany.mockResolvedValue([{ id: "alerte-deblocage" }]);
    mockNotifierAlerteInterne.mockResolvedValue(undefined);

    await formationCronsHandler({
      type: "formation-crons.alertes",
      tick: "2026-08-05T07:00:00Z",
    });

    expect(mockNotifierAlerteInterne).toHaveBeenCalledWith("alerte-deblocage");
  });

  it("ne notifie rien si aucune alerte critique en attente", async () => {
    mockPrisma.alerteSysteme.findMany.mockResolvedValue([]);

    await formationCronsHandler({
      type: "formation-crons.alertes",
      tick: "2026-06-06T07:00:00Z",
    });

    expect(mockNotifierAlerteInterne).not.toHaveBeenCalled();
  });

  it("continue en cas d'erreur sur une notification (fail-soft)", async () => {
    mockPrisma.alerteSysteme.findMany.mockResolvedValue([
      { id: "alerte-ok-1" },
      { id: "alerte-ko" },
      { id: "alerte-ok-2" },
    ]);
    mockNotifierAlerteInterne
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Email service down"))
      .mockResolvedValueOnce(undefined);

    await expect(
      formationCronsHandler({
        type: "formation-crons.alertes",
        tick: "2026-06-06T07:00:00Z",
      }),
    ).resolves.toBeUndefined();

    expect(mockNotifierAlerteInterne).toHaveBeenCalledTimes(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests handleFacturesRetard — réparation des échéances manquantes
//
// 🔴 Le trou structurel du recouvrement : le `where` filtrait sur
// `echeanceAt < now`, or aucune comparaison SQL n'est vraie pour NULL. Une
// facture émise sans échéance n'était donc JAMAIS candidate — ni retard, ni
// relance, ni alerte. La boucle refermait le trou d'un `continue`.
// ─────────────────────────────────────────────────────────────────────────────

describe("handleFacturesRetard — échéances manquantes (via formationCronsHandler)", () => {
  const JOUR_MS = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
    mockPrisma.factureFormation.findMany.mockResolvedValue([]);
    mockPrisma.factureFormation.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.relanceProposee.findFirst.mockResolvedValue(null);
    mockPrisma.relanceProposee.create.mockResolvedValue({ id: "relance-1" });
  });

  /** Facture ouverte type, sans échéance, émise il y a `joursEmission` jours. */
  const factureSansEcheance = (joursEmission: number, delaiClient: number | null = null) => ({
    id: "fac-1",
    numero: "AXI-FACT-2026-001",
    statut: "emise",
    echeanceAt: null,
    emiseAt: new Date(Date.now() - joursEmission * JOUR_MS),
    createdAt: new Date(Date.now() - joursEmission * JOUR_MS),
    montantTtcCents: 66_000,
    montantHtCents: 55_000,
    client: { delaiPaiementJours: delaiClient },
    payments: [],
    avoirs: [],
  });

  const lancer = () =>
    formationCronsHandler({
      type: "formation-crons.factures-retard",
      tick: "2026-08-02T06:30:00Z",
    });

  it("sélectionne AUSSI les factures à échéance NULLE (le trou d'origine)", async () => {
    await lancer();

    const args = mockPrisma.factureFormation.findMany.mock.calls[0]![0] as {
      where: { OR?: Array<Record<string, unknown>>; statut?: { in?: string[] } };
    };
    const clausesNull = (args.where.OR ?? []).filter((c) => c["echeanceAt"] === null);
    expect(clausesNull.length).toBeGreaterThan(0);
    // …et le filtre de statut part bien du SSOT des statuts ouverts.
    expect(args.where.statut?.in).toEqual(
      expect.arrayContaining(["emise", "partiellement_payee", "en_retard"]),
    );
  });

  it("RÉPARE l'échéance manquante : emiseAt + délai du client", async () => {
    // Émise il y a 10 jours, client à 45 jours → échéance dans 35 jours (future).
    mockPrisma.factureFormation.findMany.mockResolvedValue([factureSansEcheance(10, 45)]);

    await lancer();

    const updates = mockPrisma.factureFormation.updateMany.mock.calls;
    expect(updates.length).toBe(1);
    const arg = updates[0]![0] as {
      where: { id: string; echeanceAt: null };
      data: { echeanceAt: Date };
    };
    expect(arg.where.id).toBe("fac-1");
    // Écriture conditionnée à la nullité : idempotent, sans course.
    expect(arg.where.echeanceAt).toBeNull();

    const attendu = Date.now() + 35 * JOUR_MS;
    expect(Math.abs(arg.data.echeanceAt.getTime() - attendu)).toBeLessThan(5 * 60 * 1000);
  });

  it("retombe sur 30 jours quand le client n'a pas de délai propre", async () => {
    mockPrisma.factureFormation.findMany.mockResolvedValue([factureSansEcheance(10, null)]);

    await lancer();

    const arg = mockPrisma.factureFormation.updateMany.mock.calls[0]![0] as {
      data: { echeanceAt: Date };
    };
    const attendu = Date.now() + 20 * JOUR_MS; // émise il y a 10 j + 30 j
    expect(Math.abs(arg.data.echeanceAt.getTime() - attendu)).toBeLessThan(5 * 60 * 1000);
  });

  it("échéance reconstituée encore FUTURE → aucune relance, aucun passage en retard", async () => {
    mockPrisma.factureFormation.findMany.mockResolvedValue([factureSansEcheance(10, 45)]);

    await lancer();

    // Un seul updateMany : celui de l'échéance (pas de bascule `en_retard`).
    expect(mockPrisma.factureFormation.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.relanceProposee.create).not.toHaveBeenCalled();
  });

  // 🔴 Garde-fou anti-effet-de-bord. Une facture mal datée (reprise, import
  // approximatif) produirait sinon d'emblée une relance J30 ou J45 sur une
  // créance dont l'ancienneté vient d'être DEVINÉE. Le palier tombera au run du
  // lendemain, ce qui laisse une journée pour corriger la date à la main.
  it("échéance reconstituée déjà échue de +60 j → échéance POSÉE mais AUCUNE relance", async () => {
    // Émise il y a 200 jours, défaut 30 j → échue depuis 170 jours.
    mockPrisma.factureFormation.findMany.mockResolvedValue([factureSansEcheance(200, null)]);

    await lancer();

    // L'échéance est bien persistée…
    const posee = mockPrisma.factureFormation.updateMany.mock.calls.find((c) => {
      const arg = c[0] as { data: Record<string, unknown> };
      return "echeanceAt" in arg.data;
    });
    expect(posee).toBeDefined();
    // …le passage en `en_retard` est appliqué (constat d'état, pas une sollicitation)…
    const marquee = mockPrisma.factureFormation.updateMany.mock.calls.find((c) => {
      const arg = c[0] as { data: Record<string, unknown> };
      return arg.data["statut"] === "en_retard";
    });
    expect(marquee).toBeDefined();
    // …mais AUCUNE relance n'est proposée à ce passage.
    expect(mockPrisma.relanceProposee.create).not.toHaveBeenCalled();
  });

  it("ne répare RIEN sur une créance éteinte (avoir total ou trop-perçu)", async () => {
    mockPrisma.factureFormation.findMany.mockResolvedValue([
      { ...factureSansEcheance(10, null), payments: [{ amountCents: 66_000 }] },
    ]);

    await lancer();

    expect(mockPrisma.factureFormation.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.relanceProposee.create).not.toHaveBeenCalled();
  });

  it("une facture qui a DÉJÀ une échéance échue suit le circuit normal (relance proposée)", async () => {
    mockPrisma.factureFormation.findMany.mockResolvedValue([
      {
        ...factureSansEcheance(60, null),
        echeanceAt: new Date(Date.now() - 30 * JOUR_MS),
      },
    ]);

    await lancer();

    // Aucune réparation (l'échéance existait), mais bascule + relance J30.
    const reparation = mockPrisma.factureFormation.updateMany.mock.calls.find((c) => {
      const arg = c[0] as { data: Record<string, unknown> };
      return "echeanceAt" in arg.data;
    });
    expect(reparation).toBeUndefined();
    expect(mockPrisma.relanceProposee.create).toHaveBeenCalledTimes(1);
    const create = mockPrisma.relanceProposee.create.mock.calls[0]![0] as {
      data: { palier: string; type: string };
    };
    expect(create.data.palier).toBe("j30");
    expect(create.data.type).toBe("facture_retard");
  });

  // 🔴 L'échelle s'arrêtait à j30 : au-delà, plus AUCUNE relance n'était
  // proposée — la créance la plus ancienne était la seule à ne plus remonter.
  it("propose une MISE EN DEMEURE (j45) au-delà de 45 jours de retard", async () => {
    mockPrisma.factureFormation.findMany.mockResolvedValue([
      {
        ...factureSansEcheance(80, null),
        echeanceAt: new Date(Date.now() - 50 * JOUR_MS),
      },
    ]);

    await lancer();

    const create = mockPrisma.relanceProposee.create.mock.calls[0]![0] as {
      data: { palier: string };
    };
    expect(create.data.palier).toBe("j45");
  });

  it("propose le palier j60 (avant contentieux) au-delà de 60 jours de retard", async () => {
    mockPrisma.factureFormation.findMany.mockResolvedValue([
      {
        ...factureSansEcheance(120, null),
        echeanceAt: new Date(Date.now() - 90 * JOUR_MS),
      },
    ]);

    await lancer();

    const create = mockPrisma.relanceProposee.create.mock.calls[0]![0] as {
      data: { palier: string };
    };
    expect(create.data.palier).toBe("j60");
  });

  it("idempotent : une relance déjà proposée sur ce palier n'est pas recréée", async () => {
    mockPrisma.factureFormation.findMany.mockResolvedValue([
      {
        ...factureSansEcheance(60, null),
        echeanceAt: new Date(Date.now() - 30 * JOUR_MS),
      },
    ]);
    mockPrisma.relanceProposee.findFirst.mockResolvedValue({ id: "deja-la" });

    await lancer();

    expect(mockPrisma.relanceProposee.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// attestations-auto — garde « pas d'attestation sans évaluation finale »
//
// 🔴 Régression de production 2026-08-03 (AXI-ATT-2026-003) : le cron émettait
// une attestation pour tout inscrit d'une session `realisee`, évaluation ou non.
// La pièce certifiait « en a satisfait les exigences » ET affichait « Évaluation
// des acquis non réalisée ». Indicateur 11, non graduable.
//
// Ce test porte sur le `where` de la requête, pas sur le nombre d'appels : le
// défaut n'était pas une boucle fautive, c'était un filtre absent. Compter les
// appels aurait laissé passer la régression — la liste renvoyée par le mock est
// ce que le test décide, pas ce que la requête sélectionne.
// ─────────────────────────────────────────────────────────────────────────────
describe("formation-crons.attestations-auto — garde évaluation finale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    mockPrisma.enrollment.count.mockResolvedValue(0);
  });

  it("ne sélectionne que les inscrits ayant une évaluation de type `finale`", async () => {
    await formationCronsHandler({
      type: "formation-crons.attestations-auto",
      tick: "2026-08-03T09:00:00Z",
    });

    const where = mockPrisma.enrollment.findMany.mock.calls[0]?.[0]?.where;
    expect(where?.evaluations).toEqual({ some: { type: "finale" } });
    expect(where?.attestationGenereeAt).toBeNull();
    expect(where?.session).toEqual({ statut: "realisee" });
  });

  it("compte séparément les inscrits en attente d'évaluation, au lieu de les taire", async () => {
    await formationCronsHandler({
      type: "formation-crons.attestations-auto",
      tick: "2026-08-03T09:00:00Z",
    });

    const where = mockPrisma.enrollment.count.mock.calls[0]?.[0]?.where;
    expect(where?.evaluations).toEqual({ none: { type: "finale" } });
  });

  it("génère l'attestation des inscrits que la requête a retenus", async () => {
    const { genererAttestationPourEnrollment } =
      await import("@/server/qualiopi/evaluations/attestation-service");
    mockPrisma.enrollment.findMany.mockResolvedValue([
      { id: "enroll-evalue-1", session: { id: "s1" } },
      { id: "enroll-evalue-2", session: { id: "s1" } },
    ]);

    await formationCronsHandler({
      type: "formation-crons.attestations-auto",
      tick: "2026-08-03T09:00:00Z",
    });

    expect(genererAttestationPourEnrollment).toHaveBeenCalledTimes(2);
    expect(genererAttestationPourEnrollment).toHaveBeenCalledWith("enroll-evalue-1");
    expect(genererAttestationPourEnrollment).toHaveBeenCalledWith("enroll-evalue-2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// satisfaction-j1 / suivi-j30 — rattrapage sans fenêtre
//
// 🔴 Régression de production 2026-08-03. Les deux crons sélectionnaient sur une
// fenêtre glissante de 24 h ET exigeaient `statut = realisee` au même passage.
// Une session clôturée avec un jour de retard sortait de la fenêtre et ne
// recevait JAMAIS son questionnaire. Sur le premier dossier réel : 0 appréciation
// recueillie, indicateurs 8 et 30 vides.
//
// Le test porte sur le `where` — le défaut n'était pas la boucle d'envoi mais le
// critère de sélection. Compter les appels aurait laissé repasser la régression.
// ─────────────────────────────────────────────────────────────────────────────
describe("questionnaires — rattrapage sans fenêtre glissante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
  });

  it("satisfaction-j1 sélectionne sur l'ABSENCE d'envoi, pas sur une tranche horaire", async () => {
    await formationCronsHandler({
      type: "formation-crons.satisfaction-j1",
      tick: "2026-08-03T08:00:00Z",
    });

    const where = mockPrisma.enrollment.findMany.mock.calls[0]?.[0]?.where;
    expect(where?.questionnaires).toEqual({
      some: { type: "satisfaction_chaud", envoyeAt: null, reponduAt: null },
    });
    expect(where?.session?.statut).toBe("realisee");
  });

  it("suivi-j30 applique le même rattrapage sur la seconde source d'appréciation", async () => {
    await formationCronsHandler({
      type: "formation-crons.suivi-j30",
      tick: "2026-08-03T08:00:00Z",
    });

    const where = mockPrisma.enrollment.findMany.mock.calls[0]?.[0]?.where;
    expect(where?.questionnaires).toEqual({
      some: { type: "satisfaction_froid", envoyeAt: null, reponduAt: null },
    });
  });

  it("marque `envoyeAt` après envoi — sans quoi le rattrapage renverrait en boucle", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([{ id: "enroll-1" }]);

    await formationCronsHandler({
      type: "formation-crons.satisfaction-j1",
      tick: "2026-08-03T08:00:00Z",
    });

    expect(mockPrisma.questionnaire.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollmentId: "enroll-1",
          type: "satisfaction_chaud",
          envoyeAt: null,
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Relances questionnaires + enquête entreprise (2026-08-04)
// ─────────────────────────────────────────────────────────────────────────────

describe("formation-crons.relance-questionnaires", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("relance chaque questionnaire dû, une erreur n'arrête pas les suivants", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      { id: "q-1" },
      { id: "q-2" },
      { id: "q-3" },
    ]);
    // q-2 échoue (ex. stagiaire sans email) — q-3 doit quand même partir.
    mockEnvoyerRelance
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("email manquant"))
      .mockResolvedValueOnce(undefined);

    await expect(
      formationCronsHandler({
        type: "formation-crons.relance-questionnaires",
        tick: "2026-08-04T08:30:00Z",
      }),
    ).resolves.toBeUndefined();

    expect(mockEnvoyerRelance).toHaveBeenCalledTimes(3);
    expect(mockEnvoyerRelance).toHaveBeenNthCalledWith(3, "q-3");
  });

  it("le plafond de 2 relances est STRUCTUREL dans la sélection", async () => {
    // 🔴 Vérifié par réintroduction : si quelqu'un ajoute une branche
    // `relanceCount: 2` (ou remplace le OR par un simple envoyeAt ≤ J-3),
    // ce test rougit — c'est la seule garde contre le harcèlement par email.
    mockPrisma.questionnaire.findMany.mockResolvedValue([]);

    await formationCronsHandler({
      type: "formation-crons.relance-questionnaires",
      tick: "2026-08-04T08:30:00Z",
    });

    const where = (
      mockPrisma.questionnaire.findMany.mock.calls[0]![0] as {
        where: {
          reponduAt: null;
          envoyeAt: { not: null; gte: Date };
          OR: Array<{ relanceCount: number }>;
        };
      }
    ).where;

    // Sans réponse uniquement, et jamais au-delà de 90 jours.
    expect(where.reponduAt).toBeNull();
    expect(where.envoyeAt.gte).toBeInstanceOf(Date);
    // Exactement deux branches : relanceCount 0 (J+3) et 1 (J+7 après la 1ʳᵉ).
    expect(where.OR.map((b) => b.relanceCount).sort()).toEqual([0, 1]);
  });
});

describe("formation-crons.enquete-entreprise-j30", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envoie l'enquête aux sessions réalisées ≥ J+30 puis marque envoyeAt", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([{ id: "sess-1" }]);
    mockEnvoyerEnquete.mockResolvedValue(undefined);
    mockPrisma.questionnaire.updateMany.mockResolvedValue({ count: 1 });

    await formationCronsHandler({
      type: "formation-crons.enquete-entreprise-j30",
      tick: "2026-08-04T08:15:00Z",
    });

    expect(mockEnvoyerEnquete).toHaveBeenCalledTimes(1);
    expect(mockEnvoyerEnquete).toHaveBeenCalledWith("sess-1");
    // Le marquage envoyeAt ne cible QUE l'enquête entreprise de cette session.
    expect(mockPrisma.questionnaire.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "satisfaction_entreprise",
          envoyeAt: null,
          enrollment: { sessionId: "sess-1" },
        }),
        data: { envoyeAt: expect.any(Date) },
      }),
    );

    // Idempotence : la sélection exclut les sessions déjà enquêtées.
    const where = (
      mockPrisma.trainingSession.findMany.mock.calls[0]![0] as {
        where: { statut: string; NOT: unknown };
      }
    ).where;
    expect(where.statut).toBe("realisee");
    expect(where.NOT).toEqual({
      enrollments: {
        some: {
          questionnaires: {
            some: { type: "satisfaction_entreprise", envoyeAt: { not: null } },
          },
        },
      },
    });
  });

  it("échec d'envoi → envoyeAt N'EST PAS marqué (la session reste candidate)", async () => {
    // 🔴 Marquer avant d'avoir envoyé transformerait tout échec transitoire en
    // enquête définitivement perdue — le contraire exact du bug satisfaction-j1
    // (fenêtre ratée = questionnaire perdu à vie) qu'on vient de payer.
    mockPrisma.trainingSession.findMany.mockResolvedValue([{ id: "sess-ko" }]);
    mockEnvoyerEnquete.mockRejectedValue(new Error("contact client sans email"));

    await expect(
      formationCronsHandler({
        type: "formation-crons.enquete-entreprise-j30",
        tick: "2026-08-04T08:15:00Z",
      }),
    ).resolves.toBeUndefined();

    expect(mockPrisma.questionnaire.updateMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests handleDevisExpiration — expiration + relance J+3 (parcours vente)
//
// Deux mécaniques dans le même passage quotidien : l'échéance passe les devis
// `envoye → expire`, puis les devis encore vivants mais muets depuis 3 jours
// reçoivent une PROPOSITION de relance (hub facturation, envoi = clic admin).
// ─────────────────────────────────────────────────────────────────────────────

describe("handleDevisExpiration — expiration + relance J+3 (via formationCronsHandler)", () => {
  const JOUR_MS = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
    mockPrisma.devis.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.devis.findMany.mockResolvedValue([]);
    mockPrisma.relanceProposee.findFirst.mockResolvedValue(null);
    mockPrisma.relanceProposee.create.mockResolvedValue({ id: "relance-1" });
  });

  const devisDormant = (joursDepuisEnvoi: number) => ({
    id: "dev-1",
    numero: "AXI-DEV-2026-042",
    dateValidite: new Date(Date.now() + 20 * JOUR_MS),
    sentAt: new Date(Date.now() - joursDepuisEnvoi * JOUR_MS),
    client: { raisonSociale: "INVEST SUN" },
  });

  const lancer = () =>
    formationCronsHandler({
      type: "formation-crons.devis-expiration",
      tick: "2026-08-05T06:45:00Z",
    });

  it("passe les devis échus envoye→expire (statut seul, jamais d'email)", async () => {
    await lancer();

    const arg = mockPrisma.devis.updateMany.mock.calls[0]![0] as {
      where: { statut: string; dateValidite: { lt: Date } };
      data: { statut: string };
    };
    expect(arg.where.statut).toBe("envoye");
    expect(arg.data.statut).toBe("expire");
  });

  it("propose UNE relance J+3 pour un devis envoyé sans réponse depuis 3 jours", async () => {
    mockPrisma.devis.findMany.mockResolvedValue([devisDormant(4)]);

    await lancer();

    // La sélection ne vise que les devis encore `envoye`, expédiés il y a ≥ 3 j.
    const sel = mockPrisma.devis.findMany.mock.calls[0]![0] as {
      where: { statut: string; sentAt: { not: null; lte: Date } };
    };
    expect(sel.where.statut).toBe("envoye");
    expect(Date.now() - sel.where.sentAt.lte.getTime()).toBeGreaterThanOrEqual(3 * JOUR_MS - 1000);

    expect(mockPrisma.relanceProposee.create).toHaveBeenCalledTimes(1);
    const create = mockPrisma.relanceProposee.create.mock.calls[0]![0] as {
      data: { type: string; palier: string; devisId: string; suggestion: string };
    };
    expect(create.data.type).toBe("devis_sans_reponse");
    expect(create.data.palier).toBe("j3");
    expect(create.data.devisId).toBe("dev-1");
    expect(create.data.suggestion).toContain("AXI-DEV-2026-042");
  });

  it("IDEMPOTENT : une relance déjà proposée sur ce devis n'est jamais doublée", async () => {
    mockPrisma.devis.findMany.mockResolvedValue([devisDormant(10)]);
    mockPrisma.relanceProposee.findFirst.mockResolvedValue({ id: "deja-la" });

    await lancer();

    expect(mockPrisma.relanceProposee.create).not.toHaveBeenCalled();
  });

  it("aucun devis dormant → aucune relance", async () => {
    await lancer();
    expect(mockPrisma.relanceProposee.create).not.toHaveBeenCalled();
  });
});
