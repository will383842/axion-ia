// @vitest-environment node

/**
 * Lot G2 — le service du bilan de fin de formation (accès en base simulés).
 *
 *   · interrupteur éteint : rien n'est lu au-delà de lui, rien n'est écrit ;
 *   · un formateur qui n'a PAS animé la session est refusé comme une session inconnue ;
 *   · un stagiaire d'une AUTRE session (ou absent, ou sorti) est refusé ;
 *   · une évaluation finale déjà saisie (console ou formateur) n'est jamais doublée ;
 *   · l'évaluation passe par le service EXISTANT, auteur = le formateur ;
 *   · l'avis passe par le service EXISTANT (qualité « formateur »), une seule fois ;
 *   · « Terminer » exige tout, puis fige ; « payer quand même » exige un motif.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MOI = "11111111-1111-4111-8111-111111111111";
const AUTRE_FORMATEUR = "22222222-2222-4222-8222-222222222222";
const INSC = "33333333-3333-4333-8333-333333333333";
const INSC_AUTRE_SESSION = "44444444-4444-4444-8444-444444444444";
const BILAN = "55555555-5555-4555-8555-555555555555";
const ADMIN = "66666666-6666-4666-8666-666666666666";
const APRES = new Date("2026-11-10T10:00:00Z");

const m = vi.hoisted(() => ({
  allume: vi.fn(),
  createEvaluation: vi.fn(),
  creerAppreciation: vi.fn(),
  dossierOuvert: vi.fn(),
  journaliser: vi.fn(),
  db: {
    trainingSession: { findUnique: vi.fn() },
    trainer: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    bilanFinFormation: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    evaluationAcquis: { count: vi.fn() },
    appreciation: { findUnique: vi.fn() },
    setting: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: m.allume,
}));
vi.mock("@/server/qualiopi/evaluations/evaluations-service", () => ({
  createEvaluation: m.createEvaluation,
}));
vi.mock("@/server/qualiopi/portail/appreciation-service", () => ({
  creerAppreciation: m.creerAppreciation,
}));
vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: m.dossierOuvert,
}));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: m.journaliser }));

import {
  enregistrerAvisFormateur,
  enregistrerEvaluationFinaleFormateur,
  lireBilanFormateur,
  payerQuandMemeBilan,
  terminerBilanFormateur,
} from "../service";
import { LIBELLE_MOTIF_FORMATION_INCOMPLETE } from "../../paiement/formation-complete";

function session(over: Record<string, unknown> = {}) {
  return {
    id: SESSION,
    numero: "S-2026-001",
    titreSession: "IA générative",
    statut: "realisee",
    formateurPrincipalId: MOI,
    sessionFormateurs: [{ trainerId: MOI }],
    jours: [{ date: new Date("2026-11-04T00:00:00Z"), heureFin: "17:00", trainerId: MOI }],
    formation: { objectifsPedagogiques: ["Rédiger un prompt", "Vérifier une réponse"] },
    ...over,
  };
}

function inscrit(over: Record<string, unknown> = {}) {
  return {
    id: INSC,
    statut: "terminee",
    trainee: { prenom: "Alex", nom: "Martin" },
    _count: { presences: 2, emargementSignatures: 2 },
    evaluations: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.allume.mockResolvedValue(true);
  m.db.trainingSession.findUnique.mockResolvedValue(session());
  m.db.trainer.findUnique.mockResolvedValue({
    statut: "sous_traitant",
    organismeSousTraitantId: null,
    finCollaborationAt: null,
  });
  m.db.enrollment.findMany.mockResolvedValue([inscrit()]);
  m.db.bilanFinFormation.upsert.mockResolvedValue({ id: BILAN });
  m.db.bilanFinFormation.findUnique.mockResolvedValue({
    id: BILAN,
    appreciationId: null,
    termineAt: null,
    payerQuandMemeAt: null,
  });
  m.db.bilanFinFormation.update.mockResolvedValue({ id: BILAN });
  m.db.evaluationAcquis.count.mockResolvedValue(0);
  m.db.appreciation.findUnique.mockResolvedValue(null);
  m.db.setting.findUnique.mockResolvedValue(null);
  m.db.$queryRaw.mockResolvedValue([]);
  m.db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(m.db));
  m.createEvaluation.mockResolvedValue({ id: "77777777-7777-4777-8777-777777777777" });
  m.creerAppreciation.mockResolvedValue({ id: "88888888-8888-4888-8888-888888888888" });
  m.dossierOuvert.mockResolvedValue({ ok: true, sessionId: SESSION });
  m.journaliser.mockResolvedValue(true);
});

const evaluer = (over: Record<string, unknown> = {}) =>
  enregistrerEvaluationFinaleFormateur({
    sessionId: SESSION,
    trainerId: MOI,
    enrollmentId: INSC,
    notes: [3, 2],
    maintenant: APRES,
    ...over,
  } as Parameters<typeof enregistrerEvaluationFinaleFormateur>[0]);

describe("interrupteur éteint : comportement d'avant", () => {
  it("aucun bloc, aucune écriture, rien n'est lu au-delà de l'interrupteur", async () => {
    m.allume.mockResolvedValue(false);
    expect(await lireBilanFormateur(SESSION, MOI, APRES)).toBeNull();
    expect(await evaluer()).toBe("eteint");
    expect(
      await enregistrerAvisFormateur({
        sessionId: SESSION,
        trainerId: MOI,
        commentaire: "Très bon groupe, rien à signaler.",
        maintenant: APRES,
      }),
    ).toBe("eteint");
    expect(
      await terminerBilanFormateur({ sessionId: SESSION, trainerId: MOI, maintenant: APRES }),
    ).toBe("eteint");
    expect(m.db.trainingSession.findUnique).not.toHaveBeenCalled();
    expect(m.createEvaluation).not.toHaveBeenCalled();
    expect(m.creerAppreciation).not.toHaveBeenCalled();
  });
});

describe("qui peut écrire", () => {
  it("un formateur qui n'a pas animé la session : refusé comme une session inconnue", async () => {
    expect(await evaluer({ trainerId: AUTRE_FORMATEUR })).toBe("introuvable");
    expect(await lireBilanFormateur(SESSION, AUTRE_FORMATEUR, APRES)).toBeNull();
    expect(m.createEvaluation).not.toHaveBeenCalled();
  });

  it("un stagiaire d'une AUTRE session : refusé, rien n'est écrit", async () => {
    expect(await evaluer({ enrollmentId: INSC_AUTRE_SESSION })).toBe("stagiaire_inconnu");
    expect(m.db.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sessionId: SESSION }) }),
    );
    expect(m.createEvaluation).not.toHaveBeenCalled();
  });

  it("un stagiaire absent ou sorti du dispositif : refusé", async () => {
    m.db.enrollment.findMany.mockResolvedValue([
      inscrit({ _count: { presences: 0, emargementSignatures: 0 } }),
    ]);
    expect(await evaluer()).toBe("stagiaire_inconnu");
    m.db.enrollment.findMany.mockResolvedValue([inscrit({ statut: "abandon" })]);
    expect(await evaluer()).toBe("stagiaire_inconnu");
    expect(m.createEvaluation).not.toHaveBeenCalled();
  });

  it("un formateur salarié : aucun bloc, aucune écriture (son écran ne change pas)", async () => {
    m.db.trainer.findUnique.mockResolvedValue({
      statut: "salarie",
      organismeSousTraitantId: null,
      finCollaborationAt: null,
    });
    expect(await lireBilanFormateur(SESSION, MOI, APRES)).toBeNull();
    expect(await evaluer()).toBe("non_concerne");
  });

  it("avant la fin de la dernière journée : pas encore", async () => {
    expect(await evaluer({ maintenant: new Date("2026-11-04T10:00:00Z") })).toBe("pas_encore");
    expect(await lireBilanFormateur(SESSION, MOI, new Date("2026-11-04T10:00:00Z"))).toBeNull();
  });

  it("session annulée : aucun bilan", async () => {
    m.db.trainingSession.findUnique.mockResolvedValue(session({ statut: "annulee" }));
    expect(await evaluer()).toBe("non_concerne");
  });
});

describe("l'évaluation finale", () => {
  it("passe par le service existant, auteur = le formateur, barème de la formation", async () => {
    expect(await evaluer()).toBe("ok");
    expect(m.createEvaluation).toHaveBeenCalledWith(
      {
        enrollmentId: INSC,
        type: "finale",
        dateEvaluation: APRES.toISOString(),
        competences: [
          { libelle: "Rédiger un prompt", note: 3, objectifRef: "Rédiger un prompt" },
          { libelle: "Vérifier une réponse", note: 2, objectifRef: "Vérifier une réponse" },
        ],
        evalueParId: MOI,
      },
      m.db,
    );
    // L'auteur est aussi tracé au journal, sans aucune donnée du stagiaire.
    expect(m.journaliser).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({
        action: "qualiopi.formateur.bilan_evaluation_finale",
        targetType: "EvaluationAcquis",
        changes: { sessionId: SESSION, trainerId: MOI, nbCompetences: 2 },
      }),
      expect.anything(),
    );
  });

  it("une finale existe déjà (console ou formateur) : jamais doublée", async () => {
    m.db.evaluationAcquis.count.mockResolvedValue(1);
    expect(await evaluer()).toBe("deja_evalue");
    expect(m.createEvaluation).not.toHaveBeenCalled();
  });

  it("une note par objectif, de 1 à 3, sinon refus", async () => {
    expect(await evaluer({ notes: [3] })).toBe("notes_invalides");
    expect(await evaluer({ notes: [3, 4] })).toBe("notes_invalides");
    expect(m.createEvaluation).not.toHaveBeenCalled();
  });

  it("dossier clos : refus (même garde que la console)", async () => {
    m.dossierOuvert.mockResolvedValue({
      ok: false,
      code: "DOSSIER_CLOS",
      message: "x",
      error: "x",
    });
    expect(await evaluer()).toBe("dossier_clos");
    expect(m.createEvaluation).not.toHaveBeenCalled();
  });

  it("bilan terminé : figé", async () => {
    m.db.bilanFinFormation.findUnique.mockResolvedValue({
      id: BILAN,
      appreciationId: null,
      termineAt: APRES,
      payerQuandMemeAt: null,
    });
    expect(await evaluer()).toBe("termine");
    expect(m.createEvaluation).not.toHaveBeenCalled();
  });
});

describe("l'avis du formateur", () => {
  const avis = (over: Record<string, unknown> = {}) =>
    enregistrerAvisFormateur({
      sessionId: SESSION,
      trainerId: MOI,
      note: 4,
      commentaire: "Groupe motivé ; une absence le mardi matin.",
      maintenant: APRES,
      ...over,
    } as Parameters<typeof enregistrerAvisFormateur>[0]);

  it("appréciation « formateur » par le service existant, rattachée au bilan", async () => {
    expect(await avis()).toBe("ok");
    expect(m.creerAppreciation).toHaveBeenCalledWith(
      {
        source: "formateur",
        trainerId: MOI,
        note: 4,
        commentaire: "Groupe motivé ; une absence le mardi matin.",
        dateAppreciation: APRES,
      },
      m.db,
    );
    expect(m.db.bilanFinFormation.update).toHaveBeenCalledWith({
      where: { id: BILAN },
      data: { appreciationId: "88888888-8888-4888-8888-888888888888" },
    });
  });

  it("note facultative", async () => {
    expect(await avis({ note: undefined })).toBe("ok");
    expect(m.creerAppreciation.mock.calls[0]![0]).not.toHaveProperty("note");
  });

  it("une seule par formateur et par session", async () => {
    m.db.bilanFinFormation.findUnique.mockResolvedValue({
      id: BILAN,
      appreciationId: "x",
      termineAt: null,
      payerQuandMemeAt: null,
    });
    expect(await avis()).toBe("deja_donne");
    expect(m.creerAppreciation).not.toHaveBeenCalled();
  });

  it("texte vide ou note hors barème : refus", async () => {
    expect(await avis({ commentaire: "  " })).toBe("avis_invalide");
    expect(await avis({ note: 6 })).toBe("avis_invalide");
    expect(m.creerAppreciation).not.toHaveBeenCalled();
  });
});

describe("Terminer", () => {
  const terminer = () =>
    terminerBilanFormateur({ sessionId: SESSION, trainerId: MOI, maintenant: APRES });

  it("incomplet (une finale manque, ou pas d'avis) : refus, rien n'est figé", async () => {
    expect(await terminer()).toBe("incomplet");
    m.db.enrollment.findMany.mockResolvedValue([inscrit({ evaluations: [{ id: "e" }] })]);
    expect(await terminer()).toBe("incomplet");
    expect(m.db.bilanFinFormation.update).not.toHaveBeenCalled();
  });

  it("complet : figé à l'instant, tracé", async () => {
    m.db.enrollment.findMany.mockResolvedValue([inscrit({ evaluations: [{ id: "e" }] })]);
    m.db.bilanFinFormation.findUnique.mockResolvedValue({
      id: BILAN,
      appreciationId: "x",
      termineAt: null,
      payerQuandMemeAt: null,
    });
    expect(await terminer()).toBe("ok");
    expect(m.db.bilanFinFormation.update).toHaveBeenCalledWith({
      where: { id: BILAN },
      data: { termineAt: APRES },
    });
    expect(m.journaliser).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({
        action: "qualiopi.formateur.bilan_termine",
        targetType: "BilanFinFormation",
        targetId: BILAN,
      }),
      expect.anything(),
    );
  });
});

describe("payer quand même (administrateur)", () => {
  const payer = (motif: string) =>
    payerQuandMemeBilan({
      sessionId: SESSION,
      trainerId: MOI,
      adminUserId: ADMIN,
      motif,
      maintenant: APRES,
    });

  it("motif obligatoire", async () => {
    expect(await payer("court")).toBe("motif_invalide");
    expect(m.db.bilanFinFormation.update).not.toHaveBeenCalled();
  });

  it("auteur, date, motif posés ; tracé au journal sans le motif", async () => {
    expect(await payer("Le formateur a remis son bilan sur papier.")).toBe("ok");
    expect(m.db.bilanFinFormation.update).toHaveBeenCalledWith({
      where: { id: BILAN },
      data: {
        payerQuandMemeAt: APRES,
        payerQuandMemeParId: ADMIN,
        payerQuandMemeMotif: "Le formateur a remis son bilan sur papier.",
      },
    });
    expect(m.journaliser).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({
        action: "qualiopi.formateur.bilan_payer_quand_meme",
        targetType: "BilanFinFormation",
        targetId: BILAN,
        changes: { sessionId: SESSION, trainerId: MOI },
        session: { userId: ADMIN },
      }),
      { exiger: true },
    );
  });

  it("déjà fait : ne réécrit pas", async () => {
    m.db.bilanFinFormation.findUnique.mockResolvedValue({
      id: BILAN,
      appreciationId: null,
      termineAt: null,
      payerQuandMemeAt: APRES,
    });
    expect(await payer("Le formateur a remis son bilan sur papier.")).toBe("deja_fait");
    expect(m.db.bilanFinFormation.update).not.toHaveBeenCalled();
  });

  it("interrupteur éteint : refus", async () => {
    m.allume.mockResolvedValue(false);
    expect(await payer("Le formateur a remis son bilan sur papier.")).toBe("eteint");
  });
});

describe("le motif affiché au formateur (même règle que le paiement)", () => {
  beforeEach(() => {
    // Allumé avant la dernière journée (2026-11-04) : le bilan est exigé.
    m.db.setting.findUnique.mockResolvedValue({
      value: { actif: true, allumeLe: "2026-10-01T08:00:00Z" },
      updatedAt: null,
    });
  });

  it("bilan attendu : le motif dit que seul le dernier mois de la mission l'attend", async () => {
    const vue = await lireBilanFormateur(SESSION, MOI, APRES);
    expect(vue?.attenduPourPaiement).toBe(true);
    expect(vue?.motifPaiement).toBe(
      LIBELLE_MOTIF_FORMATION_INCOMPLETE.bilan_fin_formation_manquant,
    );
    expect(vue?.motifPaiement).toContain("seul le relevé du dernier mois de la mission");
  });

  it("« payer quand même » posé : plus de motif", async () => {
    m.db.bilanFinFormation.findUnique.mockResolvedValue({
      id: BILAN,
      appreciationId: null,
      termineAt: null,
      payerQuandMemeAt: APRES,
    });
    const vue = await lireBilanFormateur(SESSION, MOI, APRES);
    expect(vue?.attenduPourPaiement).toBe(false);
    expect(vue?.motifPaiement).toBeNull();
  });
});
