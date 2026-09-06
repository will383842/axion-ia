/**
 * 🔴 F5 — le montant HT d'une session n'était JAMAIS pré-rempli.
 *
 * Constaté le 2026-09-04 : « MONTANT HT (€) * » démarre à 0 et bloque la
 * création, alors que la formation est déjà choisie et que son offre porte un
 * tarif — 1 900 € HT, lisible sur `/qualiopi/offres`. Il a fallu ouvrir un
 * second onglet, trouver l'offre, lire le prix, revenir. Rien sur l'écran ne
 * dit que le prix est là-bas.
 *
 * Le risque n'est pas la lenteur, c'est le chiffre INVENTÉ : un montant faux
 * part ensuite sur la convention et sur la facture.
 *
 * Les trois cas qui décident si ce correctif vaut mieux que le défaut :
 *   1. un champ vierge se remplit — sinon on n'a rien fait ;
 *   2. un chiffre SAISI ne s'écrase jamais — sinon on a fabriqué une perte de
 *      travail silencieuse à la place d'une saisie manquante ;
 *   3. une offre SANS prix ferme ne pré-remplit rien ET retire le tarif
 *      précédent — garder 1 900 € en changeant de formation attribuerait à la
 *      nouvelle un prix qui n'est pas le sien, ce qui est PIRE que le zéro.
 */

import { describe, it, expect } from "vitest";

import { centimesVersChampNombre, montantApresChoixFormation } from "../tarif-catalogue";

const VIERGE = { montant: "0", vientDuCatalogue: false } as const;

describe("montantApresChoixFormation", () => {
  it("remplit un champ vierge avec le tarif catalogue", () => {
    expect(montantApresChoixFormation(VIERGE, 190000)).toEqual({
      montant: "1900.00",
      vientDuCatalogue: true,
    });
  });

  it("remplit aussi un champ complètement vide", () => {
    expect(montantApresChoixFormation({ montant: "", vientDuCatalogue: false }, 190000)).toEqual({
      montant: "1900.00",
      vientDuCatalogue: true,
    });
  });

  // 🔴 Le cas qui rendrait le correctif nuisible : un admin a négocié 2 400 €,
  // change la formation par erreur, et son chiffrage disparaît sans un mot.
  it("n'écrase JAMAIS un montant saisi à la main", () => {
    const saisi = { montant: "2400", vientDuCatalogue: false };
    expect(montantApresChoixFormation(saisi, 190000)).toEqual({
      montant: "2400",
      vientDuCatalogue: false,
    });
  });

  it("remplace en revanche un tarif que le catalogue avait posé lui-même", () => {
    const pose = { montant: "1900.00", vientDuCatalogue: true };
    expect(montantApresChoixFormation(pose, 240000)).toEqual({
      montant: "2400.00",
      vientDuCatalogue: true,
    });
  });

  // 🔴 « Sur devis », fourchette, paliers : `resolveOffrePriceEur` rend `null`
  // précisément pour qu'aucun écran n'affiche « Sur devis » tout en
  // pré-remplissant un montant.
  it("ne pré-remplit rien quand l'offre n'a pas de prix ferme", () => {
    expect(montantApresChoixFormation(VIERGE, null)).toEqual({
      montant: "0",
      vientDuCatalogue: false,
    });
  });

  it("RETIRE le tarif catalogue précédent quand la nouvelle offre est sur devis", () => {
    const pose = { montant: "1900.00", vientDuCatalogue: true };
    expect(montantApresChoixFormation(pose, null)).toEqual({
      montant: "0",
      vientDuCatalogue: false,
    });
  });

  it("… mais conserve une saisie manuelle même sur une offre sans prix ferme", () => {
    const saisi = { montant: "2400", vientDuCatalogue: false };
    expect(montantApresChoixFormation(saisi, null)).toEqual({
      montant: "2400",
      vientDuCatalogue: false,
    });
  });
});

describe("centimesVersChampNombre", () => {
  // Témoin positif : une fonction qui rendrait toujours "" ferait passer
  // « ne pré-remplit rien » sans rien mesurer.
  it('rend une valeur qu\'un <input type="number"> accepte — point, jamais virgule', () => {
    expect(centimesVersChampNombre(190000)).toBe("1900.00");
    expect(centimesVersChampNombre(199)).toBe("1.99");
    // Une virgule ici viderait le champ sans un mot : `type="number"` refuse la
    // valeur et le navigateur n'affiche rien.
    expect(centimesVersChampNombre(190000)).not.toContain(",");
  });
});
