import { describe, expect, it } from "vitest";
import {
  SEUIL_REUSSITE_DEFAUT_PCT,
  figerSeuilDansSnapshot,
  lireSeuilFige,
  resoudreSeuil,
  verdictReussite,
} from "./seuil-reussite";

describe("seuil de réussite unique", () => {
  it("vaut 70 % par défaut", () => {
    expect(SEUIL_REUSSITE_DEFAUT_PCT).toBe(70);
  });

  it("lit le seuil figé dans le snapshot de la session", () => {
    expect(lireSeuilFige({ v: 1, titre: "X", seuilReussitePct: 80 })).toBe(80);
  });

  it.each([
    null,
    undefined,
    {},
    { seuilReussitePct: "80" },
    { seuilReussitePct: 0 },
    { seuilReussitePct: 101 },
    { seuilReussitePct: 70.5 },
  ])("ignore un snapshot sans seuil exploitable (%j)", (snap) => {
    expect(lireSeuilFige(snap)).toBeNull();
  });

  it("fige le seuil à la création sans toucher au reste du snapshot", () => {
    const snap = { v: 1, titre: "Formation IA", dureeHeures: 14 };
    const fige = figerSeuilDansSnapshot(snap, 75);
    expect(fige).toEqual({ v: 1, titre: "Formation IA", dureeHeures: 14, seuilReussitePct: 75 });
    expect(snap).not.toHaveProperty("seuilReussitePct");
  });

  it("ne refige jamais un seuil déjà figé (pas de recalcul)", () => {
    const fige = figerSeuilDansSnapshot({ v: 1, titre: "X", seuilReussitePct: 70 }, 90);
    expect(lireSeuilFige(fige)).toBe(70);
  });

  it("la session fait foi sur le réglage courant", () => {
    expect(resoudreSeuil({ snapshot: { seuilReussitePct: 70 }, reglagePct: 90 })).toEqual({
      pct: 70,
      source: "session",
    });
  });

  it("session ancienne sans seuil figé : le réglage courant s'applique", () => {
    expect(resoudreSeuil({ snapshot: null, reglagePct: 65 })).toEqual({
      pct: 65,
      source: "reglage",
    });
  });

  it("réglage illisible : 70 %", () => {
    expect(resoudreSeuil({ snapshot: null, reglagePct: Number.NaN })).toEqual({
      pct: 70,
      source: "defaut",
    });
    expect(resoudreSeuil({ snapshot: null, reglagePct: 250 }).pct).toBe(70);
  });
});

describe("verdict de réussite", () => {
  const notes = (...n: Array<1 | 2 | 3 | undefined>) =>
    n.map((note, i) => ({ libelle: `Objectif ${i + 1}`, ...(note ? { note } : {}) }));

  it("règle éteinte : seul le score compte (comportement historique)", () => {
    const v = verdictReussite({
      scorePct: 78,
      competences: notes(3, 3, 3, 3, 1),
      seuilPct: 70,
      aucunNonAcquis: false,
    });
    expect(v).toEqual({ reussite: true, objectifsNonAcquis: [] });
  });

  it("règle active : un objectif non acquis fait échouer malgré un bon score", () => {
    const v = verdictReussite({
      scorePct: 78,
      competences: notes(3, 3, 3, 3, 1),
      seuilPct: 70,
      aucunNonAcquis: true,
    });
    expect(v.reussite).toBe(false);
    expect(v.objectifsNonAcquis).toEqual(["Objectif 5"]);
  });

  it("règle active : un objectif non noté n'est pas un non acquis", () => {
    const v = verdictReussite({
      scorePct: 100,
      competences: notes(3, 3, undefined),
      seuilPct: 70,
      aucunNonAcquis: true,
    });
    expect(v.reussite).toBe(true);
  });

  it("score sous le seuil : échec même sans objectif non acquis", () => {
    const v = verdictReussite({
      scorePct: 66,
      competences: notes(2, 2, 2),
      seuilPct: 70,
      aucunNonAcquis: true,
    });
    expect(v.reussite).toBe(false);
    expect(v.objectifsNonAcquis).toEqual([]);
  });

  it("le seuil est atteint à égalité", () => {
    expect(
      verdictReussite({ scorePct: 70, competences: notes(3), seuilPct: 70, aucunNonAcquis: true })
        .reussite,
    ).toBe(true);
  });
});
