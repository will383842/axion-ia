// @formateurs V2P1 — La relance du contrat-cadre (F18) attend dans la file, ou en
// corbeille de validation, quand la raison de relancer disparaît. Part-elle ?
//
// Le vrai passage des campagnes décide F18 « J+3 » et l'enfile ; la boîte est
// saturée (quota de 40 envois dans l'heure atteint), F18 attend. Pendant l'attente :
// le formateur signe, répond, s'oppose, sa collaboration prend fin, ou la direction
// coupe `relances_auto` par la console. Troisième tour : F18 garé en corbeille par
// une règle « à valider », le contrat est signé, puis la direction l'approuve en
// retard. À chaque fois, le worker relit l'état au départ : une relance qui part
// alors est une relance qui ne s'arrête pas.
//
// Défauts consignés par la vérification n° 2, corrigés au départ (`relecture-au-depart.ts`) :
// V2-P-1 (fait accompli), V2-P-2 (réponse), V2-P-3 (interrupteur coupé), V2-P-4 (opposition).

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { ouvrirScenario, type DecorScenario } from "../fixtures/formateurs/scenario";
import { executerScenarioV2p } from "../fixtures/formateurs/v2p-execution";

interface Ligne {
  template: string;
  status: string;
  error: string | null;
}
type Cas =
  "temoin" | "signe" | "repond" | "oppose" | "fin-collaboration" | "relances-coupees" | "corbeille";
interface Observations {
  adresses: string[];
  passages: Array<{ envoyes: number; gares: number; campagnesActives: number }>;
  coupure: { ok: boolean };
  regle: { ok: boolean };
  approbation: { ok: boolean };
  f18: Record<Cas, Ligne[]>;
}

const statuts = (l: readonly Ligne[]) => l.map((x) => x.status);

test.describe("@formateurs V2P1 — F18 en file, puis la raison de relancer disparaît", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(400_000);
  let decor: DecorScenario;
  let o: Observations;

  test.beforeAll(async () => {
    // Les scénarios du groupe passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("v2p1");
    o = await executerScenarioV2p<Observations>("v2p1-relance-contrat-en-file");
  });
  test.afterAll(async () => {
    for (const a of o?.adresses ?? []) await viderPuitsPour(a);
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("témoin : le passage enfile (puis gare) F18, et rien n'ayant changé, F18 part", () => {
    expect(o.passages).toEqual([
      { envoyes: 5, gares: 0, campagnesActives: 1 },
      { envoyes: 1, gares: 0, campagnesActives: 1 },
      { envoyes: 0, gares: 1, campagnesActives: 1 },
    ]);
    expect(statuts(o.f18.temoin)).toEqual(["sent"]);
    expect(o.coupure.ok).toBe(true);
    expect(o.regle.ok).toBe(true);
    expect(o.approbation.ok).toBe(true);
  });

  test("fin de collaboration pendant l'attente : F18 est retenu au départ", () => {
    expect(o.f18["fin-collaboration"]).toEqual([
      expect.objectContaining({
        status: "cancelled",
        error: expect.stringMatching(/fin de collaboration/),
      }),
    ]);
  });

  // V2-P-1 — le contrat est signé pendant que F18 attend : F18 ne part pas.
  test("V2-P-1 — contrat signé pendant l'attente : F18 est retenu au départ", () => {
    expect(statuts(o.f18.signe)).toEqual(["cancelled"]);
  });

  // V2-P-1 — même chemin par la corbeille : approuvé après la signature, F18 ne part pas.
  test("V2-P-1 — F18 garé, contrat signé, approuvé en retard : F18 est retenu", () => {
    expect(statuts(o.f18.corbeille)).toEqual(["cancelled"]);
  });

  // V2-P-2 — le formateur répond pendant que F18 attend : F18 ne part pas.
  test("V2-P-2 — le formateur répond pendant l'attente : F18 est retenu au départ", () => {
    expect(statuts(o.f18.repond)).toEqual(["cancelled"]);
  });

  // V2-P-3 — `relances_auto` coupé par la console pendant que F18 attend : F18 ne part pas.
  test("V2-P-3 — `relances_auto` coupé pendant l'attente : F18 est retenu", () => {
    expect(statuts(o.f18["relances-coupees"])).toEqual(["cancelled"]);
  });

  // V2-P-4 — le formateur s'oppose pendant que F18 attend : F18 ne part pas, comme le
  // passage ne l'aurait pas décidé (le moteur lit l'opposition).
  test("V2-P-4 — opposition pendant l'attente : F18 est retenu au départ", () => {
    expect(statuts(o.f18.oppose)).toEqual(["cancelled"]);
  });
});
