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
    questionnaire: {
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
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/qualiopi/notifications/notifications-service", () => ({
  envoyerConvocation: vi.fn(),
  envoyerRappelJ7: vi.fn(),
  envoyerSatisfactionJ1: vi.fn(),
  envoyerSuiviJ30: vi.fn(),
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
  notifierAlerteInterne,
} from "@/server/qualiopi/notifications/notifications-service";
import { synchroniserAlertes } from "@/server/qualiopi/alertes/alertes-service";
import { decideSessionTransitions } from "@/server/qualiopi/formations/crons";
import { formationCronsHandler } from "./qualiopi-formation-crons-worker";

const mockPrisma = prisma as unknown as {
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  questionnaire: { updateMany: ReturnType<typeof vi.fn> };
  alerteSysteme: { findMany: ReturnType<typeof vi.fn> };
  factureFormation: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  relanceProposee: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockEnvoyerConvocation = envoyerConvocation as ReturnType<typeof vi.fn>;
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
    // Stub DB → aucune session planifiée dans la fenêtre J-5
    mockPrisma.trainingSession.findMany.mockResolvedValue([]);

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

describe("handleConvocationJ5 (via formationCronsHandler)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Environnement non-stub pour ces tests
    delete process.env["DATABASE_URL"];
  });

  it("skip si DATABASE_URL = stub.invalid (stub-aware)", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await formationCronsHandler({
        type: "formation-crons.convocation-j5",
        tick: "2026-06-06T08:00:00Z",
      });
      expect(mockPrisma.trainingSession.findMany).not.toHaveBeenCalled();
      expect(mockEnvoyerConvocation).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  it("ne fait rien si aucune session planifiée dans la fenêtre J-5", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([]);

    await formationCronsHandler({
      type: "formation-crons.convocation-j5",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockEnvoyerConvocation).not.toHaveBeenCalled();
  });

  it("appelle envoyerConvocation pour chaque enrollment des sessions J-5", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      {
        id: "session-uuid-1",
        enrollments: [{ id: "enroll-uuid-1" }, { id: "enroll-uuid-2" }],
      },
      {
        id: "session-uuid-2",
        enrollments: [{ id: "enroll-uuid-3" }],
      },
    ]);
    mockEnvoyerConvocation.mockResolvedValue(undefined);

    await formationCronsHandler({
      type: "formation-crons.convocation-j5",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockEnvoyerConvocation).toHaveBeenCalledTimes(3);
    expect(mockEnvoyerConvocation).toHaveBeenCalledWith("enroll-uuid-1");
    expect(mockEnvoyerConvocation).toHaveBeenCalledWith("enroll-uuid-2");
    expect(mockEnvoyerConvocation).toHaveBeenCalledWith("enroll-uuid-3");
  });

  it("continue en cas d'erreur sur un enrollment (fail-soft)", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      {
        id: "session-uuid-1",
        enrollments: [{ id: "enroll-ok-1" }, { id: "enroll-ko-1" }, { id: "enroll-ok-2" }],
      },
    ]);
    mockEnvoyerConvocation
      .mockResolvedValueOnce(undefined) // ok-1
      .mockRejectedValueOnce(new Error("Email service down")) // ko-1
      .mockResolvedValueOnce(undefined); // ok-2

    await expect(
      formationCronsHandler({
        type: "formation-crons.convocation-j5",
        tick: "2026-06-06T08:00:00Z",
      }),
    ).resolves.toBeUndefined();

    expect(mockEnvoyerConvocation).toHaveBeenCalledTimes(3);
  });

  it("scanne les sessions dans la fenêtre [J+4.5j, J+5.5j]", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([]);

    await formationCronsHandler({
      type: "formation-crons.convocation-j5",
      tick: "2026-06-06T08:00:00Z",
    });

    const rawCall = mockPrisma.trainingSession.findMany.mock.calls[0];
    expect(rawCall).toBeDefined();
    const callArgs = rawCall![0] as {
      where: {
        statut: string;
        dateDebut: { gte: Date; lte: Date };
      };
    };
    expect(callArgs.where.statut).toBe("planifiee");

    const now = new Date();
    const expectedStart = new Date(now.getTime() + 4.5 * 24 * 60 * 60 * 1000);
    const expectedEnd = new Date(now.getTime() + 5.5 * 24 * 60 * 60 * 1000);

    // Tolérance de 5 secondes pour le temps d'exécution du test
    const tolerance = 5000;
    expect(callArgs.where.dateDebut.gte.getTime()).toBeGreaterThan(
      expectedStart.getTime() - tolerance,
    );
    expect(callArgs.where.dateDebut.gte.getTime()).toBeLessThan(
      expectedStart.getTime() + tolerance,
    );
    expect(callArgs.where.dateDebut.lte.getTime()).toBeGreaterThan(
      expectedEnd.getTime() - tolerance,
    );
    expect(callArgs.where.dateDebut.lte.getTime()).toBeLessThan(expectedEnd.getTime() + tolerance);
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

    // Filtre = critique + non-résolue + non-notifiée (anti-spam).
    const findArgs = mockPrisma.alerteSysteme.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(findArgs.where).toMatchObject({
      niveau: "critique",
      resolue: false,
      notifiedAt: null,
    });
    expect(mockNotifierAlerteInterne).toHaveBeenCalledTimes(2);
    expect(mockNotifierAlerteInterne).toHaveBeenCalledWith("alerte-1");
    expect(mockNotifierAlerteInterne).toHaveBeenCalledWith("alerte-2");
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
