// @formateurs V2-S07 (vérification n° 2, sécurité) — Webhook Calendly.
//
// La vraie route reçoit des livraisons signées au format Calendly : sans
// signature, d'une autre clé, au corps modifié, périmée (au-delà de 5 min), datée du
// futur, en-tête illisible — 401 partout. Témoin : la livraison juste passe.
// ÉCART constaté : la même livraison rejouée dans les 5 minutes est acceptée ;
// sans effet propre (la route ne fait que relancer la lecture de l'API
// Calendly, et une réservation est unique par son URI en base).

import { expect, test } from "@playwright/test";

import { DELAI_SPEC_MS, scenarioV2 } from "../fixtures/formateurs/v2s-commun";

interface Http {
  statut: number;
  corps: string;
}
type Observations = Record<
  | "temoin"
  | "rejeu"
  | "sansSignature"
  | "autreCle"
  | "corpsModifie"
  | "perimee"
  | "future"
  | "enteteIllisible",
  Http
>;

const REFUS: Http = { statut: 401, corps: "invalid_signature" };

test.describe("@formateurs V2-S07 — webhook Calendly non signé ou rejoué", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(DELAI_SPEC_MS);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(DELAI_SPEC_MS);
    o = await scenarioV2<Observations>("v2s07-webhook-calendly");
  });

  test("témoin : la livraison signée passe", () => {
    expect(o.temoin.statut).toBe(200);
  });

  test("non signée, autre clé, corps modifié : 401", () => {
    expect(o.sansSignature).toEqual(REFUS);
    expect(o.autreCle).toEqual(REFUS);
    expect(o.corpsModifie).toEqual(REFUS);
    expect(o.enteteIllisible).toEqual(REFUS);
  });

  test("périmée ou datée du futur (au-delà de 5 minutes) : 401", () => {
    expect(o.perimee).toEqual(REFUS);
    expect(o.future).toEqual(REFUS);
  });

  test("ÉCART constaté : rejouée dans la fenêtre, elle est acceptée (sans effet propre)", () => {
    expect(o.rejeu).toEqual(o.temoin);
  });
});
