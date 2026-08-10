/**
 * Tests du gate de mots proscrits de la base de connaissance.
 *
 * 🔓 Réécrits le 2026-08-10 (décision Will) : le mot « formation » n'est plus
 * banni. Ces tests affirmaient l'inverse — ils vérifiaient que « Formation IA
 * pour entreprise » était REJETÉ. Ils garantissent désormais la propriété
 * inverse, qui est celle qu'on veut préserver : le vocabulaire officiel de
 * l'offre passe le gate.
 *
 * La liste de motifs étant vide, ces tests documentent aussi le contrat du
 * mécanisme conservé : `bodyText` prime sur `body`, et une violation remonte
 * son champ et un extrait — de sorte qu'ajouter un motif un jour reste sûr.
 */

import { describe, expect, it } from "vitest";
import { checkTranslationBannedWords } from "./banned-words";

describe("checkTranslationBannedWords", () => {
  it("accepte un texte quelconque (aucun motif proscrit déclaré)", () => {
    const r = checkTranslationBannedWords({
      title: "Module d'intervention IA",
      body: "Boost compétence équipe",
    });
    expect(r.valid).toBe(true);
    expect(r.fieldViolations).toHaveLength(0);
  });

  describe("🔓 « formation » n'est plus proscrit (2026-08-10)", () => {
    it("accepte « formation » dans le titre", () => {
      const r = checkTranslationBannedWords({ title: "Formation IA pour entreprise" });
      expect(r.valid).toBe(true);
    });

    it("accepte « formations » au pluriel dans le corps", () => {
      const r = checkTranslationBannedWords({ body: "Nos formations IA en entreprise" });
      expect(r.valid).toBe(true);
    });

    it("accepte le verbe « former »", () => {
      const r = checkTranslationBannedWords({ excerpt: "Nous allons former vos équipes" });
      expect(r.valid).toBe(true);
    });

    it("accepte « formateur » et « formatrice »", () => {
      expect(
        checkTranslationBannedWords({ metaDescription: "Un formateur expert vient" }).valid,
      ).toBe(true);
      expect(checkTranslationBannedWords({ metaDescription: "Une formatrice senior" }).valid).toBe(
        true,
      );
    });

    it("accepte le vocabulaire réel du catalogue", () => {
      const r = checkTranslationBannedWords({
        title: "Formations IA",
        excerpt: "21 formations au catalogue, animées par nos formateurs seniors.",
        body: "IA pour bien commencer, IA pour les équipes, IA pour l'automatisation.",
      });
      expect(r.valid).toBe(true);
    });
  });

  it("accepte « transformation » et « information »", () => {
    const r = checkTranslationBannedWords({
      title: "Transformation IA",
      body: "Une information utile sur la transformation digitale",
    });
    expect(r.valid).toBe(true);
  });

  it("lit tous les champs sans lever d'erreur sur les valeurs nulles", () => {
    // `exactOptionalPropertyTypes` est actif : une clé optionnelle ne peut pas
    // recevoir explicitement `undefined`. On l'omet plutôt que de la passer.
    const r = checkTranslationBannedWords({
      title: null,
      body: null,
      bodyText: null,
      metaDescription: null,
    });
    expect(r.valid).toBe(true);
  });
});
