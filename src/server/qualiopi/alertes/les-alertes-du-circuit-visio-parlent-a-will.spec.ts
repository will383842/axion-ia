/**
 * m-5 (2e vérification du chantier visio, reste d'UX-05) — les titres des
 * alertes techniques de la visio parlaient de « worker », de « témoin de clé »
 * et de base « migrée ». Will lit ces titres : ils disent ce qui est bloqué et
 * quoi faire, sans jargon.
 *
 * Angle mort : les titres posés à la levée par `etapes.ts` (étape inconnue,
 * schéma en retard) — fichier hors de ce lot.
 *
 * Mutation qui rougit : remettre un des anciens titres.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALERTE_CATALOGUE } from "./catalogue";

const JARGON = /worker|témoin|migr|déploiement|schéma/i;

describe("m-5 — les alertes de la visio parlent à Will", () => {
  it.each(["visio.temoin_cle", "visio.etape_sans_gestionnaire", "visio.schema_en_retard"])(
    "%s : titre sans jargon, qui dit quoi faire",
    (code) => {
      const titre = ALERTE_CATALOGUE[code]?.titre ?? "";
      expect(titre).not.toMatch(JARGON);
      expect(titre).toContain("prévenez Claude");
    },
  );

  it("le balayage de l'enregistreur lève le témoin de clé sous le même titre", () => {
    const src = readFileSync("src/server/visio/balayage-enregistreur.ts", "utf8");
    expect(src).not.toContain("le worker ne relit pas le témoin de clé");
    expect(src).toContain(`titre: ${JSON.stringify(ALERTE_CATALOGUE["visio.temoin_cle"]?.titre)}`);
  });
});
