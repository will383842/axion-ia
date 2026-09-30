// @vitest-environment node
/**
 * ⛔ UNE OPPOSITION À L'IA ARRÊTE LE CIRCUIT AVANT TOUT APPEL À OPENAI
 * (art. 21 ; « défaut = refus »).
 *
 * Le démarrage de l'enregistrement (PR 5) refuse une rencontre dont une
 * personne s'est opposée. Mais le circuit tourne APRÈS : une opposition
 * arrivée pendant une suspension (plafond, quota), ou un rattachement après
 * coup à une fiche qui en porte une, laissait « Réextraire » ou la reprise
 * automatique envoyer la voix ou le nom de la personne à OpenAI.
 *
 * L'opposition est relue avant CHAQUE étape (hors purge) : l'étape s'arrête
 * sans appeler son gestionnaire, les enregistrements passent « abandonné »,
 * la purge du son est programmée, Will est prévenu. Et les contacts opposés
 * ne figurent jamais dans `<contacts_connus>`.
 *
 * Mutation qui rougit : retirer le contrôle `oppositionIa` de
 * `executerEtape` ; ou retirer `oppositionIaLe: null` de `contactsDuClient`.
 * Contre-témoin : la purge du son passe malgré l'opposition ; sans
 * opposition, le gestionnaire est bien appelé.
 * Angle mort : une opposition posée PENDANT une étape déjà commencée n'est
 * relue qu'à l'étape suivante.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { executerEtape, type Gestionnaire } from "../etapes";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";

function gestionnaireEspion(): { g: Gestionnaire; appels: number[] } {
  const appels: number[] = [];
  return {
    appels,
    g: async () => {
      appels.push(1);
      return { ecrire: async () => [] };
    },
  };
}

describe("⛔ une opposition à l'IA arrête le circuit avant OpenAI", () => {
  for (const etape of ["transcrire", "extraire", "rediger"] as const) {
    it(`${etape} : aucun appel, échec définitif, son purgé, Will prévenu`, async () => {
      const depot = new FauxDepot();
      const t = depot.ajouter({ rencontreId: "r1", etape });
      const { g, appels } = gestionnaireEspion();
      const abandons: string[] = [];
      const deps = depsDeTest({
        depot,
        gestionnaires: { [etape]: g },
        donnees: {
          oppositionIa: async () => true,
          abandonnerPourOpposition: async (r) => {
            abandons.push(r);
          },
        },
      });
      expect(await executerEtape(deps, t.id)).toBe("echec_definitif");
      expect(appels).toEqual([]);
      expect(depot.ligne(t.id).statut).toBe("echec_definitif");
      expect(abandons).toEqual(["r1"]);
      expect(depot.lignes.some((l) => l.etape === "purger_audio" && l.statut === "a_faire")).toBe(
        true,
      );
      expect(deps.alertes.map((a) => a.titre).join()).toMatch(/opposée à l'IA/);
    });
  }

  it("contre-témoin : la purge du son passe malgré l'opposition", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "purger_audio" });
    const { g, appels } = gestionnaireEspion();
    const deps = depsDeTest({
      depot,
      gestionnaires: { purger_audio: g },
      donnees: { oppositionIa: async () => true },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(appels).toEqual([1]);
  });

  it("contre-témoin : sans opposition, l'étape s'exécute", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "extraire" });
    const { g, appels } = gestionnaireEspion();
    const deps = depsDeTest({ depot, gestionnaires: { extraire: g } });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(appels).toEqual([1]);
  });

  it("les contacts opposés ne partent jamais dans <contacts_connus>", () => {
    const src = readFileSync(path.resolve(__dirname, "../depot-donnees.ts"), "utf8");
    const bloc = /async function contactsDuClient[\s\S]*?\n\}/.exec(src)?.[0] ?? "";
    expect(bloc).toMatch(/where:\s*\{\s*clientId,\s*oppositionIaLe:\s*null\s*\}/);
  });
});
