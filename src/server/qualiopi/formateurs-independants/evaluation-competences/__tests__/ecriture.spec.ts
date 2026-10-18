// @vitest-environment node

/**
 * Qualiopi ind. 21 — l'écrivain des grilles : rôle jugé avant toute lecture, auteur =
 * session, grille vierge refusée, « habilité » refusé sous les seuils, journal exigé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  trainer: { statut: "sous_traitant" } as { statut: string } | null,
  formation: { id: "ffffffff-ffff-4fff-8fff-ffffffffffff" } as { id: string } | null,
  lignes: [] as unknown[],
  create: vi.fn(),
  journal: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    trainer: { findUnique: vi.fn(async () => h.trainer) },
    formation: { findUnique: vi.fn(async () => h.formation) },
    evaluationCompetenceFormateur: {
      findMany: vi.fn(async () => h.lignes),
      create: h.create,
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
  };
  return { prisma: client };
});
vi.mock("@/server/journal/journaliser", () => ({ journaliser: h.journal }));
vi.mock("../reglages-lecture", async () => ({
  lireReglagesEvaluation: async () => (await import("../reglages")).REGLAGES_EVALUATION,
}));

import { BLOCS_MISE_EN_SITUATION, CRITERES_ENTRETIEN } from "../configuration";
import { verserEvaluation } from "../ecriture";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "admin" };
const notes = (c: ReadonlyArray<{ code: string }>, n: number) =>
  Object.fromEntries(c.map((x) => [x.code, n]));

beforeEach(() => {
  vi.clearAllMocks();
  h.trainer = { statut: "sous_traitant" };
  h.formation = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff" };
  h.lignes = [];
  h.create.mockResolvedValue({ id: "nouvelle" });
  h.journal.mockResolvedValue(true);
});

describe("verserEvaluation", () => {
  it("rôle non habilité (editor) : refus, rien n'est lu ni écrit", async () => {
    const r = await verserEvaluation({
      trainerId: ID,
      session: { userId: ADMIN.userId, role: "editor" },
      demande: { nature: "entretien", notes: notes(CRITERES_ENTRETIEN, 4) },
    });
    expect(r.ok).toBe(false);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("grille vierge : refus", async () => {
    const r = await verserEvaluation({
      trainerId: ID,
      session: ADMIN,
      demande: { nature: "mise_en_situation", notes: {} },
    });
    expect(r.ok).toBe(false);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("un salarié n'a pas de grille d'indépendant", async () => {
    h.trainer = { statut: "salarie" };
    const r = await verserEvaluation({
      trainerId: ID,
      session: ADMIN,
      demande: { nature: "entretien", notes: notes(CRITERES_ENTRETIEN, 4) },
    });
    expect(r.ok).toBe(false);
  });

  it("verse une grille complète, attribuée à la session, journalisée (exigée)", async () => {
    const r = await verserEvaluation({
      trainerId: ID,
      session: ADMIN,
      demande: { nature: "entretien", notes: notes(CRITERES_ENTRETIEN, 4) },
    });
    expect(r).toEqual({ ok: true, id: "nouvelle" });
    expect(h.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trainerId: ID,
          nature: "entretien",
          auteurId: ADMIN.userId,
          auteurRole: "admin",
        }),
      }),
    );
    expect(h.journal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "qualiopi.trainer.evaluation_competences" }),
      { exiger: true },
    );
  });

  it("« habilité » sous les seuils : refus ; la décision ne s'écrit pas", async () => {
    const base = { formationId: null, decision: null, motif: null, dateSuivie: null, version: 1 };
    h.lignes = [
      {
        ...base,
        id: "e",
        nature: "entretien",
        notes: notes(CRITERES_ENTRETIEN, 1),
        createdAt: new Date(1),
      },
      {
        ...base,
        id: "m",
        nature: "mise_en_situation",
        notes: notes(BLOCS_MISE_EN_SITUATION, 5),
        createdAt: new Date(2),
      },
    ];
    const r = await verserEvaluation({
      trainerId: ID,
      session: ADMIN,
      demande: {
        nature: "decision_habilitation",
        formationId: h.formation!.id,
        decision: "habilite",
        motif: "bien",
      },
    });
    expect(r.ok).toBe(false);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("une décision motivée garde la copie des seuils et cite ses grilles", async () => {
    const base = { formationId: null, decision: null, motif: null, dateSuivie: null, version: 1 };
    h.lignes = [
      {
        ...base,
        id: "e",
        nature: "entretien",
        notes: notes(CRITERES_ENTRETIEN, 5),
        createdAt: new Date(1),
      },
      {
        ...base,
        id: "m",
        nature: "mise_en_situation",
        notes: notes(BLOCS_MISE_EN_SITUATION, 5),
        createdAt: new Date(2),
      },
    ];
    const r = await verserEvaluation({
      trainerId: ID,
      session: ADMIN,
      demande: {
        nature: "decision_habilitation",
        formationId: h.formation!.id,
        decision: "habilite",
        motif: "Très bonne mise en situation",
      },
    });
    expect(r.ok).toBe(true);
    const data = h.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      decision: "habilite",
      entretienId: "e",
      miseEnSituationId: "m",
      motif: "Très bonne mise en situation",
    });
    expect(data.seuilsAppliques).toBeDefined();
  });

  it("journal en échec : rien n'est versé (erreur rendue)", async () => {
    h.journal.mockRejectedValue(new Error("journal"));
    const r = await verserEvaluation({
      trainerId: ID,
      session: ADMIN,
      demande: { nature: "formation_methode", jour: "2026-10-01" },
    });
    expect(r.ok).toBe(false);
  });
});
