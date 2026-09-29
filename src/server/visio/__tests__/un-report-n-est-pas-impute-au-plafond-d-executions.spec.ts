/**
 * ⛔ UN REPORT N'EST PAS IMPUTÉ AU PLAFOND DE 10 EXÉCUTIONS (LOTS PR 6 : « report
 * sans compter », jamais un échec).
 *
 * Chaque prise fait `execution + 1` (jeton de propriété). Une prise qui finit
 * en REPORT — base pas encore migrée (`schema_en_retard`), enregistrement de
 * la rencontre encore actif — ou relâchée au SIGTERM ne doit pas rapprocher
 * l'étape de l'échec définitif : une base non migrée pendant 2 h 30 (11 reports
 * de 15 min) ou un second enregistrement actif pendant 50 min (11 reports de
 * 5 min) ne tuent rien.
 *
 * Mutation qui rougit : comparer `t.execution` (et non `executionsImputees(t)`)
 * au plafond dans `executerEtape`, ou ne plus incrémenter `interruptions` dans
 * `echouer` sur un report. Contre-témoin : onze prises perdues par un verrou
 * expiré (plantages), elles, restent imputées et arrêtent l'étape.
 */

import { describe, expect, it } from "vitest";

import { executerEtape, PLAFOND_EXECUTIONS, type Gestionnaire } from "../etapes";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";

function colonneAbsente(): Error {
  return Object.assign(new Error("The column `x` does not exist in the current database."), {
    code: "P2022",
  });
}

describe("un report n'est pas imputé au plafond d'exécutions", () => {
  it("onze reports « base non migrée » : toujours à faire, jamais d'échec définitif", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "extraire" });
    const g: Gestionnaire = async () => {
      throw colonneAbsente();
    };
    const deps = depsDeTest({ depot, gestionnaires: { extraire: g } });
    for (let i = 0; i < PLAFOND_EXECUTIONS + 1; i++) {
      expect(await executerEtape(deps, t.id)).toBe("reportee");
    }
    expect(depot.ligne(t.id)).toMatchObject({ statut: "a_faire", echecs: 0, execution: 11 });
    // La douzième prise, la base enfin migrée, réussit.
    const ok = depsDeTest({
      depot,
      gestionnaires: { extraire: async () => ({ ecrire: async () => [] }) },
    });
    expect(await executerEtape(ok, t.id)).toBe("reussie");
  });

  it("onze reports « enregistrement encore actif » : toujours à faire", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "transcrire" });
    let actif = true;
    const deps = depsDeTest({
      depot,
      gestionnaires: { transcrire: async () => ({ ecrire: async () => [] }) },
      donnees: { enregistrementActif: async () => actif },
    });
    for (let i = 0; i < PLAFOND_EXECUTIONS + 1; i++) {
      expect(await executerEtape(deps, t.id)).toBe("reportee");
    }
    expect(depot.ligne(t.id).statut).toBe("a_faire");
    actif = false;
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(deps.alertes).toEqual([]);
  });

  it("onze arrêts du worker (SIGTERM) : toujours à faire", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "transcrire" });
    const g: Gestionnaire = async (ctx) => {
      ctx.verifierArret();
      return { ecrire: async () => [] };
    };
    const deps = depsDeTest({ depot, gestionnaires: { transcrire: g }, arret: () => true });
    for (let i = 0; i < PLAFOND_EXECUTIONS + 1; i++) {
      expect(await executerEtape(deps, t.id)).toBe("relachee");
    }
    expect(depot.ligne(t.id).statut).toBe("a_faire");
  });

  it("contre-témoin : onze prises perdues par un verrou expiré arrêtent l'étape", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "transcrire" });
    const deps = depsDeTest({
      depot,
      gestionnaires: { transcrire: async () => ({ ecrire: async () => [] }) },
    });
    // Le balayage rend une prise perdue sans toucher à `interruptions`.
    for (let i = 0; i < PLAFOND_EXECUTIONS; i++) {
      await depot.prendre(t.id);
      const l = depot.ligne(t.id);
      l.statut = "a_faire";
      l.verrouJusqua = null;
    }
    expect(await executerEtape(deps, t.id)).toBe("echec_definitif");
    expect(depot.ligne(t.id).statut).toBe("echec_definitif");
  });
});
