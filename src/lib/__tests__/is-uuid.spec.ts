import { describe, it, expect } from "vitest";
import { isUuid } from "../is-uuid";

describe("isUuid — un slug n'est pas un identifiant", () => {
  it("accepte un UUID v4 tel que Prisma les génère", () => {
    expect(isUuid("3cd2be4f-082f-42af-850b-be1a192c88f2")).toBe(true);
    expect(isUuid("3CD2BE4F-082F-42AF-850B-BE1A192C88F2")).toBe(true);
  });

  it("refuse ce que la console affichait comme « Adresse (URL) » — le cas du 2026-09-02", () => {
    expect(isUuid("kb-fact-roi-ia-050")).toBe(false);
  });

  it("refuse un identifiant tronqué, vide, ou d'un autre type", () => {
    expect(isUuid("3cd2be4f-082f-42af-850b")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid("3cd2be4f-082f-42af-850b-be1a192c88f2/apercu")).toBe(false);
  });
});
