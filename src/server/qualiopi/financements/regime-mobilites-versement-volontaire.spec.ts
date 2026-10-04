/**
 * Lot OPCO A7b (manque n°10) — le régime de paiement lit enfin, sur la fiche
 * client, l'adhésion à l'offre de services d'OPCO Mobilités et le versement
 * volontaire. Avant : `adhesionOffreMobilites: null` et `versementVolontaire:
 * false` codés en dur, donc Mobilités toujours « inconnu ».
 */

import { describe, expect, it } from "vitest";
import { entreeRegimeDepuisSession } from "./regime-paiement-session";
import { regimePaiementOpco } from "./regime-paiement-opco";

function regime(client: Record<string, unknown>) {
  const { entree } = entreeRegimeDepuisSession({
    client: { opco: "mobilites", effectif: 8, ...client } as never,
    dossiersFinancement: [],
  });
  return { entree, resultat: regimePaiementOpco(entree) };
}

describe("régime — offre Mobilités et versement volontaire lus sur le client", () => {
  it("Mobilités, adhésion à l'offre de services → subrogation possible", () => {
    const { entree, resultat } = regime({ opcoAdhesionOffreMobilites: true });
    expect(entree.adhesionOffreMobilites).toBe(true);
    expect(resultat.regime).toBe("subrogation_possible");
  });

  it("Mobilités, adhésion non renseignée → inconnu (jamais « non »)", () => {
    const { entree, resultat } = regime({ opcoAdhesionOffreMobilites: null });
    expect(entree.adhesionOffreMobilites).toBeNull();
    expect(resultat.regime).toBe("inconnu");
  });

  it("versement volontaire → remboursement par l'entreprise", () => {
    const { entree, resultat } = regime({
      opco: "akto",
      opcoVersementVolontaire: true,
    });
    expect(entree.versementVolontaire).toBe(true);
    expect(resultat.regime).toBe("remboursement_entreprise");
  });

  it("versement non renseigné → pas de versement retenu", () => {
    const { entree } = regime({ opcoVersementVolontaire: null });
    expect(entree.versementVolontaire).toBe(false);
  });
});
