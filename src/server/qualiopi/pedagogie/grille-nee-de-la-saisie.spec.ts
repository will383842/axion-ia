/**
 * Lot L08 (O13) — la grille d'évaluation naît de la SAISIE.
 *
 * Avant le lot, `produireGrilleEvaluation` se repliait sur une grille VIERGE
 * quand aucune évaluation n'était enregistrée, et la production automatique la
 * versait au dossier le jour de la création de la session : une pièce de
 * preuve sans constat. Sous `qualiopi.pedagogie.actif`, pas de saisie, pas de
 * grille ; avec une saisie, la grille la reprend et l'évaluation retient son
 * document.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findUnique: vi.fn() },
    evaluationAcquis: { findFirst: vi.fn(), update: vi.fn() },
    trainer: { findUnique: vi.fn() },
    setting: { findUnique: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({ raisonSociale: "Axion-IA SAS" }),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { produireGrilleEvaluation } from "../documents/production/producteurs";

const p = prisma as unknown as {
  enrollment: { findUnique: ReturnType<typeof vi.fn> };
  evaluationAcquis: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  trainer: { findUnique: ReturnType<typeof vi.fn> };
  setting: { findUnique: ReturnType<typeof vi.fn> };
};
const gen = generateDocument as ReturnType<typeof vi.fn>;
const etat = (e: string | null) =>
  p.setting.findUnique.mockResolvedValue(e === null ? null : { value: { etat: e } });

const inscription = (test = false) => ({
  id: "enr-1",
  estTestInterne: false,
  trainee: { id: "t-1", nom: "Blanc", prenom: "Simone" },
  session: {
    id: "s-1",
    titreSession: "IA",
    dateDebut: new Date("2026-09-04T07:00:00Z"),
    coFormateurs: [],
    formateurPrincipalId: null,
    formationSnapshot: null,
    estTestInterne: test,
    formation: { objectifsPedagogiques: ["Formuler une demande"] },
  },
});
const SAISIE = {
  id: "ev-1",
  competences: [{ libelle: "Formuler une demande", note: 3, observations: "Très à l'aise." }],
  recommandations: null,
  dateEvaluation: new Date("2026-09-05T15:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  p.enrollment.findUnique.mockResolvedValue(inscription());
  p.trainer.findUnique.mockResolvedValue(null);
  gen.mockResolvedValue({ id: "doc-1", numero: "AXI-DOC-1" });
});

describe("éteint = inchangé", () => {
  it("sans saisie, la grille vierge est produite comme avant", async () => {
    etat(null);
    p.evaluationAcquis.findFirst.mockResolvedValue(null);
    const r = await produireGrilleEvaluation("enr-1");
    expect(r.ok).toBe(true);
    expect(gen).toHaveBeenCalled();
    expect(p.evaluationAcquis.update).not.toHaveBeenCalled();
  });
});

describe("actif", () => {
  beforeEach(() => etat("actif"));

  it("sans saisie : AUCUNE grille, et le motif dit quoi faire", async () => {
    p.evaluationAcquis.findFirst.mockResolvedValue(null);
    const r = await produireGrilleEvaluation("enr-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motif).toMatch(/saisie/i);
    expect(gen).not.toHaveBeenCalled();
  });

  it("avec saisie : la grille la reprend et l'évaluation retient son document", async () => {
    p.evaluationAcquis.findFirst.mockResolvedValue(SAISIE);
    const r = await produireGrilleEvaluation("enr-1");
    expect(r.ok).toBe(true);
    expect(p.evaluationAcquis.update).toHaveBeenCalledWith({
      where: { id: "ev-1" },
      data: { documentId: "doc-1" },
    });
  });
});

describe("essai", () => {
  beforeEach(() => etat("essai"));
  it("session réelle : comportement historique", async () => {
    p.evaluationAcquis.findFirst.mockResolvedValue(null);
    expect((await produireGrilleEvaluation("enr-1")).ok).toBe(true);
  });
  it("session du banc d'essai : exige la saisie", async () => {
    p.enrollment.findUnique.mockResolvedValue(inscription(true));
    p.evaluationAcquis.findFirst.mockResolvedValue(null);
    expect((await produireGrilleEvaluation("enr-1")).ok).toBe(false);
  });
});
