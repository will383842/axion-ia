/**
 * Le tri `ancien` inverse réellement l'ordre — et le défaut ne bouge pas.
 *
 * 🔑 Le second point est le plus important. `tri` est ajouté pour UNE vue
 * (« À traiter ») ; s'il changeait le défaut, il changerait l'ordre de tous les
 * écrans qui partagent cette lecture, sans que personne l'ait demandé. Une
 * option dont le défaut dérive n'est pas une option, c'est une régression.
 */

import { describe, it, expect } from "vitest";
import { listSubmissionsSchema } from "../query";

describe("le tri de la liste des messages", () => {
  it("vaut « recent » quand personne ne le demande", () => {
    expect(listSubmissionsSchema.parse({}).tri).toBe("recent");
  });

  it("accepte « ancien » pour la vue À traiter", () => {
    expect(listSubmissionsSchema.parse({ tri: "ancien" }).tri).toBe("ancien");
  });

  it("refuse toute autre valeur — c'est une liste FERMÉE", () => {
    // `listSubmissionsAction` est un point d'entrée réseau : une clause libre y
    // serait une lecture arbitraire offerte à qui appelle l'action. Même
    // raisonnement que `perimetre`.
    expect(() => listSubmissionsSchema.parse({ tri: "submittedAt desc; DROP" })).toThrow();
    expect(() => listSubmissionsSchema.parse({ tri: "asc" })).toThrow();
  });
});
