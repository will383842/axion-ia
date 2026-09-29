/**
 * ⛔ LE DRAPEAU NE LIT QUE SES DEUX VARIABLES (PR 5 ; décision de Will du
 * 29/09, LOTS-EXECUTION §0, ligne « Préavis »).
 *
 * Remplace `avant-la-pr8-ouvert-vaut-pilote.spec.ts`, qui figeait la règle
 * abandonnée (« `ouvert` attend la fin du préavis »). Désormais `ouvert` est
 * `ouvert` : le préavis ne bloque que les clients ACTIFS, rencontre par
 * rencontre (`preavis-clients-actifs.ts`, gardé par trois autres tests).
 *
 * `effectif` est celui de `modeEffectif` (`ouverture.ts`, PR 8 ; anti-doublon
 * D2) : `ouvert` ne s'applique que si la notice publique l'annonce.
 *
 * Mutation qui rougit : réintroduire dans `drapeau.ts` une lecture du préavis
 * (`PREAVIS`, `finLe`), une déclaration de `DICTEE_ANNONCEE` ou un autre
 * import que `./ouverture` → le 2e cas. Ne plus passer par `modeEffectif` → le
 * 1er cas (et `le-drapeau-ouvert-attend-la-notice-publique.spec.ts`).
 * Contre-témoin : `ferme` par défaut, une valeur mal saisie reste `ferme`.
 * Angle mort : la garde lit le SOURCE ; un préavis relu par un détour (un
 * autre module importé) ne se verrait qu'au 1er cas.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lireDrapeauEnregistrement } from "../drapeau";
import { modeEffectif } from "../ouverture";

describe("⛔ le drapeau ne lit que ses deux variables", () => {
  it("« ouvert » suit la notice publique (`modeEffectif`), sans attendre de date de préavis", () => {
    const attendu = modeEffectif("ouvert");
    expect(lireDrapeauEnregistrement({ ENREGISTREMENT_VISIO_OUVERT: "true" })).toEqual({
      demande: "ouvert",
      effectif: attendu.mode,
      motif: attendu.motif,
    });
    expect(lireDrapeauEnregistrement({ ENREGISTREMENT_VISIO_PILOTE: "true" }).effectif).toBe(
      "pilote",
    );
  });

  it("le source ne connaît ni le préavis, ni la dictée annoncée", () => {
    const source = readFileSync(join(process.cwd(), "src/server/visio/drapeau.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/PREAVIS|finLe|maintenant|DICTEE_ANNONCEE/);
    // Un seul import : la règle d'ouverture unique.
    expect(code.match(/^import .*$/gm)).toEqual(['import { modeEffectif } from "./ouverture";']);
  });

  it("contre-témoin : rien de posé ou une valeur mal saisie → fermé", () => {
    expect(lireDrapeauEnregistrement({}).effectif).toBe("ferme");
    expect(lireDrapeauEnregistrement({ ENREGISTREMENT_VISIO_OUVERT: "oui" }).effectif).toBe(
      "ferme",
    );
  });
});
