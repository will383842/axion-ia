/**
 * Tests — la REQUÊTE qui date l'émargement à l'écran (seconde revue A09, §7).
 *
 * La sous-page Émargement affiche la date de la première signature VIVANTE lue
 * au registre (`presence/provenance.ts`). Le test d'écran remplace
 * `getSessionEmargement` par un double : sans ce test, retirer le filtre des
 * signatures révoquées ou le tri par date ne rougirait nulle part — et une
 * signature révoquée plus ancienne fuirait dans la date affichée.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: vi.fn() },
    presenceCreneau: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getSessionEmargement } from "@/server/qualiopi/presence/queries";

const mockSession = prisma.trainingSession.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockCreneaux = prisma.presenceCreneau.findMany as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue({
    id: "ses-1",
    numero: "AXI-SESS-TEST",
    titreSession: "Session de test",
    dateDebut: new Date("2026-09-05T07:00:00Z"),
    dateFin: new Date("2026-09-05T16:00:00Z"),
    dureeReelleHeures: 7,
    modalite: "presentiel",
    statut: "realisee",
    formationId: "f-1",
    nbParticipantsPrevus: 1,
    nbParticipantsReels: 1,
    enrollments: [
      {
        id: "enr-1",
        traineeId: "t-1",
        statut: "presente",
        tauxPresencePct: 100,
        emargementSigneAt: null,
        trainee: { nom: "Test", prenom: "Alice", email: "a@exemple.test" },
      },
    ],
    jours: [],
  });
  mockCreneaux.mockResolvedValue([]);
});

/** Sous-requête des signatures portée par la lecture des créneaux. */
async function sousRequeteSignatures(): Promise<Record<string, unknown>> {
  const res = await getSessionEmargement("ses-1");
  expect(res, "la lecture a échoué (null) : la requête n'a pas été mesurée").not.toBeNull();
  const arg = mockCreneaux.mock.calls[0]?.[0] as {
    include?: { emargementSignatures?: Record<string, unknown> };
  };
  expect(arg?.include?.emargementSignatures).toBeDefined();
  return arg.include!.emargementSignatures!;
}

describe("getSessionEmargement — signatures lues pour dater l'émargement", () => {
  it("🔴 n'emporte QUE les signatures vivantes (révoquées exclues)", async () => {
    const q = await sousRequeteSignatures();
    expect(
      q["where"],
      "une signature révoquée peut dater l'émargement affiché, ou compter comme signature",
    ).toEqual({ revokedAt: null });
  });

  it("🔴 retient la PLUS ANCIENNE signature du créneau (tri ascendant, une ligne)", async () => {
    const q = await sousRequeteSignatures();
    expect(q["orderBy"], "sans tri, `take: 1` rend une signature arbitraire").toEqual({
      signeAt: "asc",
    });
    expect(q["take"]).toBe(1);
    expect(q["select"]).toEqual({ id: true, signeAt: true });
  });
});
