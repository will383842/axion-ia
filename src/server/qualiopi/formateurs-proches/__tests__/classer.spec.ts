/** Lot L15c — classement des formateurs proches (W6 D-W6-2, garde 18). */

import { describe, expect, it } from "vitest";

import { classerFormateursProches, type FormateurAClasser, type Point } from "../classer";

const REGIONS: Record<string, string> = {
  "01": "ara",
  "74": "ara",
  "69": "ara",
  "75": "idf",
  "971": "gp",
};
const regionDe = (d: string) => REGIONS[d] ?? null;

const BOURG: Point = { lat: 46.205, lon: 5.2255, departement: "01" };
const AMBERIEU: Point = { lat: 45.958, lon: 5.358, departement: "01" };
const LYON: Point = { lat: 45.764, lon: 4.8357, departement: "69" };
const ANNECY: Point = { lat: 45.8992, lon: 6.1294, departement: "74" };
const PARIS: Point = { lat: 48.8566, lon: 2.3522, departement: "75" };

const stats = (formationsRealisees = 0) => ({
  formationsRealisees,
  satisfaction: null,
  derniereFormation: null,
});
const f = (
  id: string,
  point: Point | null,
  extra: Partial<FormateurAClasser> = {},
): FormateurAClasser => ({
  id,
  nom: id,
  statut: "sous_traitant",
  point,
  commune: null,
  regionsIntervention: [],
  franceEntiere: false,
  stats: stats(),
  ...extra,
});

describe("classerFormateursProches", () => {
  const depart = { sorte: "lieu" as const, point: BOURG, libelle: "Bourg-en-Bresse (01)" };

  it("même département, puis même région (du plus proche au plus loin), puis ailleurs, puis lieu inconnu", () => {
    const groupes = classerFormateursProches(
      depart,
      [
        f("paris", PARIS),
        f("inconnu", null),
        f("annecy", ANNECY),
        f("lyon", LYON),
        f("amberieu", AMBERIEU),
      ],
      regionDe,
    );
    expect(groupes.map((g) => [g.cle, g.formateurs.map((x) => x.id)])).toEqual([
      ["meme_departement", ["amberieu"]],
      ["meme_region", ["lyon", "annecy"]],
      ["ailleurs", ["paris"]],
      ["lieu_inconnu", ["inconnu"]],
    ]);
    const lyon = groupes[1]!.formateurs[0]!;
    expect(lyon.distanceKm).toBe(Math.round(lyon.distanceKm!));
    expect(lyon.distanceKm).toBeGreaterThan(40);
    expect(lyon.distanceKm).toBeLessThan(70);
  });

  it("« se déplace partout » garde sa vraie distance ; « intervient dans la région » est marqué", () => {
    const groupes = classerFormateursProches(
      depart,
      [f("paris", PARIS, { franceEntiere: true, regionsIntervention: ["ara"] })],
      regionDe,
    );
    expect(groupes[0]).toMatchObject({ cle: "ailleurs" });
    expect(groupes[0]!.formateurs[0]).toMatchObject({
      franceEntiere: true,
      intervientDansLaRegion: true,
    });
    expect(groupes[0]!.formateurs[0]!.distanceKm).toBeGreaterThan(300);
  });

  it("outre-mer : les formateurs de métropole sont « ailleurs », sans erreur", () => {
    const pap = {
      sorte: "lieu" as const,
      point: { lat: 16.24, lon: -61.53, departement: "971" },
      libelle: "x",
    };
    const groupes = classerFormateursProches(pap, [f("lyon", LYON)], regionDe);
    expect(groupes.map((g) => g.cle)).toEqual(["ailleurs"]);
  });

  it("distanciel : un seul groupe, sans distance, trié par activité puis nom", () => {
    const groupes = classerFormateursProches(
      { sorte: "distanciel", libelle: "x" },
      [
        f("b", LYON, { stats: stats(1) }),
        f("a", null, { stats: stats(1) }),
        f("c", PARIS, { stats: stats(4) }),
      ],
      regionDe,
    );
    expect(groupes).toHaveLength(1);
    expect(groupes[0]!.cle).toBe("distanciel");
    expect(groupes[0]!.formateurs.map((x) => [x.id, x.distanceKm])).toEqual([
      ["c", null],
      ["a", null],
      ["b", null],
    ]);
  });

  it("aucun point de départ : un groupe « sans départ », jamais rangé comme distanciel", () => {
    const groupes = classerFormateursProches({ sorte: "inconnu" }, [f("a", LYON)], regionDe);
    expect(groupes.map((g) => g.cle)).toEqual(["sans_depart"]);
  });

  it("aucun formateur : aucun groupe", () => {
    expect(classerFormateursProches(depart, [], regionDe)).toEqual([]);
  });
});
