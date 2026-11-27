import { describe, expect, it } from "vitest";
import { filtrerDonneesPersonnelles, requetesARetirerDuTexte } from "../personnel";

const l = (requete: string, impressions = 1, clics = 0) => ({ requete, impressions, clics });

describe("filtrerDonneesPersonnelles", () => {
  it("retire un e-mail, et le compte dans l'agrégat", () => {
    const r = filtrerDonneesPersonnelles(
      [l("jean.dupont@exemple.fr formation", 4, 1), l("formation ia", 10)],
      {
        noms: [],
      },
    );
    expect(r.conservees.map((x) => x.requete)).toEqual(["formation ia"]);
    expect(r.retirees).toEqual({ lignes: 1, impressions: 4, clics: 1 });
  });

  it.each([
    "contact 06 12 34 56 78",
    "0612345678",
    "06.12.34.56.78",
    "06-12-34-56-78",
    "+33 6 12 34 56 78",
    "+33612345678",
    "0033 6 12 34 56 78",
    "04 76 12 34 56 devis",
  ])("retire un téléphone : %s", (q) => {
    expect(filtrerDonneesPersonnelles([l(q)], { noms: [] }).conservees).toEqual([]);
  });

  it.each(["formation ia 2026", "iso 27001 2022 audit", "top 10 outils ia", "gpt 4 vs claude 3"])(
    "garde une requête avec des chiffres ordinaires : %s",
    (q) => {
      expect(filtrerDonneesPersonnelles([l(q)], { noms: [] }).conservees).toHaveLength(1);
    },
  );

  it("un nom de personne connu n'est jamais conservé en texte (casse, accents, ordre)", () => {
    const noms = ["Élodie Martin"];
    for (const q of ["elodie martin formatrice", "MARTIN Élodie avis", "avis sur elodie  martin"]) {
      const r = filtrerDonneesPersonnelles([l(q, 3)], { noms });
      expect(r.conservees).toEqual([]);
      expect(r.retirees.impressions).toBe(3);
    }
  });

  it("ne confond pas un nom avec un mot plus long", () => {
    const r = filtrerDonneesPersonnelles([l("martinez elodie")], { noms: ["Élodie Martin"] });
    expect(r.conservees).toHaveLength(1);
  });

  it("un nom d'un seul mot est retiré quand il est présent en mot entier", () => {
    const r = filtrerDonneesPersonnelles([l("avis dupont"), l("dupontel film")], {
      noms: ["Dupont"],
    });
    expect(r.conservees.map((x) => x.requete)).toEqual(["dupontel film"]);
  });

  it("ignore les noms vides ou trop courts pour être discriminants", () => {
    const r = filtrerDonneesPersonnelles([l("formation ia")], { noms: ["", "  ", "a"] });
    expect(r.conservees).toHaveLength(1);
  });

  it("aucun seuil journalier : une requête à 1 impression est conservée", () => {
    const r = filtrerDonneesPersonnelles([l("formation ia pme", 1)], { noms: [] });
    expect(r.conservees).toHaveLength(1);
  });

  it("ne modifie pas l'entrée et garde les champs supplémentaires", () => {
    const entree = [{ requete: "formation ia", impressions: 2, clics: 0, date: "2026-11-01" }];
    const r = filtrerDonneesPersonnelles(entree, { noms: [] });
    expect(r.conservees[0]).toEqual(entree[0]);
    expect(r.conservees[0]).not.toBe(entree[0]);
  });
});

describe("requetesARetirerDuTexte (purge < 3 impressions cumulées sur 90 jours)", () => {
  it("rend les requêtes sous le seuil, cumul tous jours confondus", () => {
    const lignes = [
      l("rare", 1),
      l("rare", 1),
      l("moyenne", 2),
      l("moyenne", 1),
      l("frequente", 50),
    ];
    expect(requetesARetirerDuTexte(lignes).sort()).toEqual(["rare"]);
  });

  it("le seuil est paramétrable et exclusif (cumul === seuil → conservée)", () => {
    expect(requetesARetirerDuTexte([l("x", 3)])).toEqual([]);
    expect(requetesARetirerDuTexte([l("x", 3)], 4)).toEqual(["x"]);
  });

  it("regroupe les variantes de casse et d'espaces", () => {
    expect(requetesARetirerDuTexte([l("Formation IA", 1), l("formation  ia", 1)], 3)).toEqual([
      "formation ia",
    ]);
  });
});
