/**
 * Tests — collectif-queries.ts.
 *
 * L'enjeu central est la POLITIQUE DE CHAMPS : dès que le formateur voit des
 * données de stagiaires tiers, tout champ sensible sélectionné par erreur devient
 * une fuite. Ces tests vérifient au niveau du `select` Prisma que les champs
 * interdits (email, handicapDetailsChiffre) ne sont JAMAIS demandés, et que le
 * filtre d'appartenance couvre bien les deux voies.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { listMyTrainingSessions, getTrainingSessionForFormateur } from "./collectif-queries";

const mockFindMany = (
  prisma as unknown as { trainingSession: { findMany: ReturnType<typeof vi.fn> } }
).trainingSession.findMany;
const mockFindFirst = (
  prisma as unknown as { trainingSession: { findFirst: ReturnType<typeof vi.fn> } }
).trainingSession.findFirst;

/** Aplati récursivement les clés d'un objet de `select`/`include` imbriqué. */
function collectSelectKeys(obj: unknown, acc: Set<string> = new Set()): Set<string> {
  if (obj === null || typeof obj !== "object") return acc;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    acc.add(k);
    if (v !== null && typeof v === "object") collectSelectKeys(v, acc);
  }
  return acc;
}

const TRAINER = "trainer-1";

describe("listMyTrainingSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filtre sur les DEUX voies d'affectation (FK principal OU SessionFormateur)", async () => {
    mockFindMany.mockResolvedValue([]);
    await listMyTrainingSessions(TRAINER);
    const arg = mockFindMany.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    expect(arg.where.OR).toEqual([
      { formateurPrincipalId: TRAINER },
      { sessionFormateurs: { some: { trainerId: TRAINER } } },
    ]);
  });

  it("dérive le rôle du formateur pour chaque session", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "s1",
        numero: "AXI-SESS-2026-1",
        titreSession: "IA pour RH",
        statut: "planifiee",
        modalite: "presentiel",
        dateDebut: new Date("2026-09-01"),
        dateFin: new Date("2026-09-02"),
        lieuVille: "Grenoble",
        formateurPrincipalId: TRAINER,
        sessionFormateurs: [],
        _count: { enrollments: 8 },
      },
    ]);
    const r = await listMyTrainingSessions(TRAINER);
    expect(r[0]?.role).toBe("principal");
    expect(r[0]?.nbInscrits).toBe(8);
  });
});

describe("getTrainingSessionForFormateur", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne null si la session n'appartient pas au formateur", async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await getTrainingSessionForFormateur("s1", TRAINER)).toBeNull();
  });

  it("🔴 ne sélectionne JAMAIS email ni handicapDetailsChiffre du stagiaire", async () => {
    mockFindFirst.mockResolvedValue(null);
    await getTrainingSessionForFormateur("s1", TRAINER);
    const arg = mockFindFirst.mock.calls[0]?.[0];
    const keys = collectSelectKeys(arg);
    // Ces deux champs sont des données personnelles/sensibles : leur présence
    // dans un select exposé au formateur serait une fuite RGPD.
    expect(keys.has("email")).toBe(false);
    expect(keys.has("handicapDetailsChiffre")).toBe(false);
    expect(keys.has("consentementEmail")).toBe(false);
    // En revanche le drapeau d'adaptation est bien demandé (ind. 10/26).
    expect(keys.has("situationHandicap")).toBe(true);
  });

  it("scoppe la requête par session ET appartenance formateur", async () => {
    mockFindFirst.mockResolvedValue(null);
    await getTrainingSessionForFormateur("s1", TRAINER);
    const arg = mockFindFirst.mock.calls[0]?.[0] as { where: { id: string; OR: unknown[] } };
    expect(arg.where.id).toBe("s1");
    expect(arg.where.OR).toBeDefined();
  });

  it("expose le droit de clôture dérivé du rôle (co-formateur = false)", async () => {
    mockFindFirst.mockResolvedValue({
      id: "s1",
      numero: "AXI-SESS-2026-1",
      titreSession: "IA pour RH",
      statut: "en_cours",
      modalite: "presentiel",
      dateDebut: new Date("2026-09-01"),
      dateFin: new Date("2026-09-02"),
      dureeReelleHeures: 14,
      lieuVille: "Grenoble",
      lieuCodePostal: "38000",
      formateurPrincipalId: "un-autre-formateur",
      sessionFormateurs: [{ role: "co_formateur" }],
      enrollments: [],
    });
    const r = await getTrainingSessionForFormateur("s1", TRAINER);
    expect(r?.role).toBe("co_formateur");
    expect(r?.peutCloturerEmargement).toBe(false);
  });
});
