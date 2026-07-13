/**
 * Tests — satisfaction/synthese-service.ts (LOT 4).
 *
 * Stratégie : mock @/lib/prisma. Fixtures réalistes couvrant les DEUX formats
 * réels de `reponses` :
 *   - portail stagiaire : { commentaire: "..." } + noteGlobale /5 ;
 *   - saisie admin 17 questions : q1..q13 scores 1-5 + q14..q17 texte libre.
 * Vérifie : agrégats par formation + global, moyennes par bloc, verbatims,
 * fail-soft sur formats hétérogènes, stub-aware.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaire: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getSyntheseQuestionnaires, parseReponses } from "./synthese-service";

const mockPrisma = prisma as unknown as {
  questionnaire: { findMany: ReturnType<typeof vi.fn> };
};

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures réalistes
// ─────────────────────────────────────────────────────────────────────────────

const FORMATION_IA = { id: "f-ia-001", titre: "IA générative pour les cabinets d'avocats" };
const FORMATION_M365 = { id: "f-m365-002", titre: "Copilot Microsoft 365 au quotidien" };

function q(
  formation: { id: string; titre: string },
  sessionNumero: string,
  reponses: unknown,
  noteGlobale: number | null,
  reponduAt: string,
) {
  return {
    reponses,
    noteGlobale,
    reponduAt: new Date(reponduAt),
    enrollment: { session: { numero: sessionNumero, formation } },
  };
}

/** Jeu de données : 3 réponses IA (2 portail + 1 admin 17 questions) + 1 M365. */
function fixtureQuestionnaires() {
  return [
    // Portail stagiaire — note 5/5 + commentaire libre
    q(
      FORMATION_IA,
      "AXI-SES-2026-004",
      { commentaire: "Formation très concrète, exemples adaptés à notre métier." },
      5,
      "2026-03-14T09:00:00.000Z",
    ),
    // Portail stagiaire — note 4/5 sans commentaire
    q(FORMATION_IA, "AXI-SES-2026-004", {}, 4, "2026-03-14T10:00:00.000Z"),
    // Saisie admin — 17 questions : q1..q13 scores, q14..q17 texte libre
    q(
      FORMATION_IA,
      "AXI-SES-2026-007",
      {
        q1: 5,
        q2: 4,
        q3: 5,
        q4: 4, // bloc A (contenu) → 4.5
        q5: 5,
        q6: 5,
        q7: 4,
        q8: 5, // bloc B (animation) → 4.8
        q9: 3,
        q10: 4,
        q11: 4, // bloc C (organisation) → 3.7
        q12: "5",
        q13: "4", // bloc D (résultats, chaînes numériques) → 4.5
        q14: "Les ateliers pratiques sur nos propres dossiers.",
        q15: "Prévoir une pause supplémentaire l'après-midi.",
        recommandation: "Oui",
      },
      5,
      "2026-06-20T14:00:00.000Z",
    ),
    // Autre formation — note 3/5 + commentaire
    q(
      FORMATION_M365,
      "AXI-SES-2026-010",
      { commentaire: "Rythme un peu rapide pour les débutants." },
      3,
      "2026-09-01T08:00:00.000Z",
    ),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// parseReponses (fail-soft)
// ─────────────────────────────────────────────────────────────────────────────

describe("parseReponses", () => {
  it("extrait scores qN (nombres + chaînes numériques) et textes libres", () => {
    const parsed = parseReponses({
      q1: 5,
      q5: "4",
      q14: "Très bon formateur",
      commentaire: "Merci !",
      recommandation: "Oui",
    });
    expect(parsed.scoresParBloc.get("A")).toEqual([5]);
    expect(parsed.scoresParBloc.get("B")).toEqual([4]);
    const cles = parsed.textes.map((t) => t.cle).sort();
    expect(cles).toEqual(["commentaire", "q14", "recommandation"]);
  });

  it("fail-soft : formats hétérogènes ignorés sans lever", () => {
    expect(parseReponses(null).textes).toEqual([]);
    expect(parseReponses("chaine brute").textes).toEqual([]);
    expect(parseReponses([1, 2, 3]).textes).toEqual([]);
    expect(parseReponses({ q1: 42, q2: { nested: true }, q3: "" }).scoresParBloc.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSyntheseQuestionnaires
// ─────────────────────────────────────────────────────────────────────────────

describe("getSyntheseQuestionnaires", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.questionnaire.findMany.mockResolvedValue(fixtureQuestionnaires());
  });

  it("agrège par formation : nb réponses + note moyenne /5", async () => {
    const synthese = await getSyntheseQuestionnaires({ annee: 2026 });

    expect(synthese.parFormation).toHaveLength(2);
    const ia = synthese.parFormation.find((f) => f.formationId === FORMATION_IA.id);
    expect(ia?.nbReponses).toBe(3);
    expect(ia?.noteMoyenne).toBe(4.7); // (5+4+5)/3 = 4.666 → 4.7
    const m365 = synthese.parFormation.find((f) => f.formationId === FORMATION_M365.id);
    expect(m365?.nbReponses).toBe(1);
    expect(m365?.noteMoyenne).toBe(3);
  });

  it("global : nb réponses total + note moyenne", async () => {
    const synthese = await getSyntheseQuestionnaires({ annee: 2026 });

    expect(synthese.global.nbReponses).toBe(4);
    expect(synthese.global.noteMoyenne).toBe(4.3); // (5+4+5+3)/4 = 4.25 → 4.3
  });

  it("moyennes par bloc quand des scores q1..q13 sont présents", async () => {
    const synthese = await getSyntheseQuestionnaires({ annee: 2026 });

    const ia = synthese.parFormation.find((f) => f.formationId === FORMATION_IA.id);
    const blocA = ia?.moyennesBlocs.find((b) => b.bloc === "A");
    const blocB = ia?.moyennesBlocs.find((b) => b.bloc === "B");
    const blocC = ia?.moyennesBlocs.find((b) => b.bloc === "C");
    const blocD = ia?.moyennesBlocs.find((b) => b.bloc === "D");
    expect(blocA?.moyenne).toBe(4.5);
    expect(blocB?.moyenne).toBe(4.8);
    expect(blocC?.moyenne).toBe(3.7);
    expect(blocD?.moyenne).toBe(4.5);
    // M365 : aucune réponse par question → pas de blocs
    const m365 = synthese.parFormation.find((f) => f.formationId === FORMATION_M365.id);
    expect(m365?.moyennesBlocs).toEqual([]);
  });

  it("liste les verbatims (texte libre) avec date + session + formation", async () => {
    const synthese = await getSyntheseQuestionnaires({ annee: 2026 });

    const textes = synthese.verbatims.map((v) => v.texte);
    expect(textes).toContain("Formation très concrète, exemples adaptés à notre métier.");
    expect(textes).toContain("Les ateliers pratiques sur nos propres dossiers.");
    expect(textes).toContain("Rythme un peu rapide pour les débutants.");

    const v = synthese.verbatims.find((x) => x.texte.startsWith("Rythme"));
    expect(v?.sessionNumero).toBe("AXI-SES-2026-010");
    expect(v?.formationTitre).toBe(FORMATION_M365.titre);
    expect(v?.date).toBeInstanceOf(Date);
    expect(v?.questionCle).toBe("commentaire");
  });

  it("filtre sur les questionnaires satisfaction répondus de l'année (where)", async () => {
    await getSyntheseQuestionnaires({ annee: 2026, formationId: FORMATION_IA.id });

    const arg = mockPrisma.questionnaire.findMany.mock.calls[0]?.[0] as {
      where: {
        type: { in: string[] };
        reponduAt: { not: null };
        enrollment: { session: { formationId?: string } };
      };
    };
    expect(arg.where.type.in).toEqual(["satisfaction_chaud", "satisfaction_froid"]);
    expect(arg.where.reponduAt).toEqual({ not: null });
    expect(arg.where.enrollment.session.formationId).toBe(FORMATION_IA.id);
  });

  it("retourne une synthèse vide en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const synthese = await getSyntheseQuestionnaires({ annee: 2026 });
      expect(synthese.global.nbReponses).toBe(0);
      expect(synthese.parFormation).toEqual([]);
      expect(synthese.verbatims).toEqual([]);
      expect(mockPrisma.questionnaire.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});
