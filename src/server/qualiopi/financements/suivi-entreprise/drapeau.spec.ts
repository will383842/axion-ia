import { describe, expect, it } from "vitest";
import { suiviEntrepriseActif } from "./drapeau";

describe("OPCO_SUIVI_ENTREPRISE_ENABLED", () => {
  it("actif par défaut en production, coupé par « false »", () => {
    expect(suiviEntrepriseActif({ NODE_ENV: "production" })).toBe(true);
    expect(
      suiviEntrepriseActif({ NODE_ENV: "production", OPCO_SUIVI_ENTREPRISE_ENABLED: "false" }),
    ).toBe(false);
  });

  it("🔴 coupé en test sauf ouverture explicite", () => {
    expect(suiviEntrepriseActif({ NODE_ENV: "test" })).toBe(false);
    expect(suiviEntrepriseActif({ NODE_ENV: "test", OPCO_SUIVI_ENTREPRISE_ENABLED: "true" })).toBe(
      true,
    );
    expect(suiviEntrepriseActif()).toBe(false);
  });
});
