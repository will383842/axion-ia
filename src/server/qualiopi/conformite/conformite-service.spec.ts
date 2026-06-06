/**
 * Tests — conformite-service.ts (T12 — AGENT B, T17 — CLUSTER 2).
 *
 * Stratégie : mock @/lib/prisma + @/server/qualiopi/config/site-settings.
 * Vérifie la structure du résultat, le calcul du score (couverts/applicables),
 * le comportement stub.invalid, et que les 32 indicateurs sont présents.
 * Couvre aussi off.21 (cvUrl), off.26 (referent_handicap_nom), off.30 (appreciation.count).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: { count: vi.fn(), findMany: vi.fn() },
    trainingSession: { count: vi.fn() },
    evaluationAcquis: { count: vi.fn() },
    appreciation: { count: vi.fn() },
    reclamation: { count: vi.fn() },
    veille: { count: vi.fn() },
    partenariat: { count: vi.fn() },
    sousTraitant: { count: vi.fn() },
    trainer: { count: vi.fn() },
    trainee: { count: vi.fn() },
    enrollment: { count: vi.fn() },
    documentGenere: { count: vi.fn() },
    revueDirection: { count: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(""),
}));

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { evaluerConformite } from "./conformite-service";

type MockPrisma = {
  formation: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  trainingSession: { count: ReturnType<typeof vi.fn> };
  evaluationAcquis: { count: ReturnType<typeof vi.fn> };
  appreciation: { count: ReturnType<typeof vi.fn> };
  reclamation: { count: ReturnType<typeof vi.fn> };
  veille: { count: ReturnType<typeof vi.fn> };
  partenariat: { count: ReturnType<typeof vi.fn> };
  sousTraitant: { count: ReturnType<typeof vi.fn> };
  trainer: { count: ReturnType<typeof vi.fn> };
  trainee: { count: ReturnType<typeof vi.fn> };
  enrollment: { count: ReturnType<typeof vi.fn> };
  documentGenere: { count: ReturnType<typeof vi.fn> };
  revueDirection: { count: ReturnType<typeof vi.fn> };
};

const mockP = prisma as unknown as MockPrisma;
const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Setup de base : toutes les tables vides
// ─────────────────────────────────────────────────────────────────────────────

function setupEmpty() {
  vi.clearAllMocks();
  mockP.formation.count.mockResolvedValue(0);
  mockP.formation.findMany.mockResolvedValue([]);
  mockP.trainingSession.count.mockResolvedValue(0);
  mockP.evaluationAcquis.count.mockResolvedValue(0);
  mockP.appreciation.count.mockResolvedValue(0);
  mockP.reclamation.count.mockResolvedValue(0);
  mockP.veille.count.mockResolvedValue(0);
  mockP.partenariat.count.mockResolvedValue(0);
  mockP.sousTraitant.count.mockResolvedValue(0);
  mockP.trainer.count.mockResolvedValue(0);
  mockP.trainee.count.mockResolvedValue(0);
  mockP.enrollment.count.mockResolvedValue(0);
  mockP.documentGenere.count.mockResolvedValue(0);
  mockP.revueDirection.count.mockResolvedValue(0);
  // Par défaut : référent handicap vide
  mockGetConfig.mockResolvedValue("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerConformite", () => {
  beforeEach(setupEmpty);

  it("retourne exactement 32 indicateurs", async () => {
    const result = await evaluerConformite();
    expect(result.indicateurs).toHaveLength(32);
  });

  it("tous les numéros de 1 à 32 sont présents", async () => {
    const result = await evaluerConformite();
    const nums = result.indicateurs.map((i) => i.numero).sort((a, b) => a - b);
    for (let n = 1; n <= 32; n++) {
      expect(nums[n - 1]).toBe(n);
    }
  });

  it("DB vide → score 0 %, nbCouverts 0", async () => {
    const result = await evaluerConformite();
    expect(result.nbCouverts).toBe(0);
    expect(result.scorePct).toBe(0);
  });

  it("score = couverts / applicables × 100 (JAMAIS /22)", async () => {
    // Quelques formations + sessions → couvre plusieurs indicateurs TC
    mockP.formation.count.mockResolvedValue(3);
    mockP.formation.findMany.mockResolvedValue([]);
    mockP.trainingSession.count.mockResolvedValue(2);
    // trainer.count est appelé deux fois : total actif, puis avec cvUrl filter
    mockP.trainer.count.mockResolvedValue(2);
    mockP.documentGenere.count.mockResolvedValue(5);

    const result = await evaluerConformite();
    // Vérifier que le score n'est pas /22 mais /applicables
    if (result.nbApplicables > 0) {
      expect(result.scorePct).toBe(Math.round((result.nbCouverts / result.nbApplicables) * 100));
    }
  });

  it("les conditionnels APP (13,14,15) sont non_applicable pour une action classique", async () => {
    // formation.findMany retourne une formation classique sans alternance_afest
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["classique"] }]);

    const result = await evaluerConformite();
    const appIndicateurs = result.indicateurs.filter((i) => [13, 14, 15].includes(i.numero));
    for (const ind of appIndicateurs) {
      expect(ind.statut, `off.${ind.numero} doit être non_applicable`).toBe("non_applicable");
    }
  });

  it("off.31 couvert si au moins 1 réclamation existe", async () => {
    mockP.reclamation.count.mockResolvedValue(2);
    const result = await evaluerConformite();
    const ind31 = result.indicateurs.find((i) => i.numero === 31);
    expect(ind31?.statut).toBe("couvert");
  });

  it("off.31 a_completer si 0 réclamation", async () => {
    const result = await evaluerConformite();
    const ind31 = result.indicateurs.find((i) => i.numero === 31);
    expect(ind31?.statut).toBe("a_completer");
  });

  it("off.11 couvert si au moins 1 évaluation finale existe", async () => {
    // évaluationsFinales > 0 : count avec type=finale
    mockP.evaluationAcquis.count.mockResolvedValue(3);
    const result = await evaluerConformite();
    const ind11 = result.indicateurs.find((i) => i.numero === 11);
    expect(ind11?.statut).toBe("couvert");
  });

  it("off.23 couvert si au moins 1 veille legale existe", async () => {
    mockP.veille.count.mockResolvedValue(1);
    const result = await evaluerConformite();
    const ind23 = result.indicateurs.find((i) => i.numero === 23);
    expect(ind23?.statut).toBe("couvert");
  });

  it("chaque indicateur a un libelle non vide", async () => {
    const result = await evaluerConformite();
    for (const ind of result.indicateurs) {
      expect(ind.libelle.trim().length, `off.${ind.numero}`).toBeGreaterThan(0);
    }
  });

  it("chaque indicateur a un critere dans [1..7]", async () => {
    const result = await evaluerConformite();
    for (const ind of result.indicateurs) {
      expect(ind.critere).toBeGreaterThanOrEqual(1);
      expect(ind.critere).toBeLessThanOrEqual(7);
    }
  });

  it("nbApplicables ≤ 32", async () => {
    const result = await evaluerConformite();
    expect(result.nbApplicables).toBeLessThanOrEqual(32);
  });

  it("nbCouverts ≤ nbApplicables", async () => {
    mockP.formation.count.mockResolvedValue(5);
    const result = await evaluerConformite();
    expect(result.nbCouverts).toBeLessThanOrEqual(result.nbApplicables);
  });

  it("retourne résultat vide en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await evaluerConformite();
      expect(result.nbCouverts).toBe(0);
      expect(result.scorePct).toBe(0);
      expect(result.indicateurs).toHaveLength(32);
      // En mode stub, aucun mock prisma ne doit être appelé
      expect(mockP.formation.count).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  // ── off.30 : appréciation multi-parties (T17 — CLUSTER 2) ─────────────────

  it("off.30 couvert si ≥1 appréciation (appreciation.count > 0)", async () => {
    mockP.appreciation.count.mockResolvedValue(3);
    const result = await evaluerConformite();
    const ind30 = result.indicateurs.find((i) => i.numero === 30);
    expect(ind30?.statut).toBe("couvert");
  });

  it("off.30 a_completer si 0 appréciation", async () => {
    mockP.appreciation.count.mockResolvedValue(0);
    const result = await evaluerConformite();
    const ind30 = result.indicateurs.find((i) => i.numero === 30);
    expect(ind30?.statut).toBe("a_completer");
  });

  it("off.30 preuve mentionne 'appréciation' (pas 'questionnaire')", async () => {
    mockP.appreciation.count.mockResolvedValue(2);
    const result = await evaluerConformite();
    const ind30 = result.indicateurs.find((i) => i.numero === 30);
    expect(ind30?.preuves.join(" ")).toMatch(/appr[eé]ciation/i);
  });

  // ── off.26 : référent handicap désigné (T17 — CLUSTER 2) ─────────────────

  it("off.26 couvert si partenariats > 0 ET referent_handicap_nom non vide", async () => {
    mockP.partenariat.count.mockResolvedValue(1);
    mockGetConfig.mockResolvedValue("Williams Jullin");
    const result = await evaluerConformite();
    const ind26 = result.indicateurs.find((i) => i.numero === 26);
    expect(ind26?.statut).toBe("couvert");
  });

  it("off.26 a_completer si partenariats > 0 MAIS referent_handicap_nom vide", async () => {
    mockP.partenariat.count.mockResolvedValue(1);
    mockGetConfig.mockResolvedValue("");
    const result = await evaluerConformite();
    const ind26 = result.indicateurs.find((i) => i.numero === 26);
    expect(ind26?.statut).toBe("a_completer");
  });

  it("off.26 a_completer si partenariats = 0 même si référent nommé", async () => {
    mockP.partenariat.count.mockResolvedValue(0);
    mockGetConfig.mockResolvedValue("Williams Jullin");
    const result = await evaluerConformite();
    const ind26 = result.indicateurs.find((i) => i.numero === 26);
    expect(ind26?.statut).toBe("a_completer");
  });

  // ── off.1 : information accessible sur les prestations (S5) ─────────────

  it("off.1 couvert si formations > 0 ET nda_numero non vide", async () => {
    mockP.formation.count.mockResolvedValue(2);
    mockP.formation.findMany.mockResolvedValue([]);
    mockP.documentGenere.count.mockResolvedValue(1);
    // getQualiopiConfig appelé pour referent_handicap_nom puis nda_numero
    mockGetConfig.mockResolvedValueOnce("").mockResolvedValueOnce("11075XXXX75");
    const result = await evaluerConformite();
    const ind1 = result.indicateurs.find((i) => i.numero === 1);
    expect(ind1?.statut).toBe("couvert");
  });

  it("off.1 a_completer si formations > 0 MAIS nda_numero vide", async () => {
    mockP.formation.count.mockResolvedValue(2);
    mockP.formation.findMany.mockResolvedValue([]);
    mockP.documentGenere.count.mockResolvedValue(1);
    // Les deux appels getQualiopiConfig retournent ""
    mockGetConfig.mockResolvedValue("");
    const result = await evaluerConformite();
    const ind1 = result.indicateurs.find((i) => i.numero === 1);
    expect(ind1?.statut).toBe("a_completer");
  });

  it("off.1 a_completer si nda_numero renseigné MAIS 0 formation", async () => {
    mockP.formation.count.mockResolvedValue(0);
    mockP.formation.findMany.mockResolvedValue([]);
    mockGetConfig.mockResolvedValueOnce("").mockResolvedValueOnce("11075XXXX75");
    const result = await evaluerConformite();
    const ind1 = result.indicateurs.find((i) => i.numero === 1);
    expect(ind1?.statut).toBe("a_completer");
  });

  it("off.1 preuve mentionne le NDA si renseigné", async () => {
    mockP.formation.count.mockResolvedValue(1);
    mockP.formation.findMany.mockResolvedValue([]);
    mockGetConfig.mockResolvedValueOnce("").mockResolvedValueOnce("11075XXXX75");
    const result = await evaluerConformite();
    const ind1 = result.indicateurs.find((i) => i.numero === 1);
    expect(ind1?.preuves.join(" ")).toContain("11075XXXX75");
  });

  it("off.1 preuve signale NDA manquant si vide", async () => {
    mockP.formation.count.mockResolvedValue(1);
    mockP.formation.findMany.mockResolvedValue([]);
    mockGetConfig.mockResolvedValue("");
    const result = await evaluerConformite();
    const ind1 = result.indicateurs.find((i) => i.numero === 1);
    expect(ind1?.preuves.join(" ")).toMatch(/non renseigné/i);
  });

  // ── off.21 : formateurs avec CV réel (T17 — CLUSTER 2) ───────────────────

  it("off.21 couvert si ≥1 formateur actif avec cvUrl non null", async () => {
    // trainer.count : 1er appel = total actif, 2e appel = actif+cvUrl non null
    mockP.trainer.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    const result = await evaluerConformite();
    const ind21 = result.indicateurs.find((i) => i.numero === 21);
    expect(ind21?.statut).toBe("couvert");
  });

  it("off.21 a_completer si formateurs actifs mais 0 avec cvUrl", async () => {
    mockP.trainer.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
    const result = await evaluerConformite();
    const ind21 = result.indicateurs.find((i) => i.numero === 21);
    expect(ind21?.statut).toBe("a_completer");
  });

  it("off.21 a_completer si 0 formateur actif", async () => {
    mockP.trainer.count.mockResolvedValue(0);
    const result = await evaluerConformite();
    const ind21 = result.indicateurs.find((i) => i.numero === 21);
    expect(ind21?.statut).toBe("a_completer");
  });
});
