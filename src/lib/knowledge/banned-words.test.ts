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
import {
  avertissementsCible,
  checkTranslationBannedWords,
  ficheDestineeAuPublic,
  verifierDoctrineTraduction,
} from "./banned-words";

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

describe("doctrine à l'entrée (audit knowledge 08/11/2026)", () => {
  it("laisse passer une fiche propre", () => {
    const r = verifierDoctrineTraduction({
      title: "Premiers pas avec l'IA",
      body: "Un dirigeant de PME peut démarrer par un usage simple.",
    });
    expect(r.valid).toBe(true);
  });

  it("bloque Qualiopi", () => {
    const r = verifierDoctrineTraduction({ body: "Notre organisme cite Qualiopi." });
    expect(r.valid).toBe(false);
    expect(r.fieldViolations[0]?.code).toBe("qualiopi");
  });

  it("bloque Grenoble", () => {
    const r = verifierDoctrineTraduction({ excerpt: "Notre siège à Grenoble" });
    expect(r.valid).toBe(false);
    expect(r.fieldViolations.map((v) => v.code)).toContain("grenoble");
  });

  it("ne bloque PAS la cible ETI (titres de sources réels) mais l'avertit", () => {
    const texte = "Baromètre Bpifrance Le Lab — Dirigeants de PME et ETI";
    expect(verifierDoctrineTraduction({ title: texte }).valid).toBe(true);
    expect(avertissementsCible({ title: texte }).map((v) => v.code)).toContain("eti-hors-cible");
  });

  it("ficheDestineeAuPublic : public/client + confidentialité publique seulement", () => {
    expect(ficheDestineeAuPublic({ audience: "public", confidentiality: "public" })).toBe(true);
    expect(ficheDestineeAuPublic({ audience: "client", confidentiality: "public" })).toBe(true);
    expect(ficheDestineeAuPublic({ audience: "team", confidentiality: "public" })).toBe(false);
    expect(ficheDestineeAuPublic({ audience: "public", confidentiality: "internal" })).toBe(false);
    expect(ficheDestineeAuPublic({ audience: "will_only", confidentiality: "secret" })).toBe(false);
  });

  it("ne confond pas ETI avec un mot qui la contient", () => {
    expect(
      verifierDoctrineTraduction({ body: "Une société étiquetée, la métier, le diététicien" })
        .valid,
    ).toBe(true);
  });

  it("une « Source : … » ne cache pas un interdit", () => {
    expect(
      verifierDoctrineTraduction({
        body: "<p>Nous aidons les PME. Source : notre siège est à Grenoble</p>",
      }).valid,
    ).toBe(false);
    expect(
      verifierDoctrineTraduction({
        body: "<p>Une PME.</p><p><em>Source : siège à Grenoble, cite Qualiopi</em></p>",
      }).valid,
    ).toBe(false);
  });

  it("donne la raison avec le champ", () => {
    const r = verifierDoctrineTraduction({ title: "Qualiopi" });
    expect(r.reason).toMatch(/title \[qualiopi\]/);
  });

  it("ignore l'étiquette « Source : … » du seed (HTML et texte), comme le fait le seed", () => {
    const r = verifierDoctrineTraduction({
      body: '<p>Une PME peut commencer simplement.</p><p><em>Source : <a href="https://x.fr">Axion-IA — Catalogue formations 2026</a></em></p>',
      bodyText: "Une PME peut commencer simplement. Source : Axion-IA — Catalogue formations 2026.",
    });
    expect(r.valid).toBe(true);
  });

  it("un bodyText vide ne masque pas le body", () => {
    const r = verifierDoctrineTraduction({ body: "<p>Voir Qualiopi</p>", bodyText: "" });
    expect(r.valid).toBe(false);
  });

  it("l'ancien contrôle (vidéo) reste sans effet", () => {
    expect(checkTranslationBannedWords({ body: "Voir Qualiopi à Grenoble" }).valid).toBe(true);
  });
});
