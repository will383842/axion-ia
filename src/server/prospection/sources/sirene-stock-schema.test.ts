import { describe, it, expect } from "vitest";
import {
  uniteLegaleRowSchema,
  etablissementRowSchema,
  mapUniteLegale,
  mapEtablissement,
  parseStatutDiffusion,
  parseEtatAdministratif,
  departementFromCodeCommune,
} from "./sirene-stock-schema";

describe("uniteLegaleRowSchema (Zod) — anti-changement de schéma", () => {
  it("parse une ligne valide", () => {
    const r = uniteLegaleRowSchema.safeParse({
      siren: "123456789",
      denominationUniteLegale: "ACME BTP",
      activitePrincipaleUniteLegale: "41.20A",
      statutDiffusionUniteLegale: "O",
    });
    expect(r.success).toBe(true);
  });
  it("échoue proprement si siren absent (colonne renommée)", () => {
    const r = uniteLegaleRowSchema.safeParse({ SIREN: "123456789" });
    expect(r.success).toBe(false);
  });
  it("échoue si siren mal formé (8 chiffres)", () => {
    expect(uniteLegaleRowSchema.safeParse({ siren: "12345678" }).success).toBe(false);
  });
});

describe("mapUniteLegale", () => {
  it("dérive secteur/taille/type/diffusion", () => {
    const row = uniteLegaleRowSchema.parse({
      siren: "123456789",
      denominationUniteLegale: "ACME BTP",
      activitePrincipaleUniteLegale: "41.20A",
      trancheEffectifsUniteLegale: "12", // 20-49 → PME
      categorieJuridiqueUniteLegale: "5710", // SAS → privée
      statutDiffusionUniteLegale: "O",
      etatAdministratifUniteLegale: "A",
    });
    const m = mapUniteLegale(row);
    expect(m.secteur).toBe("btp");
    expect(m.taille).toBe("PME");
    expect(m.typeOrganisation).toBe("privee");
    expect(m.statutDiffusion).toBe("diffusible");
    expect(m.etatAdministratif).toBe("actif");
    expect(m.sectionNaf).toBe("F");
  });
  it("statut non 'O' → non_diffusible (conservateur RGPD)", () => {
    expect(parseStatutDiffusion("P")).toBe("non_diffusible");
    expect(parseStatutDiffusion(undefined)).toBe("non_diffusible");
    expect(parseStatutDiffusion("O")).toBe("diffusible");
  });
  it("état cessé", () => {
    expect(parseEtatAdministratif("C")).toBe("cesse");
    expect(parseEtatAdministratif("A")).toBe("actif");
  });
});

describe("etablissementRowSchema + mapEtablissement", () => {
  it("échoue si siret absent", () => {
    expect(etablissementRowSchema.safeParse({ siren: "123456789" }).success).toBe(false);
  });
  it("dérive département/région depuis le code commune (Isère)", () => {
    const row = etablissementRowSchema.parse({
      siret: "12345678900012",
      siren: "123456789",
      etablissementSiege: "true",
      activitePrincipaleEtablissement: "41.20A",
      trancheEffectifsEtablissement: "12",
      codeCommuneEtablissement: "38185", // Grenoble
      codePostalEtablissement: "38000",
      libelleCommuneEtablissement: "GRENOBLE",
      statutDiffusionEtablissement: "O",
      etatAdministratifEtablissement: "A",
    });
    const m = mapEtablissement(row);
    expect(m.departement).toBe("38");
    expect(m.region).toBe("84"); // Auvergne-Rhône-Alpes
    expect(m.estSiege).toBe(true);
    expect(m.taille).toBe("PME");
    expect(m.secteur).toBe("btp");
  });
});

describe("departementFromCodeCommune", () => {
  it("métropole", () => {
    expect(departementFromCodeCommune("38185", null)).toBe("38");
  });
  it("Corse", () => {
    expect(departementFromCodeCommune("2A004", null)).toBe("2A");
  });
  it("DROM", () => {
    expect(departementFromCodeCommune("97411", null)).toBe("974");
  });
  it("repli code postal", () => {
    expect(departementFromCodeCommune(null, "75001")).toBe("75");
  });
  it("null si rien d'exploitable", () => {
    expect(departementFromCodeCommune(null, null)).toBeNull();
  });
});
