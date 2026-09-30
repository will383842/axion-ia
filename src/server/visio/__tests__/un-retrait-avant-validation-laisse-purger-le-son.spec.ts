// @vitest-environment node
/**
 * ⛔ UN RETRAIT AVANT LA VALIDATION LAISSE PURGER LE SON (B2 ; ADR 0056).
 *
 * Le retrait de l'accord programme `purger_audio`. Or l'écriture finale de
 * toute étape vérifiait l'absence de retrait (`exigerAucunRetrait`) — purge
 * comprise : les objets R2 étaient supprimés, mais l'écriture qui pose
 * `audioSupprimeLe` et passe les tranches en `purgee` était ANNULÉE à chaque
 * fois. Le balayage reprogrammait la purge toutes les 5 minutes jusqu'au
 * plafond, puis l'alerte critique « audio non purgé » partait — fausse.
 *
 * Mutation qui rougit : retirer `purger_audio` de
 * `ETAPES_PERMISES_APRES_RETRAIT`. Contre-témoin : toute autre étape, après
 * un retrait, n'écrit toujours RIEN. Angle mort : la chaîne de Gate D ne fait
 * le retrait qu'après la validation (son déjà purgé) ; le SQL de la garde est
 * lu ici sur une base espionne.
 */

import { describe, expect, it } from "vitest";

import { executerEtape, type Gestionnaire } from "../etapes";
import { depotEtapesPrisma, RetraitConstate, type EtapeTenue } from "../prise-d-etape";
import { purgerAudio } from "../purge-audio";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { baseEspion } from "../../../../tests/outils/base-espion";

function tenue(etape: EtapeTenue["etape"]): EtapeTenue {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    rencontreId: "00000000-0000-4000-8000-000000000002",
    etape,
    compteRenduId: null,
    execution: 1,
    interruptions: 0,
    echecs: 0,
    premierEchecLe: null,
  };
}

/** Une base où un retrait est enregistré pour la rencontre. */
function baseAvecRetrait() {
  return baseEspion({
    $queryRaw: ({ sql }) =>
      String(sql).includes("enregistrement_consentements") ? [{ un: 1 }] : [{ id: "x" }],
  });
}

describe("un retrait avant la validation laisse purger le son", () => {
  it("purger_audio aboutit : audioSupprimeLe est posé malgré le retrait", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "purger_audio" });
    depot.retraits.add("r1");
    const marques: string[] = [];
    const deps = depsDeTest({
      depot,
      gestionnaires: { purger_audio: purgerAudio },
      donnees: {
        audiosAPurger: async () => [
          {
            enregistrementId: "e1",
            trancheIds: ["t1"],
            cles: ["k1"],
            statut: "abandonne",
            audioAPurgerAvant: null,
            compteRenduValide: false,
          },
        ],
        supprimerObjet: async () => {},
        objetExiste: async () => false,
        marquerAudioPurge: async (_tx, a) => {
          marques.push(a.enregistrementId);
        },
      },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(marques).toEqual(["e1"]);
    expect(depot.ligne(t.id).statut).toBe("reussie");
  });

  it("le dépôt SQL ne lit pas le retrait pour la purge", async () => {
    const e = baseAvecRetrait();
    const suites = await depotEtapesPrisma(e.base).terminer(tenue("purger_audio"), async () => []);
    expect(suites).toEqual([]);
    expect(e.sqls.some((s) => s.sql.includes("enregistrement_consentements"))).toBe(false);
  });

  it("contre-témoin : une autre étape, après un retrait, n'écrit rien", async () => {
    const e = baseAvecRetrait();
    await expect(
      depotEtapesPrisma(e.base).terminer(tenue("extraire"), async () => []),
    ).rejects.toBeInstanceOf(RetraitConstate);
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "extraire" });
    depot.retraits.add("r1");
    const g: Gestionnaire = async () => ({ ecrire: async () => [] });
    expect(await executerEtape(depsDeTest({ depot, gestionnaires: { extraire: g } }), t.id)).toBe(
      "retrait",
    );
  });
});
