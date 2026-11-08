import { describe, expect, it } from "vitest";

import { selectionComplete, verifierDependances } from "./dependances";

const auto = (code: string, dependDe: string[] = [], facultative = true) => ({
  code,
  libelle: code,
  facultative,
  dependDe,
});

describe("verifierDependances", () => {
  it("accepte un graphe sans défaut", () => {
    expect(verifierDependances([auto("a"), auto("b", ["a"])])).toEqual({ ok: true });
  });
  it("refuse un code inconnu", () => {
    const r = verifierDependances([auto("a", ["zz"])]);
    expect(r).toMatchObject({ ok: false, motif: "code_inconnu" });
  });
  it("refuse l'auto-dépendance", () => {
    expect(verifierDependances([auto("a", ["a"])])).toMatchObject({
      ok: false,
      motif: "auto_dependance",
    });
  });
  it("refuse un cycle et renvoie son chemin", () => {
    const r = verifierDependances([auto("a", ["b"]), auto("b", ["c"]), auto("c", ["a"])]);
    expect(r).toMatchObject({ ok: false, motif: "cycle" });
    if (!r.ok) expect(r.chemin).toEqual(["a", "b", "c", "a"]);
  });
  it("refuse un code en double", () => {
    expect(verifierDependances([auto("a"), auto("a")])).toMatchObject({
      ok: false,
      motif: "code_double",
    });
  });
});

describe("selectionComplete", () => {
  const liste = [auto("a"), auto("b", ["a"]), auto("c", [], false)];
  it("refuse une sélection sans ses dépendances", () => {
    expect(selectionComplete(["b"], liste)).toMatchObject({ ok: false, manquantes: ["a"] });
  });
  it("retient toujours les non facultatives", () => {
    const r = selectionComplete(["a", "b"], liste);
    expect(r).toEqual({ ok: true, retenues: ["a", "b", "c"] });
  });
  it("refuse un code inconnu", () => {
    expect(selectionComplete(["x"], liste)).toMatchObject({ ok: false });
  });
});
