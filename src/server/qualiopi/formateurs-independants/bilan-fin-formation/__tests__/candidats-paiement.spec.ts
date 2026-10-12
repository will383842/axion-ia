// @vitest-environment node

/**
 * Lot G2 — le paiement par mission LIT le bilan de fin de formation.
 *
 *   · interrupteur éteint (aucune ligne de réglage) : aucune lecture de plus, aucun
 *     candidat ne porte d'exigence — exactement comme avant ;
 *   · allumé : l'indépendant en nom propre porte l'état de son bilan ;
 *   · le salarié et le formateur d'un organisme ne portent rien ;
 *   · une session finie AVANT l'allumage ne porte rien (jamais rétroactif).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const m = {
    sessions: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    missions: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    signatures: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    revendications: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    setting: vi.fn(async (..._a: unknown[]) => null as unknown),
    bilans: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    trainers: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
  };
  const prisma = {
    trainingSession: { findMany: (...a: unknown[]) => m.sessions(...a) },
    missionFormateur: { findMany: (...a: unknown[]) => m.missions(...a) },
    emargementContresignature: { findMany: (...a: unknown[]) => m.signatures(...a) },
    revendicationPaiement: { findMany: (...a: unknown[]) => m.revendications(...a) },
    setting: { findUnique: (...a: unknown[]) => m.setting(...a) },
    bilanFinFormation: { findMany: (...a: unknown[]) => m.bilans(...a) },
    trainer: { findMany: (...a: unknown[]) => m.trainers(...a) },
  };
  return { m, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));

import { lireCandidats } from "../../paiement/passage-mission-base";

const SESSION = "a5a5a5a5-0000-4000-8000-00000000000a";
const T = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOUR = new Date("2026-11-05T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  h.m.sessions.mockResolvedValue([
    {
      id: SESSION,
      dateDebut: new Date("2026-11-04T08:00:00Z"),
      lieuType: "sur_site",
      modalite: "presentiel",
      jours: [
        {
          date: new Date("2026-11-04T00:00:00Z"),
          heureDebut: "09:00",
          heureFin: "17:00",
          trainerId: null,
        },
        { date: JOUR, heureDebut: "09:00", heureFin: "17:00", trainerId: null },
      ],
      sessionFormateurs: [{ trainerId: T, role: "principal" }],
    },
  ]);
  h.m.signatures.mockResolvedValue([
    { sessionId: SESSION, trainerId: T, date: JOUR, demiJournee: "matin" },
  ]);
  h.m.trainers.mockResolvedValue([
    { id: T, statut: "sous_traitant", organismeSousTraitantId: null },
  ]);
});

const allume = (le: string) =>
  h.m.setting.mockResolvedValue({ value: { actif: true, allumeLe: le }, updatedAt: new Date(le) });

describe("lireCandidats et le bilan de fin de formation", () => {
  it("éteint : aucune exigence, aucune lecture de bilan", async () => {
    const [c] = await lireCandidats("2026-11-01");
    expect(c).not.toHaveProperty("bilanFinFormation");
    expect(h.m.bilans).not.toHaveBeenCalled();
    h.m.setting.mockResolvedValue({ value: { actif: false }, updatedAt: new Date() });
    const [d] = await lireCandidats("2026-11-01");
    expect(d).not.toHaveProperty("bilanFinFormation");
  });

  it("allumé : l'indépendant porte son bilan (absent = non terminé)", async () => {
    allume("2026-11-01T08:00:00.000Z");
    const [c] = await lireCandidats("2026-11-01");
    expect(c?.bilanFinFormation).toEqual({ termine: false, payerQuandMeme: false });

    h.m.bilans.mockResolvedValue([
      { sessionId: SESSION, trainerId: T, termineAt: new Date(), payerQuandMemeAt: null },
    ]);
    const [d] = await lireCandidats("2026-11-01");
    expect(d?.bilanFinFormation).toEqual({ termine: true, payerQuandMeme: false });
  });

  it("salarié ou formateur d'un organisme : aucune exigence", async () => {
    allume("2026-11-01T08:00:00.000Z");
    h.m.trainers.mockResolvedValue([{ id: T, statut: "salarie", organismeSousTraitantId: null }]);
    expect((await lireCandidats("2026-11-01"))[0]).not.toHaveProperty("bilanFinFormation");
    h.m.trainers.mockResolvedValue([
      { id: T, statut: "sous_traitant", organismeSousTraitantId: "o" },
    ]);
    expect((await lireCandidats("2026-11-01"))[0]).not.toHaveProperty("bilanFinFormation");
  });

  it("session finie avant l'allumage : jamais rétroactif", async () => {
    allume("2026-11-06T08:00:00.000Z");
    expect((await lireCandidats("2026-11-01"))[0]).not.toHaveProperty("bilanFinFormation");
  });
});
