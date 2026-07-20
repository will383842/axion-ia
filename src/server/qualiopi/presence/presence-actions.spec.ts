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
import { genererCreneaux } from "@/server/qualiopi/presence/creneaux";
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
  presenceCreneau: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  enrollment: { updateMany: ReturnType<typeof vi.fn> };
  releveConnexionImport: { create: ReturnType<typeof vi.fn> };
};

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockGenererCreneaux = genererCreneaux as ReturnType<typeof vi.fn>;
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
    // Par défaut : aucun créneau existant → tous créés
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(null);
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

    expect(mockUpsertCreneau).toHaveBeenCalledTimes(2);
    const dates = mockUpsertCreneau.mock.calls.map((c) =>
      (c[0] as { date: Date }).date.toISOString().slice(0, 10),
    );
    // Deux jours DISTINCTS : c'est l'assertion qui tombe si l'on repose tout sur dateDebut.
    expect(new Set(dates)).toEqual(new Set(["2026-06-10", "2026-06-11"]));

    // Durée prévue = UNE journée (2 demi-journées), pas la session entière.
    const premier = mockCall<{ dureePrevueMinutes: number }>(mockUpsertCreneau);
    expect(premier.dureePrevueMinutes).toBe(420);
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

  it("crée un créneau 'journee' pour chaque participant matché", async () => {
    await importReleveConnexionAction({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plateforme: "zoom",
      fileName: "participants.csv",
      content: CSV_CONTENT,
    });

    expect(mockUpsertCreneau).toHaveBeenCalledOnce();
    const upsertCall = mockCall<{
      demiJournee: string;
      source: string;
      dureeRealiseeMinutes: number;
      importId: string;
    }>(mockUpsertCreneau);
    expect(upsertCall.demiJournee).toBe("journee");
    expect(upsertCall.source).toBe("import_zoom");
    expect(upsertCall.dureeRealiseeMinutes).toBe(480);
    expect(upsertCall.importId).toBe("import-new-id");
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
