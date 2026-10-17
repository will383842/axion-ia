/**
 * Lot L08 — createEvaluation sous `qualiopi.pedagogie.actif` :
 * seuil figé dans la session, règle « aucun objectif non acquis », éteint = inchangé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    evaluationAcquis: { create: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    setting: { findUnique: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { createEvaluation } from "../evaluations/evaluations-service";

const p = prisma as unknown as {
  evaluationAcquis: { create: ReturnType<typeof vi.fn> };
  enrollment: { findUnique: ReturnType<typeof vi.fn> };
  setting: { findUnique: ReturnType<typeof vi.fn> };
};
const config = getQualiopiConfig as ReturnType<typeof vi.fn>;

function inscription(over: { test?: boolean; snapshot?: unknown } = {}) {
  return {
    estTestInterne: false,
    session: {
      dateDebut: new Date("2026-06-10T09:00:00.000Z"),
      estTestInterne: over.test ?? false,
      formationSnapshot: over.snapshot ?? null,
    },
  };
}
const interrupteur = (etat: string | null) =>
  p.setting.findUnique.mockResolvedValue(etat === null ? null : { value: { etat } });

const comp = (...notes: Array<1 | 2 | 3>) =>
  notes.map((note, i) => ({ libelle: `O${i + 1}`, note }));
const saisir = (competences: ReturnType<typeof comp>) =>
  createEvaluation({
    enrollmentId: "e1",
    type: "finale",
    dateEvaluation: "2026-06-12T10:00:00.000Z",
    competences,
  });
const reussiteEcrite = () => p.evaluationAcquis.create.mock.calls[0]![0].data.reussite as boolean;

beforeEach(() => {
  vi.clearAllMocks();
  config.mockResolvedValue(70);
  p.evaluationAcquis.create.mockResolvedValue({ id: "ev1" });
});

describe("éteint = inchangé", () => {
  it.each([null, "eteint"])(
    "clé %s : le score seul décide, même avec un objectif non acquis",
    async (etat) => {
      interrupteur(etat);
      p.enrollment.findUnique.mockResolvedValue(
        inscription({ snapshot: { seuilReussitePct: 95 } }),
      );
      await saisir(comp(3, 3, 3, 3, 1)); // 13/15 = 87 %
      expect(reussiteEcrite()).toBe(true);
    },
  );

  it("base illisible : éteint", async () => {
    p.setting.findUnique.mockRejectedValue(new Error("down"));
    p.enrollment.findUnique.mockResolvedValue(inscription());
    await saisir(comp(3, 3, 3, 3, 1));
    expect(reussiteEcrite()).toBe(true);
  });
});

describe("actif", () => {
  beforeEach(() => interrupteur("actif"));

  it("un objectif non acquis fait échouer malgré un bon score", async () => {
    p.enrollment.findUnique.mockResolvedValue(inscription());
    await saisir(comp(3, 3, 3, 3, 1));
    expect(reussiteEcrite()).toBe(false);
  });

  it("le seuil figé dans la session l'emporte sur le réglage courant", async () => {
    config.mockResolvedValue(50); // le réglage a baissé depuis la création
    p.enrollment.findUnique.mockResolvedValue(inscription({ snapshot: { seuilReussitePct: 80 } }));
    await saisir(comp(2, 3, 2)); // 7/9 = 78 %
    expect(reussiteEcrite()).toBe(false);
  });

  it("session sans seuil figé : le réglage courant s'applique", async () => {
    config.mockResolvedValue(60);
    p.enrollment.findUnique.mockResolvedValue(inscription());
    await saisir(comp(2, 3, 2));
    expect(reussiteEcrite()).toBe(true);
  });
});

describe("essai", () => {
  beforeEach(() => interrupteur("essai"));

  it("n'agit pas sur une session réelle", async () => {
    p.enrollment.findUnique.mockResolvedValue(inscription({ test: false }));
    await saisir(comp(3, 3, 3, 3, 1));
    expect(reussiteEcrite()).toBe(true);
  });

  it("agit sur une session du banc d'essai", async () => {
    p.enrollment.findUnique.mockResolvedValue(inscription({ test: true }));
    await saisir(comp(3, 3, 3, 3, 1));
    expect(reussiteEcrite()).toBe(false);
  });
});
