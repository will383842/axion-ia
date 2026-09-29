/**
 * consoliderFaits — « je dois revoir le budget » : l'ancien budget n'est plus
 * la valeur courante ; la case est vide avec « à reconfirmer ».
 *
 * Deux écritures du même constat, testées toutes deux :
 *   · un fait validé portant `relation = remet_en_cause` vers l'ancien budget ;
 *   · l'ancien budget passé `suivi = a_reconfirmer`.
 *
 * Mutation qui fait rougir : ignorer `remisEnCause` ou `suivi === a_reconfirmer`.
 * Contre-témoin : sans remise en cause, le budget reste courant.
 * Angle mort : une remise en cause portée par un fait NON validé ne compte pas.
 */

import { describe, expect, it } from "vitest";
import { consoliderFaits, trouverValeur, valeurRetenue } from "../consolider-faits";
import { MAINTENANT, faitProjet, ilYA } from "./_faits";

const P = "p-1";
const projets = [{ id: P, derniereReouvertureLe: null }];

describe("un budget remis en cause n'est plus courant", () => {
  it("par une relation remet_en_cause", () => {
    const ancien = faitProjet(P, {
      type: "budget",
      montantMaxCents: 400_000,
      constateLe: ilYA(30),
    });
    const doute = faitProjet(P, {
      type: "budget",
      enonce: "je dois revoir le budget",
      relation: "remet_en_cause",
      relationAvecFaitId: ancien.id,
      constateLe: ilYA(2),
    });
    const v = trouverValeur(
      consoliderFaits([ancien, doute], projets, MAINTENANT).projets[P],
      "budget",
    );
    expect(v?.etat).toBe("a_reconfirmer");
    expect(valeurRetenue(v)).toBeNull();
  });

  it("par le suivi « à reconfirmer »", () => {
    const ancien = faitProjet(P, {
      type: "budget",
      montantMaxCents: 400_000,
      suivi: "a_reconfirmer",
    });
    const v = trouverValeur(consoliderFaits([ancien], projets, MAINTENANT).projets[P], "budget");
    expect(v?.etat).toBe("a_reconfirmer");
  });

  it("contre-témoin : sans remise en cause, il reste courant", () => {
    const ancien = faitProjet(P, { type: "budget", montantMaxCents: 400_000 });
    const v = trouverValeur(consoliderFaits([ancien], projets, MAINTENANT).projets[P], "budget");
    expect(v?.etat).toBe("courante");
  });

  it("une remise en cause seulement PROPOSÉE ne retire rien", () => {
    const ancien = faitProjet(P, { type: "budget", montantMaxCents: 400_000 });
    const propose = faitProjet(P, {
      type: "budget",
      statut: "propose",
      relation: "remet_en_cause",
      relationAvecFaitId: ancien.id,
    });
    const v = trouverValeur(
      consoliderFaits([ancien, propose], projets, MAINTENANT).projets[P],
      "budget",
    );
    expect(v?.etat).toBe("courante");
  });
});
