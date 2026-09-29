/**
 * consoliderFaits — un fait SANS valeur (un budget sans montant, une échéance
 * sans date) n'est jamais la valeur courante, même s'il est le plus récent.
 *
 * Mutation qui fait rougir : retirer `aUneValeur(f)` du filtre des candidats.
 * Contre-témoin : le fait plus ancien, qui a un montant, reste courant.
 * Angle mort : un texte fait d'espaces compte comme vide ; un texte « ? »
 * compte comme une valeur.
 */

import { describe, expect, it } from "vitest";
import { aUneValeur, consoliderFaits, trouverValeur, valeurRetenue } from "../consolider-faits";
import { MAINTENANT, faitProjet, ilYA } from "./_faits";

const P = "p-1";

describe("un fait sans valeur n'est jamais la valeur courante", () => {
  it("le budget sans montant, plus récent, ne remplace pas le budget chiffré", () => {
    const chiffre = faitProjet(P, {
      type: "budget",
      montantMaxCents: 300_000,
      constateLe: ilYA(20),
    });
    const vide = faitProjet(P, { type: "budget", enonce: "on verra", constateLe: ilYA(2) });
    const conso = consoliderFaits(
      [chiffre, vide],
      [{ id: P, derniereReouvertureLe: null }],
      MAINTENANT,
    );
    const v = trouverValeur(conso.projets[P], "budget");
    expect(v?.etat).toBe("courante");
    expect(valeurRetenue(v)?.id).toBe(chiffre.id);
  });

  it("aUneValeur suit le type : montant pour un budget, date pour une échéance", () => {
    expect(aUneValeur(faitProjet(P, { type: "budget", enonce: "gros budget" }))).toBe(false);
    expect(aUneValeur(faitProjet(P, { type: "echeance", enonce: "bientôt" }))).toBe(false);
    expect(aUneValeur(faitProjet(P, { type: "echeance", dateCible: ilYA(-30) }))).toBe(true);
    expect(aUneValeur(faitProjet(P, { type: "besoin", enonce: "   " }))).toBe(false);
    expect(aUneValeur(faitProjet(P, { type: "besoin", enonce: "former les RH" }))).toBe(true);
  });
});
