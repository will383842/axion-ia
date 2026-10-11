/** Lot L15a — écriture du lieu d'exercice : arrondi, journal sans donnée, rattrapage. */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  communes: [] as Array<Record<string, unknown>>,
  fiches: [] as Array<Record<string, unknown>>,
  update: vi.fn(),
  logs: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    trainer: { update: (a: unknown) => d.update(a) },
    activityLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        d.logs.push(data);
        return data;
      },
    },
  };
  return {
    prisma: {
      communeGeo: { findMany: async () => d.communes },
      trainer: { findMany: async () => d.fiches },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

import { enregistrerLieuFormateur, rattraperLieuxFormateurs } from "../lieu-formateur-service";

const ID = "00000000-0000-4000-8000-0000000000aa";
const USER = "00000000-0000-4000-8000-0000000000bb";
const maintenant = new Date("2026-10-11T08:00:00Z");
const ANNECY = {
  codeInsee: "74010",
  nom: "Annecy",
  latitude: 45.90156,
  longitude: 6.125782,
  departement: "74",
  population: 130_000,
};

beforeEach(() => {
  d.communes = [ANNECY];
  d.fiches = [];
  d.update.mockReset();
  d.logs = [];
});

describe("enregistrerLieuFormateur", () => {
  it("écrit la commune et un centre arrondi à 2 décimales ; le journal ne porte ni code postal ni commune", async () => {
    expect(await enregistrerLieuFormateur(ID, "74 000", "Annecy", USER, maintenant)).toBe(
      "enregistre",
    );
    expect(d.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: {
        codePostalPro: "74000",
        communeInsee: "74010",
        geoLat: 45.9,
        geoLng: 6.13,
        geoCalculeAt: maintenant,
      },
    });
    expect(d.logs).toHaveLength(1);
    expect(d.logs[0]).toMatchObject({ targetId: ID, targetType: "Trainer", adminUserId: USER });
    const brut = JSON.stringify(d.logs[0]);
    expect(brut).not.toContain("74000");
    expect(brut).not.toContain("74010");
    expect(brut).not.toContain("Annecy");
  });

  it("code postal invalide : rien n'est écrit", async () => {
    expect(await enregistrerLieuFormateur(ID, "380", null, USER, maintenant)).toBe("code_invalide");
    expect(d.update).not.toHaveBeenCalled();
    expect(d.logs).toHaveLength(0);
  });

  it("commune introuvable : code postal gardé, coordonnées vides", async () => {
    d.communes = [];
    expect(await enregistrerLieuFormateur(ID, "74000", null, USER, maintenant)).toBe(
      "commune_inconnue",
    );
    expect(d.update.mock.calls[0]![0].data).toMatchObject({
      codePostalPro: "74000",
      communeInsee: null,
      geoLat: null,
    });
  });
});

describe("rattraperLieuxFormateurs", () => {
  it("code saisi d'abord, sinon celui de l'adresse ; sans code : rien d'écrit", async () => {
    d.fiches = [
      {
        id: "00000000-0000-4000-8000-00000000000a",
        codePostalPro: null,
        adresseProfessionnelle: "1 rue X, 74000 Annecy",
      },
      {
        id: "00000000-0000-4000-8000-00000000000b",
        codePostalPro: null,
        adresseProfessionnelle: "Annecy",
      },
      {
        id: "00000000-0000-4000-8000-00000000000c",
        codePostalPro: null,
        adresseProfessionnelle: null,
      },
    ];
    expect(await rattraperLieuxFormateurs(USER, maintenant)).toEqual({
      examinees: 3,
      trouvees: 1,
      sansCodePostal: 2,
      sansCommune: 0,
    });
    expect(d.update).toHaveBeenCalledTimes(1);
  });

  it("code déjà saisi dont la commune reste introuvable : aucune réécriture", async () => {
    d.communes = [];
    d.fiches = [
      {
        id: "00000000-0000-4000-8000-00000000000a",
        codePostalPro: "75999",
        adresseProfessionnelle: null,
      },
    ];
    expect(await rattraperLieuxFormateurs(USER, maintenant)).toMatchObject({
      sansCommune: 1,
      trouvees: 0,
    });
    expect(d.update).not.toHaveBeenCalled();
  });
});
