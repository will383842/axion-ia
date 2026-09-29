/**
 * consoliderFaits — un projet ROUVERT : ce qui a été dit avant la réouverture
 * ne pré-remplit plus rien ; la case est vide, marquée « avant la
 * réouverture ». Ce qui a été dit après redevient courant.
 *
 * Mutation qui fait rougir : ignorer `derniereReouvertureLe`.
 * Contre-témoin : le même projet sans réouverture garde sa valeur.
 * Angle mort : la réouverture est lue sur le projet (`derniereReouvertureLe`) ;
 * l'historique `ProjetEvenement` n'est pas relu.
 */

import { describe, expect, it } from "vitest";
import { consoliderFaits, trouverValeur, valeurRetenue } from "../consolider-faits";
import { MAINTENANT, faitProjet, ilYA } from "./_faits";

const P = "p-1";

describe("un fait d'avant la réouverture est à reconfirmer", () => {
  it("échéance dite avant la réouverture → avant_reouverture, case vide", () => {
    const f = faitProjet(P, { type: "echeance", dateCible: ilYA(-60), constateLe: ilYA(90) });
    const c = consoliderFaits([f], [{ id: P, derniereReouvertureLe: ilYA(10) }], MAINTENANT);
    const v = trouverValeur(c.projets[P], "echeance");
    expect(v?.etat).toBe("avant_reouverture");
    expect(v?.reouvertLe?.getTime()).toBe(ilYA(10).getTime());
    expect(valeurRetenue(v)).toBeNull();
  });

  it("ce qui est dit APRÈS la réouverture redevient courant", () => {
    const avant = faitProjet(P, { type: "echeance", dateCible: ilYA(-60), constateLe: ilYA(90) });
    const apres = faitProjet(P, { type: "echeance", dateCible: ilYA(-90), constateLe: ilYA(3) });
    const c = consoliderFaits(
      [avant, apres],
      [{ id: P, derniereReouvertureLe: ilYA(10) }],
      MAINTENANT,
    );
    const v = trouverValeur(c.projets[P], "echeance");
    expect(v?.etat).toBe("courante");
    expect(valeurRetenue(v)?.id).toBe(apres.id);
  });

  it("contre-témoin : sans réouverture, l'échéance est courante", () => {
    const f = faitProjet(P, { type: "echeance", dateCible: ilYA(-60), constateLe: ilYA(90) });
    const c = consoliderFaits([f], [{ id: P, derniereReouvertureLe: null }], MAINTENANT);
    expect(trouverValeur(c.projets[P], "echeance")?.etat).toBe("courante");
  });
});
