// @vitest-environment node

/**
 * Relecture argent, 2e tour de #1501 — « forfait payé distanciel ».
 *
 * Règle du plan (08 §8, L11b) : « même département ou visio = 0 ». Le forfait
 * de déplacement n'existe que pour une session sur place. Une mission dont le
 * forfait a été figé hors département (80 € par journée), puis dont la session
 * passe à distance, ne doit l'avoir NI dans la proposition, NI dans la lettre,
 * NI dans le paiement : les trois lisent une seule règle, `sessionADistance`.
 *
 * Une session « à distance » : `lieuType = distanciel`, ou, pour une session
 * sans lieu renseigné (`lieuType` nul), `modalite = distanciel` — la règle que
 * les cartes de choix appliquaient déjà.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const m = {
    sessions: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    missions: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    signatures: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    revendications: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    mission: vi.fn(async (..._a: unknown[]) => null as unknown),
  };
  const prisma = {
    trainingSession: { findMany: (...a: unknown[]) => m.sessions(...a) },
    missionFormateur: {
      findMany: (...a: unknown[]) => m.missions(...a),
      findUnique: (...a: unknown[]) => m.mission(...a),
    },
    emargementContresignature: { findMany: (...a: unknown[]) => m.signatures(...a) },
    revendicationPaiement: { findMany: (...a: unknown[]) => m.revendications(...a) },
  };
  return { m, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));

import { sessionADistance } from "../choix-formateur";
import { lireCandidats } from "../paiement/passage-mission-base";
import { lirePropositionChiffree } from "../proposition-chiffree";

const SESSION = "a5a5a5a5-0000-4000-8000-00000000000a";
const TRAINER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOURS = [
  {
    date: new Date("2026-11-04T00:00:00Z"),
    heureDebut: "09:00",
    heureFin: "17:00",
    trainerId: null,
  },
  {
    date: new Date("2026-11-05T00:00:00Z"),
    heureDebut: "09:00",
    heureFin: "17:00",
    trainerId: null,
  },
];

describe("sessionADistance — la seule règle du lieu", () => {
  it("distanciel par le lieu, ou par la modalité quand le lieu n'est pas renseigné", () => {
    expect(sessionADistance({ lieuType: "distanciel", modalite: "presentiel" })).toBe(true);
    expect(sessionADistance({ lieuType: null, modalite: "distanciel" })).toBe(true);
    expect(sessionADistance({ lieuType: "sur_site", modalite: "distanciel" })).toBe(false);
    expect(sessionADistance({ lieuType: "nos_locaux", modalite: "presentiel" })).toBe(false);
    expect(sessionADistance({ lieuType: null, modalite: "hybride" })).toBe(false);
  });
});

describe("paiement par mission — forfait figé à 80 €, session passée à distance", () => {
  function preparer(lieu: { lieuType: string | null; modalite: string }) {
    h.m.sessions.mockResolvedValue([
      {
        id: SESSION,
        dateDebut: new Date("2026-11-04T08:00:00Z"),
        ...lieu,
        jours: JOURS,
        sessionFormateurs: [{ trainerId: TRAINER, role: "principal" }],
      },
    ]);
    h.m.signatures.mockResolvedValue([
      { sessionId: SESSION, trainerId: TRAINER, date: JOURS[0]!.date, demiJournee: "matin" },
    ]);
    h.m.missions.mockResolvedValue([
      {
        sessionId: SESSION,
        trainerId: TRAINER,
        tarifHtCents: 35_000,
        forfaitDeplacementParJourHtCents: 8_000,
        regimeTvaFige: "assujetti_20",
      },
    ]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    h.m.revendications.mockResolvedValue([]);
  });

  it("lieu à distance : aucun forfait payé (aucune ligne de déplacement)", async () => {
    preparer({ lieuType: "distanciel", modalite: "presentiel" });
    const [c] = await lireCandidats("2026-11-01");
    expect(c?.conditions).toEqual({
      tarifJourneeHtCents: 35_000,
      forfaitDeplacementParJourHtCents: null,
      regimeTva: "assujetti_20",
    });
  });

  it("lieu non renseigné, modalité à distance : aucun forfait payé", async () => {
    preparer({ lieuType: null, modalite: "distanciel" });
    const [c] = await lireCandidats("2026-11-01");
    expect(c?.conditions?.forfaitDeplacementParJourHtCents).toBeNull();
  });

  it("sur place : le forfait figé est payé, inchangé", async () => {
    preparer({ lieuType: "sur_site", modalite: "presentiel" });
    const [c] = await lireCandidats("2026-11-01");
    expect(c?.conditions?.forfaitDeplacementParJourHtCents).toBe(8_000);
  });

  it("la session est lue avec son lieu ET sa modalité", async () => {
    preparer({ lieuType: "sur_site", modalite: "presentiel" });
    await lireCandidats("2026-11-01");
    const arg = h.m.sessions.mock.calls[0]?.[0] as { select: Record<string, unknown> };
    expect(arg.select).toMatchObject({ lieuType: true, modalite: true });
  });
});

describe("proposition chiffrée — même règle que le paiement", () => {
  function mission(lieu: { lieuType: string | null; modalite: string }) {
    return {
      tarifHtCents: 35_000,
      forfaitDeplacementParJourHtCents: 8_000,
      session: {
        titreSession: "IA pour managers",
        ...lieu,
        lieuIntitule: null,
        lieuAdresse: null,
        lieuCodePostal: null,
        lieuVille: null,
        lieuSalle: null,
        lieuVisioUrl: null,
        jours: JOURS,
      },
    };
  }

  it("lieu non renseigné, modalité à distance : déplacement compris, 700 € HT", async () => {
    h.m.mission.mockResolvedValue(mission({ lieuType: null, modalite: "distanciel" }));
    const p = await lirePropositionChiffree("mi-1");
    expect(p?.forfaitParJourHtCents).toBeNull();
    expect(p?.totalHtCents).toBe(70_000);
  });

  it("sur place : 700 + 2 × 80 = 860 € HT", async () => {
    h.m.mission.mockResolvedValue(mission({ lieuType: "sur_site", modalite: "presentiel" }));
    const p = await lirePropositionChiffree("mi-1");
    expect(p?.forfaitParJourHtCents).toBe(8_000);
    expect(p?.totalHtCents).toBe(86_000);
  });
});
