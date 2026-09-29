// @vitest-environment node
/**
 * « Valider tous » (les cases cochées d'avance) écarte : la confiance faible,
 * le budget seulement « confirmé sur reformulation », les types validés un
 * par un (budget, décideur, mise en relation), un fait en attente, un fait à
 * ranger. Plan §3.13 point 3 et `types-de-faits.ts`.
 *
 * Contre-témoin : un besoin de confiance haute, rangé, est coché d'avance.
 */

import { describe, expect, it } from "vitest";

import { faitsValidablesEnLot, validableEnLot, type FaitAValider } from "../valider";

function fait(p: Partial<FaitAValider>): FaitAValider {
  return {
    id: "f",
    type: "besoin",
    portee: "projet",
    statut: "propose",
    confiance: "haute",
    certitude: "dit_explicitement",
    ...p,
  };
}

describe("« Valider tous » exclut la confiance faible et le budget reformulé", () => {
  it("contre-témoin : un besoin sûr et rangé est validable en lot", () => {
    expect(validableEnLot(fait({}))).toBe(true);
  });

  it.each<[string, Partial<FaitAValider>]>([
    ["confiance faible", { confiance: "faible" }],
    ["budget reformulé", { type: "budget", certitude: "confirme_sur_reformulation" }],
    ["budget dit (un par un quand même)", { type: "budget" }],
    ["décideur", { type: "decideur" }],
    ["mise en relation", { type: "mise_en_relation" }],
    ["en attente (sensible)", { statut: "en_attente" }],
    ["à ranger", { portee: "a_ranger" }],
  ])("%s : jamais coché d'avance", (_nom, p) => {
    expect(validableEnLot(fait(p))).toBe(false);
  });

  it("le filtre garde l'ordre et ne rend que les validables", () => {
    const a = fait({ id: "a" });
    const b = fait({ id: "b", confiance: "faible" });
    const c = fait({ id: "c", type: "prochaine_etape", portee: "entreprise" });
    expect(faitsValidablesEnLot([a, b, c]).map((f) => f.id)).toEqual(["a", "c"]);
  });
});
