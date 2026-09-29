/**
 * consoliderFaits — deux valeurs validées DIFFÉRENTES pour une information
 * unique (budget) sont « à trancher », même dites dans le même rendez-vous.
 * Aucune n'est choisie en silence : le devis resterait vide avec la mention.
 *
 * Mutation qui fait rougir : dans `consolider-faits.ts`, toujours rendre
 * `courante` pour une cardinalité unique.
 * Contre-témoin : deux faits de MÊME valeur ne sont pas « à trancher ».
 * Angle mort : deux montants proches (4 900 € / 5 000 €) sont aussi « à
 * trancher » ; il n'y a pas de tolérance, c'est voulu.
 */

import { describe, expect, it } from "vitest";
import { consoliderFaits, trouverValeur, valeurRetenue } from "../consolider-faits";
import { MAINTENANT, faitProjet, ilYA } from "./_faits";

const P = "p-1";
const projets = [{ id: P, derniereReouvertureLe: null }];

describe("deux valeurs dans le même rendez-vous sont à trancher", () => {
  it("deux budgets différents, même rencontre → à trancher, case vide", () => {
    const faits = [
      faitProjet(P, {
        type: "budget",
        montantMaxCents: 500_000,
        rencontreId: "r1",
        constateLe: ilYA(3),
        citationDebutMs: 1000,
      }),
      faitProjet(P, {
        type: "budget",
        montantMaxCents: 800_000,
        rencontreId: "r1",
        constateLe: ilYA(3),
        citationDebutMs: 9000,
      }),
    ];
    const v = trouverValeur(consoliderFaits(faits, projets, MAINTENANT).projets[P], "budget");
    expect(v?.etat).toBe("a_trancher");
    expect(valeurRetenue(v)).toBeNull();
  });

  it("contre-témoin : deux fois le même budget → valeur courante", () => {
    const faits = [
      faitProjet(P, { type: "budget", montantMaxCents: 500_000, rencontreId: "r1" }),
      faitProjet(P, {
        type: "budget",
        montantMaxCents: 500_000,
        rencontreId: "r2",
        constateLe: ilYA(1),
      }),
    ];
    const v = trouverValeur(consoliderFaits(faits, projets, MAINTENANT).projets[P], "budget");
    expect(v?.etat).toBe("courante");
    expect(valeurRetenue(v)?.montantMaxCents).toBe(500_000);
  });
});
