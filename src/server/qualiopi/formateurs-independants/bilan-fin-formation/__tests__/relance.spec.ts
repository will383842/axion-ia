// @vitest-environment node

/**
 * Lot G2 — relance F61 et alerte interne à J+10 (accès en base simulés).
 *
 *   · interrupteur éteint : rien n'est lu au-delà de lui, rien ne part ;
 *   · seul l'indépendant en nom propre, sur une session finie après l'allumage, est lu ;
 *   · l'alerte part une fois par bilan, tracée au journal, sans aucun nom.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T = "11111111-1111-4111-8111-111111111111";
const BILAN = "55555555-5555-4555-8555-555555555555";

const m = vi.hoisted(() => ({
  allume: vi.fn(),
  journaliser: vi.fn(),
  telegram: vi.fn(),
  db: {
    setting: { findUnique: vi.fn() },
    trainingSession: { findMany: vi.fn() },
    trainer: { findMany: vi.fn() },
    bilanFinFormation: { findMany: vi.fn(), upsert: vi.fn() },
    emailLog: { findMany: vi.fn() },
    emailOpposition: { findMany: vi.fn() },
    activityLog: { count: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: m.telegram }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: m.journaliser }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: m.allume,
}));

import { CAMPAGNE_BILAN, lireLignesBilan, passerAlerteBilanFinFormation } from "../relance";

// 15/11/2026, 10 h à Paris : J+11 après une dernière journée le 04/11.
const MAINTENANT = new Date("2026-11-15T09:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://exemple.test");
  m.allume.mockResolvedValue(true);
  m.db.setting.findUnique.mockResolvedValue({
    value: { actif: true, allumeLe: "2026-11-01T08:00:00.000Z" },
    updatedAt: new Date("2026-11-01T08:00:00Z"),
  });
  m.db.trainingSession.findMany.mockResolvedValue([
    {
      id: SESSION,
      numero: "S-2026-001",
      titreSession: "IA générative",
      formateurPrincipalId: T,
      sessionFormateurs: [],
      jours: [{ date: new Date("2026-11-04T00:00:00Z"), heureFin: "17:00", trainerId: null }],
    },
  ]);
  m.db.trainer.findMany.mockResolvedValue([
    {
      id: T,
      email: "f@example.test",
      prenom: "Camille",
      statut: "sous_traitant",
      organismeSousTraitantId: null,
      finCollaborationAt: null,
    },
  ]);
  m.db.bilanFinFormation.findMany.mockResolvedValue([]);
  m.db.bilanFinFormation.upsert.mockResolvedValue({ id: BILAN });
  m.db.emailLog.findMany.mockResolvedValue([]);
  m.db.emailOpposition.findMany.mockResolvedValue([]);
  m.db.activityLog.count.mockResolvedValue(0);
  m.journaliser.mockResolvedValue(true);
  m.telegram.mockResolvedValue(true);
});

describe("lecture des bilans à relancer", () => {
  it("éteint : rien n'est lu au-delà de l'interrupteur", async () => {
    m.allume.mockResolvedValue(false);
    expect(await lireLignesBilan(MAINTENANT)).toEqual([]);
    expect(await CAMPAGNE_BILAN.lireFaits(MAINTENANT)).toEqual([]);
    expect(await passerAlerteBilanFinFormation(MAINTENANT)).toBe(0);
    expect(m.db.trainingSession.findMany).not.toHaveBeenCalled();
    expect(m.telegram).not.toHaveBeenCalled();
  });

  it("la campagne porte le lien vers le bloc de la session", async () => {
    const [f] = await CAMPAGNE_BILAN.lireFaits(MAINTENANT);
    expect(f?.payload).toMatchObject({
      prenom: "Camille",
      lien: `https://exemple.test/fr/espace-formateur/sessions/${SESSION}#fin-de-formation`,
    });
    expect(CAMPAGNE_BILAN.interrupteurs).toEqual(["textes_valides"]);
  });

  it("session finie avant l'allumage : rien", async () => {
    m.db.setting.findUnique.mockResolvedValue({
      value: { actif: true, allumeLe: "2026-11-10T08:00:00.000Z" },
      updatedAt: new Date(),
    });
    expect(await lireLignesBilan(MAINTENANT)).toEqual([]);
  });
});

describe("alerte interne à J+10", () => {
  it("une fois par bilan, tracée, sans nom ni adresse", async () => {
    expect(await passerAlerteBilanFinFormation(MAINTENANT)).toBe(1);
    expect(m.journaliser).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({
        action: "qualiopi.formateur.bilan_alerte_j10",
        targetType: "BilanFinFormation",
        targetId: BILAN,
      }),
    );
    const corps = String(m.telegram.mock.calls[0]![0].body);
    expect(corps).toContain("S-2026-001");
    expect(corps).not.toMatch(/Camille|example\.test/);

    m.db.activityLog.count.mockResolvedValue(1);
    expect(await passerAlerteBilanFinFormation(MAINTENANT)).toBe(0);
  });

  it("bilan terminé : aucune alerte", async () => {
    m.db.bilanFinFormation.findMany.mockResolvedValue([
      { sessionId: SESSION, trainerId: T, termineAt: new Date(), payerQuandMemeAt: null },
    ]);
    expect(await passerAlerteBilanFinFormation(MAINTENANT)).toBe(0);
  });

  it("hors de 8 h - 19 h (Paris) : rien", async () => {
    expect(await passerAlerteBilanFinFormation(new Date("2026-11-15T20:00:00Z"))).toBe(0);
  });
});
