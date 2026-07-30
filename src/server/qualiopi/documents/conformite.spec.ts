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

  // 🔴 2026-07-28. L'art. L.6351-1 laisse TROIS MOIS après la première
  // convention pour déposer la déclaration d'activité : au moment d'émettre
  // cette convention et la facture qui la suit, l'organisme n'a pas encore de
  // NDA — c'est elle qui ouvre le délai. Et le NDA n'est pas une mention
  // obligatoire de facture (R123-238 C. com. + 242 nonies A ann. II CGI ;
  // L.6352-4 vise les documents contractuels et publicitaires).
  //
  // Même impasse que celle qui avait fait retirer `qualiopi` trois jours plus
  // tôt : on ne peut pas exiger un numéro qui n'existe qu'après l'acte qu'il
  // conditionne.
  it("🔴 la facture n'exige PAS le NDA — 3 mois pour déclarer l'activité", () => {
    const sansNda = { ...IDENTITE_COMPLETE, nda: "" };
    expect(champsIdentiteManquants(sansNda, "facture")).toEqual([]);
  });

  it("le SIRET, lui, reste bloquant sur la facture (mention obligatoire R123-238)", () => {
    const sansSiretNiNda = { ...IDENTITE_COMPLETE, siret: "", nda: "" };
    const manquants = champsIdentiteManquants(sansSiretNiNda, "facture");
    expect(manquants).toEqual(["SIRET"]);
  });

  it("🔴 le NDA n'est PLUS exigé nulle part — la première convention OUVRE le délai", () => {
    // Changement du 2026-07-29. L'art. L.6351-1 fait courir le délai de
    // déclaration « dans les trois mois suivant la conclusion de la PREMIÈRE
    // convention de formation ». C'est donc cette convention qui ouvre le
    // délai : au moment de l'émettre, l'organisme n'a légalement pas de numéro.
    // L'exiger revenait à demander le résultat avant la cause — la même impasse
    // circulaire qui avait déjà fait retirer Qualiopi de ces listes.
    //
    // ⚠️ L'obligation de L.6352-4 n'est pas niée : elle devient exigible une
    // fois le numéro obtenu, et le pied de page l'imprime dès qu'il existe.
    // Ce qui change, c'est que son absence ne déclasse plus la pièce en
    // SPÉCIMEN au moment précis où on la présente à un certificateur.
    const sansNda = { ...IDENTITE_COMPLETE, nda: "" };
    for (const type of ["convention", "convention_tripartite", "contrat", "facture"] as const) {
      expect(champsIdentiteManquants(sansNda, type)).toEqual([]);
    }
  });

  it("🔴 un organisme SANS NDA ni Qualiopi produit des pièces NON déclassées", () => {
    // C'est la situation réelle d'Axion-IA au moment de l'audit initial, et le
    // scénario que ce garde-fou doit servir plutôt que saboter : ni NDA, ni
    // numéro de certification, mais une identité légale complète.
    const avantCertification = { ...IDENTITE_COMPLETE, nda: "", qualiopi: "" };
    for (const type of ["convention", "convention_tripartite", "contrat", "facture"] as const) {
      expect(champsIdentiteManquants(avantCertification, type)).toEqual([]);
    }
  });

  it("🔴 le numéro Qualiopi n'est JAMAIS exigé — ni convention, ni contrat, ni facture", () => {
    // Audit certification 2026-07-25 : l'exiger créait une impasse. L'arrêté du
    // 6 juin 2019 impose d'avoir réalisé une action pour déclencher l'audit
    // initial ; cette action suppose une convention ; la convention était
    // refusée faute d'un numéro qui n'existe qu'APRÈS la certification.
    // Qualiopi conditionne le financement mutualisé, pas la validité de la
    // convention (art. L.6353-1/-2 C. trav. en régissent le contenu).
    const sansQualiopi = { ...IDENTITE_COMPLETE, qualiopi: "" };
    for (const type of ["convention", "convention_tripartite", "contrat", "facture"] as const) {
      expect(champsIdentiteManquants(sansQualiopi, type)).toEqual([]);
    }
  });

  it("convention exige l'identité légale de l'OF (raison sociale, SIRET, adresse)", () => {
    const manquants = champsIdentiteManquants(IDENTITE_VIDE, "convention");
    expect(manquants).toEqual(
      expect.arrayContaining(["raison sociale", "SIRET", "adresse du siège"]),
    );
    // Ni Qualiopi ni NDA : le premier n'existe qu'APRÈS la certification, le
    // second qu'après la première convention. Les exiger ici serait circulaire.
    expect(manquants).not.toContain("numéro de certification Qualiopi");
    expect(manquants).not.toContain("numéro de déclaration d'activité (NDA)");
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
    expect(() => assertOrganismeComplet(IDENTITE_VIDE, "facture")).toThrow(OrganismeIncompletError);
  });

  it("l'erreur porte le type et la liste des champs manquants", () => {
    try {
      assertOrganismeComplet(IDENTITE_VIDE, "convention");
      throw new Error("aurait dû lever");
    } catch (err) {
      expect(err).toBeInstanceOf(OrganismeIncompletError);
      const e = err as OrganismeIncompletError;
      expect(e.type).toBe("convention");
      expect(e.manquants).toEqual(expect.arrayContaining(["SIRET", "raison sociale"]));
      expect(e.message).toMatch(/refusée/i);
    }
  });

  it("identité vide mais type interne → ne lève pas", () => {
    expect(() => assertOrganismeComplet(IDENTITE_VIDE, "attestation")).not.toThrow();
  });
});
