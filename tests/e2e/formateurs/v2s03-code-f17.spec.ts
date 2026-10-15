// @formateurs V2-S03 (vérification n° 2, sécurité) — Le code F17 attaqué.
//
// Codes émis et vérifiés par le code du dépôt sur de vrais contrats-cadres v3 :
// forcé en série puis en rafale (le bon code ne passe plus, le compteur ne
// dépasse jamais le plafond), rejoué, remplacé, échu, présenté sur le contrat
// d'un autre formateur, émis avant un changement d'adresse ; et demandé par un
// lien figé sur l'ancienne adresse : rien ne part. Témoin : un code neuf et
// juste passe la première fois.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { DELAI_SPEC_MS, scenarioV2 } from "../fixtures/formateurs/v2s-commun";

interface Observations {
  serie: boolean[];
  bonApresSerie: boolean;
  rafale: number;
  essaisCompte: number | null;
  bonApresRafale: boolean;
  temoin: boolean;
  rejeu: boolean;
  ancienApresRecent: boolean;
  recentOk: boolean;
  apresEcheance: boolean;
  surB: boolean;
  changement: string;
  apresChangement: boolean;
  demande: { ok: boolean; raison: string | null };
  nouveauxCodes: number;
  versAncienne: number;
  essaisMax: number;
}

test.describe("@formateurs V2-S03 — code de signature F17 forcé, rejoué, détourné", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(DELAI_SPEC_MS);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(DELAI_SPEC_MS);
    o = await scenarioV2<Observations>("v2s03-code-f17");
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("témoin : un code neuf et juste passe la première fois", () => {
    expect(o.temoin).toBe(true);
    expect(o.recentOk).toBe(true);
  });

  test("forcé en série : refusé, puis le bon code ne passe plus", () => {
    expect(o.serie).toEqual(Array.from({ length: o.essaisMax }, () => false));
    expect(o.bonApresSerie).toBe(false);
  });

  test("forcé en rafale simultanée : compteur plafonné, le bon code ne passe plus", () => {
    expect(o.rafale).toBe(0);
    expect(o.essaisCompte).toBe(o.essaisMax);
    expect(o.bonApresRafale).toBe(false);
  });

  test("rejoué, remplacé, échu, présenté sur le contrat d'un autre : refusé", () => {
    expect(o.rejeu).toBe(false);
    expect(o.ancienApresRecent).toBe(false);
    expect(o.apresEcheance).toBe(false);
    expect(o.surB).toBe(false);
  });

  test("après un changement d'adresse : le code émis avant ne vaut plus, rien vers l'ancienne", () => {
    expect(o.changement).toBe("ok");
    expect(o.apresChangement).toBe(false);
    expect(o.demande).toEqual({ ok: false, raison: "code_indisponible" });
    expect(o.nouveauxCodes).toBe(0);
    expect(o.versAncienne).toBe(0);
  });
});
