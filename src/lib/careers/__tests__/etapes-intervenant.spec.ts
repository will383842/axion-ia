import { describe, expect, it } from "vitest";

import {
  ETAPES_INTERVENANT,
  estOffreIntervenant,
  etapesIntervenant,
  phraseEtapesIntervenant,
} from "../etapes-intervenant";

describe("étapes d'une candidature d'intervenant (L14)", () => {
  it("annonce les sept vraies étapes, dans l'ordre", () => {
    expect(ETAPES_INTERVENANT.map((e) => e.id)).toEqual([
      "candidature",
      "entretien",
      "mise-en-situation",
      "pieces",
      "formation-methode",
      "observation",
      "evaluation",
    ]);
  });

  it("nomme les pièces vérifiées : SIRET, déclaration d'activité, CV de moins de 24 mois", () => {
    const pieces = ETAPES_INTERVENANT.find((e) => e.id === "pieces")!;
    expect(pieces.fr).toMatch(/SIRET/);
    expect(pieces.fr).toMatch(/déclaration d'activité/);
    expect(pieces.fr).toMatch(/CV de moins de 24 mois/);
  });

  it("dit que l'entretien et la mise en situation sont notés, et la formation obligatoire", () => {
    const fr = phraseEtapesIntervenant("fr");
    expect(fr).toMatch(/entretien, noté/i);
    expect(fr).toMatch(/mise en situation.*notée/i);
    expect(fr).toMatch(/formation obligatoire à la méthode Axion-IA/);
    expect(fr).toMatch(/évaluation après chaque mission/);
  });

  it("ne dit rien de l'état de la certification Qualiopi, sans jamais écrire « certifié »", () => {
    for (const langue of ["fr", "en"] as const) {
      expect(phraseEtapesIntervenant(langue)).not.toMatch(/Qualiopi|obtention|obtains/i);
      expect(JSON.stringify(ETAPES_INTERVENANT)).not.toMatch(/certifi[ée]s?\b(?! Qualiopi)/i);
      expect(phraseEtapesIntervenant(langue)).not.toMatch(/\bcertifi[ée]e?s?\b|\bcertified\b/i);
    }
  });

  it("ne promet ni doublon, ni équipe d'accompagnement, ni CV optionnel", () => {
    for (const langue of ["fr", "en"] as const) {
      expect(phraseEtapesIntervenant(langue)).not.toMatch(
        /doublon|shadow|accompagn|équipe|team|optionnel|optional/i,
      );
    }
  });

  it("une offre salariée ne se voit pas demander SIRET ni déclaration d'activité", () => {
    const fr = etapesIntervenant({ freelance: false })
      .map((e) => e.fr)
      .join(" ");
    expect(fr).not.toMatch(/SIRET|déclaration d'activité/);
    expect(fr).toMatch(/CV de moins de 24 mois/);
    expect(etapesIntervenant({ freelance: false })).toHaveLength(ETAPES_INTERVENANT.length);
  });

  it("reconnaît une offre d'intervenant par son intitulé ou son slug", () => {
    expect(estOffreIntervenant({ slug: "formateur-ia-freelance", titleFr: "Formateur IA" })).toBe(
      true,
    );
    expect(estOffreIntervenant({ slug: "x", titleFr: "Formatrice IA en entreprise" })).toBe(true);
    expect(estOffreIntervenant({ slug: "developpeur", titleFr: "Développeur" })).toBe(false);
    expect(estOffreIntervenant(null)).toBe(false);
  });
});
