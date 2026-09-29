/**
 * consoliderFaits — quand la valeur la plus récente a été EFFACÉE (droit à
 * l'effacement, rectification), la synthèse ne retombe pas en silence sur une
 * valeur plus ancienne : la case est vide, marquée « valeur effacée ».
 *
 * Mutation qui fait rougir : écarter les faits `efface` avant le groupement.
 * Contre-témoin : un fait effacé PLUS ANCIEN que la valeur courante ne la
 * masque pas.
 * Angle mort : la date de l'effacement n'est pas connue ici (le journal
 * `fait_evenements` la porte) ; on se fie à la date de la rencontre du fait.
 */

import { describe, expect, it } from "vitest";
import { consoliderFaits, trouverValeur, valeurRetenue } from "../consolider-faits";
import { MAINTENANT, fait, ilYA } from "./_faits";

describe("une valeur effacée ne retombe pas sur l'ancienne", () => {
  it("effectif récent effacé, effectif ancien validé → case vide « effacée »", () => {
    const ancien = fait({ type: "effectif", quantite: 40, constateLe: ilYA(200) });
    const efface = fait({ type: "effectif", statut: "efface", constateLe: ilYA(5) });
    const v = trouverValeur(
      consoliderFaits([ancien, efface], [], MAINTENANT).entreprise,
      "effectif",
    );
    expect(v?.etat).toBe("effacee");
    expect(valeurRetenue(v)).toBeNull();
  });

  it("contre-témoin : un effacement plus ANCIEN ne masque pas la valeur récente", () => {
    const efface = fait({ type: "effectif", statut: "efface", constateLe: ilYA(200) });
    const recent = fait({ type: "effectif", quantite: 55, constateLe: ilYA(5) });
    const v = trouverValeur(
      consoliderFaits([efface, recent], [], MAINTENANT).entreprise,
      "effectif",
    );
    expect(v?.etat).toBe("courante");
    expect(valeurRetenue(v)?.quantite).toBe(55);
  });
});
