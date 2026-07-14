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
    appreciation: { count: vi.fn(), groupBy: vi.fn() },
    questionnaire: { count: vi.fn() },
    reclamation: { count: vi.fn() },
    veille: { count: vi.fn() },
    partenariat: { count: vi.fn() },
    sousTraitant: { count: vi.fn() },
    trainer: { count: vi.fn() },
    trainerDevelopmentAction: { count: vi.fn() },
    trainee: { count: vi.fn() },
    enrollment: { count: vi.fn() },
    documentGenere: { count: vi.fn() },
    revueDirection: { count: vi.fn() },
    supportFormation: { count: vi.fn() },
    coachingSession: { findMany: vi.fn() },
    moyenPedagogique: { groupBy: vi.fn() },
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
  appreciation: { count: ReturnType<typeof vi.fn>; groupBy: ReturnType<typeof vi.fn> };
  questionnaire: { count: ReturnType<typeof vi.fn> };
  reclamation: { count: ReturnType<typeof vi.fn> };
  veille: { count: ReturnType<typeof vi.fn> };
  partenariat: { count: ReturnType<typeof vi.fn> };
  sousTraitant: { count: ReturnType<typeof vi.fn> };
  trainer: { count: ReturnType<typeof vi.fn> };
  trainerDevelopmentAction: { count: ReturnType<typeof vi.fn> };
  trainee: { count: ReturnType<typeof vi.fn> };
  enrollment: { count: ReturnType<typeof vi.fn> };
  documentGenere: { count: ReturnType<typeof vi.fn> };
  revueDirection: { count: ReturnType<typeof vi.fn> };
  supportFormation: { count: ReturnType<typeof vi.fn> };
  coachingSession: { findMany: ReturnType<typeof vi.fn> };
  moyenPedagogique: { groupBy: ReturnType<typeof vi.fn> };
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
  mockP.appreciation.groupBy.mockResolvedValue([]);
  mockP.questionnaire.count.mockResolvedValue(0);
  mockP.reclamation.count.mockResolvedValue(0);
  mockP.veille.count.mockResolvedValue(0);
  mockP.partenariat.count.mockResolvedValue(0);
  mockP.sousTraitant.count.mockResolvedValue(0);
  mockP.trainer.count.mockResolvedValue(0);
  mockP.trainerDevelopmentAction.count.mockResolvedValue(0);
  mockP.trainee.count.mockResolvedValue(0);
  mockP.enrollment.count.mockResolvedValue(0);
  mockP.documentGenere.count.mockResolvedValue(0);
  mockP.revueDirection.count.mockResolvedValue(0);
  mockP.supportFormation.count.mockResolvedValue(0);
  mockP.coachingSession.findMany.mockResolvedValue([]);
  mockP.moyenPedagogique.groupBy.mockResolvedValue([]);
  // Par défaut : référent handicap + responsable qualité vides.
  // NB : off29_applicable lit aussi ce mock — "" n'est pas `true` strict →
  // off.29 reste non applicable par défaut.
  mockGetConfig.mockResolvedValue("");
}

/** Mock groupBy moyens pédagogiques : 1er appel = actifs, 2e = actifs vérifiés. */
function setupMoyens(
  actifs: Array<{ categorie: string; count: number }>,
  verifies: Array<{ categorie: string; count: number }>,
) {
  mockP.moyenPedagogique.groupBy
    .mockResolvedValueOnce(
      actifs.map((a) => ({ categorie: a.categorie, _count: { _all: a.count } })),
    )
    .mockResolvedValueOnce(
      verifies.map((v) => ({ categorie: v.categorie, _count: { _all: v.count } })),
    );
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

  it("les conditionnels APP (13,14,15,20,29) sont non_applicable pour une action classique (AFC)", async () => {
    // formation.findMany retourne une formation classique sans alternance_afest.
    // Aligné sur la liste officielle Acuria « CERT PPS LIAI QUA 1 V3 » : en AFC, les
    // indicateurs apprentissage/CFA 13,14,15,20,29 ont une colonne vide (non audités).
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["classique"] }]);

    const result = await evaluerConformite();
    const appIndicateurs = result.indicateurs.filter((i) =>
      [13, 14, 15, 20, 29].includes(i.numero),
    );
    for (const ind of appIndicateurs) {
      expect(ind.statut, `off.${ind.numero} doit être non_applicable`).toBe("non_applicable");
    }
  });

  it("off.5/6 DURCIS : a_completer si des formations existent mais aucune structurée/contenu", async () => {
    // 2 formations au total, mais 0 sortie de « intention » (aucun objectif/contenu réel).
    mockP.formation.count.mockImplementation((args?: { where?: { statutGeneration?: unknown } }) =>
      Promise.resolve(args?.where?.statutGeneration !== undefined ? 0 : 2),
    );
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["classique"] }]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 5)?.statut).toBe("a_completer");
    expect(result.indicateurs.find((i) => i.numero === 6)?.statut).toBe("a_completer");
  });

  it("off.5/6 DURCIS : couverts si ≥1 formation structurée + contenu réellement produit", async () => {
    mockP.formation.count.mockResolvedValue(3); // total ET filtrés (structure/contenu) = 3
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["classique"] }]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 5)?.statut).toBe("couvert");
    expect(result.indicateurs.find((i) => i.numero === 6)?.statut).toBe("couvert");
  });

  it("off.31 [P1] couvert si procédure de réclamation publiée ATTESTÉE ET responsable qualité désigné", async () => {
    // La couverture n'est plus déduite du seul nom du responsable (défaut config) :
    // elle exige l'attestation explicite `procedure_reclamations_publiee = true`.
    mockGetConfig.mockImplementation((key: string) =>
      Promise.resolve(
        key === "procedure_reclamations_publiee"
          ? true
          : key === "responsable_qualite_nom"
            ? "Williams Jullin"
            : "",
      ),
    );
    const result = await evaluerConformite();
    const ind31 = result.indicateurs.find((i) => i.numero === 31);
    expect(ind31?.statut).toBe("couvert");
  });

  it("off.31 [P1] a_completer par défaut (procédure non attestée publiée)", async () => {
    const result = await evaluerConformite();
    const ind31 = result.indicateurs.find((i) => i.numero === 31);
    expect(ind31?.statut).toBe("a_completer");
  });

  it("off.31 [P1] a_completer si responsable désigné MAIS procédure non attestée (fin de l'auto-pass)", async () => {
    // Le seul nom du responsable (même non vide) ne suffit plus : sans procédure
    // attestée publiée, off.31 reste a_completer. Même avec des réclamations enregistrées.
    mockP.reclamation.count.mockResolvedValue(5);
    mockGetConfig.mockImplementation((key: string) =>
      Promise.resolve(key === "responsable_qualite_nom" ? "Williams Jullin" : ""),
    );
    const result = await evaluerConformite();
    const ind31 = result.indicateurs.find((i) => i.numero === 31);
    expect(ind31?.statut).toBe("a_completer");
  });

  it("off.31 [P1] a_completer si procédure attestée MAIS responsable non renseigné", async () => {
    mockGetConfig.mockImplementation((key: string) =>
      Promise.resolve(key === "procedure_reclamations_publiee" ? true : ""),
    );
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

  it("off.30 [P1] couvert si ≥2 sources d'appréciation DISTINCTES (multi-parties réel)", async () => {
    mockP.appreciation.count.mockResolvedValue(5);
    mockP.appreciation.groupBy.mockResolvedValue([
      { source: "stagiaire" },
      { source: "entreprise" },
    ]);
    const result = await evaluerConformite();
    const ind30 = result.indicateurs.find((i) => i.numero === 30);
    expect(ind30?.statut).toBe("couvert");
  });

  it("off.30 [P1] a_completer si une seule source d'appréciation (pas multi-parties)", async () => {
    mockP.appreciation.count.mockResolvedValue(3);
    mockP.appreciation.groupBy.mockResolvedValue([{ source: "stagiaire" }]);
    const result = await evaluerConformite();
    const ind30 = result.indicateurs.find((i) => i.numero === 30);
    expect(ind30?.statut).toBe("a_completer");
  });

  it("off.30 a_completer si 0 appréciation", async () => {
    mockP.appreciation.count.mockResolvedValue(0);
    mockP.appreciation.groupBy.mockResolvedValue([]);
    const result = await evaluerConformite();
    const ind30 = result.indicateurs.find((i) => i.numero === 30);
    expect(ind30?.statut).toBe("a_completer");
  });

  it("off.30 preuve mentionne 'appréciation' (pas 'questionnaire')", async () => {
    mockP.appreciation.count.mockResolvedValue(2);
    mockP.appreciation.groupBy.mockResolvedValue([
      { source: "stagiaire" },
      { source: "formateur" },
    ]);
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

  it("off.21 [P1] couvert si ≥1 formateur actif avec CV téléversé ET à jour (< 24 mois)", async () => {
    // trainer.count : 1=actif, 2=actif+cvUrl, 3=actif+cvUrl+cvUploadedAt<24 mois (récent)
    mockP.trainer.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const result = await evaluerConformite();
    const ind21 = result.indicateurs.find((i) => i.numero === 21);
    expect(ind21?.statut).toBe("couvert");
  });

  it("off.21 [P1] a_completer si CV présent mais PÉRIMÉ (aucun < 24 mois)", async () => {
    // 2 CV téléversés mais aucun daté de moins de 24 mois → 3e appel = 0.
    mockP.trainer.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    const result = await evaluerConformite();
    const ind21 = result.indicateurs.find((i) => i.numero === 21);
    expect(ind21?.statut).toBe("a_completer");
  });

  it("off.21 a_completer si formateurs actifs mais 0 avec cvUrl", async () => {
    mockP.trainer.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
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

  // ── off.3/7/16 : formations certifiantes (branche cert couvert) ──────────

  it("off.3/7/16 couvert si ≥1 formation certifiante avec code RS/RNCP + évaluations finales", async () => {
    // typesAction inclut "certifiante" → cert applicable ; findMany retourne
    // d'abord les typesActionQualiopi (1er appel) puis les formations certifiantes
    // (2e appel) avec code RNCP + blocs de compétences.
    mockP.formation.count.mockResolvedValue(2);
    mockP.formation.findMany
      .mockResolvedValueOnce([{ typesActionQualiopi: ["certifiante"] }])
      .mockResolvedValueOnce([
        {
          certificationType: "rncp",
          codeRncp: "RNCP37274",
          codeRs: null,
          blocsCompetences: [{ code: "BC1", libelle: "x" }],
        },
      ]);
    // évaluations initiales + finales présentes (count appelé pour les deux types)
    mockP.evaluationAcquis.count.mockResolvedValue(4);

    const result = await evaluerConformite();
    const ind3 = result.indicateurs.find((i) => i.numero === 3);
    const ind7 = result.indicateurs.find((i) => i.numero === 7);
    const ind16 = result.indicateurs.find((i) => i.numero === 16);
    expect(ind3?.statut, "off.3 doit être couvert").toBe("couvert");
    expect(ind7?.statut, "off.7 doit être couvert").toBe("couvert");
    expect(ind16?.statut, "off.16 doit être couvert").toBe("couvert");
  });

  // ── off.28 = AFEST (automatisé) ; off.13/14/15 = APPRENTISSAGE (non applicable) ──

  it("off.13/14/15/20/29 (apprentissage/CFA) restent NON APPLICABLES même avec AFEST déclaré", async () => {
    // alternance_afest déclaré ne doit PAS rendre les indicateurs apprenti applicables.
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["alternance_afest"] }]);
    const result = await evaluerConformite();
    for (const numero of [13, 14, 15, 20, 29]) {
      const ind = result.indicateurs.find((i) => i.numero === numero);
      expect(ind?.statut, `off.${numero} (apprentissage) doit être non_applicable`).toBe(
        "non_applicable",
      );
    }
  });

  it("off.28 a_completer si AFEST applicable mais aucun parcours conforme tracé", async () => {
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["alternance_afest"] }]);
    const result = await evaluerConformite();
    const ind28 = result.indicateurs.find((i) => i.numero === 28);
    expect(ind28?.statut).toBe("a_completer");
    expect(ind28?.preuves.join(" ")).toMatch(/à compléter/i);
  });

  it("off.28 AUTOMATISÉ → couvert depuis un parcours AFEST 1-to-1 CONFORME (analyse + alternance + éval)", async () => {
    mockP.coachingSession.findMany.mockResolvedValue([
      {
        cartographie: { taches: [{ tache: "Tri des emails" }] },
        evaluations: [{ id: "eval-1" }],
        comptesRendus: [
          { misesEnSituation: [{ cas: "x" }], phasesReflexives: [{ situation: "y" }] },
        ],
      },
    ]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 28)?.statut).toBe("couvert");
    // Les indicateurs apprentissage NE deviennent PAS couverts par l'AFEST.
    for (const numero of [13, 14, 15, 20, 29]) {
      expect(result.indicateurs.find((i) => i.numero === numero)?.statut).toBe("non_applicable");
    }
  });

  it("off.28 a_completer si cartographie/alternance/éval vides ou malformées (anti faux-positif)", async () => {
    mockP.coachingSession.findMany.mockResolvedValue([
      {
        cartographie: { taches: [] }, // vide
        evaluations: [],
        comptesRendus: [
          { misesEnSituation: [{ cas: "" }], phasesReflexives: [] },
          { misesEnSituation: [null], phasesReflexives: [{ situation: "ok" }] },
        ],
      },
    ]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 28)?.statut).toBe("a_completer");
  });

  it("off.28 a_completer si comptesRendus vide même avec cartographie remplie + éval", async () => {
    mockP.coachingSession.findMany.mockResolvedValue([
      {
        cartographie: { taches: [{ tache: "x" }] },
        evaluations: [{ id: "e" }],
        comptesRendus: [],
      },
    ]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 28)?.statut).toBe("a_completer");
  });

  it("off.28 (AFEST) non_applicable et sans preuve pour une action classique", async () => {
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["classique"] }]);
    const result = await evaluerConformite();
    const ind28 = result.indicateurs.find((i) => i.numero === 28);
    expect(ind28?.statut).toBe("non_applicable");
    expect(ind28?.preuves).toHaveLength(0);
  });

  // ── off.17/18 : inventaire des moyens pédagogiques (LOT 2) ────────────────

  it("off.17 a_completer si formateurs actifs MAIS aucun moyen technique vérifié", async () => {
    mockP.trainer.count.mockResolvedValue(2);
    // 1 salle active mais jamais vérifiée
    setupMoyens([{ categorie: "salle", count: 1 }], []);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 17)?.statut).toBe("a_completer");
  });

  it("off.17 couvert si formateur actif + ≥1 moyen technique actif vérifié", async () => {
    mockP.trainer.count.mockResolvedValue(1);
    setupMoyens([{ categorie: "salle", count: 1 }], [{ categorie: "salle", count: 1 }]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 17)?.statut).toBe("couvert");
  });

  it("off.17 a_completer si seul un moyen HUMAIN est vérifié (pas technique)", async () => {
    mockP.trainer.count.mockResolvedValue(1);
    setupMoyens([{ categorie: "humain", count: 2 }], [{ categorie: "humain", count: 2 }]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 17)?.statut).toBe("a_completer");
  });

  it("off.18 couvert si chaque catégorie utilisée a ≥1 moyen vérifié", async () => {
    mockP.trainer.count.mockResolvedValue(1);
    setupMoyens(
      [
        { categorie: "salle", count: 2 },
        { categorie: "plateforme", count: 1 },
      ],
      [
        { categorie: "salle", count: 1 },
        { categorie: "plateforme", count: 1 },
      ],
    );
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 18)?.statut).toBe("couvert");
  });

  it("off.18 a_completer si une catégorie utilisée n'a aucun moyen vérifié", async () => {
    mockP.trainer.count.mockResolvedValue(1);
    setupMoyens(
      [
        { categorie: "salle", count: 1 },
        { categorie: "materiel", count: 1 },
      ],
      [{ categorie: "salle", count: 1 }], // materiel jamais vérifié
    );
    const result = await evaluerConformite();
    const ind18 = result.indicateurs.find((i) => i.numero === 18);
    expect(ind18?.statut).toBe("a_completer");
    expect(ind18?.preuves.join(" ")).toContain("materiel");
  });

  it("off.18 a_completer si inventaire vide (aucun moyen actif)", async () => {
    mockP.trainer.count.mockResolvedValue(3);
    setupMoyens([], []);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 18)?.statut).toBe("a_completer");
  });

  // ── off.29 : applicabilité pilotée par config off29_applicable (LOT 2) ────

  it("off.29 non_applicable par défaut (off29_applicable=false)", async () => {
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 29)?.statut).toBe("non_applicable");
  });

  it("off.29 applicable + a_completer si off29_applicable=true (à renseigner manuellement)", async () => {
    mockGetConfig.mockImplementation((key: string) =>
      Promise.resolve(key === "off29_applicable" ? true : ""),
    );
    const result = await evaluerConformite();
    const ind29 = result.indicateurs.find((i) => i.numero === 29);
    expect(ind29?.statut).toBe("a_completer");
    expect(ind29?.preuves.join(" ")).toMatch(/manuellement/i);
  });

  it("off.29 : une valeur config non booléenne n'active PAS l'indicateur (strict === true)", async () => {
    mockGetConfig.mockResolvedValue("oui");
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 29)?.statut).toBe("non_applicable");
  });

  // ── P1 (durcissement anti-proxy — audit 2026-07-14) ──────────────────────

  it("off.2 [P1] a_completer si évaluations finales mesurées MAIS aucun résultat publié", async () => {
    // Sessions réalisées + évaluations finales, mais indicateursPubliesAt jamais posé.
    mockP.trainingSession.count.mockResolvedValue(3);
    mockP.evaluationAcquis.count.mockResolvedValue(4);
    mockP.formation.count.mockImplementation(
      (args?: { where?: { indicateursPubliesAt?: unknown } }) =>
        Promise.resolve(args?.where?.indicateursPubliesAt !== undefined ? 0 : 5),
    );
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 2)?.statut).toBe("a_completer");
  });

  it("off.2 [P1] couvert si ≥1 formation a des indicateurs de résultats publiés", async () => {
    mockP.formation.count.mockResolvedValue(2); // total ET publiés = 2
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 2)?.statut).toBe("couvert");
  });

  it("off.4 [P1] mesuré par le questionnaire de positionnement (≠ grille d'acquis off.8)", async () => {
    mockP.formation.count.mockResolvedValue(2);
    // Grille d'acquis présente (off.8) mais AUCUN questionnaire de positionnement répondu.
    mockP.evaluationAcquis.count.mockResolvedValue(3);
    mockP.questionnaire.count.mockResolvedValue(0);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 4)?.statut).toBe("a_completer");
    // off.8 (acquis), lui, est couvert par la grille.
    expect(result.indicateurs.find((i) => i.numero === 8)?.statut).toBe("couvert");
  });

  it("off.4 [P1] couvert si formations + ≥1 questionnaire de positionnement répondu", async () => {
    mockP.formation.count.mockResolvedValue(2);
    mockP.questionnaire.count.mockResolvedValue(1);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 4)?.statut).toBe("couvert");
  });

  it("off.27 [P1] a_completer si sous-traitant référencé mais NON conforme (NDA/data.gouv/contrat manquants)", async () => {
    // total > 0 mais aucun conforme (le 2e appel avec where renvoie 0).
    mockP.sousTraitant.count.mockImplementation((args?: { where?: unknown }) =>
      Promise.resolve(args?.where ? 0 : 3),
    );
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 27)?.statut).toBe("a_completer");
  });

  it("off.27 [P1] couvert si ≥1 sous-traitant conforme (NDA + vérif data.gouv + contrat signé)", async () => {
    mockP.sousTraitant.count.mockResolvedValue(1); // total ET conformes = 1
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 27)?.statut).toBe("couvert");
  });

  it("off.22 [P1] a_completer si CV présents mais AUCUNE action de développement récente", async () => {
    // Des formateurs avec CV (off.21) mais aucune trace de développement (off.22 distinct).
    mockP.trainer.count.mockResolvedValue(2);
    mockP.trainerDevelopmentAction.count.mockResolvedValue(0);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 22)?.statut).toBe("a_completer");
  });

  it("off.22 [P1] couvert si ≥1 action de développement récente (< 24 mois)", async () => {
    mockP.trainerDevelopmentAction.count.mockResolvedValue(3);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 22)?.statut).toBe("couvert");
  });
});
