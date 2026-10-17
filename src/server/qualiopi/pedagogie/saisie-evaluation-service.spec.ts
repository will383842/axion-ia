import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  $executeRaw: vi.fn(),
  evaluationAcquis: { count: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    trainingSession: { findFirst: vi.fn() },
    enrollment: { findFirst: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn().mockResolvedValue(true) }));
vi.mock("@/server/formateur/collectif-queries", () => ({
  whereSessionsDuFormateur: (id: string) => ({ formateurPrincipalId: id }),
}));
vi.mock("@/server/qualiopi/documents/production/producteurs", () => ({
  produireGrilleEvaluation: vi.fn(),
}));
vi.mock("@/server/qualiopi/evaluations/evaluations-service", () => ({ createEvaluation: vi.fn() }));
vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { produireGrilleEvaluation } from "@/server/qualiopi/documents/production/producteurs";
import { createEvaluation } from "@/server/qualiopi/evaluations/evaluations-service";
import { assertDossierOuvert } from "@/server/qualiopi/sessions/verrou-dossier-garde";
import { enregistrerEvaluationFormateur, lireSaisieFormateur } from "./saisie-evaluation-service";

const p = prisma as unknown as {
  setting: { findUnique: ReturnType<typeof vi.fn> };
  trainingSession: { findFirst: ReturnType<typeof vi.fn> };
  enrollment: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};
const create = createEvaluation as ReturnType<typeof vi.fn>;
const grille = produireGrilleEvaluation as ReturnType<typeof vi.fn>;
const verrou = assertDossierOuvert as ReturnType<typeof vi.fn>;
const etat = (e: string | null) =>
  p.setting.findUnique.mockResolvedValue(e === null ? null : { value: { etat: e } });

const OBS = "Constaté en atelier, autonome.";
const ENTREE = {
  sessionId: "s1",
  trainerId: "tr1",
  enrollmentId: "e1",
  notes: [3, 2],
  observations: [OBS, OBS],
  maintenant: new Date("2026-10-17T10:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  etat("actif");
  p.trainingSession.findFirst.mockResolvedValue({
    id: "s1",
    estTestInterne: false,
    formationSnapshot: null,
    formation: { titre: "IA", objectifsPedagogiques: ["Rédiger", "Vérifier"] },
  });
  p.enrollment.findFirst.mockResolvedValue({ id: "e1" });
  verrou.mockResolvedValue({ ok: true, sessionId: "s1" });
  tx.evaluationAcquis.count.mockResolvedValue(0);
  create.mockResolvedValue({ id: "ev1" });
  grille.mockResolvedValue({ ok: true, documentId: "d1", numero: "N" });
});

describe("portes fermées", () => {
  it.each([null, "eteint"])("%s : rien n'est écrit", async (e) => {
    etat(e);
    expect((await enregistrerEvaluationFormateur(ENTREE)).issue).toBe("non_active");
    expect(create).not.toHaveBeenCalled();
    expect(await lireSaisieFormateur("s1", "tr1")).toBeNull();
  });

  it("session qui n'est pas la sienne", async () => {
    p.trainingSession.findFirst.mockResolvedValue(null);
    expect((await enregistrerEvaluationFormateur(ENTREE)).issue).toBe("non_membre");
    expect(create).not.toHaveBeenCalled();
  });

  it("stagiaire d'une autre session", async () => {
    p.enrollment.findFirst.mockResolvedValue(null);
    expect((await enregistrerEvaluationFormateur(ENTREE)).issue).toBe("stagiaire_inconnu");
  });

  it("dossier clos", async () => {
    verrou.mockResolvedValue({ ok: false, code: "DOSSIER_CLOS", message: "clos", error: "clos" });
    expect((await enregistrerEvaluationFormateur(ENTREE)).issue).toBe("dossier_clos");
    expect(create).not.toHaveBeenCalled();
  });

  it("finale déjà saisie : jamais doublée", async () => {
    tx.evaluationAcquis.count.mockResolvedValue(1);
    expect((await enregistrerEvaluationFormateur(ENTREE)).issue).toBe("deja_evalue");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("observation obligatoire", () => {
  it("sans observation, rien n'est enregistré et les erreurs sont rendues", async () => {
    const r = await enregistrerEvaluationFormateur({ ...ENTREE, observations: [OBS, ""] });
    expect(r.issue).toBe("invalide");
    expect(r.erreurs?.[0]).toMatch(/Vérifier/);
    expect(create).not.toHaveBeenCalled();
    expect(grille).not.toHaveBeenCalled();
  });
});

describe("enregistrement", () => {
  it("écrit l'évaluation finale avec ses observations, l'auteur, la date serveur — puis la grille", async () => {
    const r = await enregistrerEvaluationFormateur(ENTREE);
    expect(r.issue).toBe("ok");
    const [arg, client] = create.mock.calls[0]!;
    expect(arg).toMatchObject({
      enrollmentId: "e1",
      type: "finale",
      dateEvaluation: "2026-10-17T10:00:00.000Z",
      evalueParId: "tr1",
    });
    expect(arg.competences[0]).toMatchObject({ libelle: "Rédiger", note: 3, observations: OBS });
    expect(client).toBe(tx);
    expect(journaliser).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "qualiopi.formateur.evaluation_finale_saisie" }),
      { exiger: true },
    );
    expect(grille).toHaveBeenCalledWith("e1");
  });

  it("grille en échec : l'évaluation reste enregistrée, l'issue le dit", async () => {
    grille.mockRejectedValue(new Error("pdf"));
    expect((await enregistrerEvaluationFormateur(ENTREE)).issue).toBe("ok_sans_grille");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("grille refusée (ok:false) : même issue", async () => {
    grille.mockResolvedValue({ ok: false, motif: "x" });
    expect((await enregistrerEvaluationFormateur(ENTREE)).issue).toBe("ok_sans_grille");
  });
});

describe("essai", () => {
  it("n'agit pas sur une session réelle", async () => {
    etat("essai");
    expect((await enregistrerEvaluationFormateur(ENTREE)).issue).toBe("non_active");
  });
  it("agit sur le banc d'essai", async () => {
    etat("essai");
    p.trainingSession.findFirst.mockResolvedValue({
      id: "s1",
      estTestInterne: true,
      formationSnapshot: null,
      formation: { titre: "IA", objectifsPedagogiques: ["Rédiger", "Vérifier"] },
    });
    expect((await enregistrerEvaluationFormateur(ENTREE)).issue).toBe("ok");
  });
});
