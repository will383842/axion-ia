import { describe, expect, it } from "vitest";
import { htEtTtc } from "../montants";

const NB = "\u00a0"; // espace insécable

describe("htEtTtc", () => {
  it("1 200 € HT donne 1 440 € TTC (espaces insécables partout)", () => {
    expect(htEtTtc(120000)).toEqual({
      ht: `1${NB}200${NB}€${NB}HT`,
      ttc: `1${NB}440${NB}€${NB}TTC`,
    });
  });
  it("zéro", () => {
    expect(htEtTtc(0)).toEqual({ ht: `0${NB}€${NB}HT`, ttc: `0${NB}€${NB}TTC` });
  });
  it("centimes, TTC arrondi au centime", () => {
    expect(htEtTtc(1001)).toEqual({ ht: `10,01${NB}€${NB}HT`, ttc: `12,01${NB}€${NB}TTC` });
  });
  it("1050 donne « 10,50 » (deux décimales), jamais « 10,5 »", () => {
    expect(htEtTtc(1050)).toEqual({ ht: `10,50${NB}€${NB}HT`, ttc: `12,60${NB}€${NB}TTC` });
  });
  it("un avoir (montant négatif) garde son signe et ses deux décimales", () => {
    expect(htEtTtc(-1050)).toEqual({
      ht: `-10,50${NB}€${NB}HT`,
      ttc: `-12,60${NB}€${NB}TTC`,
    });
  });
});
