import { describe, expect, it } from "vitest";
import { estContresignable } from "./contresignables";

describe("estContresignable — ce que l'écran propose au lot", () => {
  it("convention signée par le client : il ne manque que l'organisme", () => {
    expect(estContresignable("convention", ["client"])).toBe(true);
  });
  it("tripartite sans le financeur : pas encore", () => {
    expect(estContresignable("convention_tripartite", ["client"])).toBe(false);
  });
  it("déjà contresignée, ou circuit sans l'organisme : jamais", () => {
    expect(estContresignable("convention", ["client", "axionia"])).toBe(false);
    expect(estContresignable("autorisation_captation", ["beneficiaire"])).toBe(false);
    expect(estContresignable("facture", [])).toBe(false);
  });
});
