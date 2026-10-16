// @formateurs V2P3 — Nouvelle version du contrat (F45) : la direction coupe
// `formateurs.nouvelle_version_contrat`. La page d'allumage promet « Couper (rien
// n'est émis ni envoyé) ». Le vrai passage des campagnes relance-t-il encore F45,
// et émet-il un nouveau lien de signature ?

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { ouvrirScenario, type DecorScenario } from "../fixtures/formateurs/scenario";
import { executerScenarioV2p } from "../fixtures/formateurs/v2p-execution";

interface Ligne {
  template: string;
  status: string;
}
interface Observations {
  adresses: string[];
  allume: boolean;
  coupe: boolean;
  temoin: { envoyes: number; lignes: Ligne[] };
  apresCoupure: { envoyes: number; lignes: Ligne[]; liensEmis: number };
}

test.describe("@formateurs V2P3 — F45 après la coupure de « nouvelle version du contrat »", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);
  let decor: DecorScenario;
  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("v2p3");
    o = await executerScenarioV2p<Observations>("v2p3-nouvelle-version-coupee");
  });
  test.afterAll(async () => {
    for (const a of o?.adresses ?? []) await viderPuitsPour(a);
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("témoin : clé allumée, la relance F45 de J+7 part", () => {
    expect(o.allume).toBe(true);
    expect(o.temoin.envoyes).toBe(1);
    expect(o.temoin.lignes.map((l) => [l.template, l.status])).toEqual([
      ["formateur-contrat-nouvelle-version", "sent"],
      ["formateur-contrat-nouvelle-version", "sent"],
    ]);
  });

  // V2-P-5 — la campagne F45 dépend aussi de la clé `nouvelle_version_contrat` :
  // coupée, le passage ne relance pas et n'émet aucun lien de signature.
  test("V2-P-5 — clé coupée : aucune relance F45 n'est enfilée ni aucun lien émis", () => {
    expect(o.coupe).toBe(true);
    expect(o.apresCoupure.envoyes).toBe(0);
    expect(o.apresCoupure.liensEmis).toBe(0);
    expect(o.apresCoupure.lignes.map((l) => l.status)).toEqual(["sent"]);
  });
});
