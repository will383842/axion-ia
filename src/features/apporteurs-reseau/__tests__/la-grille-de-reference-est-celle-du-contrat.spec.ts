// La GRILLE DE RÉFÉRENCE publiée (page /fr/apporteur-affaires/commissions) est, ligne à ligne,
// celle de l'annexe 1 du contrat en vigueur (2026-10-07, décision de Will). Les tableaux A1.1 à
// A1.5 du texte signé sont relus ici ; chaque ligne doit avoir les MÊMES cellules (libellé, durée,
// prix, commission) que la grille calculée depuis regles.ts et pricing.ts. Une divergence — un
// prix ou un taux changé d'un côté seulement — rougit la CI.
import { describe, expect, it } from "vitest";

import { CONTRAT_V2_MARKDOWN } from "../contrat-v2";
import { dateDeLaLigne, grilleDeReference, type TableauGrille } from "../grille-reference";

const norme = (v: string) =>
  v.replace(/\*\*/g, "").replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

/** Les lignes (sans l'en-tête) du premier tableau de la section `### <cle> — …`. */
function tableauDuContrat(cle: string): string[][] {
  const debut = CONTRAT_V2_MARKDOWN.indexOf(`### ${cle} —`);
  if (debut < 0) throw new Error(`section ${cle} absente du contrat`);
  const suite = CONTRAT_V2_MARKDOWN.slice(debut + 4);
  const fin = suite.search(/\n### /);
  const section = fin < 0 ? suite : suite.slice(0, fin);
  const lignes = section.split("\n").filter((l) => l.startsWith("| "));
  return lignes
    .slice(2) // en-tête + séparateur
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => norme(c)),
    );
}

const grille = grilleDeReference();

describe("grille de référence ↔ annexe 1 du contrat", () => {
  it("les six tableaux A1.1 à A1.5 sont publiés", () => {
    expect(grille.map((t) => t.cle)).toEqual(["A1.1", "A1.2", "A1.3", "A1.4", "A1.4 bis", "A1.5"]);
  });

  it.each(grille.map((t) => [t.cle, t] as [string, TableauGrille]))(
    "%s : chaque ligne est celle du contrat (libellé, prix, commission)",
    (cle, t) => {
      const contrat = tableauDuContrat(cle);
      expect(t.lignes.map((l) => l.cellules.map(norme))).toEqual(contrat);
    },
  );

  it("le test sait échouer : un prix modifié d'un seul côté est vu", () => {
    const t = grille[0]!;
    const fausse = t.lignes.map((l, i) =>
      i === 0 ? [...l.cellules.slice(0, 2), "1 250 €", l.cellules[3]!] : [...l.cellules],
    );
    expect(fausse.map((c) => c.map(norme))).not.toEqual(tableauDuContrat("A1.1"));
  });

  it("les dates : AAAA-MM-JJ, jamais dans le futur ; un produit ajouté prend sa date", () => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    for (const t of grille) {
      expect(t.publieLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.publieLe <= aujourdhui).toBe(true);
    }
    const t = grille[0]!;
    expect(dateDeLaLigne(t, { cellules: [], ajouteLe: "2099-01-01" })).toBe("2099-01-01");
    expect(dateDeLaLigne(t, { cellules: [] })).toBe(t.publieLe);
  });
});
