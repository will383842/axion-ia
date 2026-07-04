import { describe, it, expect } from "vitest";
import { typeOrganisationFromNatureJuridique, isPublicOrganisation } from "./nature-juridique";

describe("typeOrganisationFromNatureJuridique", () => {
  it("sociétés commerciales (5xxx) → privée", () => {
    expect(typeOrganisationFromNatureJuridique("5710")).toBe("privee"); // SAS
    expect(typeOrganisationFromNatureJuridique("5499")).toBe("privee"); // SARL
  });
  it("entrepreneur individuel (1000) → privée", () => {
    expect(typeOrganisationFromNatureJuridique("1000")).toBe("privee");
  });
  it("collectivités territoriales (72xx) → collectivité", () => {
    expect(typeOrganisationFromNatureJuridique("7210")).toBe("collectivite"); // commune
  });
  it("administration d'État (71xx) → publique", () => {
    expect(typeOrganisationFromNatureJuridique("7150")).toBe("publique");
  });
  it("EPIC (41xx) → epic", () => {
    expect(typeOrganisationFromNatureJuridique("4110")).toBe("epic");
  });
  it("associations (92xx) → association", () => {
    expect(typeOrganisationFromNatureJuridique("9220")).toBe("association");
  });
  it("sécurité sociale (81xx) → parapublique", () => {
    expect(typeOrganisationFromNatureJuridique("8110")).toBe("parapublique");
  });
  it("repli privée sur code inconnu/vide", () => {
    expect(typeOrganisationFromNatureJuridique(null)).toBe("privee");
    expect(typeOrganisationFromNatureJuridique("")).toBe("privee");
    expect(typeOrganisationFromNatureJuridique("0")).toBe("privee");
    expect(typeOrganisationFromNatureJuridique("9999")).toBe("privee");
  });
});

describe("isPublicOrganisation", () => {
  it("classe correctement public vs privé", () => {
    expect(isPublicOrganisation("publique")).toBe(true);
    expect(isPublicOrganisation("collectivite")).toBe(true);
    expect(isPublicOrganisation("epic")).toBe(true);
    expect(isPublicOrganisation("parapublique")).toBe(true);
    expect(isPublicOrganisation("privee")).toBe(false);
    expect(isPublicOrganisation("association")).toBe(false);
  });
});
