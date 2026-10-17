// @vitest-environment node

/**
 * Vérification 2, V2-A-8 — un relevé mensuel OUBLIÉ reste signalé tant qu'il n'est pas
 * fait, y compris après le 1er du mois suivant.
 *
 * Scénario (contre-calcul en dates) : bascule au 01/10/2041 ; septembre 2041 a eu des
 * journées de session, son calcul n'a jamais été lancé. Le 06/11/2041, le mois écoulé
 * est octobre (rien à payer) ; septembre est un mois PLUS ANCIEN, toujours dû.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  telegram: vi.fn(),
  runMensuel: vi.fn(),
  journees: vi.fn(),
  compteReleves: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: {
      findMany: async () => [],
      findFirst: async () => null,
      count: (...a: unknown[]) => m.compteReleves(...a),
    },
    sessionJour: { count: (...a: unknown[]) => m.journees(...a) },
    trainer: { findMany: async () => [] },
    trainingSession: { findMany: async () => [] },
    emailLog: { count: async () => 0 },
    emailOutbox: { count: async () => 0 },
    activityLog: { count: async () => 0, create: async () => ({}) },
    $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
  },
}));
vi.mock("@/lib/legal-identity", () => ({ resolveRibFacture: async () => null }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => m.telegram(...a) }));
vi.mock("@/server/qualiopi/remuneration/verrou-remuneration", () => ({
  prendreVerrousRemuneration: async () => {},
  DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION: {},
}));
vi.mock("@/server/qualiopi/remuneration/statements", () => ({
  runRemunerationMensuelle: (...a: unknown[]) => m.runMensuel(...a),
}));
vi.mock("../virement-en-attente-suivi", () => ({ envoyerF38Dus: async () => 0 }));
vi.mock("../../envois", () => ({ envoyer: async () => "envoye" }));
vi.mock("../corrections-mission", () => ({ traiterTropPercu: async () => ({}) }));
vi.mock("../lecture-passage", () => ({ lireDateBascule: async () => "2041-10-01" }));
vi.mock("../passage-mission-base", () => ({ lireCandidats: async () => [] }));
vi.mock("../virement-fait-envoi", async (orig) => ({
  ...(await orig<typeof import("../virement-fait-envoi")>()),
  reprendreVirementsFaitsSansF37: async () => 0,
}));

import { MOIS_OUBLIES_SURVEILLES, passerSuiviMission } from "../suivi-mission";

type Periode = { year: number; month: number };
type OuCount = { where: { periodeYear?: number; periodeMonth?: number; statut?: unknown } };

beforeEach(() => {
  vi.clearAllMocks();
  // Seul septembre 2041 a eu des journées de session.
  m.journees.mockImplementation(async (a: { where: { date: { gte: Date } } }) =>
    a.where.date.gte.toISOString().startsWith("2041-09") ? 2 : 0,
  );
  // Aucun relevé mensuel nulle part, aucun relevé à valider.
  m.compteReleves.mockResolvedValue(0);
  m.runMensuel.mockImplementation(async (p: Periode) => ({
    relevesEcrits: p.year === 2041 && p.month === 9 ? 1 : 0,
  }));
});

describe("V2-A-8 — un mois oublié reste signalé", () => {
  it("le 06/11/2041, septembre jamais calculé est encore signalé (simulation seule)", async () => {
    const b = await passerSuiviMission(new Date("2041-11-06T07:15:00Z"));
    expect(b.etat).toBe("fait");
    expect(b.relevesNonLances).toBe(1);
    expect(m.runMensuel).toHaveBeenCalledWith({ year: 2041, month: 9 }, { dryRun: true });
    const corps = m.telegram.mock.calls.map((c) => (c[0] as { body: string }).body);
    expect(corps.some((x) => /septembre 2041/.test(x) && /jamais lancé/.test(x))).toBe(true);
  });

  it("septembre calculé depuis (un relevé mensuel existe) : silence", async () => {
    m.compteReleves.mockImplementation(async (a: OuCount) =>
      a.where.periodeYear === 2041 && a.where.periodeMonth === 9 ? 3 : 0,
    );
    const b = await passerSuiviMission(new Date("2041-11-06T07:15:00Z"));
    expect(b.relevesNonLances).toBe(0);
    expect(m.runMensuel).not.toHaveBeenCalledWith({ year: 2041, month: 9 }, { dryRun: true });
  });

  it("un relevé de septembre resté à valider est signalé aussi", async () => {
    m.compteReleves.mockImplementation(async (a: OuCount) => (a.where.statut ? 2 : 1));
    const b = await passerSuiviMission(new Date("2041-11-06T07:15:00Z"));
    expect(b.alerteNonValides).toBe(2);
  });

  it("avant le délai d'alerte du mois (le 05), rien ne part ; au-delà de 12 mois, rien n'est lu", async () => {
    await passerSuiviMission(new Date("2041-11-05T07:15:00Z"));
    expect(m.journees).not.toHaveBeenCalled();
    await passerSuiviMission(new Date("2041-11-06T07:15:00Z"));
    expect(m.journees).toHaveBeenCalledTimes(MOIS_OUBLIES_SURVEILLES);
    expect(MOIS_OUBLIES_SURVEILLES).toBe(12);
  });

  it("une lecture en échec ne compte rien : jamais d'alerte inventée", async () => {
    m.journees.mockRejectedValue(new Error("base indisponible"));
    const b = await passerSuiviMission(new Date("2041-11-06T07:15:00Z"));
    expect(b.etat).toBe("fait");
    expect(b.relevesNonLances).toBe(0);
  });
});
