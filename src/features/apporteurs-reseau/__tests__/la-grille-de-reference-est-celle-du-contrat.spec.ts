// La GRILLE DE RÉFÉRENCE publiée (réservée aux apporteurs : /apporteur/dossier/<id>/<jeton>/commissions) est, ligne à ligne,
// celle de l'annexe 1 du contrat en vigueur (2026-10-07, décision de Will). Les tableaux A1.1 à
// A1.5 du texte signé sont relus ici ; chaque ligne doit avoir les MÊMES cellules (libellé, durée,
// prix, commission) que la grille calculée depuis regles.ts et pricing.ts. Une divergence — un
// prix ou un taux changé d'un côté seulement — rougit la CI.
import { describe, expect, it } from "vitest";

import { CONTRAT_V2_MARKDOWN } from "../contrat-v2";
import {
  cleDeLigne,
  DATE_PUBLICATION_GRILLE,
  depuisLeDeLaLigne,
  grilleDeReference,
  type EntreeHistorique,
  type TableauGrille,
} from "../grille-reference";
import historiqueBrut from "../grille-reference-historique.json";

const historique = historiqueBrut as Record<string, EntreeHistorique[]>;

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

  it("la date de publication : AAAA-MM-JJ, jamais antérieure au 2026-10-08 (A1.7)", () => {
    expect(DATE_PUBLICATION_GRILLE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DATE_PUBLICATION_GRILLE >= "2026-10-08").toBe(true);
  });

  it("🔴 « Depuis le » : chaque ligne a un historique dont la DERNIÈRE entrée est la ligne actuelle", () => {
    const cles = new Set<string>();
    for (const t of grille) {
      for (const l of t.lignes) {
        const k = cleDeLigne(t, l);
        cles.add(k);
        const h = historique[k];
        expect(h, `historique manquant : ${k}`).toBeDefined();
        // Un montant changé SANS nouvelle entrée datée → la dernière entrée ne colle plus.
        expect(h!.at(-1)!.cellules, `montant changé sans nouvelle date : ${k}`).toEqual(l.cellules);
        expect(depuisLeDeLaLigne(t, l, historique)).toBe(h!.at(-1)!.depuisLe);
      }
    }
    expect(Object.keys(historique).sort()).toEqual([...cles].sort());
  });

  it("l'historique : dates strictement croissantes, jamais avant la publication, contenu changé à chaque entrée", () => {
    for (const [k, h] of Object.entries(historique)) {
      expect(h[0]!.depuisLe >= DATE_PUBLICATION_GRILLE, k).toBe(true);
      for (let i = 1; i < h.length; i++) {
        expect(h[i]!.depuisLe > h[i - 1]!.depuisLe, k).toBe(true);
        expect(h[i]!.cellules).not.toEqual(h[i - 1]!.cellules);
      }
    }
  });

  it("le test sait échouer : un montant modifié sans entrée datée n'a plus de « depuis le »", () => {
    const t = grille[0]!;
    const l = t.lignes[0]!;
    const changee = { cellules: [...l.cellules.slice(0, 3), "300 €"] };
    expect(depuisLeDeLaLigne(t, changee, historique)).toBeNull();
  });
});
