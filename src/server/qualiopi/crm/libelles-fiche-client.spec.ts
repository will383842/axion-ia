import { afterEach, describe, expect, it, vi } from "vitest";

import { libelleSalutationEmails } from "./libelle-salutation";
import { libelleBlocBranche, titreOngletClient } from "./libelles-fiche-client";

afterEach(() => vi.unstubAllEnvs());

describe("libellés de la fiche client", () => {
  it("avant la certification : « Branche professionnelle » et « Clients — … » sans Qualiopi", () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false");
    expect(libelleBlocBranche()).toBe("Branche professionnelle");
    expect(titreOngletClient("Fiche client")).toBe("Clients — Fiche client | Axion-IA Admin");
  });

  it("certification obtenue : les libellés d'origine", () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    expect(libelleBlocBranche()).toBe("Branche et OPCO");
    expect(titreOngletClient("Fiche client")).toBe("Qualiopi — Fiche client | Axion-IA Admin");
  });
});

describe("libelleSalutationEmails", () => {
  it("montre le rendu des trois cas", () => {
    expect(
      libelleSalutationEmails({ contactCivilite: "madame", contactNomFamille: "Dupont" }),
    ).toBe("Bonjour Madame Dupont,");
    expect(libelleSalutationEmails({ contactPrenom: "Léa" })).toBe("Bonjour Léa,");
    expect(libelleSalutationEmails({})).toBe("Bonjour,");
  });
});
