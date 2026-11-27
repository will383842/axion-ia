import { describe, expect, it } from "vitest";
import { construireCourbeCtr, regressionIsotone } from "../courbe-ctr";
import type { LigneRequete } from "../types";

function l(requete: string, position: number, impressions: number, clics: number): LigneRequete {
  return {
    requete,
    url: "https://axion-ia.com/fr/blog/x",
    typePage: "article",
    position,
    impressions,
    clics,
    semainesPresentes: 4,
  };
}

describe("régression isotone", () => {
  it("rend une suite décroissante en fusionnant les violations", () => {
    const r = regressionIsotone([0.1, 0.2, 0.05], [1, 1, 1]);
    expect(r[0]).toBeGreaterThanOrEqual(r[1]!);
    expect(r[1]).toBeGreaterThanOrEqual(r[2]!);
    expect(r[0]).toBeCloseTo(0.15);
  });
});

describe("courbe CTR du site", () => {
  const base = [
    l("a", 1, 1000, 300),
    l("b", 3, 1000, 100),
    l("c", 6, 1000, 50),
    l("d", 12, 1000, 10),
  ];
  it("est en veille avec moins de 3 tranches valides", () => {
    expect(construireCourbeCtr([l("a", 1, 1000, 300), l("b", 3, 1000, 100)])).toBeNull();
  });
  it("exclut la marque", () => {
    const sansMarque = construireCourbeCtr(base)!;
    const avecMarque = construireCourbeCtr([...base, l("axion ia", 1, 9000, 8000)])!;
    expect(avecMarque.ctrAttendu(1)).toBeCloseTo(sansMarque.ctrAttendu(1));
  });
  it("est décroissante avec la position", () => {
    const c = construireCourbeCtr(base)!;
    expect(c.ctrAttendu(1)).toBeGreaterThan(c.ctrAttendu(6));
    expect(c.ctrAttendu(6)).toBeGreaterThan(c.ctrAttendu(15));
  });
  it("ignore les tranches trop pauvres", () => {
    expect(
      construireCourbeCtr([l("a", 1, 1000, 300), l("b", 3, 1000, 100), l("c", 6, 10, 5)]),
    ).toBeNull();
  });
});

describe("domaine de la courbe", () => {
  it("n'extrapole pas hors des tranches mesurées", () => {
    const c = construireCourbeCtr([
      l("a", 1, 1000, 300),
      l("b", 3, 1000, 100),
      l("c", 6, 1000, 50),
    ])!;
    expect(c.ctrAttendu(18)).toBe(0);
    expect(c.ctrAttendu(45)).toBe(0);
    expect(c.ctrAttendu(3)).toBeGreaterThan(0);
  });
  it("une ligne NaN n'empoisonne pas la courbe", () => {
    const c = construireCourbeCtr([
      l("a", 1, 1000, 300),
      l("b", 3, 1000, 100),
      l("c", 6, 1000, 50),
      l("d", 3, 1000, NaN),
    ])!;
    expect(Number.isFinite(c.ctrAttendu(3))).toBe(true);
  });
});
