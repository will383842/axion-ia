/**
 * ⛔ UN PLAFOND ATTEINT SUSPEND LE CIRCUIT SANS TOUCHER AU KILL SWITCH DE CONTENT-GEN
 * (ADR 0055 §1.4).
 *
 * `cost_cap_reached` levé par le plafond partagé ⇒ l'étape passe `suspendu`
 * (classe `plafond`), TOUT ce qui attend est suspendu, une alerte technique
 * part — et le circuit ne touche à RIEN de content-gen : ni kill switch, ni
 * `recordPermanentProviderFailure`, ni `handleCostCapHit`.
 *
 * Mutation qui rougit : classer `cost_cap_reached` en `passagere` dans
 * `erreurs.ts` → l'étape repart en `a_faire` au lieu d'être suspendue.
 * Contre-témoin : aucun module du circuit n'importe ces fonctions (lecture du
 * code). Angle mort : le kill switch lui-même est l'affaire de content-gen.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { executerEtape, type Gestionnaire } from "../../etapes";
import { executerPasse } from "../passe";
import { z } from "zod";
import { depsDeTest, FauxDepot } from "../../../../../tests/outils/faux-circuit-visio";
import {
  fauxClient,
  fauxCout,
  reponseReussie,
} from "../../../../../tests/outils/faux-openai-visio";

const INTERDITS =
  /\b(handleCostCapHit|recordPermanentProviderFailure|activerKillSwitch|killSwitch|setKillSwitch)\b/;

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return n === "__tests__" ? [] : fichiers(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("un plafond atteint suspend le circuit sans toucher au kill switch de content-gen", () => {
  it("l'étape est suspendue (plafond), tout ce qui attend aussi, une alerte part", async () => {
    const depot = new FauxDepot();
    const cible = depot.ajouter({ rencontreId: "r1", etape: "extraire" });
    const autre = depot.ajouter({ rencontreId: "r2", etape: "rediger", compteRenduId: "cr2" });
    const cout = fauxCout(undefined, { plafondAtteint: true });
    const passe: Gestionnaire = async (ctx) => {
      await executerPasse(
        { client: ctx.deps.openai(), cout: ctx.deps.cout },
        {
          passe: "extraire",
          schema: z.object({}),
          nomSchema: "t",
          instructions: "i",
          entree: "e",
          jobId: ctx.jobId,
        },
      );
      return { ecrire: async () => [] };
    };
    const deps = depsDeTest({
      depot,
      cout: cout.port,
      gestionnaires: { extraire: passe },
      client: fauxClient(undefined, { reponses: [reponseReussie({})] }).client,
    });
    expect(await executerEtape(deps, cible.id)).toBe("suspendue");
    expect(depot.ligne(cible.id)).toMatchObject({
      statut: "suspendu",
      classeErreur: "plafond",
      derniereErreur: "plafond_atteint",
    });
    expect(depot.ligne(autre.id).statut).toBe("suspendu");
    expect(deps.alertes.map((a) => a.code)).toEqual(["visio.suspendu_plafond"]);
  });

  it("contre-témoin : aucun module du circuit ne touche au kill switch de content-gen", () => {
    const racine = path.resolve(__dirname, "../..");
    const fautifs = fichiers(racine).filter((f) =>
      INTERDITS.test(
        readFileSync(f, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, ""),
      ),
    );
    expect(fautifs).toEqual([]);
    // Le motif reconnaît bien un appel.
    expect(INTERDITS.test("await handleCostCapHit('openai')")).toBe(true);
  });
});
