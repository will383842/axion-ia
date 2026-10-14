/**
 * Étape 4 — la proposition chiffrée (F23, page F-8) annonce ce que le paiement
 * versera : seulement les journées du formateur (co-animation), et rien sans
 * conditions figées (tarif ET régime de TVA).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ mission: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { missionFormateur: { findUnique: (...a: unknown[]) => h.mission(...a) } },
}));

import { lirePropositionChiffree } from "../proposition-chiffree";

const MOI = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";

const jour = (date: string, trainerId: string | null) => ({
  date: new Date(`${date}T00:00:00Z`),
  heureDebut: "09:00",
  heureFin: "17:00",
  trainerId,
});

function mission(over: Record<string, unknown> = {}) {
  return {
    trainerId: MOI,
    tarifHtCents: 35_000,
    forfaitDeplacementParJourHtCents: null,
    regimeTvaFige: "franchise_293b",
    session: {
      titreSession: "IA pour managers",
      lieuType: "sur_site",
      modalite: "presentiel",
      lieuIntitule: null,
      lieuAdresse: "12 rue Exemple",
      lieuCodePostal: "69001",
      lieuVille: "Lyon",
      lieuSalle: null,
      lieuVisioUrl: null,
      sessionFormateurs: [{ trainerId: MOI }, { trainerId: AUTRE }],
      jours: [
        jour("2026-11-04", MOI),
        jour("2026-11-05", null),
        jour("2026-11-06", AUTRE),
        jour("2026-11-07", AUTRE),
      ],
    },
    ...over,
  };
}

beforeEach(() => h.mission.mockReset());

describe("lirePropositionChiffree — co-animation", () => {
  it("4 journées dont 2 à un autre : 2 × 35 000 = 70 000 c HT, deux lignes", async () => {
    h.mission.mockResolvedValue(mission());
    const p = await lirePropositionChiffree("m1");
    expect(p?.totalHtCents).toBe(70_000);
    expect(p?.lignesJours).toHaveLength(2);
    expect(p?.ligneHonoraires.replace(/\s/g, " ")).toBe("2 journées × 350 € HT = 700 € HT");
  });

  it("sans régime de TVA figé : aucun montant annoncé", async () => {
    h.mission.mockResolvedValue(mission({ regimeTvaFige: null }));
    expect(await lirePropositionChiffree("m1")).toBeNull();
  });

  it("sans tarif figé : aucun montant annoncé (jamais 350 € par défaut)", async () => {
    h.mission.mockResolvedValue(mission({ tarifHtCents: null }));
    expect(await lirePropositionChiffree("m1")).toBeNull();
  });
});
