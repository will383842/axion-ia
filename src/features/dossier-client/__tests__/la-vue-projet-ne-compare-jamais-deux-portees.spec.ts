/**
 * consoliderFaits — on ne compare JAMAIS deux portées. Un niveau en IA dit pour
 * l'entreprise et un autre dit pour un projet ne sont pas « à trancher » :
 * chacun reste dans sa portée. Et un fait d'un projet n'apparaît dans aucun
 * autre.
 *
 * Mutation qui fait rougir : consolider un projet sur `portee === "projet"`
 * seulement (sans filtrer `projetId`), ou mêler les faits d'entreprise au projet.
 * Contre-témoin : deux valeurs différentes DANS la même portée sont à trancher.
 * Angle mort : un fait mal rangé (portée entreprise au lieu de projet) est
 * consolidé là où il est rangé ; le rangement est l'affaire de Will.
 */

import { describe, expect, it } from "vitest";
import { consoliderFaits, trouverValeur } from "../consolider-faits";
import { MAINTENANT, fait, faitProjet } from "./_faits";

const A = "p-a";
const B = "p-b";
const projets = [
  { id: A, derniereReouvertureLe: null },
  { id: B, derniereReouvertureLe: null },
];

describe("la vue projet ne compare jamais deux portées", () => {
  it("niveau IA entreprise ≠ niveau IA projet : aucun n'est à trancher", () => {
    const faits = [
      fait({ type: "niveau_ia", texteCourt: "débutant" }),
      faitProjet(A, { type: "niveau_ia", texteCourt: "avancé" }),
    ];
    const c = consoliderFaits(faits, projets, MAINTENANT);
    expect(trouverValeur(c.entreprise, "niveau_ia")?.etat).toBe("courante");
    expect(trouverValeur(c.projets[A], "niveau_ia")?.etat).toBe("courante");
  });

  it("le budget du projet A n'apparaît ni dans le projet B ni dans l'entreprise", () => {
    const c = consoliderFaits(
      [faitProjet(A, { type: "budget", montantMaxCents: 1_000_000 })],
      projets,
      MAINTENANT,
    );
    expect(trouverValeur(c.projets[A], "budget")).toBeDefined();
    expect(trouverValeur(c.projets[B], "budget")).toBeUndefined();
    expect(trouverValeur(c.entreprise, "budget")).toBeUndefined();
  });

  it("contre-témoin : deux niveaux différents dans la MÊME portée sont à trancher", () => {
    const faits = [
      faitProjet(A, { type: "niveau_ia", texteCourt: "débutant" }),
      faitProjet(A, { type: "niveau_ia", texteCourt: "avancé" }),
    ];
    expect(
      trouverValeur(consoliderFaits(faits, projets, MAINTENANT).projets[A], "niveau_ia")?.etat,
    ).toBe("a_trancher");
  });
});
