/**
 * Tests — server actions Présence (T8).
 *
 * Stratégie :
 *   - Mock `@/lib/prisma` + `@/server/actions/qualiopi/_guards`
 *     (requireAdminWrite + logQualiopiActivity).
 *   - Mock les dépendances logique pure AGENT A.
 *   - Vérifie les flux principaux + cas d'erreur des 4 actions.
 *
 * Pas d'import de `next/headers` en test (mocké via _guards).
 */

import { describe, it, expect, vi, beforeEach, assert } from "vitest";

/** Accès sûr à un appel de mock (lève si absent). */
function mockCall<T>(fn: ReturnType<typeof vi.fn>, callIndex = 0): T {
  const call = fn.mock.calls[callIndex];
  assert(call !== undefined, `mockCall: aucun appel à l'index ${callIndex}`);
  return call[0] as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks déclarés AVANT tout import des modules testés
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: vi.fn(),
    },
    presenceCreneau: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    enrollment: {
      updateMany: vi.fn(),
    },
    releveConnexionImport: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-test-id" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/presence/creneaux", () => ({
  genererCreneaux: vi.fn(),
  // Garde-fou D14. Mocké à `false` par défaut — les sessions de test sont
  // courtes et contiguës — et repassé à `true` dans le cas qui le teste.
  sessionTropEtaleePourLeRepli: vi.fn(),
  ECART_MAX_REPLI_JOURS: 31,
}));

vi.mock("@/server/qualiopi/presence/parse-releve", () => ({
  parseReleveConnexion: vi.fn(),
}));

vi.mock("@/server/qualiopi/presence/match", () => ({
  matchParticipants: vi.fn(),
}));

vi.mock("@/server/qualiopi/presence/presence-service", () => ({
  upsertCreneau: vi.fn().mockResolvedValue("new-creneau-id"),
  recomputeTauxPresence: vi.fn().mockResolvedValue(85),
}));

vi.mock("@/server/qualiopi/indicateurs/service", () => ({
  // Le cache indicateurs dérive de tauxPresencePct : toute mutation de présence
  // doit l'invalider, sinon le taux de complétion reste faux jusqu'à 1 h.
  invalidateIndicateursCache: vi.fn(),
}));

vi.mock("@/server/qualiopi/documents/render", () => ({
  storeAndSignCsv: vi.fn().mockResolvedValue(null),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (après mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { genererCreneaux, sessionTropEtaleePourLeRepli } from "@/server/qualiopi/presence/creneaux";
import { parseReleveConnexion } from "@/server/qualiopi/presence/parse-releve";
import { matchParticipants } from "@/server/qualiopi/presence/match";
import { upsertCreneau, recomputeTauxPresence } from "@/server/qualiopi/presence/presence-service";
import { storeAndSignCsv } from "@/server/qualiopi/documents/render";
import { invalidateIndicateursCache } from "@/server/qualiopi/indicateurs/service";

import {
  generateSessionCreneauxAction,
  saveEmargementAction,
  importReleveConnexionAction,
  setPresenceCreneauManualAction,
} from "@/server/actions/qualiopi/presence";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as {
  trainingSession: { findUnique: ReturnType<typeof vi.fn> };
  presenceCreneau: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  enrollment: { updateMany: ReturnType<typeof vi.fn> };
  releveConnexionImport: { create: ReturnType<typeof vi.fn> };
};

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockGenererCreneaux = genererCreneaux as ReturnType<typeof vi.fn>;
const mockTropEtalee = sessionTropEtaleePourLeRepli as ReturnType<typeof vi.fn>;
const mockParseReleve = parseReleveConnexion as ReturnType<typeof vi.fn>;
const mockMatchParticipants = matchParticipants as ReturnType<typeof vi.fn>;
const mockUpsertCreneau = upsertCreneau as ReturnType<typeof vi.fn>;
const mockRecompute = recomputeTauxPresence as ReturnType<typeof vi.fn>;
const mockStoreAndSignCsv = storeAndSignCsv as ReturnType<typeof vi.fn>;
const mockInvalidateCache = invalidateIndicateursCache as ReturnType<typeof vi.fn>;

/** Session de base pour les tests */
function makeSession(overrides = {}) {
  return {
    id: "session-test-id",
    dateDebut: new Date("2026-06-10T08:00:00.000Z"),
    dateFin: new Date("2026-06-11T17:00:00.000Z"),
    dureeReelleHeures: 7,
    /// Journées déclarées (D14). Vide par défaut = session en repli sur la plage.
    jours: [],
    enrollments: [
      {
        id: "enroll-1",
        trainee: { email: "alice@example.com", nom: "Dupont", prenom: "Alice" },
      },
      {
        id: "enroll-2",
        trainee: { email: "bob@example.com", nom: "Martin", prenom: "Bob" },
      },
    ],
    ...overrides,
  };
}

/** Créneaux générés par genererCreneaux */
function makeCreneaux() {
  return [
    {
      date: "2026-06-10",
      demiJournee: "matin" as const,
      libelle: "2026-06-10 matin",
      dureePrevueMinutes: 210,
    },
    {
      date: "2026-06-10",
      demiJournee: "apres_midi" as const,
      libelle: "2026-06-10 après-midi",
      dureePrevueMinutes: 210,
    },
    {
      date: "2026-06-11",
      demiJournee: "matin" as const,
      libelle: "2026-06-11 matin",
      dureePrevueMinutes: 210,
    },
    {
      date: "2026-06-11",
      demiJournee: "apres_midi" as const,
      libelle: "2026-06-11 après-midi",
      dureePrevueMinutes: 210,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// generateSessionCreneauxAction
// ─────────────────────────────────────────────────────────────────────────────

describe("generateSessionCreneauxAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.trainingSession.findUnique.mockResolvedValue(makeSession());
    mockGenererCreneaux.mockReturnValue(makeCreneaux());
    // ⚠️ `clearAllMocks` efface les APPELS, pas les valeurs de retour : sans ce
    // repositionnement le mock renverrait `undefined` (falsy, donc « pas
    // étalée ») et le garde-fou passerait par accident plutôt que par choix.
    mockTropEtalee.mockReturnValue(false);
    // Par défaut : aucun créneau existant → tous créés
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(null);
    // ⚠️ `clearAllMocks` efface les appels, pas les valeurs de retour : sans ce
    // repositionnement, la détection des créneaux hors plan reçoit `undefined`.
    mockPrisma.presenceCreneau.findMany.mockResolvedValue([]);
    mockPrisma.presenceCreneau.update.mockResolvedValue({});
    mockUpsertCreneau.mockResolvedValue("new-id");
  });

  it("retourne { data: { created: N } } pour une session valide", async () => {
    const result = await generateSessionCreneauxAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    // 4 créneaux × 2 enrollments = 8 créneaux créés
    expect(result.data.created).toBe(8);
  });

  it("est idempotent : ne crée pas si le créneau existe déjà", async () => {
    // Tous les créneaux existent déjà
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue({ id: "existing-id" });

    const result = await generateSessionCreneauxAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.created).toBe(0);
    expect(mockUpsertCreneau).not.toHaveBeenCalled();
  });

  it("retourne { error } si la session n'existe pas", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);

    const result = await generateSessionCreneauxAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Session introuvable");
  });

  it("retourne { error } si sessionId n'est pas un UUID valide", async () => {
    const result = await generateSessionCreneauxAction({ sessionId: "pas-un-uuid" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si aucun créneau généré", async () => {
    mockGenererCreneaux.mockReturnValue([]);

    const result = await generateSessionCreneauxAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("créneau");
  });

  it("appelle logQualiopiActivity avec les bonnes données", async () => {
    await generateSessionCreneauxAction({ sessionId: "550e8400-e29b-41d4-a716-446655440000" });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string }>(mockLogActivity);
    expect(logCall.action).toBe("qualiopi.presence.creneaux.generate");
    expect(logCall.targetType).toBe("TrainingSession");
  });

  it("🔴 RÉCONCILIE la durée d'un créneau existant au lieu de l'ignorer", async () => {
    // L'action ne créait que les manquants : corriger les journées après coup ne
    // recalculait donc rien, et le dénominateur restait faux à vie.
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue({
      id: "cre-existant",
      dureePrevueMinutes: 999,
      libelle: "ancien libellé",
    });

    const r = await generateSessionCreneauxAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect("data" in r).toBe(true);
    if (!("data" in r)) return;
    expect(r.data.created).toBe(0);
    expect(r.data.reconcilies).toBeGreaterThan(0);
    const maj = mockPrisma.presenceCreneau.update.mock.calls[0]?.[0] as {
      data: { dureePrevueMinutes: number };
    };
    expect(maj.data.dureePrevueMinutes).toBe(210);
  });

  it("⚠️ la réconciliation ne touche NI `present` NI `dureeRealiseeMinutes`", async () => {
    // Ce sont les données de PREUVE. En base, une absence émargée et un créneau
    // vierge sont indiscernables : les écraser détruirait des feuilles signées.
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue({
      id: "cre-existant",
      dureePrevueMinutes: 999,
      libelle: "x",
    });

    await generateSessionCreneauxAction({ sessionId: "550e8400-e29b-41d4-a716-446655440000" });

    const maj = mockPrisma.presenceCreneau.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(maj.data).not.toHaveProperty("present");
    expect(maj.data).not.toHaveProperty("dureeRealiseeMinutes");
    expect(maj.data).not.toHaveProperty("source");
  });

  it("SIGNALE les créneaux hors plan sans jamais les supprimer", async () => {
    mockPrisma.presenceCreneau.findMany.mockResolvedValue([
      { date: new Date("2026-06-10T00:00:00.000Z"), demiJournee: "matin" },
      // Journée qui n'est plus au plan : elle gonfle le dénominateur.
      { date: new Date("2026-05-01T00:00:00.000Z"), demiJournee: "matin" },
    ]);

    const r = await generateSessionCreneauxAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect("data" in r).toBe(true);
    if (!("data" in r)) return;
    expect(r.data.horsPlan).toBe(1);
  });

  it("REFUSE une session étalée qui n'a déclaré aucune journée (garde-fou D14)", async () => {
    // Sans journées déclarées, générer les créneaux de tous les jours ouvrés
    // traversés multiplierait le dénominateur du taux — 66 jours au lieu de 4
    // sur un parcours de 3 mois, soit un taux à ≈ 3 %. Refuser bruyamment vaut
    // mieux que produire des dizaines de créneaux faux en silence.
    mockTropEtalee.mockReturnValue(true);

    const result = await generateSessionCreneauxAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("journées");
    // Rien n'a été écrit : c'est l'invariant qui compte, pas le message.
    expect(mockUpsertCreneau).not.toHaveBeenCalled();
    expect(mockGenererCreneaux).not.toHaveBeenCalled();
  });

  it("transmet les journées déclarées à genererCreneaux", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({
        jours: [
          { date: new Date("2026-06-10T00:00:00.000Z"), heureDebut: "09:00", heureFin: "17:00" },
          { date: new Date("2026-06-30T00:00:00.000Z"), heureDebut: "09:00", heureFin: "12:30" },
        ],
      }),
    );

    await generateSessionCreneauxAction({ sessionId: "550e8400-e29b-41d4-a716-446655440000" });

    expect(mockGenererCreneaux).toHaveBeenCalledWith(
      expect.objectContaining({
        jours: [
          { date: "2026-06-10", heureDebut: "09:00", heureFin: "17:00" },
          { date: "2026-06-30", heureDebut: "09:00", heureFin: "12:30" },
        ],
      }),
    );
  });

  it("n'envoie AUCUNE clé `jours` quand la session n'en déclare pas", async () => {
    // `exactOptionalPropertyTypes` est actif : passer `jours: undefined` ne
    // compile pas, et passer `jours: []` ferait croire à une déclaration vide.
    await generateSessionCreneauxAction({ sessionId: "550e8400-e29b-41d4-a716-446655440000" });

    const arg = mockCall<Record<string, unknown>>(mockGenererCreneaux);
    expect("jours" in arg).toBe(false);
  });

  it("passe heuresParJour optionnel à genererCreneaux", async () => {
    await generateSessionCreneauxAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      heuresParJour: 6,
    });

    expect(mockGenererCreneaux).toHaveBeenCalledWith(expect.objectContaining({ heuresParJour: 6 }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// saveEmargementAction
// ─────────────────────────────────────────────────────────────────────────────

describe("saveEmargementAction", () => {
  const validEntry = {
    enrollmentId: "550e8400-e29b-41d4-a716-446655440001",
    date: "2026-06-10",
    demiJournee: "matin" as const,
    present: true,
    dureeRealiseeMinutes: 180,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      id: "session-test-id",
      dateDebut: new Date("2026-06-10T08:00:00Z"),
    });
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue({
      id: "c1",
      dureePrevueMinutes: 210,
      enrollmentId: "enr-1",
      enrollment: { session: { dateDebut: new Date("2026-06-10T08:00:00Z") } },
    });
    mockUpsertCreneau.mockResolvedValue("upserted-id");
    mockRecompute.mockResolvedValue(85);
    mockPrisma.enrollment.updateMany.mockResolvedValue({ count: 1 });
  });

  it("retourne { data: { updated: N } } pour des entrées valides", async () => {
    const result = await saveEmargementAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      entries: [validEntry],
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.updated).toBe(1);
  });

  it("utilise dureePrevueMinutes si present=true et dureeRealiseeMinutes absent", async () => {
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue({
      id: "c1",
      dureePrevueMinutes: 210,
      enrollmentId: "enr-1",
      enrollment: { session: { dateDebut: new Date("2026-06-10T08:00:00Z") } },
    });

    const { dureeRealiseeMinutes: _omit, ...entryWithoutDuree } = validEntry;
    await saveEmargementAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      entries: [entryWithoutDuree],
    });

    // upsertCreneau doit recevoir dureeRealiseeMinutes=210 (dureePrevueMinutes)
    const upsertCall = mockCall<{ dureeRealiseeMinutes: number }>(mockUpsertCreneau);
    expect(upsertCall.dureeRealiseeMinutes).toBe(210);
  });

  it("recompute le taux pour chaque enrollment touché", async () => {
    const entries = [
      { ...validEntry, enrollmentId: "550e8400-e29b-41d4-a716-446655440001" },
      {
        ...validEntry,
        enrollmentId: "550e8400-e29b-41d4-a716-446655440002",
        demiJournee: "apres_midi" as const,
      },
    ];

    await saveEmargementAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      entries,
    });

    // 2 enrollments différents → 2 appels recompute
    expect(mockRecompute).toHaveBeenCalledTimes(2);
  });

  it("invalide le cache indicateurs UNE SEULE FOIS, sur l'année de la session", async () => {
    await saveEmargementAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      entries: [
        {
          enrollmentId: "550e8400-e29b-41d4-a716-446655440001",
          date: "2026-06-10",
          demiJournee: "matin",
          present: true,
        },
        {
          enrollmentId: "550e8400-e29b-41d4-a716-446655440002",
          date: "2026-06-10",
          demiJournee: "matin",
          present: true,
        },
      ],
    });
    // Sans invalidation, le taux de complétion resterait faux jusqu'à 1 h
    // (TTL Redis). Et un appel PAR enrollment déclencherait autant de
    // `redis.keys()`, bloquant O(N) sur un Redis partagé avec BullMQ.
    expect(mockInvalidateCache).toHaveBeenCalledTimes(1);
    expect(mockInvalidateCache).toHaveBeenCalledWith(2026);
  });

  it("pose emargementSigneAt write-once (updateMany conditionné sur null)", async () => {
    await saveEmargementAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      entries: [validEntry],
    });

    // 1re signature : le where cible uniquement les enrollments non encore signés.
    expect(mockPrisma.enrollment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: validEntry.enrollmentId,
          emargementSigneAt: null,
        }),
        data: expect.objectContaining({ emargementSigneAt: expect.any(Date) }),
      }),
    );
  });

  it("n'écrase pas la date sur ré-enregistrement (déjà signé → count:0)", async () => {
    // Simule un enrollment déjà signé : le where exclut la ligne → 0 mise à jour.
    mockPrisma.enrollment.updateMany.mockResolvedValue({ count: 0 });

    const result = await saveEmargementAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      entries: [validEntry],
    });

    // La sauvegarde réussit (présence corrigible) mais la garde null empêche
    // toute réécriture de la date de première signature.
    expect("data" in result).toBe(true);
    const call = mockCall<{ where: { emargementSigneAt: unknown } }>(
      mockPrisma.enrollment.updateMany,
    );
    expect(call.where.emargementSigneAt).toBeNull();
  });

  it("retourne { error } si la session n'existe pas", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);

    const result = await saveEmargementAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      entries: [validEntry],
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Session introuvable");
  });

  it("retourne { error } si entries vide (Zod min 1)", async () => {
    const result = await saveEmargementAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      entries: [],
    });

    expect("error" in result).toBe(true);
  });

  it("retourne { error } si date mal formée", async () => {
    const result = await saveEmargementAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      entries: [{ ...validEntry, date: "10/06/2026" }],
    });

    expect("error" in result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// importReleveConnexionAction
// ─────────────────────────────────────────────────────────────────────────────

describe("importReleveConnexionAction", () => {
  const CSV_CONTENT = `Name,User Email,Join Time,Leave Time,Duration (Minutes)\nAlice Dupont,alice@example.com,06/10/2026 09:00:00 AM,06/10/2026 05:00:00 PM,480`;

  const parsedReleve = {
    plateforme: "zoom" as const,
    idReunion: "123456789",
    participants: [
      {
        nomBrut: "Alice Dupont",
        email: "alice@example.com",
        joinAt: new Date("2026-06-10T07:00:00.000Z"),
        leaveAt: new Date("2026-06-10T15:00:00.000Z"),
        dureeMinutes: 480,
      },
    ],
    nbLignes: 1,
    meta: { titre: "Formation IA" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.trainingSession.findUnique.mockResolvedValue(makeSession());
    // ⚠️ `clearAllMocks` efface les APPELS, pas les valeurs de retour. Sans ce
    // repositionnement, le `true` posé par le test du garde-fou FUIT vers tous
    // les tests suivants du bloc, qui échouent alors pour une raison sans
    // rapport avec ce qu'ils vérifient.
    mockTropEtalee.mockReturnValue(false);
    mockParseReleve.mockReturnValue(parsedReleve);
    mockMatchParticipants.mockReturnValue({
      matched: [{ enrollmentId: "enroll-1", participant: parsedReleve.participants[0] }],
      unmatched: [],
    });
    mockStoreAndSignCsv.mockResolvedValue(null);
    mockPrisma.releveConnexionImport.create.mockResolvedValue({ id: "import-new-id" });
    mockUpsertCreneau.mockResolvedValue("creneau-new-id");
    mockRecompute.mockResolvedValue(90);
  });

  it("retourne { data } avec importId, nbMatched, nbUnmatched", async () => {
    const result = await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "participants.csv",
      content: CSV_CONTENT,
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.importId).toBe("import-new-id");
    expect(result.data.nbMatched).toBe(1);
    expect(result.data.nbUnmatched).toBe(0);
    expect(result.data.unmatched).toHaveLength(0);
  });

  it("rattache chaque relevé au JOUR de connexion réel (session multi-jours)", async () => {
    // Avant correctif : tous les créneaux étaient posés sur `dateDebut`, avec une
    // durée prévue égale à la durée TOTALE de la session. Sur une session de 2
    // jours, le second jour n'avait donc aucun créneau — présence injustifiable —
    // et le premier attendait 14 h. Le relevé porte l'heure de connexion : on
    // s'en sert.
    mockMatchParticipants.mockReturnValue({
      matched: [
        {
          enrollmentId: "enroll-1",
          participant: {
            nomBrut: "Alice Dupont",
            email: "alice@example.com",
            dureeMinutes: 400,
            joinAt: new Date("2026-06-10T08:05:00Z"),
            leaveAt: new Date("2026-06-10T15:00:00Z"),
          },
        },
        {
          enrollmentId: "enroll-2",
          participant: {
            nomBrut: "Bob Martin",
            email: "bob@example.com",
            dureeMinutes: 380,
            joinAt: new Date("2026-06-11T08:10:00Z"),
            leaveAt: new Date("2026-06-11T15:00:00Z"),
          },
        },
      ],
      unmatched: [],
    });

    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "participants.csv",
      content: CSV_CONTENT,
    });

    // 2 inscrits × 2 demi-journées : le distanciel pose désormais un créneau par
    // demi-journée, comme le présentiel. Une feuille signée une seule fois par
    // jour est précisément ce que CAA Nantes 14/06/2022 juge insuffisamment
    // probant.
    expect(mockUpsertCreneau).toHaveBeenCalledTimes(4);
    const dates = mockUpsertCreneau.mock.calls.map((c) =>
      (c[0] as { date: Date }).date.toISOString().slice(0, 10),
    );
    // Deux jours DISTINCTS : c'est l'assertion qui tombe si l'on repose tout sur dateDebut.
    expect(new Set(dates)).toEqual(new Set(["2026-06-10", "2026-06-11"]));

    // Durée prévue = celle de la DEMI-JOURNÉE, plus de la journée entière.
    const premier = mockCall<{ dureePrevueMinutes: number; demiJournee: string }>(
      mockUpsertCreneau,
    );
    expect(premier.dureePrevueMinutes).toBe(210);
    expect(premier.demiJournee).toBe("matin");

    // ⭐ L'invariant qui protège le taux : la somme des durées prévues d'un jour
    // vaut la journée entière, pas le double.
    const jour10 = mockUpsertCreneau.mock.calls
      .map((c) => c[0] as { date: Date; dureePrevueMinutes: number })
      .filter((a) => a.date.toISOString().startsWith("2026-06-10"));
    expect(jour10.reduce((s, a) => s + a.dureePrevueMinutes, 0)).toBe(420);
  });

  it("crée un ReleveConnexionImport avec les bons champs", async () => {
    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "participants.csv",
      content: CSV_CONTENT,
    });

    const createCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.releveConnexionImport.create,
    );
    expect(createCall.data["sessionId"]).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(createCall.data["plateforme"]).toBe("zoom");
    expect(createCall.data["fichierOriginalNom"]).toBe("participants.csv");
    expect(createCall.data["nbLignes"]).toBe(1);
    expect(createCall.data["nbMatched"]).toBe(1);
    expect(createCall.data["nbUnmatched"]).toBe(0);
    // hash SHA-256 doit être une string de 64 chars hex
    expect(createCall.data["hashSha256"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("archive le CSV dans R2 et stocke la clé si R2 configuré", async () => {
    const r2Key = "presence/2026/session-test-id/abc123-participants.csv";
    mockStoreAndSignCsv.mockResolvedValue(r2Key);

    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "participants.csv",
      content: CSV_CONTENT,
    });

    const createCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.releveConnexionImport.create,
    );
    expect(createCall.data["fichierOriginalPath"]).toBe(r2Key);
  });

  it("crée un créneau pour TOUS les inscrits actifs, absents compris", async () => {
    // Le mock ne matche qu'un seul des deux inscrits.
    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "participants.csv",
      content: CSV_CONTENT,
    });

    // ⚠️ INVARIANT CENTRAL : ne créer de créneau que pour les PRÉSENTS retirait
    // les absents du DÉNOMINATEUR du taux. Un stagiaire venu 1 jour sur 2
    // obtenait 100 % au lieu de 50 %, donc une attestation COMPLÈTE au lieu de
    // partielle. Surévaluer la présence est bien plus grave que la sous-évaluer.
    // 2 inscrits × 2 demi-journées (le distanciel est aligné sur le présentiel).
    expect(mockUpsertCreneau).toHaveBeenCalledTimes(4);

    const calls = mockUpsertCreneau.mock.calls.map(
      (c) => c[0] as { enrollmentId: string; dureeRealiseeMinutes: number; source: string },
    );
    const totalPar = (id: string) =>
      calls.filter((c) => c.enrollmentId === id).reduce((s, c) => s + c.dureeRealiseeMinutes, 0);
    const absent = calls.find((c) => c.enrollmentId === "enroll-2");

    expect(totalPar("enroll-1")).toBeGreaterThan(0);
    expect(totalPar("enroll-2")).toBe(0);
    // L'absent est bien présent au dénominateur, à zéro minute réalisée.
    expect(absent?.dureeRealiseeMinutes).toBe(0);

    const upsertCall = mockCall<{
      demiJournee: string;
      source: string;
      importId: string;
    }>(mockUpsertCreneau);
    // ⭐ Le grain distanciel est désormais celui du présentiel : matin /
    // après-midi, jamais une case « journée » unique.
    expect(upsertCall.demiJournee).toBe("matin");
    expect(
      mockUpsertCreneau.mock.calls.map((c) => (c[0] as { demiJournee: string }).demiJournee),
    ).not.toContain("journee");
    expect(upsertCall.source).toBe("import_zoom");
    expect(upsertCall.importId).toBe("import-new-id");
  });

  it("plafonne le réalisé au prévu — un relevé agrégé ne peut pas produire 200 %", async () => {
    // `parse-zoom` agrège un participant sur toute la plage du fichier : un export
    // couvrant 2 jours renvoie 840 min pour une journée de 420 prévues.
    mockMatchParticipants.mockReturnValue({
      matched: [
        {
          enrollmentId: "enroll-1",
          participant: {
            nomBrut: "Alice Dupont",
            email: "alice@example.com",
            dureeMinutes: 840,
            joinAt: new Date("2026-06-10T08:00:00Z"),
            leaveAt: new Date("2026-06-11T17:00:00Z"),
          },
        },
      ],
      unmatched: [],
    });

    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "participants.csv",
      content: CSV_CONTENT,
    });

    const call = mockCall<{ dureePrevueMinutes: number; dureeRealiseeMinutes: number }>(
      mockUpsertCreneau,
    );
    // Sans plafond, `computeTauxPresence` écrivait 200 % en base — champ non borné.
    expect(call.dureeRealiseeMinutes).toBeLessThanOrEqual(call.dureePrevueMinutes);
  });

  it("borne la date du créneau à la plage de la session", async () => {
    // Connexion de test la VEILLE (ou CSV d'une autre réunion, ou fuseau mal parsé).
    mockMatchParticipants.mockReturnValue({
      matched: [
        {
          enrollmentId: "enroll-1",
          participant: {
            nomBrut: "Alice Dupont",
            email: "alice@example.com",
            dureeMinutes: 120,
            joinAt: new Date("2026-06-01T22:00:00Z"),
            leaveAt: new Date("2026-06-01T23:00:00Z"),
          },
        },
      ],
      unmatched: [],
    });

    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "participants.csv",
      content: CSV_CONTENT,
    });

    // Un créneau hors session serait compté par `recomputeTauxPresence` (qui lit
    // TOUS les créneaux de l'inscription, sans filtre de date) et diluerait le
    // taux — sans qu'aucune UI ne permette de le supprimer.
    const dates = mockUpsertCreneau.mock.calls.map((c) =>
      (c[0] as { date: Date }).date.toISOString().slice(0, 10),
    );
    for (const d of dates) {
      expect(d >= "2026-06-10").toBe(true);
      expect(d <= "2026-06-11").toBe(true);
    }
  });

  it("recompute le taux pour chaque enrollment matché", async () => {
    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "participants.csv",
      content: CSV_CONTENT,
    });

    expect(mockRecompute).toHaveBeenCalledWith("enroll-1");
  });

  it("retourne les non-matchés dans unmatched", async () => {
    const unmatchedParticipant = {
      nomBrut: "Inconnu X",
      email: null,
      joinAt: null,
      leaveAt: null,
      dureeMinutes: 120,
    };
    mockMatchParticipants.mockReturnValue({
      matched: [],
      unmatched: [unmatchedParticipant],
    });

    const result = await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "teams",
      fileName: "rapport.csv",
      content: "Name\tEmail\nInconnu X\t",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.nbUnmatched).toBe(1);
    expect(result.data.unmatched[0]).toMatchObject({
      nom: "Inconnu X",
      email: null,
      dureeMinutes: 120,
    });
  });

  it("tolère R2 absent (storedPath = null)", async () => {
    mockStoreAndSignCsv.mockResolvedValue(null);

    const result = await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "meet",
      fileName: "meet-attendance.csv",
      content: "Name,Duration\nAlice,60",
    });

    expect("data" in result).toBe(true);
    // Pas de fichierOriginalPath dans le create
    const createCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.releveConnexionImport.create,
    );
    expect("fichierOriginalPath" in createCall.data).toBe(false);
  });

  it("retourne { error } si la session n'existe pas", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);

    const result = await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "test.csv",
      content: "data",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Session introuvable");
  });

  it("retourne { error } si content vide", async () => {
    const result = await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "test.csv",
      content: "",
    });

    expect("error" in result).toBe(true);
  });

  it("hash SHA-256 est déterministe pour le même contenu", async () => {
    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "first.csv",
      content: CSV_CONTENT,
    });
    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "second.csv",
      content: CSV_CONTENT,
    });

    const hash1 = mockCall<{ data: { hashSha256: string } }>(
      mockPrisma.releveConnexionImport.create,
      0,
    ).data.hashSha256;
    const hash2 = mockCall<{ data: { hashSha256: string } }>(
      mockPrisma.releveConnexionImport.create,
      1,
    ).data.hashSha256;
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("🔴 durée prévue = SOMME des créneaux de LA journée, pas `[0] × 2`", async () => {
    // Régression stricte trouvée en audit : 3 matinées déclarées 09:00–13:00
    // pour 12 h. Avant D14 le stagiaire assidu sortait à 100 % ; avec le `× 2`
    // il tombait à 50 % et perdait son attestation — PARCE QUE l'organisme
    // avait correctement saisi ses journées.
    mockGenererCreneaux.mockReturnValue([
      {
        date: "2026-06-10",
        demiJournee: "matin" as const,
        libelle: "2026-06-10 matin",
        dureePrevueMinutes: 240,
      },
    ]);

    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "releve.csv",
      content: CSV_CONTENT,
    });

    const premier = mockCall<{ dureePrevueMinutes: number }>(mockUpsertCreneau);
    // 240, pas 480 : la journée ne produit qu'UN créneau.
    expect(premier.dureePrevueMinutes).toBe(240);
  });

  it("prend la durée de la journée du RELEVÉ, pas celle du premier jour", async () => {
    // Le `[0]` désignait toujours le premier jour de la session, alors que le
    // créneau est daté sur l'heure de connexion réelle.
    mockGenererCreneaux.mockReturnValue([
      {
        date: "2026-06-09",
        demiJournee: "journee" as const,
        libelle: "2026-06-09",
        dureePrevueMinutes: 120,
      },
      {
        date: "2026-06-10",
        demiJournee: "matin" as const,
        libelle: "2026-06-10 matin",
        dureePrevueMinutes: 300,
      },
      {
        date: "2026-06-10",
        demiJournee: "apres_midi" as const,
        libelle: "2026-06-10 après-midi",
        dureePrevueMinutes: 180,
      },
    ]);

    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "releve.csv",
      content: CSV_CONTENT,
    });

    // Le participant se connecte le 2026-06-10 : ses deux demi-journées valent
    // 300 + 180 = 480 min au total, réparties sur DEUX créneaux — plus un seul
    // créneau « journée » de 480.
    const duJour = mockUpsertCreneau.mock.calls
      .map((c) => c[0] as { date: Date; dureePrevueMinutes: number })
      .filter((a) => a.date.toISOString().startsWith("2026-06-10"));
    expect(duJour).toHaveLength(4); // 2 inscrits × 2 demi-journées
    const parInscrit = duJour.reduce((s, a) => s + a.dureePrevueMinutes, 0) / 2;
    expect(parInscrit).toBe(480);
  });

  it("🔴 REFUSE l'import sur une session étalée sans journées déclarées", async () => {
    // Le garde-fou n'était appliqué qu'à la génération : un chemin refusait
    // bruyamment, l'autre écrivait en silence le même dénominateur faux.
    mockTropEtalee.mockReturnValue(true);

    const result = await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "releve.csv",
      content: CSV_CONTENT,
    });

    expect("error" in result).toBe(true);
    expect(mockUpsertCreneau).not.toHaveBeenCalled();
  });

  it("🔴 transmet les journées déclarées à genererCreneaux — sinon 100 % pour 0 h 26", async () => {
    // Bloquant trouvé en revue : ce second appel à `genererCreneaux` ignorait les
    // journées déclarées, alors que l'autre chemin les respectait. Sur une session
    // distancielle de 28 h dont les 4 journées sont réparties sur 3 mois, le repli
    // retenait 66 jours ouvrés → 0,42 h/jour → 26 MINUTES de durée prévue pour la
    // journée. Le réalisé étant plafonné au prévu, tout le monde ressortait à
    // 100 % avec 0 h 26 sur l'attestation. Surévaluer la présence est bien plus
    // grave que la sous-évaluer : c'est ce qu'un contrôle sanctionne.
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      makeSession({
        jours: [
          { date: new Date("2026-06-10T00:00:00.000Z"), heureDebut: "09:00", heureFin: "17:00" },
        ],
      }),
    );

    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "releve.csv",
      content: CSV_CONTENT,
    });

    expect(mockGenererCreneaux).toHaveBeenCalledWith(
      expect.objectContaining({
        jours: [{ date: "2026-06-10", heureDebut: "09:00", heureFin: "17:00" }],
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setPresenceCreneauManualAction
// ─────────────────────────────────────────────────────────────────────────────

describe("setPresenceCreneauManualAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440010",
      enrollmentId: "550e8400-e29b-41d4-a716-446655440001",
      // Remonté jusqu'à la session pour invalider le cache indicateurs de la
      // bonne année après correction manuelle d'un créneau.
      enrollment: { session: { dateDebut: new Date("2026-06-10T08:00:00Z") } },
    });
    mockPrisma.presenceCreneau.update.mockResolvedValue({});
    mockRecompute.mockResolvedValue(75);
  });

  it("retourne { data: { id } } pour un créneau valide", async () => {
    const result = await setPresenceCreneauManualAction({
      creneauId: "550e8400-e29b-41d4-a716-446655440010",
      present: true,
      dureeRealiseeMinutes: 180,
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe("550e8400-e29b-41d4-a716-446655440010");
  });

  it("met à jour le créneau avec source='manuel'", async () => {
    await setPresenceCreneauManualAction({
      creneauId: "550e8400-e29b-41d4-a716-446655440010",
      present: false,
      dureeRealiseeMinutes: 0,
      commentaire: "Absent non justifié",
    });

    expect(mockPrisma.presenceCreneau.update).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440010" },
      data: {
        present: false,
        dureeRealiseeMinutes: 0,
        source: "manuel",
        commentaire: "Absent non justifié",
      },
    });
  });

  it("ne passe pas commentaire si absent (exactOptionalPropertyTypes)", async () => {
    await setPresenceCreneauManualAction({
      creneauId: "550e8400-e29b-41d4-a716-446655440010",
      present: true,
      dureeRealiseeMinutes: 210,
      // commentaire absent
    });

    const updateCall = mockCall<{ data: Record<string, unknown> }>(
      mockPrisma.presenceCreneau.update,
    );
    expect("commentaire" in updateCall.data).toBe(false);
  });

  it("recompute le taux après mise à jour", async () => {
    await setPresenceCreneauManualAction({
      creneauId: "550e8400-e29b-41d4-a716-446655440010",
      present: true,
      dureeRealiseeMinutes: 210,
    });

    expect(mockRecompute).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440001");
  });

  it("retourne { error } si le créneau n'existe pas", async () => {
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(null);

    const result = await setPresenceCreneauManualAction({
      creneauId: "550e8400-e29b-41d4-a716-446655440010",
      present: true,
      dureeRealiseeMinutes: 0,
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Créneau introuvable");
  });

  it("retourne { error } si creneauId n'est pas un UUID", async () => {
    const result = await setPresenceCreneauManualAction({
      creneauId: "pas-un-uuid",
      present: true,
      dureeRealiseeMinutes: 0,
    });

    expect("error" in result).toBe(true);
  });

  it("retourne { error } si dureeRealiseeMinutes < 0", async () => {
    const result = await setPresenceCreneauManualAction({
      creneauId: "550e8400-e29b-41d4-a716-446655440010",
      present: false,
      dureeRealiseeMinutes: -1,
    });

    expect("error" in result).toBe(true);
  });

  it("logge l'activité avec la bonne action", async () => {
    await setPresenceCreneauManualAction({
      creneauId: "550e8400-e29b-41d4-a716-446655440010",
      present: true,
      dureeRealiseeMinutes: 180,
    });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.presence.creneau.manual");
    expect(logCall.targetType).toBe("PresenceCreneau");
    expect(logCall.targetId).toBe("550e8400-e29b-41d4-a716-446655440010");
  });
});
