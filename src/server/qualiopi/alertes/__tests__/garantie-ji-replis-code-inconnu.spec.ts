/**
 * Garantie Journée IA (PR 3/3) — deux conteneurs : un code ou un type de cible peut arriver chez une
 * version de l'app qui ne les connaît pas encore. Chaque surface doit se replier sans planter.
 */
import { describe, expect, it } from "vitest";
import { ALERTE_CATALOGUE } from "../catalogue";
import { guichetPourCode, regrouperAlertes } from "../routage";
import { lienCible, segmentCible } from "../lien-cible";
import { texteCible } from "../libelle-cible";

describe("replis d'un code ou d'un type de cible inconnu", () => {
  it("un code absent du catalogue part « sans guichet », il ne plante pas le regroupement", () => {
    expect(guichetPourCode("garantie_ji_futur")).toBeUndefined();
    const { lots, sansGuichet } = regrouperAlertes([
      {
        id: "1",
        code: "garantie_ji_futur",
        niveau: "info",
        titre: "t",
        message: "m",
        cibleType: null,
        cibleId: null,
      } as never,
    ]);
    expect(lots).toEqual([]);
    expect(sansGuichet).toHaveLength(1);
  });
  it("un type de cible inconnu : texte = le type brut + « non retrouvée », jamais d'identifiant, et aucun lien", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(texteCible("TypeFutur", id, new Map())).toBe("TypeFutur (non retrouvée)");
    expect(lienCible("TypeFutur", id, "/fr/p")).toBeNull();
    expect(segmentCible("constructor")).toBeNull();
  });
  it("les trois codes sont au catalogue, au guichet direction, refermés par le passage seul", () => {
    for (const code of [
      "garantie_ji_rapport",
      "garantie_ji_reponse",
      "garantie_ji_remboursement",
    ]) {
      const e = ALERTE_CATALOGUE[code];
      expect(e?.guichet).toBe("direction");
      expect(e?.resolutionAuto).toBe(false);
    }
  });
  it("la cible GarantieJourneeIa mène à la fiche et porte un nom lisible", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(lienCible("GarantieJourneeIa", id, "/fr/p")).toBe(`/fr/p/garanties-journee-ia/${id}`);
    expect(texteCible("GarantieJourneeIa", id, new Map())).toBe(
      "Garantie Journée IA (non retrouvée)",
    );
  });
});
