/**
 * ⛔ UNE ÉTAPE SANS GESTIONNAIRE ALERTE (V1, F4).
 *
 * Fenêtre app/worker : l'app peut programmer une étape (questionnaire,
 * lecture des réponses, e-mail de suivi) que le worker en place ne sait pas
 * encore exécuter (retour arrière du worker, déploiement du worker en échec).
 * L'étape était suspendue EN SILENCE : la console annonçait « d'ici quelques
 * minutes » et rien ne venait. Elle lève maintenant
 * `visio.etape_sans_gestionnaire`, en nommant l'étape, pour que Will sache
 * quoi reprendre. Code DISTINCT de `visio.circuit_suspendu` : l'anti-doublon
 * porte sur (code, cible nulle), et une pause « quota » déjà ouverte avalait
 * l'alerte qui nomme l'étape.
 *
 * Mutation qui rougit : retirer l'appel à `alerter` de la branche « pas de
 * gestionnaire » d'`executerEtape`.
 * Contre-témoin : une étape qui a son gestionnaire ne lève aucune alerte.
 * Angle mort : la reprise reste manuelle (« Reprendre » sur l'état du
 * circuit), une fois le bon worker en place.
 */

import { describe, expect, it } from "vitest";

import { CODES_ALERTES_VISIO } from "../alertes";
import { executerEtape, type Gestionnaire } from "../etapes";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";

const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";

describe("⛔ une étape sans gestionnaire alerte", () => {
  it("l'étape est suspendue ET une alerte nomme l'étape", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "questionnaire" });
    const deps = depsDeTest({ depot, gestionnaires: {} });
    expect(await executerEtape(deps, t.id)).toBe("suspendue");
    expect(depot.ligne(t.id)).toMatchObject({ statut: "suspendu", classeErreur: "configuration" });
    expect(deps.alertes).toHaveLength(1);
    expect(deps.alertes[0]).toMatchObject({ code: "visio.etape_sans_gestionnaire" });
    expect(deps.alertes[0]!.code).not.toBe(CODES_ALERTES_VISIO.circuitSuspendu);
    expect(deps.alertes[0]!.message).toContain("« questionnaire »");
    expect(deps.alertes[0]!.message).toMatch(/Reprendre/);
  });

  it("contre-témoin : une étape qui a son gestionnaire ne lève aucune alerte", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "questionnaire" });
    const g: Gestionnaire = async () => ({ ecrire: async () => [] });
    const deps = depsDeTest({ depot, gestionnaires: { questionnaire: g } });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(deps.alertes).toEqual([]);
  });
});
