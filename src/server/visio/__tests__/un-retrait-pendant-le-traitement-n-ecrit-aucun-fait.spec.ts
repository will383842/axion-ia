/**
 * ⛔ UN RETRAIT PENDANT LE TRAITEMENT N'ÉCRIT AUCUN FAIT (décision B2).
 *
 * Will déclare « le client retire son accord » pendant que le worker vérifie
 * les faits (après un appel OpenAI de plusieurs dizaines de secondes).
 * L'écriture finale vérifie, DANS SA TRANSACTION, qu'aucun retrait n'a été
 * enregistré : elle n'écrit rien, et l'étape n'est pas relancée.
 *
 * Mutation qui rougit : retirer `exigerAucunRetrait` de `terminer` (le faux
 * dépôt l'imite par `retraits`) → les faits sont écrits après le retrait.
 * Contre-témoin : sans retrait, l'écriture a lieu. Angle mort : la
 * sérialisation réelle (retrait et écriture dans deux transactions
 * concurrentes) est prouvée par Gate D.
 */

import { describe, expect, it } from "vitest";

import { executerEtape, type Gestionnaire } from "../etapes";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";

function lancer(retrait: boolean) {
  const depot = new FauxDepot();
  const t = depot.ajouter({ rencontreId: "r1", etape: "verifier_faits", compteRenduId: "cr1" });
  let faitsEcrits = 0;
  const g: Gestionnaire = async () => {
    // … l'appel est en vol quand Will retire l'accord.
    if (retrait) depot.retraits.add("r1");
    return {
      ecrire: async () => {
        faitsEcrits += 5;
        return [{ etape: "rattacher", compteRenduId: "cr1" }];
      },
    };
  };
  return { depot, t, g, lire: () => faitsEcrits };
}

describe("un retrait pendant le traitement n'écrit aucun fait", () => {
  it("retrait déclaré en vol : rien n'est écrit, rien n'est programmé", async () => {
    const { depot, t, g, lire } = lancer(true);
    expect(
      await executerEtape(depsDeTest({ depot, gestionnaires: { verifier_faits: g } }), t.id),
    ).toBe("retrait");
    expect(lire()).toBe(0);
    expect(depot.ecritures).toEqual([]);
    expect(depot.lignes.map((l) => l.etape)).toEqual(["verifier_faits"]);
  });

  it("contre-témoin : sans retrait, les faits sont écrits et la suite programmée", async () => {
    const { depot, t, g, lire } = lancer(false);
    expect(
      await executerEtape(depsDeTest({ depot, gestionnaires: { verifier_faits: g } }), t.id),
    ).toBe("reussie");
    expect(lire()).toBe(5);
    expect(depot.lignes.map((l) => l.etape)).toEqual(["verifier_faits", "rattacher"]);
  });
});
