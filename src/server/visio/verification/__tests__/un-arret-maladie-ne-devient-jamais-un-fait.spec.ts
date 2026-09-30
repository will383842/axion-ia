/**
 * ⛔ G8 — UN ARRÊT MALADIE NE DEVIENT JAMAIS UN FAIT (art. 9 RGPD ; AI Act).
 *
 * Un énoncé qui porte une donnée de santé, de religion, d'opinion, syndicale…
 * ou une APPRÉCIATION d'une personne (« pas fiable », « agressif ») est MIS
 * EN ATTENTE : jamais validable en un clic, jamais rangé comme les autres ;
 * un signal « passage sensible » est levé.
 *
 * Mutation qui rougit : dans `verifierUnFait`, ignorer `estSensible` → le
 * fait sort `propose`. Contre-témoin : un fait ordinaire reste `propose`.
 * Angle mort : la liste est lexicale et fermée ; une formulation inédite
 * passe — la consigne 7 et la relecture de Will la rattrapent.
 */

import { describe, expect, it } from "vitest";

import { estSensible } from "../regles";
import { fait } from "../../../../../tests/fixtures/visio/scenario-menuiserie";
import { FAITS, leFait, verifier } from "./outils";

describe("un arrêt maladie ne devient jamais un fait", () => {
  it("« en arrêt maladie » → en_attente, signal", () => {
    const b = verifier([
      ...FAITS,
      fait({
        ref: "F09",
        type: "contrainte",
        enonce: "Un commercial est en arrêt maladie jusqu'en novembre.",
        preuves: [{ segment_ids: ["S0004"], citation: "On serait douze commerciaux à former" }],
      }),
    ]);
    expect(leFait(b, "F09")).toMatchObject({ statut: "en_attente", sensible: true });
    expect(b.signaux.sensibles).toBe(1);
  });

  it("une appréciation d'une personne est aussi mise en attente", () => {
    expect(estSensible("Le directeur semble méfiant et pas fiable.")).toBe(true);
    expect(estSensible("La responsable est enceinte.")).toBe(true);
  });

  it("contre-témoin : un fait ordinaire reste proposé", () => {
    expect(estSensible("L'équipe utilise Excel pour les relances.")).toBe(false);
    expect(leFait(verifier(FAITS), "F05").statut).toBe("propose");
  });
});
