/**
 * ⛔ G3 — UN BUDGET DIT PAR WILLIAMS N'EST PAS LE BUDGET DU CLIENT (§2.3, §4.2).
 *
 * La piste RÉELLE du segment décide (pas `locuteur_declare`). Un budget, un
 * décideur, un problème ou un besoin doivent venir du client LUI-MÊME : une
 * phrase de Williams est rejetée, même confirmée. Pour les types « client, ou
 * Williams avec confirmation » (nombre de participants…), la confirmation du
 * client dans les 90 s rend le fait `confirme_sur_reformulation`.
 *
 * Mutation qui rougit : dans `verifierLocuteur`, accepter `avec_confirmation`
 * pour `budget` (ou ignorer la piste réelle) → le budget de Williams passe.
 * Contre-témoin : le nombre de participants confirmé passe. Angle mort : un
 * écho de Williams sur la piste client (micro qui repasse dans l'onglet) est
 * signalé « écho », pas rejeté.
 */

import { describe, expect, it } from "vitest";

import { avec, leFait, verifier } from "./outils";

describe("un budget dit par Williams n'est pas le budget du client", () => {
  it("budget cité sur la piste de Williams, même « confirmé » → locuteur_non_admis", () => {
    const b = verifier(
      avec("F02", {
        locuteur_declare: "axion",
        preuves: [{ segment_ids: ["S0005"], citation: "Et côté budget, vous aviez une idée" }],
        confirmation_client: {
          segment_ids: ["S0006"],
          citation: "On avait prévu autour de trois mille euros hors taxes",
        },
        valeur: { ...avec("F02", {})[1]!.valeur },
      }),
    );
    expect(leFait(b, "F02")).toMatchObject({ statut: "rejete", motif: "locuteur_non_admis" });
  });

  it("déclaré « client » mais cité sur la piste de Williams → rejeté (la piste décide)", () => {
    const b = verifier(
      avec("F02", {
        preuves: [{ segment_ids: ["S0005"], citation: "Et côté budget, vous aviez une idée" }],
      }),
    );
    expect(leFait(b, "F02")).toMatchObject({ statut: "rejete", motif: "locuteur_non_admis" });
  });

  it("contre-témoin : « donc vous êtes bien douze ? » + « oui… douze personnes » dans les 90 s", () => {
    const b = verifier(
      avec("F01", {
        locuteur_declare: "axion",
        preuves: [{ segment_ids: ["S0007"], citation: "Donc vous êtes bien douze personnes" }],
        confirmation_client: {
          segment_ids: ["S0008"],
          citation: "Oui c'est bien ça, douze personnes au total",
        },
      }),
    );
    expect(leFait(b, "F01")).toMatchObject({
      statut: "propose",
      certitude: "confirme_sur_reformulation",
      confirmationDebutMs: 65_000,
    });
  });
});
