/**
 * ⛔ UN ARRÊT DU WORKER NE CONSOMME PAS UNE TENTATIVE (plan §2.5 ; `worker.ts` vidange 25 s).
 *
 * Au SIGTERM (redéploiement : le worker atterrit ~50 min avant l'app, et
 * redémarre souvent), l'étape en cours s'arrête à la prochaine tranche et
 * repasse `a_faire` SANS compter d'échec — sinon chaque déploiement
 * rapprocherait un compte rendu de l'échec définitif.
 *
 * Mutation qui rougit : dans `traiterErreur`, traiter `InterruptionArret`
 * comme une erreur passagère → `echecs` passe à 1. Contre-témoin : une vraie
 * panne, elle, compte. Angle mort : un arrêt BRUTAL (SIGKILL, mémoire)
 * laisse le verrou expirer : le balayage le rend sans compter d'échec, mais
 * cette prise-là reste imputée au plafond de 10 exécutions (boucle de plantages).
 */

import { describe, expect, it } from "vitest";

import { executerEtape, type Gestionnaire } from "../etapes";
import { ErreurVisio } from "../openai/erreurs";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";

describe("un arrêt du worker ne consomme pas une tentative", () => {
  it("SIGTERM entre deux tranches : a_faire, 0 échec, une interruption", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "transcrire",
    });
    let arret = false;
    const g: Gestionnaire = async (ctx) => {
      ctx.verifierArret(); // tranche 1
      arret = true; // SIGTERM reçu pendant la tranche 1
      ctx.verifierArret(); // tranche 2 : on s'arrête
      return { ecrire: async () => [] };
    };
    const deps = depsDeTest({ depot, gestionnaires: { transcrire: g }, arret: () => arret });
    expect(await executerEtape(deps, t.id)).toBe("relachee");
    expect(depot.ligne(t.id)).toMatchObject({ statut: "a_faire", echecs: 0, interruptions: 1 });
  });

  it("contre-témoin : une panne passagère, elle, compte", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "transcrire",
    });
    const g: Gestionnaire = async () => {
      throw new ErreurVisio("passagere", "fournisseur_indisponible", "x");
    };
    await executerEtape(depsDeTest({ depot, gestionnaires: { transcrire: g } }), t.id);
    expect(depot.ligne(t.id).echecs).toBe(1);
  });
});
