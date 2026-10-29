import { describe, expect, it } from "vitest";
import { htEtTtc } from "../montants";

describe("htEtTtc", () => {
  it("1 200 € HT donne 1 440 € TTC (espaces insécables)", () => {
    expect(htEtTtc(120000)).toEqual({ ht: "1 200 € HT", ttc: "1 440 € TTC" });
  });
  it("zéro", () => {
    expect(htEtTtc(0)).toEqual({ ht: "0 € HT", ttc: "0 € TTC" });
  });
  it("centimes, TTC arrondi au centime", () => {
    expect(htEtTtc(1001)).toEqual({ ht: "10,01 € HT", ttc: "12,01 € TTC" });
  });
});
