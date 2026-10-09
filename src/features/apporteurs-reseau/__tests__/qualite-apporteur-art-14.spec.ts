import { describe, expect, it } from "vitest";

// Contrat 2.7, art. 14 : la qualité de l'Apporteur reprend, quand le dossier les donne, le siège
// et la fonction du signataire d'une société, et l'immatriculation au RCS d'un entrepreneur
// individuel. Sans ces champs (dossiers d'avant), la formule générale est gardée.

import { texteDuContrat } from "../contrat-pdf";
import { valeursDuContrat } from "../signature-regles";

const LE = new Date("2026-10-09T10:00:00Z");
const base = {
  prenom: "Jeanne",
  nom: "Martin",
  siren: "123456789",
  siret: "12345678900012",
  adresse: "4 rue de l'Établissement, 38000 Grenoble",
};

describe("qualité de l'art. 14", () => {
  it("société : dénomination, siège, représentant et sa fonction", () => {
    const v = valeursDuContrat(
      {
        ...base,
        statutJuridique: "sas",
        denomination: "ALPES CONSEIL",
        siegeAdresse: "3 place Grenette, 38000 Grenoble",
        fonctionSignataire: "Présidente",
      },
      LE,
    );
    expect(v.qualite).toBe(
      "société commerciale ALPES CONSEIL, dont le siège est situé 3 place Grenette, 38000 Grenoble, représentée par Jeanne MARTIN, en qualité de Présidente, qui déclare avoir le pouvoir de l'engager",
    );
    expect(texteDuContrat(v)).toContain(
      "suivante : société commerciale ALPES CONSEIL, dont le siège est situé 3 place Grenette",
    );
  });

  it("société sans ces champs (dossier d'avant) : formule de la 2.7 inchangée", () => {
    const v = valeursDuContrat(
      { ...base, statutJuridique: "sarl", denomination: "ALPES CONSEIL" },
      LE,
    );
    expect(v.qualite).toBe(
      "société commerciale ALPES CONSEIL, représentée par Jeanne MARTIN, qui déclare avoir le pouvoir de l'engager",
    );
  });

  it("entrepreneur individuel : commerçant si immatriculé au RCS, non commerçant sinon, formule générale si inconnu", () => {
    const q = (immatriculeRcs: boolean | null) =>
      valeursDuContrat({ ...base, statutJuridique: "micro_entrepreneur", immatriculeRcs }, LE)
        .qualite;
    expect(q(true)).toBe(
      "entrepreneur individuel commerçant, immatriculé au registre du commerce et des sociétés",
    );
    expect(q(false)).toBe(
      "entrepreneur individuel non commerçant, non immatriculé au registre du commerce et des sociétés",
    );
    expect(q(null)).toBe(
      "entrepreneur individuel commerçant s'il est immatriculé au registre du commerce et des sociétés, entrepreneur individuel non commerçant dans le cas contraire",
    );
  });

  it("le siège d'un entrepreneur individuel n'est jamais imprimé", () => {
    const v = valeursDuContrat(
      {
        ...base,
        statutJuridique: "entrepreneur_individuel",
        siegeAdresse: "ailleurs",
        immatriculeRcs: false,
      },
      LE,
    );
    expect(v.qualite).not.toContain("ailleurs");
  });
});
