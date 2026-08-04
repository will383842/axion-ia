/**
 * Tests — satisfaction-service.ts (T10 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma + @/server/qualiopi/documents/qr.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaire: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    evaluationAcquis: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/documents/qr", () => ({
  makeQrToken: vi
    .fn()
    .mockReturnValue("tok-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"),
}));

// Versement aux registres (off.8 / off.30) — cf. `verserAuxRegistres`.
vi.mock("@/server/qualiopi/evaluations/evaluations-service", () => ({
  createEvaluation: vi.fn().mockResolvedValue({ id: "eval-1" }),
}));
vi.mock("@/server/qualiopi/portail/appreciation-service", () => ({
  creerAppreciation: vi.fn().mockResolvedValue({ id: "appr-1" }),
}));

import { prisma } from "@/lib/prisma";
import { makeQrToken } from "@/server/qualiopi/documents/qr";
import { createEvaluation } from "@/server/qualiopi/evaluations/evaluations-service";
import { creerAppreciation } from "@/server/qualiopi/portail/appreciation-service";
import {
  creerQuestionnaire,
  soumettreReponses,
  listQuestionnairesSession,
} from "./satisfaction-service";

const mockPrisma = prisma as unknown as {
  questionnaire: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  evaluationAcquis: { count: ReturnType<typeof vi.fn> };
};
const mockCreateEvaluation = createEvaluation as ReturnType<typeof vi.fn>;
const mockCreerAppreciation = creerAppreciation as ReturnType<typeof vi.fn>;

const mockMakeQrToken = makeQrToken as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// creerQuestionnaire
// ─────────────────────────────────────────────────────────────────────────────

describe("creerQuestionnaire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMakeQrToken.mockReturnValue(
      "tok-nouveau-token-hexadecimal-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );
  });

  it("crée un questionnaire si inexistant et retourne id+token", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(null);
    mockPrisma.questionnaire.create.mockResolvedValue({
      id: "q-uuid-1",
      token: "tok-nouveau-token-hexadecimal-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    const result = await creerQuestionnaire({
      enrollmentId: "enroll-1",
      type: "satisfaction_chaud",
    });

    expect(result).toEqual({
      id: "q-uuid-1",
      token: "tok-nouveau-token-hexadecimal-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    });
    expect(mockPrisma.questionnaire.create).toHaveBeenCalledOnce();
  });

  it("retourne l'existant (idempotent) si déjà créé", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue({
      id: "q-existant",
      token: "tok-existant",
    });

    const result = await creerQuestionnaire({
      enrollmentId: "enroll-2",
      type: "satisfaction_froid",
    });

    expect(result).toEqual({ id: "q-existant", token: "tok-existant" });
    expect(mockPrisma.questionnaire.create).not.toHaveBeenCalled();
  });

  it("utilise makeQrToken pour générer le token", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(null);
    mockPrisma.questionnaire.create.mockResolvedValue({ id: "q-2", token: "tok-new" });

    await creerQuestionnaire({ enrollmentId: "enroll-3", type: "positionnement" });

    expect(mockMakeQrToken).toHaveBeenCalledOnce();
  });

  it("recherche par enrollmentId_type (contrainte unique)", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(null);
    mockPrisma.questionnaire.create.mockResolvedValue({ id: "q-3", token: "tok-3" });

    await creerQuestionnaire({ enrollmentId: "enroll-4", type: "satisfaction_chaud" });

    expect(mockPrisma.questionnaire.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          enrollmentId_type: {
            enrollmentId: "enroll-4",
            type: "satisfaction_chaud",
          },
        },
      }),
    );
  });

  it("lève si DATABASE_URL contient stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(
        creerQuestionnaire({ enrollmentId: "any", type: "positionnement" }),
      ).rejects.toThrow();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// soumettreReponses
// ─────────────────────────────────────────────────────────────────────────────

describe("soumettreReponses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne null si le token est inconnu", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(null);

    const result = await soumettreReponses({
      token: "tok-inconnu",
      reponses: { q1: "oui" },
    });

    expect(result).toBeNull();
    expect(mockPrisma.questionnaire.update).not.toHaveBeenCalled();
  });

  it("met à jour reponses + noteGlobale + reponduAt", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue({ id: "q-uuid-1" });
    mockPrisma.questionnaire.update.mockResolvedValue({ id: "q-uuid-1" });

    const result = await soumettreReponses({
      token: "tok-valid",
      reponses: { satisfaction: "très bien" },
      noteGlobale: 5,
    });

    expect(result).toEqual({ id: "q-uuid-1" });
    const call = mockPrisma.questionnaire.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["reponses"]).toEqual({ satisfaction: "très bien" });
    expect(call.data["noteGlobale"]).toBe(5);
    expect(call.data["reponduAt"]).toBeInstanceOf(Date);
  });

  it("accepte noteGlobale = 1 (borne basse)", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue({ id: "q-2" });
    mockPrisma.questionnaire.update.mockResolvedValue({ id: "q-2" });

    await expect(
      soumettreReponses({ token: "tok-2", reponses: {}, noteGlobale: 1 }),
    ).resolves.toEqual({ id: "q-2" });
  });

  it("accepte noteGlobale = 5 (borne haute)", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue({ id: "q-3" });
    mockPrisma.questionnaire.update.mockResolvedValue({ id: "q-3" });

    await expect(
      soumettreReponses({ token: "tok-3", reponses: {}, noteGlobale: 5 }),
    ).resolves.toEqual({ id: "q-3" });
  });

  it("lève si noteGlobale = 0 (invalide)", async () => {
    await expect(
      soumettreReponses({ token: "tok-4", reponses: {}, noteGlobale: 0 }),
    ).rejects.toThrow("noteGlobale invalide");
  });

  it("lève si noteGlobale = 6 (invalide)", async () => {
    await expect(
      soumettreReponses({ token: "tok-5", reponses: {}, noteGlobale: 6 }),
    ).rejects.toThrow("noteGlobale invalide");
  });

  it("lève si noteGlobale est décimal (non entier)", async () => {
    await expect(
      soumettreReponses({ token: "tok-6", reponses: {}, noteGlobale: 3.5 }),
    ).rejects.toThrow("noteGlobale invalide");
  });

  it("n'inclut pas noteGlobale si absent (exactOptionalPropertyTypes)", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue({ id: "q-7" });
    mockPrisma.questionnaire.update.mockResolvedValue({ id: "q-7" });

    await soumettreReponses({ token: "tok-7", reponses: { q1: "non" } });

    const call = mockPrisma.questionnaire.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect("noteGlobale" in call.data).toBe(false);
  });

  it("lève si DATABASE_URL contient stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(soumettreReponses({ token: "any", reponses: {} })).rejects.toThrow();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listQuestionnairesSession
// ─────────────────────────────────────────────────────────────────────────────

describe("listQuestionnairesSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.questionnaire.findMany.mockResolvedValue([]);
  });

  it("appelle findMany avec le bon sessionId", async () => {
    await listQuestionnairesSession("session-1");

    expect(mockPrisma.questionnaire.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollment: { sessionId: "session-1" } },
      }),
    );
  });

  it("retourne les questionnaires", async () => {
    const fakeQ = { id: "q-1", enrollmentId: "e-1", type: "satisfaction_chaud" };
    mockPrisma.questionnaire.findMany.mockResolvedValue([fakeQ]);

    const result = await listQuestionnairesSession("session-2");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "q-1" });
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listQuestionnairesSession("any");
      expect(result).toEqual([]);
      expect(mockPrisma.questionnaire.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Versement aux registres (off.8 / off.30)
// ─────────────────────────────────────────────────────────────────────────────
//
// 🔴 Constaté sur le premier dossier réel : `soumettreReponses` écrivait le
// questionnaire ET RIEN D'AUTRE. Les trois questionnaires de la stagiaire
// étaient répondus, et les indicateurs affichaient « 0 évaluation initiale »
// et « 0 appréciation ». Il a fallu transcrire à la main. Ces tests
// verrouillent le pont — vérifiés par réintroduction du défaut.

describe("soumettreReponses — versement aux registres", () => {
  const ENROLLMENT = {
    id: "enroll-1",
    traineeId: "trainee-1",
    session: { clientId: "client-1" },
  };

  function questionnaire(type: string, reponduAt: Date | null = null) {
    return { id: "q-1", type, reponduAt, enrollment: ENROLLMENT };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.questionnaire.update.mockResolvedValue({ id: "q-1" });
    mockPrisma.evaluationAcquis.count.mockResolvedValue(0);
    mockCreateEvaluation.mockResolvedValue({ id: "eval-1" });
    mockCreerAppreciation.mockResolvedValue({ id: "appr-1" });
  });

  it("positionnement → une évaluation INITIALE transcrite depuis niveauParObjectif", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(questionnaire("positionnement"));

    await soumettreReponses({
      token: "tok-p",
      reponses: {
        secteur: "immobilier",
        niveauParObjectif: { "Rédiger des annonces": 3, "Estimer un bien": 2 },
      },
    });

    expect(mockCreateEvaluation).toHaveBeenCalledOnce();
    const passe = mockCreateEvaluation.mock.calls[0]![0] as {
      type: string;
      enrollmentId: string;
      competences: Array<{ libelle: string; note: number }>;
      recommandations?: string;
    };
    expect(passe.type).toBe("initiale");
    expect(passe.enrollmentId).toBe("enroll-1");
    expect(passe.competences).toEqual([
      { libelle: "Rédiger des annonces", note: 3 },
      { libelle: "Estimer un bien", note: 2 },
    ]);
    // La provenance est ÉCRITE : un niveau déclaré ne doit pas passer pour mesuré.
    expect(passe.recommandations).toContain("auto-évaluation déclarée");
  });

  it("🔴 la saisie humaine PRIME : pas de doublon si une initiale existe déjà", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(questionnaire("positionnement"));
    mockPrisma.evaluationAcquis.count.mockResolvedValue(1);

    await soumettreReponses({
      token: "tok-p",
      reponses: { niveauParObjectif: { A: 3 } },
    });

    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });

  it("les niveaux HORS barème (1..3) sont écartés, pas transcrits de travers", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(questionnaire("positionnement"));

    await soumettreReponses({
      token: "tok-p",
      reponses: { niveauParObjectif: { A: 3, B: 7, C: "oui", D: 1 } },
    });

    const passe = mockCreateEvaluation.mock.calls[0]![0] as {
      competences: Array<{ libelle: string }>;
    };
    expect(passe.competences.map((c) => c.libelle)).toEqual(["A", "D"]);
  });

  it("satisfaction notée → une appréciation STAGIAIRE avec le verbatim", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(questionnaire("satisfaction_froid"));

    await soumettreReponses({
      token: "tok-s",
      reponses: { commentaire: "Formation de très grande valeur" },
      noteGlobale: 5,
    });

    expect(mockCreerAppreciation).toHaveBeenCalledOnce();
    const passe = mockCreerAppreciation.mock.calls[0]![0] as {
      source: string;
      note?: number;
      commentaire?: string;
      enrollmentId?: string;
      clientId?: string;
    };
    expect(passe.source).toBe("stagiaire");
    expect(passe.note).toBe(5);
    expect(passe.enrollmentId).toBe("enroll-1");
    expect(passe.clientId).toBe("client-1");
    expect(passe.commentaire).toContain("Formation de très grande valeur");
  });

  it("🔴 une RE-soumission ne verse RIEN — le registre ne se remplit qu'une fois", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(
      questionnaire("satisfaction_chaud", new Date("2026-08-04T08:00:00Z")),
    );

    await soumettreReponses({ token: "tok-s", reponses: {}, noteGlobale: 4 });

    expect(mockCreerAppreciation).not.toHaveBeenCalled();
    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });

  it("🔴 un versement en échec ne fait PAS échouer la soumission de la stagiaire", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(questionnaire("satisfaction_chaud"));
    mockCreerAppreciation.mockRejectedValue(new Error("registre indisponible"));

    await expect(
      soumettreReponses({ token: "tok-s", reponses: {}, noteGlobale: 5 }),
    ).resolves.toEqual({ id: "q-1" });
  });

  it("enquête ENTREPRISE notée → une appréciation source « entreprise » au client", async () => {
    // 🔴 La 2ᵉ source distincte que l'indicateur 30 exige. Le répondant se
    // nomme dans le formulaire public — identité et fonction au verbatim.
    mockPrisma.questionnaire.findUnique.mockResolvedValue(questionnaire("satisfaction_entreprise"));

    await soumettreReponses({
      token: "tok-e",
      reponses: {
        commentaire: "Effets concrets sur notre organisation",
        repondantNom: "Jean Dupont",
        repondantFonction: "Gérant",
      },
      noteGlobale: 4,
    });

    expect(mockCreerAppreciation).toHaveBeenCalledOnce();
    const passe = mockCreerAppreciation.mock.calls[0]![0] as {
      source: string;
      note?: number;
      clientId?: string;
      commentaire?: string;
    };
    expect(passe.source).toBe("entreprise");
    expect(passe.note).toBe(4);
    expect(passe.clientId).toBe("client-1");
    expect(passe.commentaire).toContain("Jean Dupont");
    expect(passe.commentaire).toContain("Gérant");
    expect(passe.commentaire).toContain("Effets concrets sur notre organisation");
    // Et surtout PAS une évaluation : une enquête entreprise ne mesure pas des acquis.
    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });

  it("enquête ENTREPRISE sans note ne verse rien", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(questionnaire("satisfaction_entreprise"));
    await soumettreReponses({ token: "tok-e", reponses: { commentaire: "sans note" } });
    expect(mockCreerAppreciation).not.toHaveBeenCalled();
  });

  it("un positionnement SANS niveauParObjectif ne crée rien", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(questionnaire("positionnement"));

    await soumettreReponses({ token: "tok-p", reponses: { secteur: "immobilier" } });

    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });
});
