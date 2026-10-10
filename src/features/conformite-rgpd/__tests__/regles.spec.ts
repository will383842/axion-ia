import { describe, expect, it } from "vitest";

import {
  echeanceUnMois,
  figureSurPagePublique,
  joursRestants,
  pastilleDelai,
  pastilleEtat,
  peutImporterRegistre,
  pointsACorriger,
} from "../regles";
import { validerRegistre, type Registre } from "../schema";
import { registreFictif } from "./fixtures";

function registre(): Registre {
  const r = validerRegistre(registreFictif);
  if (!r.ok) throw new Error(r.erreur);
  return r.registre;
}

describe("pastille d'état d'une activité", () => {
  it("vert « À jour » sans écart ouvert", () => {
    expect(pastilleEtat({ ecarts: [] })).toEqual({ libelle: "À jour", ton: "success" });
    // Un écart corrigé ne compte plus.
    expect(pastilleEtat(registre().traitements[1]!)).toEqual({ libelle: "À jour", ton: "success" });
  });

  it("prend la couleur de la gravité la plus forte parmi les écarts ouverts", () => {
    const [a, , c] = registre().traitements;
    expect(pastilleEtat(a!)).toEqual({ libelle: "Critique", ton: "destructive" });
    expect(pastilleEtat(c!)).toEqual({ libelle: "Élevé", ton: "warning" });
    expect(
      pastilleEtat({
        ecarts: [
          { gravite: "moyen", statut: "ouvert", code: null, constat: null, correction: null },
        ],
      }).ton,
    ).toBe("info");
    expect(
      pastilleEtat({
        ecarts: [
          { gravite: "faible", statut: "ouvert", code: null, constat: null, correction: null },
        ],
      }).ton,
    ).toBe("neutral");
  });
});

describe("points à corriger", () => {
  it("liste les écarts ouverts, du plus grave au moins grave", () => {
    expect(pointsACorriger(registre()).map((e) => e.gravite)).toEqual([
      "critique",
      "eleve",
      "moyen",
      "faible",
    ]);
  });
});

describe("jours restants sur un mois", () => {
  const recue = new Date("2026-01-31T10:00:00Z");

  it("échéance au même jour du mois suivant, bornée au dernier jour", () => {
    expect(echeanceUnMois(recue).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(echeanceUnMois(new Date("2026-03-15T00:00:00Z")).toISOString().slice(0, 10)).toBe(
      "2026-04-15",
    );
  });

  it("compte les jours restants, négatifs une fois dépassé", () => {
    expect(joursRestants(recue, new Date("2026-02-18T10:00:00Z"))).toBe(10);
    expect(joursRestants(recue, new Date("2026-03-03T10:00:00Z"))).toBe(-3);
  });

  it("orange à 7 jours ou moins, rouge une fois dépassé", () => {
    expect(pastilleDelai(20).ton).toBe("neutral");
    expect(pastilleDelai(7)).toEqual({ libelle: "7 jours restants", ton: "warning" });
    expect(pastilleDelai(1)).toEqual({ libelle: "1 jour restant", ton: "warning" });
    expect(pastilleDelai(-3)).toEqual({ libelle: "Dépassé de 3 jours", ton: "destructive" });
  });
});

describe("destinataires et page publique", () => {
  it("rapproche par le premier mot du nom", () => {
    const publics = ["Exemple Hébergeur SAS", "Autre Service Ltd"];
    expect(figureSurPagePublique("Exemple", publics)).toBe(true);
    expect(figureSurPagePublique("Autre Service", publics)).toBe(true);
    expect(figureSurPagePublique("Inconnu SARL", publics)).toBe(false);
  });
});

describe("import réservé aux administrateurs", () => {
  it("seuls super-administrateur et administrateur", () => {
    expect(peutImporterRegistre("super_admin")).toBe(true);
    expect(peutImporterRegistre("admin")).toBe(true);
    for (const r of [
      "responsable_qualite",
      "secretaire",
      "editor",
      "reader",
      null,
      undefined,
      "",
    ]) {
      expect(peutImporterRegistre(r)).toBe(false);
    }
  });
});
