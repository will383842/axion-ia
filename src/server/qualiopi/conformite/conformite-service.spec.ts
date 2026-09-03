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
    evaluationAcquis: { count: vi.fn(), findMany: vi.fn() },
    appreciation: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    questionnaire: { count: vi.fn(), findMany: vi.fn() },
    reclamation: { count: vi.fn() },
    veille: { count: vi.fn() },
    partenariat: { count: vi.fn() },
    sousTraitant: { count: vi.fn() },
    trainer: { count: vi.fn() },
    trainerDevelopmentAction: { count: vi.fn() },
    trainerDocument: { findMany: vi.fn() },
    trainee: { count: vi.fn() },
    enrollment: { count: vi.fn() },
    client: { findMany: vi.fn() },
    documentGenere: { count: vi.fn() },
    revueDirection: { count: vi.fn(), findFirst: vi.fn() },
    supportFormation: { count: vi.fn(), findMany: vi.fn() },
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
// Le trio certifiant (3/7/16) est DERIVE de ce registre par la garde off.1,
// jamais recopie : un predicat recopie diverge, ce depot l'a paye 4 fois.
import { INDICATEURS_RNQ } from "./indicateurs-registre";

type MockPrisma = {
  formation: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  trainingSession: { count: ReturnType<typeof vi.fn> };
  evaluationAcquis: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  appreciation: {
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  questionnaire: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  reclamation: { count: ReturnType<typeof vi.fn> };
  veille: { count: ReturnType<typeof vi.fn> };
  partenariat: { count: ReturnType<typeof vi.fn> };
  sousTraitant: { count: ReturnType<typeof vi.fn> };
  trainer: { count: ReturnType<typeof vi.fn> };
  trainerDevelopmentAction: { count: ReturnType<typeof vi.fn> };
  trainerDocument: { findMany: ReturnType<typeof vi.fn> };
  trainee: { count: ReturnType<typeof vi.fn> };
  enrollment: { count: ReturnType<typeof vi.fn> };
  client: { findMany: ReturnType<typeof vi.fn> };
  documentGenere: { count: ReturnType<typeof vi.fn> };
  revueDirection: { count: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  supportFormation: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
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
  // off.8 : les évaluations initiales sont désormais RAPPROCHÉES de la date de
  // début de session (audit blanc 2026-08-15) → findMany, plus count.
  mockP.evaluationAcquis.findMany.mockResolvedValue([]);
  mockP.appreciation.count.mockResolvedValue(0);
  mockP.appreciation.groupBy.mockResolvedValue([]);
  // off.30 : QUI s'exprime (personne physique), pas seulement en quelle qualité.
  mockP.appreciation.findMany.mockResolvedValue([]);
  mockP.questionnaire.count.mockResolvedValue(0);
  // off.4 : idem off.8 — le questionnaire de positionnement porte une date.
  mockP.questionnaire.findMany.mockResolvedValue([]);
  mockP.reclamation.count.mockResolvedValue(0);
  mockP.veille.count.mockResolvedValue(0);
  mockP.partenariat.count.mockResolvedValue(0);
  mockP.sousTraitant.count.mockResolvedValue(0);
  mockP.trainer.count.mockResolvedValue(0);
  mockP.trainerDevelopmentAction.count.mockResolvedValue(0);
  // off.21 : pièces de compétence VALIDÉES au dossier formateur.
  mockP.trainerDocument.findMany.mockResolvedValue([]);
  mockP.trainee.count.mockResolvedValue(0);
  mockP.enrollment.count.mockResolvedValue(0);
  mockP.client.findMany.mockResolvedValue([]);
  // ⚠️ Compteur de documents NEUTRE par défaut. Les tests qui le règlent
  // (off.9, off.12…) ne visent PAS la procédure de sous-traitance : sans ce
  // découplage, régler `documentGenere.count` pour l'un de ces indicateurs
  // couvrirait off.27 en silence, et l'assertion "a_completer" cesserait de
  // vouloir dire quelque chose. Cf. `nbProceduresSousTraitance`.
  mockP.documentGenere.count.mockResolvedValue(0);
  mockP.revueDirection.count.mockResolvedValue(0);
  // ⚠️ off.32 ⭐ lit desormais le CONTENU de la revue, plus son seul nombre.
  // Le mock doit porter `findFirst` : sans lui, `evaluerConformite` leve
  // `prisma.revueDirection.findFirst is not a function` et les 80 tests de ce
  // fichier rougissent d'un coup en accusant des indicateurs qui n'ont pas bouge.
  // Recopier la SIGNATURE, pas le minimum qui passe : ce depot a paye quatre
  // fois un mock incomplet, dont deux fois aujourd'hui.
  // `null` = aucune revue validee pour l'annee courante, l'etat par defaut.
  mockP.revueDirection.findFirst.mockResolvedValue(null);
  mockP.supportFormation.count.mockResolvedValue(0);
  // off.19 mesure desormais la COUVERTURE (formations actives dotees), pas le
  // volume de supports — cf. audit 2026-07-26.
  mockP.supportFormation.findMany.mockResolvedValue([]);
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

/**
 * Mock des lignes lues par off.5 (`objectifsPedagogiques` des formations
 * actives). `formation.findMany` sert TROIS requêtes distinctes ; on discrimine
 * sur le `select`, jamais sur l'ordre d'appel — une cascade de
 * `mockResolvedValueOnce` décalerait la séquence des tests voisins.
 */
function setupFormationsObjectifs(rows: Array<{ objectifsPedagogiques: unknown }>): void {
  mockP.formation.findMany.mockImplementation((args?: { select?: Record<string, unknown> }) => {
    if (args?.select?.["objectifsPedagogiques"] !== undefined) return Promise.resolve(rows);
    if (args?.select?.["typesActionQualiopi"] !== undefined) {
      return Promise.resolve([{ typesActionQualiopi: ["classique"] }]);
    }
    return Promise.resolve([]);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Repères de dates (off.4 / off.8 — audit blanc 2026-08-15)
//
// Volontairement DANS LE PASSÉ : le service calcule `maintenant = new Date()`
// au runtime, donc une session « démarrée » doit l'être quelle que soit la date
// d'exécution des tests.
// ─────────────────────────────────────────────────────────────────────────────

const DEBUT_SESSION = new Date("2024-03-04T09:00:00.000Z");
const AVANT_DEBUT = new Date("2024-02-26T14:00:00.000Z");
const APRES_DEBUT = new Date("2024-03-08T17:00:00.000Z");

/**
 * Nombre d'inscriptions rattachées à une session DÉJÀ DÉMARRÉE — dénominateur
 * commun de la couverture off.4 / off.8.
 *
 * 🔴 2026-09-02 — CE DISCRIMINANT ÉTAIT DEVENU AVEUGLE, et le commentaire qui
 * le justifiait décrivait un code qui n'existait plus. Il lisait
 * `where.session !== undefined` en expliquant que « les deux autres requêtes
 * portent sur `adaptationsRealisees` et `emargementSigneAt` ». C'était vrai le
 * jour où il a été écrit. Depuis, `inscriptionSurSessionTenue()` a AJOUTÉ un
 * `session` à CES DEUX requêtes-là : le helper répondait donc `nb` aux trois, et
 * un test qui réglait le seul dénominateur d'off.4 réglait AUSSI, en silence,
 * les compteurs d'off.10 et d'off.12.
 *
 * 🔑 Un helper de test qui répond à plus de requêtes qu'il n'en vise transforme
 * l'ABSENCE en présence : l'assertion « a_completer » des tests voisins cessait
 * de vouloir dire quelque chose. On discrimine désormais sur ce qui distingue
 * VRAIMENT la requête — les autres portent un champ d'inscription en propre —
 * et jamais sur un champ que ses voisines pourraient acquérir.
 */
function setupInscritsSessionsDemarrees(nb: number): void {
  mockP.enrollment.count.mockImplementation((args?: { where?: Record<string, unknown> }) => {
    const where = args?.where ?? {};
    const viseUnChampDInscription =
      where["adaptationsRealisees"] !== undefined ||
      where["emargementSigneAt"] !== undefined ||
      where["trainee"] !== undefined;
    return Promise.resolve(!viseUnChampDInscription && where["session"] !== undefined ? nb : 0);
  });
}

/**
 * Sessions RÉALISÉES : le total, et combien portent chaque preuve.
 *
 * `trainingSession.count` sert désormais quatre requêtes — le total des
 * réalisées, puis celles qui portent une pièce d'accueil (off.9), une
 * évaluation finale (off.11), une présence constatée (off.12). On discrimine
 * sur le `where`, JAMAIS sur l'ordre d'appel : une cascade de
 * `mockResolvedValueOnce` décalerait la séquence de tous les tests voisins.
 */
function setupSessionsRealisees(opts: {
  total: number;
  avecAccueil?: number;
  avecEvaluationFinale?: number;
  avecPresence?: number;
}): void {
  mockP.trainingSession.count.mockImplementation((args?: { where?: Record<string, unknown> }) => {
    const where = (args?.where ?? {}) as Record<string, unknown>;
    if (where["documents"] !== undefined) return Promise.resolve(opts.avecAccueil ?? 0);
    const enrollments = where["enrollments"] as { some?: Record<string, unknown> } | undefined;
    if (enrollments?.some?.["evaluations"] !== undefined) {
      return Promise.resolve(opts.avecEvaluationFinale ?? 0);
    }
    if (enrollments?.some?.["emargementSigneAt"] !== undefined) {
      return Promise.resolve(opts.avecPresence ?? 0);
    }
    return Promise.resolve(opts.total);
  });
}

/** Ligne de questionnaire de positionnement répondu, telle que la lit off.4. */
function positionnement(
  enrollmentId: string,
  reponduAt: Date,
  dateDebut: Date = DEBUT_SESSION,
): { enrollmentId: string; reponduAt: Date; enrollment: { session: { dateDebut: Date } } } {
  return { enrollmentId, reponduAt, enrollment: { session: { dateDebut } } };
}

/** Ligne d'évaluation initiale, telle que la lit off.8. */
function evaluationInitiale(
  enrollmentId: string | null,
  dateEvaluation: Date,
  dateDebut: Date | null = DEBUT_SESSION,
): {
  enrollmentId: string | null;
  dateEvaluation: Date;
  enrollment: { session: { dateDebut: Date } } | null;
} {
  return {
    enrollmentId,
    dateEvaluation,
    enrollment: dateDebut === null ? null : { session: { dateDebut } },
  };
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

  it("off.5/6 DURCIS : couverts si objectifs renseignés + contenu réellement produit", async () => {
    // [2026-08-19] off.5 lit désormais `objectifsPedagogiques`, plus seulement
    // `statutGeneration` : la structure générée reste nécessaire pour off.6,
    // elle ne suffit plus pour off.5. Le mock fournit donc les objectifs.
    mockP.formation.count.mockResolvedValue(3); // total ET filtrés (structure/contenu) = 3
    setupFormationsObjectifs([
      { objectifsPedagogiques: [{ id: "o1", verbe: "Identifier" }] },
      { objectifsPedagogiques: [{ id: "o2", verbe: "Analyser" }] },
      { objectifsPedagogiques: [{ id: "o3", verbe: "Construire" }] },
    ]);
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

  // ── off.11 ⭐ : COUVERTURE, pas volumétrie (audit certificateur 2026-09-02) ─
  //
  // 🔴 Ce test s'appelait « off.11 couvert si au moins 1 évaluation finale
  // existe », et c'était exactement le défaut : mesuré sur la base de recette,
  // DEUX évaluations finales au registre déclaraient l'indicateur couvert pour
  // 423 sessions réalisées, dont UNE SEULE en portait une. L'auditrice ne
  // demande pas s'il en existe une : elle tire une session et demande la sienne.

  it("off.11 couvert quand CHAQUE session réalisée porte une évaluation finale", async () => {
    mockP.evaluationAcquis.count.mockResolvedValue(3);
    // trainingSession.count sert plusieurs requêtes : on discrimine sur le
    // `where`, jamais sur l'ordre d'appel — une cascade décalerait les voisins.
    setupSessionsRealisees({ total: 3, avecEvaluationFinale: 3 });
    const result = await evaluerConformite();
    const ind11 = result.indicateurs.find((i) => i.numero === 11);
    expect(ind11?.statut).toBe("couvert");
  });

  it("off.11 À COMPLÉTER si une seule session réalisée sur trois porte une évaluation finale", async () => {
    mockP.evaluationAcquis.count.mockResolvedValue(3);
    setupSessionsRealisees({ total: 3, avecEvaluationFinale: 1 });
    const result = await evaluerConformite();
    const ind11 = result.indicateurs.find((i) => i.numero === 11);
    expect(ind11?.statut).toBe("a_completer");
    expect(ind11?.preuves.join(" ")).toContain("2 session(s) réalisée(s) SANS");
  });

  // ── Audit certificateur 2026-09-02 — couverture, jamais volumétrie ────────
  //
  // La règle « c'est ce que vérifie un auditeur qui tire un dossier au hasard »
  // était écrite pour off.4, off.5, off.8, off.19 et off.27. Elle n'avait pas été
  // appliquée à ses jumeaux. Chaque cas ci-dessous porte son test NÉGATIF : sans
  // lui, la règle serait « vraie sur le vide ».

  it("off.6 couvert seulement si TOUTES les formations actives ont un contenu produit", async () => {
    mockP.formation.count.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const where = (args?.where ?? {}) as Record<string, unknown>;
      const actif = where["statut"] === "actif";
      const avecContenu = where["statutGeneration"] !== undefined;
      if (actif && avecContenu) return Promise.resolve(2);
      if (actif) return Promise.resolve(2);
      return Promise.resolve(2);
    });
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 6)?.statut).toBe("couvert");
  });

  it("off.6 À COMPLÉTER si une formation active sur trois n'a pas de contenu produit", async () => {
    mockP.formation.count.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const where = (args?.where ?? {}) as Record<string, unknown>;
      const actif = where["statut"] === "actif";
      const avecContenu = where["statutGeneration"] !== undefined;
      if (actif && avecContenu) return Promise.resolve(2);
      if (actif) return Promise.resolve(3);
      return Promise.resolve(3);
    });
    const result = await evaluerConformite();
    const ind6 = result.indicateurs.find((i) => i.numero === 6);
    expect(ind6?.statut).toBe("a_completer");
    expect(ind6?.preuves.join(" ")).toContain("1 formation(s) active(s) SANS contenu");
  });

  it("off.9 couvert seulement si CHAQUE session réalisée porte une pièce d'accueil", async () => {
    mockP.documentGenere.count.mockResolvedValue(5);
    setupSessionsRealisees({ total: 4, avecAccueil: 4 });
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 9)?.statut).toBe("couvert");
  });

  it("off.9 À COMPLÉTER quand des pièces d'accueil existent mais pas sur toutes les sessions", async () => {
    // C'est LE cas mesuré en recette : 987 pièces au registre, et pourtant
    // 169 sessions réalisées sur 423 n'en portaient aucune.
    mockP.documentGenere.count.mockResolvedValue(987);
    setupSessionsRealisees({ total: 4, avecAccueil: 2 });
    const result = await evaluerConformite();
    const ind9 = result.indicateurs.find((i) => i.numero === 9);
    expect(ind9?.statut).toBe("a_completer");
    expect(ind9?.preuves.join(" ")).toContain("2 session(s) réalisée(s) SANS");
  });

  it("off.12 couvert seulement si CHAQUE session réalisée porte une présence constatée", async () => {
    setupSessionsRealisees({ total: 2, avecPresence: 2 });
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 12)?.statut).toBe("couvert");
  });

  it("off.12 À COMPLÉTER si une session réalisée n'a aucune présence constatée", async () => {
    setupSessionsRealisees({ total: 2, avecPresence: 1 });
    const result = await evaluerConformite();
    const ind12 = result.indicateurs.find((i) => i.numero === 12);
    expect(ind12?.statut).toBe("a_completer");
    expect(ind12?.preuves.join(" ")).toContain("la feuille d'émargement y est vide");
  });

  // off.10 ⭐ — ici la couverture n'est PAS un taux sur toutes les inscriptions :
  // le RNQ ne demande pas d'adapter pour tout le monde. Ce qui manquait, c'est
  // la seule question que l'auditrice pose : « des personnes ont déclaré un
  // besoin — montrez ce que vous avez adapté pour elles ».

  it("off.10 couvert si une adaptation est tracée et qu'aucun besoin déclaré ne reste sans réponse", async () => {
    mockP.enrollment.count.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const where = (args?.where ?? {}) as Record<string, unknown>;
      const besoin = where["trainee"] !== undefined;
      const adaptee = where["adaptationsRealisees"] !== undefined;
      if (besoin && adaptee) return Promise.resolve(2);
      if (besoin) return Promise.resolve(2);
      if (adaptee) return Promise.resolve(3);
      return Promise.resolve(10);
    });
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 10)?.statut).toBe("couvert");
  });

  it("off.10 À COMPLÉTER si un besoin déclaré reste sans adaptation tracée", async () => {
    mockP.enrollment.count.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const where = (args?.where ?? {}) as Record<string, unknown>;
      const besoin = where["trainee"] !== undefined;
      const adaptee = where["adaptationsRealisees"] !== undefined;
      if (besoin && adaptee) return Promise.resolve(1);
      if (besoin) return Promise.resolve(3);
      if (adaptee) return Promise.resolve(3);
      return Promise.resolve(10);
    });
    const result = await evaluerConformite();
    const ind10 = result.indicateurs.find((i) => i.numero === 10);
    expect(ind10?.statut).toBe("a_completer");
    expect(ind10?.preuves.join(" ")).toContain("ont DÉCLARÉ un besoin");
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

  it("off.30 couvert si 2 qualités déclarées portées par 2 personnes physiques distinctes", async () => {
    mockP.appreciation.count.mockResolvedValue(5);
    mockP.appreciation.groupBy.mockResolvedValue([
      { source: "stagiaire" },
      { source: "entreprise" },
    ]);
    mockP.appreciation.findMany.mockResolvedValue([
      { source: "stagiaire", clientId: null, trainee: { email: "stagiaire@exemple.fr" } },
      { source: "entreprise", clientId: "cli-1", trainee: null },
    ]);
    mockP.client.findMany.mockResolvedValue([{ id: "cli-1", contactEmail: "rh@exemple.fr" }]);
    const result = await evaluerConformite();
    const ind30 = result.indicateurs.find((i) => i.numero === 30);
    expect(ind30?.statut).toBe("couvert");
  });

  // ── off.30 : une QUALITÉ déclarée n'est pas une PARTIE PRENANTE ────────────
  //
  // 🔴 Non-conformité relevée (audit blanc 2026-08-15). Le `groupBy(["source"])`
  // comptait les qualités déclarées. Chez cet organisme, les deux « sources
  // distinctes » sont la MÊME personne physique : la stagiaire est aussi la
  // représentante du client. L'indicateur affichait « multi-parties » sur une
  // seule voix.
  //
  // 🔴 CE TEST ROUGIT SI LA GARDE SAUTE : deux sources distinctes sont bien
  // présentes — c'est exactement ce que l'ancienne règle exigeait. Sans le
  // décompte des personnes physiques, l'indicateur repasse « couvert ».
  it("off.30 a_completer si les deux sources sont la MÊME personne physique", async () => {
    mockP.appreciation.count.mockResolvedValue(2);
    mockP.appreciation.groupBy.mockResolvedValue([
      { source: "stagiaire" },
      { source: "entreprise" },
    ]);
    mockP.appreciation.findMany.mockResolvedValue([
      { source: "stagiaire", clientId: null, trainee: { email: "marie.dupont@client.fr" } },
      { source: "entreprise", clientId: "cli-1", trainee: null },
    ]);
    // Le contact du client, c'est la stagiaire elle-même (casse et espaces
    // différents : la normalisation doit les rapprocher, pas les distinguer).
    mockP.client.findMany.mockResolvedValue([
      { id: "cli-1", contactEmail: " Marie.Dupont@Client.fr " },
    ]);
    const result = await evaluerConformite();
    const ind30 = result.indicateurs.find((i) => i.numero === 30);
    expect(ind30?.statut).toBe("a_completer");
    expect(ind30?.preuves.join(" ")).toContain("1 personne physique distincte");
    expect(ind30?.preuves.join(" ")).toMatch(/Multi-parties non démontré/);
  });

  it("off.30 a_completer si une seule qualité déclarée, même avec 2 personnes distinctes", async () => {
    // Deux stagiaires font deux personnes, mais une seule partie prenante.
    mockP.appreciation.count.mockResolvedValue(2);
    mockP.appreciation.groupBy.mockResolvedValue([{ source: "stagiaire" }]);
    mockP.appreciation.findMany.mockResolvedValue([
      { source: "stagiaire", clientId: null, trainee: { email: "a@exemple.fr" } },
      { source: "stagiaire", clientId: null, trainee: { email: "b@exemple.fr" } },
    ]);
    const result = await evaluerConformite();
    const ind30 = result.indicateurs.find((i) => i.numero === 30);
    expect(ind30?.statut).toBe("a_completer");
  });

  // Élément constaté HONNÊTE quand la base ne porte pas l'information : on
  // n'invente pas d'auteur, et l'indicateur n'est pas couvert sur ce seul critère.
  it("off.30 a_completer et rattachement annoncé « non établi » si aucun auteur identifiable", async () => {
    mockP.appreciation.count.mockResolvedValue(4);
    mockP.appreciation.groupBy.mockResolvedValue([
      { source: "stagiaire" },
      { source: "financeur" },
    ]);
    mockP.appreciation.findMany.mockResolvedValue([
      { source: "stagiaire", clientId: null, trainee: null },
      { source: "financeur", clientId: null, trainee: null },
    ]);
    const result = await evaluerConformite();
    const ind30 = result.indicateurs.find((i) => i.numero === 30);
    expect(ind30?.statut).toBe("a_completer");
    expect(ind30?.preuves.join(" ")).toMatch(
      /2 appréciations, rattachement des auteurs non établi/,
    );
  });

  it("off.30 a_completer si 0 appréciation", async () => {
    mockP.appreciation.count.mockResolvedValue(0);
    mockP.appreciation.groupBy.mockResolvedValue([]);
    mockP.appreciation.findMany.mockResolvedValue([]);
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

  // 🔴 2026-09-02 (audit certificateur) — COUVERTURE, pas volumétrie.
  // La règle acceptait UN intervenant en règle pour tous les autres : mesuré sur
  // la base de recette, 1 formateur sur 101 portait une fiche. L'auditrice
  // désigne celui qui a animé la session qu'elle a tirée, et demande SA preuve.

  it("off.21 couvert quand CHAQUE formateur actif a une fiche à jour ET une pièce de compétence validée", async () => {
    // trainer.count : 1=actif, 2=actif+cvUrl, 3=actif+cvUrl+cvUploadedAt<24 mois
    mockP.trainer.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mockP.trainerDocument.findMany.mockResolvedValue([{ trainerId: "t-1" }]);
    const result = await evaluerConformite();
    const ind21 = result.indicateurs.find((i) => i.numero === 21);
    expect(ind21?.statut).toBe("couvert");
  });

  it("off.21 À COMPLÉTER si un seul formateur sur deux porte une fiche à jour", async () => {
    mockP.trainer.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mockP.trainerDocument.findMany.mockResolvedValue([{ trainerId: "t-1" }]);
    const result = await evaluerConformite();
    const ind21 = result.indicateurs.find((i) => i.numero === 21);
    expect(ind21?.statut).toBe("a_completer");
    expect(ind21?.preuves.join(" ")).toContain("1/2 formateurs actifs avec une fiche");
  });

  // ── off.21 : la fiche que l'outil génère lui-même ne justifie rien ─────────
  //
  // 🔴 Non-conformité relevée (audit blanc 2026-08-15) : la couverture reposait
  // sur `cvUrl` non null. Or quand l'outil produit la fiche formateur, c'est LUI
  // qui pose cette URL — l'organisme validait donc une pièce qu'il s'était
  // écrite, et l'élément constaté annonçait « CV téléversé ».
  //
  // 🔴 CE TEST ROUGIT SI LA CONDITION AJOUTÉE SAUTE : fiche présente et récente,
  // mais aucune pièce validée → sans la garde, l'indicateur repasse au vert.
  it("off.21 a_completer si fiche récente MAIS aucune pièce de compétence validée", async () => {
    mockP.trainer.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    mockP.trainerDocument.findMany.mockResolvedValue([]);
    const result = await evaluerConformite();
    const ind21 = result.indicateurs.find((i) => i.numero === 21);
    expect(ind21?.statut).toBe("a_completer");
    expect(ind21?.preuves.join(" ")).toMatch(/Aucune pièce de compétence validée/);
  });

  it("off.21 : l'élément constaté ne prétend plus « CV téléversé », mais « fiche formateur au dossier »", async () => {
    mockP.trainer.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mockP.trainerDocument.findMany.mockResolvedValue([{ trainerId: "t-1" }]);
    const result = await evaluerConformite();
    const preuves = result.indicateurs.find((i) => i.numero === 21)?.preuves.join(" ") ?? "";
    expect(preuves).toMatch(/fiche formateur au dossier/i);
    expect(preuves).not.toMatch(/CV téléversé/i);
  });

  it("off.21 a_completer si CV présent mais PÉRIMÉ (aucun < 24 mois)", async () => {
    // 2 CV téléversés mais aucun daté de moins de 24 mois → 3e appel = 0.
    mockP.trainer.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    mockP.trainerDocument.findMany.mockResolvedValue([{ trainerId: "t-1" }]);
    const result = await evaluerConformite();
    const ind21 = result.indicateurs.find((i) => i.numero === 21);
    expect(ind21?.statut).toBe("a_completer");
  });

  it("off.21 a_completer si formateurs actifs mais 0 avec cvUrl", async () => {
    mockP.trainer.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockP.trainerDocument.findMany.mockResolvedValue([{ trainerId: "t-1" }]);
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

  // ── off.1 : la contradiction certifiante, la plus visible de l'écran ───────
  //
  // 🔴 2026-08-23. Observée à l'œil nu sur `/qualiopi/mode-auditeur` :
  //
  //   « Indicateur 1 — Couvert : 1 formation certifiante avec code RS/RNCP »
  //   « Indicateur 3 — Non applicable » · « 7 ⭐ Non applicable » · « 16 ⭐ Non applicable »
  //
  // Le système présentait comme PREUVE un fait qu'il déclarait hors sujet trois
  // lignes plus bas. Deux signaux distincts répondent à « cet organisme est-il
  // certifiant ? » et rien ne les confrontait : l'applicabilité vient de
  // `typesActionQualiopi` (qu'aucun écran ne sait écrire), la preuve vient du
  // code RNCP/RS (saisissable).
  //
  // 🔑 Les deux tests vont PAR PAIRE, et c'est le second qui compte le plus :
  // sans lui, on « corrigerait » le défaut en supprimant purement la ligne, et
  // le moteur cesserait de dire à l'auditeur ce qu'il sait.

  /** Pilote les DEUX signaux séparément, en discriminant sur le `select`. */
  function setupSignauxCertifiants(typesAction: string[]): void {
    mockP.formation.count.mockResolvedValue(1);
    mockP.formation.findMany.mockImplementation((args?: { select?: Record<string, unknown> }) => {
      if (args?.select?.["typesActionQualiopi"] !== undefined) {
        return Promise.resolve([{ typesActionQualiopi: typesAction }]);
      }
      if (args?.select?.["certificationType"] !== undefined) {
        return Promise.resolve([
          { certificationType: "rncp", codeRncp: "RNCP37274", codeRs: null, blocsCompetences: [] },
        ]);
      }
      return Promise.resolve([]);
    });
  }

  /** Les indicateurs conditionnés au caractère certifiant, DÉRIVÉS du registre. */
  function indicateursCertifiantsAttendus(): number[] {
    return INDICATEURS_RNQ.filter((ind) => ind.conditionnel === "cert").map((ind) => ind.numero);
  }

  it("🔴 off.1 ne présente PAS un code RS/RNCP comme preuve quand 3/7/16 sont non applicables", async () => {
    setupSignauxCertifiants(["classique"]); // ← aucune action certifiante déclarée
    mockGetConfig.mockImplementation((cle: string) =>
      Promise.resolve(cle === "nda_numero" ? "84381100438" : ""),
    );

    const result = await evaluerConformite();
    const ind1 = result.indicateurs.find((i) => i.numero === 1);
    const certifiants = indicateursCertifiantsAttendus();

    // Les trois indicateurs certifiants sont bien hors jeu — c'est le contexte
    // du défaut, pas ce qu'on corrige. S'ils devenaient applicables, ce test
    // deviendrait vert par vacuité : on l'affirme donc explicitement.
    for (const n of certifiants) {
      expect(
        result.indicateurs.find((i) => i.numero === n)?.statut,
        `off.${n} doit être non applicable dans ce scénario (sinon le test ne prouve plus rien)`,
      ).toBe("non_applicable");
    }

    const preuves = (ind1?.preuves ?? []).join(" | ");

    expect(
      /formations? certifiantes? avec code RS\/RNCP renseigné/.test(preuves),
      "🔴 off.1 affirme « N formation certifiante avec code RS/RNCP renseigné » comme PREUVE\n" +
        `   alors que les indicateurs ${certifiants.join(", ")} sont déclarés NON APPLICABLES.\n` +
        "   Le système présente comme preuve un fait qu'il déclare hors sujet dans la même page.\n" +
        `   Preuves rendues : ${preuves}`,
    ).toBe(false);

    // Ne pas se contenter de TAIRE : l'auditeur doit voir la contradiction.
    expect(
      preuves.includes("RS/RNCP"),
      "off.1 doit continuer à SIGNALER le code RS/RNCP — le cacher priverait\n" +
        "   l'auditeur d'une information qu'il découvrirait seul.",
    ).toBe(true);
    for (const n of certifiants) {
      expect(
        preuves.includes(String(n)),
        `le signalement doit NOMMER l'indicateur ${n} : une contradiction qu'on ne\n` +
          "   sait pas où instruire n'est pas actionnable.",
      ).toBe(true);
    }
  });

  it("témoin négatif — quand le périmètre EST certifiant, off.1 énonce bien la preuve", async () => {
    setupSignauxCertifiants(["certifiante"]); // ← action certifiante déclarée
    mockGetConfig.mockImplementation((cle: string) =>
      Promise.resolve(cle === "nda_numero" ? "84381100438" : ""),
    );

    const result = await evaluerConformite();
    const ind1 = result.indicateurs.find((i) => i.numero === 1);
    const preuves = (ind1?.preuves ?? []).join(" | ");

    expect(
      /formations? certifiantes? avec code RS\/RNCP renseigné/.test(preuves),
      "🔴 la preuve légitime a disparu : le correctif du cas contradictoire a\n" +
        "   supprimé la ligne au lieu de la conditionner. Le moteur ne dit plus à\n" +
        "   l'auditeur ce qu'il sait, dans le cas où il a le droit de le dire.\n" +
        `   Preuves rendues : ${preuves}`,
    ).toBe(true);
    expect(preuves.includes("NON APPLICABLES"), "aucun avertissement ne doit apparaître ici").toBe(
      false,
    );
  });

  // ── off.28 = AFEST (déclaratif SEULEMENT depuis 2026-08-10) ; off.13/14/15 = APPRENTISSAGE ──

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

  it("off.28 a_completer si AFEST déclaré sur une Formation (preuves à constituer manuellement)", async () => {
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["alternance_afest"] }]);
    const result = await evaluerConformite();
    const ind28 = result.indicateurs.find((i) => i.numero === 28);
    expect(ind28?.statut).toBe("a_completer");
    expect(ind28?.preuves.join(" ")).toMatch(/à compléter/i);
  });

  // 🔴 Retournement 2026-08-10 : l'automatisme est RETIRÉ. Un parcours coaching
  // (même « conforme » au sens de l'ancienne validation structurelle) ne rend
  // PLUS `alternance_afest` effectif : le 1-to-1 est du conseil (décision
  // 2026-07-17). Déclarer l'AFEST au certificateur COFRAC avec des prestations
  // de conseil comme preuve était le risque d'audit n°1.
  it("une coachingSession réalisée ne déclenche PLUS alternance_afest ni off.28", async () => {
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["classique"] }]);
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
    const ind28 = result.indicateurs.find((i) => i.numero === 28);
    expect(ind28?.statut).toBe("non_applicable");
    expect(ind28?.preuves).toHaveLength(0);
    // Le service ne lit même plus les parcours coaching.
    expect(mockP.coachingSession.findMany).not.toHaveBeenCalled();
  });

  it("off.28 jamais couvert automatiquement, même avec AFEST déclaré ET parcours coaching présents", async () => {
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["alternance_afest"] }]);
    mockP.coachingSession.findMany.mockResolvedValue([
      {
        cartographie: { taches: [{ tache: "x" }] },
        evaluations: [{ id: "e" }],
        comptesRendus: [
          { misesEnSituation: [{ cas: "x" }], phasesReflexives: [{ situation: "y" }] },
        ],
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

  it("off.18 couvert si inventaire complet ET modalités de coordination écrites", async () => {
    mockP.trainer.count.mockResolvedValue(1);
    mockGetConfig.mockImplementation((key: string) =>
      Promise.resolve(
        key === "modalites_coordination"
          ? "Le responsable pédagogique pilote ; point de coordination avant chaque session, compte rendu partagé."
          : "",
      ),
    );
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

  // ── off.18 : la coordination se PROUVE par écrit (audit blanc 2026-08-15) ──
  //
  // 🔴 Non-conformité relevée : l'indicateur se déduisait d'un NOMBRE de
  // formateurs actifs et d'un inventaire vérifié. Avec un intervenant unique,
  // « 1 formateur coordonné » ne coordonne personne.
  //
  // 🔴 CE TEST ROUGIT SI LA GARDE SAUTE : inventaire parfait, 1 formateur, mais
  // aucune preuve écrite — sans la condition ajoutée, l'indicateur repasse au vert.
  it("off.18 a_completer si inventaire complet MAIS aucune preuve écrite de coordination", async () => {
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
    const ind18 = result.indicateurs.find((i) => i.numero === 18);
    expect(ind18?.statut).toBe("a_completer");
    expect(ind18?.preuves.join(" ")).toMatch(/Aucune preuve écrite de coordination/);
  });

  it("off.18 couvert par une pièce « inventaire des moyens » / « organisation de l'action » au registre", async () => {
    mockP.trainer.count.mockResolvedValue(1);
    mockP.documentGenere.count.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const type = args?.where?.["type"] as { in?: string[] } | string | undefined;
      const cible =
        typeof type === "object" && Array.isArray(type.in) && type.in.includes("inventaire_moyens");
      return Promise.resolve(cible ? 1 : 0);
    });
    setupMoyens([{ categorie: "salle", count: 1 }], [{ categorie: "salle", count: 1 }]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 18)?.statut).toBe("couvert");
  });

  it("off.18 : une pièce de coordination ne suffit pas si une catégorie de moyens n'est pas vérifiée", async () => {
    // La preuve écrite s'AJOUTE aux conditions LOT 2, elle ne les remplace pas.
    mockP.trainer.count.mockResolvedValue(1);
    mockGetConfig.mockImplementation((key: string) =>
      Promise.resolve(key === "modalites_coordination" ? "Coordination hebdomadaire." : ""),
    );
    setupMoyens(
      [
        { categorie: "salle", count: 1 },
        { categorie: "materiel", count: 1 },
      ],
      [{ categorie: "salle", count: 1 }],
    );
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 18)?.statut).toBe("a_completer");
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

  // ── off.4 / off.8 : la DATE et la COUVERTURE (audit blanc 2026-08-15) ─────
  //
  // 🔴 Non-conformité relevée : `nbPositionnementsBesoin > 0` — aucune contrainte
  // de date, aucune notion de couverture. UNE réponse, saisie n'importe quand,
  // « couvrait » les 22 formations du catalogue. Analyser un besoin après avoir
  // formé n'est pas une analyse du besoin.

  it("off.4 mesuré par le questionnaire de positionnement (≠ grille d'acquis off.8)", async () => {
    mockP.formation.count.mockResolvedValue(2);
    setupInscritsSessionsDemarrees(1);
    // Grille d'acquis présente et DANS LES TEMPS (off.8 couvert) mais AUCUN
    // questionnaire de positionnement répondu → off.4 reste à compléter.
    mockP.evaluationAcquis.findMany.mockResolvedValue([evaluationInitiale("enr-1", AVANT_DEBUT)]);
    mockP.questionnaire.findMany.mockResolvedValue([]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 4)?.statut).toBe("a_completer");
    expect(result.indicateurs.find((i) => i.numero === 8)?.statut).toBe("couvert");
  });

  it("off.4 couvert si TOUS les inscrits des sessions démarrées sont positionnés avant le début", async () => {
    mockP.formation.count.mockResolvedValue(2);
    setupInscritsSessionsDemarrees(2);
    mockP.questionnaire.findMany.mockResolvedValue([
      positionnement("enr-1", AVANT_DEBUT),
      positionnement("enr-2", AVANT_DEBUT),
    ]);
    const result = await evaluerConformite();
    const ind4 = result.indicateurs.find((i) => i.numero === 4);
    expect(ind4?.statut).toBe("couvert");
    expect(ind4?.preuves.join(" ")).toContain("2 inscrits sur 2");
  });

  // 🔴 CE TEST ROUGIT SI LA GARDE DE DATE SAUTE. Sans le filtre
  // `reponduAt <= session.dateDebut`, ces deux réponses comptent normalement :
  // 2/2 inscrits « positionnés » → l'indicateur repasse « couvert » et
  // l'assertion « a_completer » échoue.
  it("off.4 a_completer si le positionnement a été répondu APRÈS le début de la session", async () => {
    mockP.formation.count.mockResolvedValue(2);
    setupInscritsSessionsDemarrees(2);
    mockP.questionnaire.findMany.mockResolvedValue([
      positionnement("enr-1", APRES_DEBUT),
      positionnement("enr-2", APRES_DEBUT),
    ]);
    const result = await evaluerConformite();
    const ind4 = result.indicateurs.find((i) => i.numero === 4);
    expect(ind4?.statut).toBe("a_completer");
    // Les hors-délai sont AFFICHÉS séparément, plus fondus dans un compteur unique.
    expect(ind4?.preuves.join(" ")).toMatch(/2 positionnements répondus HORS DÉLAI/);
    expect(ind4?.preuves.join(" ")).toContain("0 inscrit sur 2");
  });

  // 🔴 CE TEST ROUGIT SI L'ÉLÉMENT CONSTATÉ REDEVIENT VOLUMÉTRIQUE. Une seule
  // réponse conforme sur 22 inscrits : l'ancien `> 0` couvrait l'indicateur.
  it("off.4 a_completer si un seul inscrit sur 22 est positionné (couverture partielle)", async () => {
    mockP.formation.count.mockResolvedValue(22);
    setupInscritsSessionsDemarrees(22);
    mockP.questionnaire.findMany.mockResolvedValue([positionnement("enr-1", AVANT_DEBUT)]);
    const result = await evaluerConformite();
    const ind4 = result.indicateurs.find((i) => i.numero === 4);
    expect(ind4?.statut).toBe("a_completer");
    expect(ind4?.preuves.join(" ")).toContain("1 inscrit sur 22");
    expect(ind4?.preuves.join(" ")).toContain("21 inscrit(s) entré(s) en formation");
  });

  it("off.4 : un positionnement anticipé sur une session À VENIR ne fabrique pas de couverture", async () => {
    // Session future → hors du dénominateur (l'inscrit n'est pas en défaut),
    // et hors du numérateur : la couverture ne peut pas dépasser 100 %.
    const futur = new Date("2099-01-10T09:00:00.000Z");
    mockP.formation.count.mockResolvedValue(1);
    setupInscritsSessionsDemarrees(0);
    mockP.questionnaire.findMany.mockResolvedValue([
      positionnement("enr-futur", new Date("2098-12-01T09:00:00.000Z"), futur),
    ]);
    const result = await evaluerConformite();
    const ind4 = result.indicateurs.find((i) => i.numero === 4);
    expect(ind4?.statut).toBe("a_completer");
    expect(ind4?.preuves.join(" ")).toContain("0 inscrit sur 0");
  });

  it("off.8 couvert si tous les inscrits sont évalués à l'entrée AVANT le début", async () => {
    setupInscritsSessionsDemarrees(2);
    mockP.evaluationAcquis.findMany.mockResolvedValue([
      evaluationInitiale("enr-1", AVANT_DEBUT),
      evaluationInitiale("enr-2", DEBUT_SESSION), // le jour même, avant/à l'ouverture
    ]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 8)?.statut).toBe("couvert");
  });

  // 🔴 CE TEST ROUGIT SI LA GARDE DE DATE SAUTE : sans le filtre
  // `dateEvaluation <= session.dateDebut`, ces deux grilles « initiales »
  // saisies pendant l'action couvrent 2/2 et l'indicateur repasse au vert.
  it("off.8 a_completer si la grille initiale a été saisie APRÈS le démarrage", async () => {
    setupInscritsSessionsDemarrees(2);
    mockP.evaluationAcquis.findMany.mockResolvedValue([
      evaluationInitiale("enr-1", APRES_DEBUT),
      evaluationInitiale("enr-2", APRES_DEBUT),
    ]);
    const result = await evaluerConformite();
    const ind8 = result.indicateurs.find((i) => i.numero === 8);
    expect(ind8?.statut).toBe("a_completer");
    expect(ind8?.preuves.join(" ")).toMatch(/HORS DÉLAI/);
  });

  it("off.8 a_completer si un seul inscrit sur trois est évalué à l'entrée", async () => {
    setupInscritsSessionsDemarrees(3);
    mockP.evaluationAcquis.findMany.mockResolvedValue([evaluationInitiale("enr-1", AVANT_DEBUT)]);
    const result = await evaluerConformite();
    const ind8 = result.indicateurs.find((i) => i.numero === 8);
    expect(ind8?.statut).toBe("a_completer");
    expect(ind8?.preuves.join(" ")).toContain("1 inscrit sur 3");
  });

  it("off.8 : une évaluation initiale sans session rattachée (1-to-1) ne prouve rien", async () => {
    setupInscritsSessionsDemarrees(1);
    mockP.evaluationAcquis.findMany.mockResolvedValue([
      evaluationInitiale(null, AVANT_DEBUT, null),
    ]);
    const result = await evaluerConformite();
    const ind8 = result.indicateurs.find((i) => i.numero === 8);
    expect(ind8?.statut).toBe("a_completer");
    expect(ind8?.preuves.join(" ")).toMatch(/sans session rattachée/);
  });

  it("off.27 [P1] a_completer si sous-traitant référencé mais NON conforme (NDA/data.gouv/contrat manquants)", async () => {
    // total > 0 mais aucun conforme. Discriminé sur `nda`, clé propre à la
    // requête « conformes » : depuis que le dénominateur filtre lui aussi
    // (`actif: true`, 2026-08-19), tester la seule présence d'un `where` rendait
    // 0 des DEUX côtés — le test passait encore, sur un scénario vide qui
    // n'était plus celui de son titre.
    mockP.sousTraitant.count.mockImplementation((args?: { where?: Record<string, unknown> }) =>
      Promise.resolve(args?.where?.["nda"] !== undefined ? 0 : 3),
    );
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 27)?.statut).toBe("a_completer");
  });

  it("off.27 [P1] couvert si ≥1 sous-traitant conforme (NDA + vérif data.gouv + contrat signé)", async () => {
    mockP.sousTraitant.count.mockResolvedValue(1); // total ET conformes = 1
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 27)?.statut).toBe("couvert");
  });

  // ── off.27 : le FORMATEUR INDÉPENDANT compte aussi ────────────────────────
  //
  // 🔴 Régression trouvée le 2026-08-03. Axion a deux natures de sous-traitant :
  // un ORGANISME (`sousTraitant`) et une PERSONNE PHYSIQUE indépendante
  // (`trainer` avec `statut: "sous_traitant"`). Seule la première était comptée.
  //
  // Or le modèle économique d'Axion repose sur des formateurs freelances : ils
  // animent, facturent Axion, et Axion facture le client. Axion pouvait donc
  // référencer dix intervenants parfaitement conformes et voir l'indicateur 27
  // rester à zéro.
  //
  // ⚠️ La RC pro n'entre PAS dans le critère (décision Will du 2026-08-03) : elle
  // est demandée et suivie par alerte, jamais bloquante. L'inclure ici aurait
  // gelé l'indicateur sur une pièce volontairement non exigée.
  it("off.27 couvert par un FORMATEUR INDÉPENDANT conforme, sans aucun organisme", async () => {
    mockP.sousTraitant.count.mockResolvedValue(0); // aucun organisme sous-traitant
    // Le formateur indépendant est référencé ET conforme : les deux requêtes
    // portent `statut: "sous_traitant"`, elles doivent rendre le MÊME homme.
    // L'ancien mock ne répondait 1 qu'à la requête « conforme » et 0 à celle qui
    // le référence — un conforme sur zéro référencé. L'incohérence passait
    // inaperçue tant que la couverture se lisait `conformes > 0` ; elle est
    // visible depuis que la règle compare conformes et référencés.
    mockP.trainer.count.mockImplementation((args?: { where?: Record<string, unknown> }) =>
      Promise.resolve(args?.where?.["statut"] === "sous_traitant" ? 1 : 0),
    );
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 27)?.statut).toBe("couvert");
  });

  it("off.27 NON couvert par un formateur sous-traitant sans contrat-cadre signé", async () => {
    mockP.sousTraitant.count.mockResolvedValue(0);
    // Référencé (total > 0) mais aucun ne satisfait NDA + vérif + contrat.
    mockP.trainer.count.mockImplementation((args?: { where?: Record<string, unknown> }) =>
      Promise.resolve(args?.where?.["sousTraitantContratSigneAt"] !== undefined ? 0 : 2),
    );
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 27)?.statut).toBe("a_completer");
  });

  // ── off.27 : la PROCÉDURE ÉCRITE, seconde voie de couverture ───────────────
  //
  // 🔴 Trouvé le 2026-08-04, en production. La règle disait dans son propre
  // commentaire « voie NON COUVERTE par ce flag — action Will hors-code », alors
  // que la PR 531 avait fait de cette procédure une pièce GÉNÉRÉE, précisément
  // pour l'indicateur 27. Générée en prod (`AXI-DOC-2026-026`), l'écran
  // continuait d'afficher « off.27 exige alors une procédure ».
  //
  // C'est la seule voie dont dispose un OF qui ne sous-traite pas ENCORE — et
  // c'est exactement le cas d'Axion à la première certification.
  it("off.27 couvert par la PROCÉDURE écrite, sans aucun sous-traitant référencé", async () => {
    mockP.sousTraitant.count.mockResolvedValue(0);
    mockP.trainer.count.mockResolvedValue(0);
    mockP.documentGenere.count.mockImplementation((args?: { where?: Record<string, unknown> }) =>
      Promise.resolve(args?.where?.["type"] === "procedure_sous_traitance" ? 1 : 0),
    );
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 27)?.statut).toBe("couvert");
  });

  it("off.27 reste à compléter SANS procédure ni sous-traitant", async () => {
    // Le pendant du précédent : sans lui, le test ci-dessus passerait même si la
    // couverture était devenue inconditionnelle.
    mockP.sousTraitant.count.mockResolvedValue(0);
    mockP.trainer.count.mockResolvedValue(0);
    mockP.documentGenere.count.mockResolvedValue(0);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 27)?.statut).toBe("a_completer");
  });

  it("🔴 une procédure ANNULÉE ne couvre pas off.27", async () => {
    // La requête filtre `annuleeAt: null`. Ce test verrouille le filtre : sans
    // lui, annuler la procédure laisserait l'indicateur vert sur une pièce que
    // l'organisme a lui-même déclarée sans valeur.
    mockP.sousTraitant.count.mockResolvedValue(0);
    mockP.trainer.count.mockResolvedValue(0);
    mockP.documentGenere.count.mockImplementation((args?: { where?: Record<string, unknown> }) =>
      Promise.resolve(
        args?.where?.["type"] === "procedure_sous_traitance" && args?.where?.["annuleeAt"] === null
          ? 0
          : 3,
      ),
    );
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 27)?.statut).toBe("a_completer");
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

  // ── off.27 : la procédure écrite est une voie de SECOURS, pas un joker ─────
  //
  // 🔴 Trouvé le 2026-08-19. Le `||` posé le 2026-08-04 n'était conditionné par
  // rien : dès qu'une procédure existait au registre, l'indicateur passait au
  // vert quel que soit l'état des intervenants réellement mobilisés. Le
  // commentaire de la règle énonçait pourtant la doctrine inverse — un OF qui
  // sous-traite prouve par la vigilance exercée sur CHAQUE intervenant, un OF
  // qui ne sous-traite pas encore prouve par sa procédure. L'affichage savait
  // déjà distinguer les deux voies (la preuve « dispositions prouvées par la
  // procédure écrite » n'est rendue que si aucun sous-traitant n'est
  // référencé) ; la couverture, elle, ne le savait pas.
  //
  // Le scénario est celui d'un super-indicateur (NC majeure) affiché couvert
  // alors qu'aucun des cinq intervenants n'a de NDA, de vérification data.gouv
  // ni de contrat signé.
  it("🔴 off.27 : 5 sous-traitants référencés, 0 conformes + 1 procédure → a_completer", async () => {
    // Discriminé sur `nda` : c'est la clé propre à la requête « conformes ».
    // Discriminer sur la seule présence d'un `where` ne distinguerait plus rien
    // depuis que le dénominateur filtre lui aussi (`actif: true`).
    mockP.sousTraitant.count.mockImplementation((args?: { where?: Record<string, unknown> }) =>
      Promise.resolve(args?.where?.["nda"] !== undefined ? 0 : 5),
    );
    mockP.trainer.count.mockResolvedValue(0);
    mockP.documentGenere.count.mockImplementation((args?: { where?: Record<string, unknown> }) =>
      Promise.resolve(args?.where?.["type"] === "procedure_sous_traitance" ? 1 : 0),
    );
    const result = await evaluerConformite();
    const ind27 = result.indicateurs.find((i) => i.numero === 27);
    expect(ind27?.statut).toBe("a_completer");
    expect(ind27?.preuves.join(" ")).toMatch(/5 référencés au total/);
  });

  // ── off.27 : le dénominateur ne compte que les sous-traitants ACTIFS ───────
  //
  // 🔴 Trouvé le 2026-08-19. Le numérateur filtrait `actif: true`, le
  // dénominateur ne filtrait rien — alors que la ligne voisine
  // (`trainer.count({ actif: true })`) filtre correctement : un oubli, pas une
  // convention. Conséquence : archiver un sous-traitant faisait BAISSER le taux
  // de conformité d'un super-indicateur, et aucune action ne pouvait le
  // corriger. La garde porte sur les deux effets : le libellé montré au
  // propriétaire, et le ratio conformes/référencés qui décide la couverture.
  it("🔴 off.27 : un sous-traitant ARCHIVÉ ne compte plus au dénominateur", async () => {
    mockP.sousTraitant.count.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      if (args?.where?.["nda"] !== undefined) return Promise.resolve(1); // conforme et actif
      if (args?.where?.["actif"] !== undefined) return Promise.resolve(1); // actifs
      return Promise.resolve(2); // toutes lignes, inactif compris
    });
    mockP.trainer.count.mockResolvedValue(0);
    const result = await evaluerConformite();
    const ind27 = result.indicateurs.find((i) => i.numero === 27);
    expect(ind27?.preuves.join(" ")).toMatch(/1 référencé au total — 1 organisme/);
    expect(ind27?.statut).toBe("couvert");
  });

  // ── off.5 : la couverture doit LIRE les objectifs ──────────────────────────
  //
  // 🔴 Dernier des huit faux positifs de l'audit blanc du 2026-08-15. off.5
  // exige des objectifs pédagogiques définis ; la règle ne regardait que
  // `statutGeneration`, c'est-à-dire l'état d'avancement du moteur de
  // génération. `Formation.objectifsPedagogiques` n'était lu nulle part. Une
  // formation sortie de « intention » avec un tableau d'objectifs VIDE
  // déclarait l'indicateur couvert.
  it("🔴 off.5 : 3 formations hors intention, aucune ne porte d'objectif → a_completer", async () => {
    mockP.formation.count.mockResolvedValue(3);
    setupFormationsObjectifs([
      { objectifsPedagogiques: [] },
      { objectifsPedagogiques: [] },
      { objectifsPedagogiques: [] },
    ]);
    const result = await evaluerConformite();
    const ind5 = result.indicateurs.find((i) => i.numero === 5);
    expect(ind5?.statut).toBe("a_completer");
    expect(ind5?.preuves.join(" ")).toMatch(/0\/3/);
  });

  it("off.5 : couvert si CHAQUE formation active porte au moins un objectif", async () => {
    mockP.formation.count.mockResolvedValue(2);
    setupFormationsObjectifs([
      { objectifsPedagogiques: [{ id: "o1", verbe: "Identifier" }] },
      { objectifsPedagogiques: [{ id: "o2", verbe: "Construire" }] },
    ]);
    const result = await evaluerConformite();
    expect(result.indicateurs.find((i) => i.numero === 5)?.statut).toBe("couvert");
  });
});
