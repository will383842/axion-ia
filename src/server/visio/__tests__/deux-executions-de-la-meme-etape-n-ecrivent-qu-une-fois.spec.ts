/**
 * ⛔ DEUX EXÉCUTIONS DE LA MÊME ÉTAPE N'ÉCRIVENT QU'UNE FOIS (ADR 0054 ; plan §3.11).
 *
 * Deux jobs pour la même étape (file rejouée, balayage + réveil) : la prise
 * est atomique, le second repart « déjà prise ». Et si le verrou a expiré
 * pendant un appel lent et qu'une seconde exécution a pris la main, la
 * PREMIÈRE, en finissant, trouve un jeton périmé : son résultat est ORPHELIN,
 * rien n'est écrit.
 *
 * Mutation qui rougit : dans `executerEtape`, écrire sans passer par
 * `depot.terminer` (ou un dépôt qui ignore `execution`) → deux écritures.
 * Contre-témoin : une exécution seule écrit une fois. Angle mort : la vraie
 * atomicité SQL (`UPDATE … RETURNING`) est prouvée par la chaîne de Gate D.
 */

import { describe, expect, it } from "vitest";

import { executerEtape, type Gestionnaire } from "../etapes";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";

describe("deux exécutions de la même étape n'écrivent qu'une fois", () => {
  it("deux jobs simultanés : un seul exécute et écrit", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "rediger", compteRenduId: "cr1" });
    let executions = 0;
    const g: Gestionnaire = async () => {
      executions += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { ecrire: async () => [] };
    };
    const deps = depsDeTest({ depot, gestionnaires: { rediger: g } });
    const issues = await Promise.all([executerEtape(deps, t.id), executerEtape(deps, t.id)]);
    expect(issues.sort()).toEqual(["deja_prise", "reussie"]);
    expect(executions).toBe(1);
    expect(depot.ecritures).toEqual(["rediger#1"]);
  });

  it("verrou expiré, reprise par une seconde exécution : la première est orpheline", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "rediger", compteRenduId: "cr1" });
    let liberer: () => void = () => undefined;
    const lent: Gestionnaire = async () => {
      await new Promise<void>((r) => {
        liberer = r;
      });
      return { ecrire: async () => [] };
    };
    const rapide: Gestionnaire = async () => ({ ecrire: async () => [] });
    const premiere = executerEtape(depsDeTest({ depot, gestionnaires: { rediger: lent } }), t.id);
    await new Promise((r) => setTimeout(r, 5));
    // Le verrou expire (worker figé) : le balayage rend l'étape.
    depot.ligne(t.id).statut = "a_faire";
    depot.ligne(t.id).verrouJusqua = null;
    expect(
      await executerEtape(depsDeTest({ depot, gestionnaires: { rediger: rapide } }), t.id),
    ).toBe("reussie");
    liberer();
    expect(await premiere).toBe("orphelin");
    expect(depot.ecritures).toEqual(["rediger#2"]);
  });
});
