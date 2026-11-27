import { describe, expect, it } from "vitest";
import {
  COURONNE_MAX,
  HAUTEUR_CARTE,
  LARGEUR_CARTE,
  coordonneesDe,
  decalagesCouronne,
  estMetropole,
  positionSurCarte,
  projeter,
  type VilleConnue,
} from "..";

const VILLES: VilleConnue[] = [
  { nameFr: "Lyon", departement: "69", geo: { lat: 45.76, lon: 4.84 } },
  { nameFr: "Saint-Étienne", departement: "42", geo: { lat: 45.43, lon: 4.39 } },
  { nameFr: "Saint-Denis", departement: "93", geo: { lat: 48.93, lon: 2.36 } },
  { nameFr: "Saint-Denis", departement: "974", geo: { lat: -20.88, lon: 55.45 } },
];

describe("coordonneesDe", () => {
  it("ville connue, accents et casse indifférents", () => {
    expect(coordonneesDe({ ville: "saint-etienne", departement: "42" }, VILLES)).toEqual({
      lat: 45.43,
      lon: 4.39,
      precision: "ville",
    });
  });
  it("homonymes : le département tranche", () => {
    expect(coordonneesDe({ ville: "Saint-Denis", departement: "93" }, VILLES)?.lat).toBe(48.93);
    expect(coordonneesDe({ ville: "Saint-Denis", departement: "974" }, VILLES)?.lat).toBe(-20.88);
  });
  it("ville inconnue → chef-lieu du département", () => {
    const c = coordonneesDe({ ville: "Hameau perdu", departement: "69" }, VILLES);
    expect(c?.precision).toBe("departement");
    expect(c?.lat).toBeCloseTo(45.764, 2);
  });
  it("ville absente du département indiqué → chef-lieu, pas une homonyme ailleurs", () => {
    expect(coordonneesDe({ ville: "Lyon", departement: "75" }, VILLES)?.precision).toBe(
      "departement",
    );
  });
  it("ville seule sans département : trouvée dans la liste", () => {
    expect(coordonneesDe({ ville: "Lyon" }, VILLES)?.precision).toBe("ville");
  });
  it("codes : un chiffre, minuscules, Corse, outre-mer", () => {
    expect(coordonneesDe({ departement: "1" })?.lat).toBeCloseTo(46.2, 1);
    expect(coordonneesDe({ departement: "2a" })?.precision).toBe("departement");
    expect(coordonneesDe({ departement: "974" })?.lat).toBeLessThan(0);
  });
  it("département inconnu renseigné → null, pas d'homonyme au hasard", () => {
    expect(coordonneesDe({ ville: "Saint-Denis", departement: "99" }, VILLES)).toBeNull();
  });
  it("rien d'exploitable → null", () => {
    expect(coordonneesDe({})).toBeNull();
    expect(coordonneesDe({ ville: "Nulle part" })).toBeNull();
    expect(coordonneesDe({ departement: "20" })).toBeNull();
    expect(coordonneesDe({ departement: "99" })).toBeNull();
  });
});

describe("projeter", () => {
  const villes = {
    brest: projeter(48.39, -4.49)!,
    strasbourg: projeter(48.57, 7.75)!,
    perpignan: projeter(42.69, 2.89)!,
    nice: projeter(43.7, 7.26)!,
    lille: projeter(50.63, 3.06)!,
    ajaccio: projeter(41.92, 8.74)!,
  };

  it("tous les points sont dans le cadre", () => {
    for (const p of Object.values(villes)) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(LARGEUR_CARTE);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(HAUTEUR_CARTE);
    }
  });
  it("orientation : nord en haut, ouest à gauche", () => {
    expect(villes.lille.y).toBeLessThan(villes.strasbourg.y);
    expect(villes.strasbourg.y).toBeLessThan(villes.perpignan.y);
    expect(villes.nice.y).toBeLessThan(villes.ajaccio.y);
    expect(villes.brest.x).toBeLessThan(villes.perpignan.x);
    expect(villes.perpignan.x).toBeLessThan(villes.nice.x);
    expect(villes.brest.x).toBeLessThan(villes.strasbourg.x);
  });
  it("Ajaccio au sud-est de Nice, Corse dans le cadre", () => {
    expect(villes.ajaccio.y).toBeGreaterThan(villes.nice.y);
    expect(villes.ajaccio.x).toBeGreaterThan(villes.nice.x);
  });
  it("proportions plausibles de la France (cadre plus haut que large ou voisin)", () => {
    expect(HAUTEUR_CARTE).toBeGreaterThan(900);
    expect(HAUTEUR_CARTE).toBeLessThan(1200);
  });
  it("déterministe et arrondi au dixième", () => {
    const a = projeter(45.76, 4.84)!;
    expect(projeter(45.76, 4.84)).toEqual(a);
    expect(Math.round(a.x * 10)).toBeCloseTo(a.x * 10, 6);
  });
  it("hors métropole ou non fini → null", () => {
    expect(projeter(-20.88, 55.45)).toBeNull();
    expect(projeter(14.6, -61.07)).toBeNull();
    expect(projeter(Number.NaN, 2)).toBeNull();
    expect(projeter(48, Number.POSITIVE_INFINITY)).toBeNull();
  });
  it("estMetropole", () => {
    expect(estMetropole(48.85, 2.35)).toBe(true);
    expect(estMetropole(16, -61.7)).toBe(false);
  });
});

describe("positionSurCarte", () => {
  it("lieu → point ; outre-mer ou vide → null", () => {
    expect(positionSurCarte({ ville: "Lyon", departement: "69" }, VILLES)).not.toBeNull();
    expect(positionSurCarte({ departement: "974" })).toBeNull();
    expect(positionSurCarte({})).toBeNull();
  });
});

describe("decalagesCouronne", () => {
  it("1 → centre ; 2 à 6 → n points distincts, au rayon voulu", () => {
    expect(decalagesCouronne(1)).toEqual([{ x: 0, y: 0 }]);
    for (let n = 2; n <= COURONNE_MAX; n++) {
      const d = decalagesCouronne(n, 10)!;
      expect(d).toHaveLength(n);
      expect(new Set(d.map((p) => `${p.x},${p.y}`)).size).toBe(n);
      for (const p of d) expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 0);
    }
    expect(decalagesCouronne(2, 10)![0]).toEqual({ x: 0, y: -10 });
  });
  it("au-delà de la couronne ou valeur invalide → null (point « +N »)", () => {
    expect(decalagesCouronne(COURONNE_MAX + 1)).toBeNull();
    expect(decalagesCouronne(0)).toBeNull();
    expect(decalagesCouronne(1.5)).toBeNull();
  });
});
