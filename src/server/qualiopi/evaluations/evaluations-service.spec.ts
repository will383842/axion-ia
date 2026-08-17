/**
 * Tests — evaluations-service.ts (T9).
 *
 * Stratégie : mock @/lib/prisma + @/server/qualiopi/config/site-settings.
 * La logique pure (scoring.ts) n'est PAS mockée — elle est déjà couverte par
 * scoring.spec.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    evaluationAcquis: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(70),
}));

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  createEvaluation,
  incoherenceDateEvaluation,
  listEvaluationsForEnrollment,
  getFinaleReussite,
} from "./evaluations-service";

const mockPrisma = prisma as unknown as {
  evaluationAcquis: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  enrollment: { findUnique: ReturnType<typeof vi.fn> };
};

const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCompetences(notes: Array<1 | 2 | 3 | undefined>) {
  return notes.map((note, i) => ({
    libelle: `Compétence ${i + 1}`,
    ...(note !== undefined ? { note } : {}),
  }));
}

/** Session de référence : elle démarre le 10/06/2026 à 09 h. */
const SESSION_DEBUT_10_JUIN = { session: { dateDebut: new Date("2026-06-10T09:00:00.000Z") } };

// ─────────────────────────────────────────────────────────────────────────────
// createEvaluation
// ─────────────────────────────────────────────────────────────────────────────

describe("createEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(70);
    mockPrisma.evaluationAcquis.create.mockResolvedValue({ id: "eval-uuid-1" });
    mockPrisma.enrollment.findUnique.mockResolvedValue(SESSION_DEBUT_10_JUIN);
  });

  it("retourne l'id créé", async () => {
    const result = await createEvaluation({
      enrollmentId: "enroll-1",
      type: "finale",
      dateEvaluation: "2026-06-10",
      competences: makeCompetences([3, 3, 2]),
    });
    expect(result).toEqual({ id: "eval-uuid-1" });
  });

  it("calcule et insère score/niveau/réussite corrects (score 100 % → acquis + réussi)", async () => {
    await createEvaluation({
      enrollmentId: "enroll-2",
      type: "finale",
      dateEvaluation: "2026-06-10",
      competences: makeCompetences([3, 3, 3]),
    });

    expect(mockPrisma.evaluationAcquis.create).toHaveBeenCalledOnce();
    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["scoreObtenu"]).toBe(9);
    expect(call.data["scoreMax"]).toBe(9);
    expect(call.data["scorePct"]).toBe(100);
    expect(call.data["niveauGlobal"]).toBe("acquis");
    expect(call.data["reussite"]).toBe(true);
  });

  it("calcule non_acquis + échec si toutes les notes absentes", async () => {
    await createEvaluation({
      enrollmentId: "enroll-3",
      type: "intermediaire",
      dateEvaluation: "2026-06-11",
      competences: makeCompetences([undefined, undefined]),
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["niveauGlobal"]).toBe("non_acquis");
    expect(call.data["reussite"]).toBe(false);
    expect(call.data["scorePct"]).toBe(0);
  });

  it("respecte le seuil de réussite issu de getQualiopiConfig", async () => {
    mockGetConfig.mockResolvedValue(80); // seuil plus élevé
    await createEvaluation({
      enrollmentId: "enroll-4",
      type: "finale",
      dateEvaluation: "2026-06-12",
      competences: makeCompetences([3, 3, 2]), // 8/9 = 89% → acquis
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    // 8/9*100 = 89 → reussite true (seuil 80)
    expect(call.data["reussite"]).toBe(true);
  });

  it("n'inclut pas recommandations si absent (exactOptionalPropertyTypes)", async () => {
    await createEvaluation({
      enrollmentId: "enroll-5",
      type: "initiale",
      dateEvaluation: "2026-06-10",
      competences: makeCompetences([2]),
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect("recommandations" in call.data).toBe(false);
  });

  it("inclut recommandations quand fourni", async () => {
    await createEvaluation({
      enrollmentId: "enroll-6",
      type: "finale",
      dateEvaluation: "2026-06-10",
      competences: makeCompetences([2]),
      recommandations: "Revoir module 3",
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["recommandations"]).toBe("Revoir module 3");
  });

  it("lève si DATABASE_URL contient stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(
        createEvaluation({
          enrollmentId: "any",
          type: "initiale",
          dateEvaluation: "2026-06-10",
          competences: [],
        }),
      ).rejects.toThrow();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// incoherenceDateEvaluation — la règle PURE
// ─────────────────────────────────────────────────────────────────────────────
//
// 🔴 Audit blanc 2026-08-15, indicateur 4 (non graduable). Le dossier portait
// une « initiale (avant formation) » du 04/08 pour une session close le 31/07,
// affichée sous la « finale » du 31/07. Ces cas rougissent si la garde saute.

describe("incoherenceDateEvaluation", () => {
  const DEBUT = new Date("2026-07-31T09:00:00.000Z");

  it("🔴 REFUSE une initiale datée APRÈS le début de session (le cas de l'audit)", () => {
    const message = incoherenceDateEvaluation({
      type: "initiale",
      dateEvaluation: new Date("2026-08-04"),
      dateDebutSession: DEBUT,
    });
    expect(message).not.toBeNull();
    // Le message doit être lisible par un humain, et nommer LA date en cause.
    expect(message).toContain("31/07/2026");
    expect(message).toContain("04/08/2026");
    expect(message).toContain("initiale");
  });

  it("accepte une initiale datée le JOUR MÊME du début (cas nominal)", () => {
    expect(
      incoherenceDateEvaluation({
        type: "initiale",
        dateEvaluation: new Date("2026-07-31"),
        dateDebutSession: DEBUT,
      }),
    ).toBeNull();
  });

  it("accepte une initiale datée la veille", () => {
    expect(
      incoherenceDateEvaluation({
        type: "initiale",
        dateEvaluation: new Date("2026-07-30"),
        dateDebutSession: DEBUT,
      }),
    ).toBeNull();
  });

  it("🔴 REFUSE une finale datée AVANT le début de session (symétrique)", () => {
    const message = incoherenceDateEvaluation({
      type: "finale",
      dateEvaluation: new Date("2026-07-30"),
      dateDebutSession: DEBUT,
    });
    expect(message).not.toBeNull();
    expect(message).toContain("finale");
    expect(message).toContain("31/07/2026");
  });

  it("🔴 REFUSE une intermédiaire datée AVANT le début de session", () => {
    expect(
      incoherenceDateEvaluation({
        type: "intermediaire",
        dateEvaluation: new Date("2026-07-29"),
        dateDebutSession: DEBUT,
      }),
    ).toContain("intermédiaire");
  });

  it("accepte une finale datée le jour même du début (session d'une journée)", () => {
    expect(
      incoherenceDateEvaluation({
        type: "finale",
        dateEvaluation: new Date("2026-07-31"),
        dateDebutSession: DEBUT,
      }),
    ).toBeNull();
  });

  it("compare à la JOURNÉE, pas à la milliseconde : 00 h 00 vs 09 h 00 le même jour passe", () => {
    // Une session commence à 09 h ; l'évaluation d'entrée saisie via un champ
    // `type="date"` arrive à minuit UTC. Comparée à la milliseconde, elle serait
    // « avant » — et surtout la finale du même jour serait refusée.
    expect(
      incoherenceDateEvaluation({
        type: "finale",
        dateEvaluation: new Date("2026-07-31T00:00:00.000Z"),
        dateDebutSession: DEBUT,
      }),
    ).toBeNull();
  });

  it("refuse une date d'évaluation invalide plutôt que de persister une date NaN", () => {
    expect(
      incoherenceDateEvaluation({
        type: "finale",
        dateEvaluation: new Date("pas une date"),
        dateDebutSession: DEBUT,
      }),
    ).toContain("invalide");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createEvaluation — garde chronologique appliquée
// ─────────────────────────────────────────────────────────────────────────────

describe("createEvaluation — cohérence des dates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(70);
    mockPrisma.evaluationAcquis.create.mockResolvedValue({ id: "eval-uuid-1" });
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      session: { dateDebut: new Date("2026-07-31T09:00:00.000Z") },
    });
  });

  it("🔴 lève ET N'ÉCRIT RIEN pour une initiale postérieure au début de session", async () => {
    await expect(
      createEvaluation({
        enrollmentId: "enroll-audit",
        type: "initiale",
        dateEvaluation: "2026-08-04",
        competences: makeCompetences([3, 3]),
      }),
    ).rejects.toThrow(
      /initiale ne peut pas être datée après le début de la session du 31\/07\/2026/,
    );

    expect(mockPrisma.evaluationAcquis.create).not.toHaveBeenCalled();
  });

  it("🔴 lève ET N'ÉCRIT RIEN pour une finale antérieure au début de session", async () => {
    await expect(
      createEvaluation({
        enrollmentId: "enroll-audit",
        type: "finale",
        dateEvaluation: "2026-07-20",
        competences: makeCompetences([3]),
      }),
    ).rejects.toThrow(/finale ne peut pas être datée avant le début de la session/);

    expect(mockPrisma.evaluationAcquis.create).not.toHaveBeenCalled();
  });

  it("laisse passer la saisie légitime du JOUR MÊME (initiale et finale)", async () => {
    await createEvaluation({
      enrollmentId: "enroll-ok",
      type: "initiale",
      dateEvaluation: "2026-07-31",
      competences: makeCompetences([2]),
    });
    await createEvaluation({
      enrollmentId: "enroll-ok",
      type: "finale",
      dateEvaluation: "2026-07-31",
      competences: makeCompetences([3]),
    });

    expect(mockPrisma.evaluationAcquis.create).toHaveBeenCalledTimes(2);
  });

  it("🔴 refuse d'écrire si l'inscription est introuvable (garde invérifiable)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(
      createEvaluation({
        enrollmentId: "enroll-fantome",
        type: "initiale",
        dateEvaluation: "2026-07-31",
        competences: makeCompetences([2]),
      }),
    ).rejects.toThrow(/Inscription introuvable/);

    expect(mockPrisma.evaluationAcquis.create).not.toHaveBeenCalled();
  });

  it("persiste la date d'évaluation telle que saisie", async () => {
    await createEvaluation({
      enrollmentId: "enroll-ok",
      type: "finale",
      dateEvaluation: "2026-08-02",
      competences: makeCompetences([3]),
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["dateEvaluation"]).toEqual(new Date("2026-08-02"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createEvaluation — pas de « réussite » sur une évaluation d'entrée
// ─────────────────────────────────────────────────────────────────────────────
//
// 🔴 Le dossier audité affichait « Réussite : Oui » sur un positionnement
// d'entrée : le stagiaire y déclarait son niveau de DÉPART et le système en
// tirait un verdict de réussite. Réussir avant d'avoir été formé ne veut rien
// dire — et lu à côté de la finale, ça donne un parcours qui n'a rien appris.

describe("createEvaluation — réussite d'une évaluation initiale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(70);
    mockPrisma.evaluationAcquis.create.mockResolvedValue({ id: "eval-uuid-1" });
    mockPrisma.enrollment.findUnique.mockResolvedValue(SESSION_DEBUT_10_JUIN);
  });

  it("🔴 n'écrit JAMAIS reussite=true sur une initiale, même à 100 %", async () => {
    await createEvaluation({
      enrollmentId: "enroll-init",
      type: "initiale",
      dateEvaluation: "2026-06-09",
      competences: makeCompetences([3, 3, 3]),
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["reussite"]).toBe(false);
    // Le niveau d'entrée, lui, RESTE écrit : c'est la preuve attendue à l'indicateur 4.
    expect(call.data["scorePct"]).toBe(100);
    expect(call.data["niveauGlobal"]).toBe("acquis");
  });

  it("une finale à 100 % reste bien réussie (la garde ne déborde pas)", async () => {
    await createEvaluation({
      enrollmentId: "enroll-fin",
      type: "finale",
      dateEvaluation: "2026-06-12",
      competences: makeCompetences([3, 3, 3]),
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["reussite"]).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listEvaluationsForEnrollment
// ─────────────────────────────────────────────────────────────────────────────

describe("listEvaluationsForEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.evaluationAcquis.findMany.mockResolvedValue([]);
  });

  it("appelle findMany avec le bon enrollmentId", async () => {
    await listEvaluationsForEnrollment("enroll-7");
    expect(mockPrisma.evaluationAcquis.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { enrollmentId: "enroll-7" } }),
    );
  });

  it("retourne les évaluations en tableau", async () => {
    const fakeEval = { id: "e1", enrollmentId: "enroll-7", type: "finale" };
    mockPrisma.evaluationAcquis.findMany.mockResolvedValue([fakeEval]);
    const result = await listEvaluationsForEnrollment("enroll-7");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "e1" });
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listEvaluationsForEnrollment("any");
      expect(result).toEqual([]);
      expect(mockPrisma.evaluationAcquis.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getFinaleReussite
// ─────────────────────────────────────────────────────────────────────────────

describe("getFinaleReussite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne true si l'évaluation finale la plus récente est réussie", async () => {
    mockPrisma.evaluationAcquis.findFirst.mockResolvedValue({ reussite: true });
    const result = await getFinaleReussite("enroll-8");
    expect(result).toBe(true);
  });

  it("retourne false si l'évaluation finale est non réussie", async () => {
    mockPrisma.evaluationAcquis.findFirst.mockResolvedValue({ reussite: false });
    const result = await getFinaleReussite("enroll-8");
    expect(result).toBe(false);
  });

  it("retourne null si aucune évaluation finale n'existe", async () => {
    mockPrisma.evaluationAcquis.findFirst.mockResolvedValue(null);
    const result = await getFinaleReussite("enroll-9");
    expect(result).toBeNull();
  });

  it("filtre sur type finale et trie par date décroissante", async () => {
    mockPrisma.evaluationAcquis.findFirst.mockResolvedValue({ reussite: true });
    await getFinaleReussite("enroll-10");
    expect(mockPrisma.evaluationAcquis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollmentId: "enroll-10", type: "finale" },
        orderBy: { dateEvaluation: "desc" },
      }),
    );
  });

  it("retourne null en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await getFinaleReussite("any");
      expect(result).toBeNull();
      expect(mockPrisma.evaluationAcquis.findFirst).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});
