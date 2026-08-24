/**
 * Gardes — `reportSessionAction` : ce qu'un report DOIT emporter.
 *
 * 🔴 Vérification du plan Qualiopi (2026-08-19, défaut B). Le report migrait
 * 2 données sur 4 : les stagiaires et le montant, mais NI le lieu de déroulement
 * (7 colonnes `lieu*`), NI le formateur (`formateurPrincipalId` / `coFormateurs`).
 * Ces champs n'étaient ni dans le `select` de la session source, ni dans le
 * `create` de la session de remplacement, et le schéma Zod ne les demandait pas
 * non plus en ressaisie.
 *
 * Conséquences mesurées :
 *   - la convention et la convocation de la session reportée sortaient SANS lieu
 *     de déroulement — mention exigée par L.6353-1, objet de l'indicateur 9 ;
 *   - l'alerte `session_sans_formateur` (qui interroge `formateurPrincipalId:
 *     null`) levait sur CHAQUE report.
 *
 * Aucun test n'existait pour cette action : les quatre données sont donc
 * assertées SÉPARÉMENT, plus le cas de doublon d'inscription (P2002).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks (hoistés)
// ─────────────────────────────────────────────────────────────────────────────

const mockSessionFindUnique = vi.fn();
const mockSessionCreate = vi.fn();
const mockSessionUpdate = vi.fn();
const mockSessionJourCreateMany = vi.fn();
const mockEnrollmentUpdate = vi.fn();
const mockSessionFormateurCreateMany = vi.fn();
const mockTrainerFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => {
  const tx = {
    trainingSession: {
      create: (...a: unknown[]) => mockSessionCreate(...a),
      update: (...a: unknown[]) => mockSessionUpdate(...a),
    },
    sessionJour: { createMany: (...a: unknown[]) => mockSessionJourCreateMany(...a) },
    enrollment: { update: (...a: unknown[]) => mockEnrollmentUpdate(...a) },
    sessionFormateur: { createMany: (...a: unknown[]) => mockSessionFormateurCreateMany(...a) },
  };
  return {
    prisma: {
      trainingSession: {
        findUnique: (...a: unknown[]) => mockSessionFindUnique(...a),
        create: (...a: unknown[]) => mockSessionCreate(...a),
        update: (...a: unknown[]) => mockSessionUpdate(...a),
      },
      trainer: { findUnique: (...a: unknown[]) => mockTrainerFindUnique(...a) },
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/formations/numbering", () => ({
  allocateSessionNumero: vi.fn().mockResolvedValue("AXI-SESS-2026-042"),
}));

vi.mock("@/server/qualiopi/formations/transition-helper", () => ({
  writeSessionTransition: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/emargement/token-service", () => ({
  revoquerTokensInscription: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// ─────────────────────────────────────────────────────────────────────────────
// Module sous test
// ─────────────────────────────────────────────────────────────────────────────

import { reportSessionAction } from "./sessions-recurrentes";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const NOUVELLE_ID = "11111111-2222-3333-4444-555555555555";
const TRAINER_ID = "99999999-8888-7777-6666-555555555555";
const FORMATION_ID = "ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb";

/** Les 7 colonnes de lieu, telles que le schéma les nomme. */
const LIEU = {
  lieuType: "sur_site",
  lieuIntitule: "Siège du client",
  lieuAdresse: "12 rue Berlioz",
  lieuCodePostal: "38000",
  lieuVille: "Grenoble",
  lieuSalle: "Salle Fraunces",
  lieuVisioUrl: null,
};

function makeAncienne(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    numero: "AXI-SESS-2026-003",
    statut: "planifiee",
    titreSession: "IA opérationnelle",
    formationId: FORMATION_ID,
    modalite: "presentiel",
    nbParticipantsPrevus: 8,
    montantHtCents: 150000,
    formationSnapshot: { titre: "IA opérationnelle" },
    clientId: null,
    financementType: null,
    sessionParentId: null,
    ...LIEU,
    formateurPrincipalId: TRAINER_ID,
    coFormateurs: [{ trainerId: TRAINER_ID, role: "principal" }],
    sessionFormateurs: [
      { trainerId: TRAINER_ID, role: "principal", heuresAnimees: 7, tarifHtCents: 50000 },
    ],
    formation: { dureeHeures: 14 },
    enrollments: [
      { id: "enr-1", traineeId: "trainee-1", statut: "inscrit" },
      { id: "enr-2", traineeId: "trainee-2", statut: "inscrit" },
    ],
    ...overrides,
  };
}

/** Formateur TOUJOURS habilité sur la formation de la session reportée. */
function makeTrainerHabilite(overrides: Record<string, unknown> = {}) {
  return {
    actif: true,
    statut: "salarie",
    sousTraitantVerifieAt: null,
    habilitations: [{ formationId: FORMATION_ID }],
    ...overrides,
  };
}

const INPUT = {
  sessionId: SESSION_ID,
  nouvelleDateDebut: new Date("2026-11-02T09:00:00.000Z"),
  nouvelleDateFin: new Date("2026-11-03T17:00:00.000Z"),
  motif: "Indisponibilité du client",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionFindUnique.mockResolvedValue(makeAncienne());
  mockSessionCreate.mockResolvedValue({ id: NOUVELLE_ID, numero: "AXI-SESS-2026-042" });
  mockSessionUpdate.mockResolvedValue({});
  mockSessionJourCreateMany.mockResolvedValue({ count: 2 });
  mockEnrollmentUpdate.mockResolvedValue({});
  mockSessionFormateurCreateMany.mockResolvedValue({ count: 1 });
  mockTrainerFindUnique.mockResolvedValue(makeTrainerHabilite());
});

/** Le `data` passé au `create` de la session de remplacement. */
function dataCreee(): Record<string, unknown> {
  return (mockSessionCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1/4 — les stagiaires (déjà migrés avant ce spec : garde de non-régression)
// ─────────────────────────────────────────────────────────────────────────────

describe("reportSessionAction — 1/4 stagiaires", () => {
  it("migre chaque inscription EN REMETTANT le déroulé à zéro", async () => {
    // 🔴 2026-08-24 — CE TEST ASSERTAIT LE BUG.
    //
    // Il exigeait `data: { sessionId }` **exactement** — c'est-à-dire qu'il
    // interdisait le correctif. Or transporter `convocationEnvoyeeAt` tel quel
    // était un BLOQUANT : le cron de convocation ne sélectionne que les
    // drapeaux nuls, donc aucune convocation ne partait aux nouvelles dates,
    // et l'écran « À traiter » affichait pourtant l'étape faite.
    //
    // C'est la seconde fois que ce dépôt trouve un test qui verrouille le
    // défaut qu'il prétend couvrir (cf. `COLONNES_SCELLEES` côté émargement).
    const attendu = {
      sessionId: NOUVELLE_ID,
      convocationEnvoyeeAt: null,
      emargementSigneAt: null,
      tauxPresencePct: null,
      attestationResultat: null,
      attestationDocumentId: null,
      attestationGenereeAt: null,
    };

    const r = await reportSessionAction(INPUT);

    expect(r).toHaveProperty("data");
    expect(mockEnrollmentUpdate).toHaveBeenCalledTimes(2);
    expect(mockEnrollmentUpdate).toHaveBeenCalledWith({
      where: { id: "enr-1" },
      data: attendu,
    });
    expect(mockEnrollmentUpdate).toHaveBeenCalledWith({
      where: { id: "enr-2" },
      data: attendu,
    });
  });

  it("P2002 sur une inscription : le report aboutit et l'inscription source reste en place", async () => {
    // @@unique [sessionId, traineeId] — le stagiaire était déjà inscrit à la
    // nouvelle session. L'inscription source peut porter une preuve (L12) :
    // elle n'est pas supprimée, et le report ne doit pas échouer pour autant.
    mockEnrollmentUpdate.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));

    const r = await reportSessionAction(INPUT);

    expect(r).toHaveProperty("data");
    expect(mockEnrollmentUpdate).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2/4 — le montant (déjà migré : garde de non-régression)
// ─────────────────────────────────────────────────────────────────────────────

describe("reportSessionAction — 2/4 montant", () => {
  it("reporte le montant vendu à l'identique", async () => {
    await reportSessionAction(INPUT);
    expect(dataCreee()["montantHtCents"]).toBe(150000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3/4 — le LIEU (off.9 + L.6353-1)
// ─────────────────────────────────────────────────────────────────────────────

describe("reportSessionAction — 3/4 lieu de déroulement", () => {
  it("lit les 7 colonnes de lieu sur la session source", async () => {
    await reportSessionAction(INPUT);
    const select = (mockSessionFindUnique.mock.calls[0]?.[0] as { select: Record<string, unknown> })
      .select;
    for (const colonne of Object.keys(LIEU)) {
      expect(select[colonne], `colonne ${colonne} absente du select`).toBe(true);
    }
  });

  it("recopie le lieu sur la session de remplacement", async () => {
    await reportSessionAction(INPUT);
    expect(dataCreee()).toMatchObject(LIEU);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4/4 — le FORMATEUR (alerte `session_sans_formateur`)
// ─────────────────────────────────────────────────────────────────────────────

describe("reportSessionAction — 4/4 formateur", () => {
  it("lit le formateur sur la session source", async () => {
    await reportSessionAction(INPUT);
    const select = (mockSessionFindUnique.mock.calls[0]?.[0] as { select: Record<string, unknown> })
      .select;
    expect(select["formateurPrincipalId"]).toBe(true);
    expect(select["coFormateurs"]).toBe(true);
  });

  it("reporte le formateur principal ENCORE habilité, et sa ligne SessionFormateur", async () => {
    await reportSessionAction(INPUT);

    expect(dataCreee()["formateurPrincipalId"]).toBe(TRAINER_ID);
    expect(mockSessionFormateurCreateMany).toHaveBeenCalledTimes(1);
    const rows = (
      mockSessionFormateurCreateMany.mock.calls[0]?.[0] as {
        data: Array<Record<string, unknown>>;
      }
    ).data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sessionId: NOUVELLE_ID,
      trainerId: TRAINER_ID,
      role: "principal",
      // Le tarif est un snapshot figé à l'affectation : il suit le formateur.
      tarifHtCents: 50000,
      // Les heures animées, elles, NE suivent PAS : la session reportée n'a pas
      // eu lieu. Les recopier facturerait deux fois la même journée.
      heuresAnimees: null,
    });
  });

  it("ne réinstalle PAS en silence un formateur dont l'habilitation a été retirée", async () => {
    // 🔴 Recopier `formateurPrincipalId` court-circuite la garde
    // `isTrainerHabilite`. Si l'habilitation a été retirée entre l'ancienne et la
    // nouvelle date, le report la réinstallerait sans qu'aucun écran ne l'ait
    // validée. On repasse donc par la garde ; à défaut, la session part sans
    // formateur et l'alerte `session_sans_formateur` fait son travail.
    mockTrainerFindUnique.mockResolvedValue(makeTrainerHabilite({ habilitations: [] }));

    const r = await reportSessionAction(INPUT);

    expect(r).toHaveProperty("data");
    expect(dataCreee()["formateurPrincipalId"]).toBeUndefined();
    // Le Json `coFormateurs` ne doit pas le réinstaller par la porte de derrière :
    // `resolvePrincipalTrainerId` y retomberait et les documents le nommeraient.
    expect(dataCreee()["coFormateurs"]).toEqual([]);
    expect(mockSessionFormateurCreateMany).not.toHaveBeenCalled();
  });
});
