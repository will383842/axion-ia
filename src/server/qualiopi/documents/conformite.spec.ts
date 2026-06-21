/**
 * Tests — garde-fou de conformité identité OF (conformite.ts).
 *
 * Vérifie que la génération d'un document à valeur juridique/fiscale est
 * REFUSÉE si un identifiant obligatoire de l'OF est vide, et autorisée sinon.
 */

import { describe, it, expect } from "vitest";
import {
  assertOrganismeComplet,
  champsIdentiteManquants,
  exigeIdentiteComplete,
  OrganismeIncompletError,
} from "./conformite";
import type { OrganismeIdentite } from "./organisme";

const IDENTITE_COMPLETE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

const IDENTITE_VIDE: OrganismeIdentite = {
  raisonSociale: "",
  nda: "",
  qualiopi: "",
  siret: "",
  adresseSiege: "",
  adresseExercice: "",
  email: "",
  telephone: "",
  site: "",
};

describe("exigeIdentiteComplete", () => {
  it("vrai pour les documents juridiques/fiscaux", () => {
    expect(exigeIdentiteComplete("facture")).toBe(true);
    expect(exigeIdentiteComplete("convention")).toBe(true);
    expect(exigeIdentiteComplete("convention_tripartite")).toBe(true);
    expect(exigeIdentiteComplete("contrat")).toBe(true);
  });

  it("faux pour les documents internes / de suivi", () => {
    expect(exigeIdentiteComplete("attestation")).toBe(false);
    expect(exigeIdentiteComplete("emargement")).toBe(false);
    expect(exigeIdentiteComplete("satisfaction")).toBe(false);
    expect(exigeIdentiteComplete("kit_opco")).toBe(false);
  });
});

describe("champsIdentiteManquants", () => {
  it("identité complète → aucun manque", () => {
    expect(champsIdentiteManquants(IDENTITE_COMPLETE, "facture")).toEqual([]);
    expect(champsIdentiteManquants(IDENTITE_COMPLETE, "convention")).toEqual([]);
  });

  it("facture sans SIRET → SIRET manquant listé", () => {
    const sansSiret = { ...IDENTITE_COMPLETE, siret: "  " };
    const manquants = champsIdentiteManquants(sansSiret, "facture");
    expect(manquants).toContain("SIRET");
    expect(manquants).toHaveLength(1);
  });

  it("convention exige aussi le numéro Qualiopi", () => {
    const sansQualiopi = { ...IDENTITE_COMPLETE, qualiopi: "" };
    expect(champsIdentiteManquants(sansQualiopi, "convention")).toContain(
      "numéro de certification Qualiopi",
    );
    // La facture n'exige pas Qualiopi.
    expect(champsIdentiteManquants(sansQualiopi, "facture")).toEqual([]);
  });

  it("type non soumis au garde-fou → jamais de manque", () => {
    expect(champsIdentiteManquants(IDENTITE_VIDE, "attestation")).toEqual([]);
    expect(champsIdentiteManquants(IDENTITE_VIDE, "emargement")).toEqual([]);
  });
});

describe("assertOrganismeComplet", () => {
  it("identité complète → ne lève pas", () => {
    expect(() => assertOrganismeComplet(IDENTITE_COMPLETE, "facture")).not.toThrow();
    expect(() => assertOrganismeComplet(IDENTITE_COMPLETE, "convention")).not.toThrow();
  });

  it("identité vide → lève OrganismeIncompletError pour une facture", () => {
    expect(() => assertOrganismeComplet(IDENTITE_VIDE, "facture")).toThrow(
      OrganismeIncompletError,
    );
  });

  it("l'erreur porte le type et la liste des champs manquants", () => {
    try {
      assertOrganismeComplet(IDENTITE_VIDE, "convention");
      throw new Error("aurait dû lever");
    } catch (err) {
      expect(err).toBeInstanceOf(OrganismeIncompletError);
      const e = err as OrganismeIncompletError;
      expect(e.type).toBe("convention");
      expect(e.manquants).toEqual(
        expect.arrayContaining(["SIRET", "numéro de certification Qualiopi"]),
      );
      expect(e.message).toMatch(/refusée/i);
    }
  });

  it("identité vide mais type interne → ne lève pas", () => {
    expect(() => assertOrganismeComplet(IDENTITE_VIDE, "attestation")).not.toThrow();
  });
});
