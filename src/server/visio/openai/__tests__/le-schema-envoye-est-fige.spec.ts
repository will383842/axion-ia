/**
 * ⛔ LE SCHÉMA ENVOYÉ EST FIGÉ (ADR 0055 §1.3).
 *
 * Le JSON Schema que `zodTextFormat` produit pour chaque schéma du circuit
 * est comparé au fichier `schemas/<nom>.schema.json`. Toute modification
 * d'un schéma Zod se voit donc en revue (le diff du `.schema.json`), et doit
 * s'accompagner d'une version qui monte.
 *
 * Régénérer : `pnpm exec tsx scripts/visio/figer-schemas.ts`.
 *
 * Mutation qui rougit : ajouter un champ à `extractionV1` sans régénérer.
 * Contre-témoin : un schéma différent ne correspond pas au fichier figé.
 * Angle mort : que la version monte n'est pas vérifié automatiquement — la
 * revue le lit dans le diff.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { formatDeSortie } from "../client";
import { SCHEMAS_VISIO } from "../../schemas";

const DOSSIER = path.resolve(__dirname, "../../schemas");

describe("le schéma envoyé est figé", () => {
  for (const s of Object.values(SCHEMAS_VISIO)) {
    it(`${s.nom} = ${s.fichier}`, () => {
      const fige = JSON.parse(readFileSync(path.join(DOSSIER, s.fichier), "utf8")) as unknown;
      expect(formatDeSortie(s.schema, s.nom).schema).toEqual(fige);
    });
  }

  it("contre-témoin : un schéma modifié ne correspond plus", () => {
    const fige = JSON.parse(
      readFileSync(path.join(DOSSIER, SCHEMAS_VISIO.emailSuivi.fichier), "utf8"),
    ) as unknown;
    const modifie = z.object({ objet: z.string(), ajout: z.string() });
    expect(formatDeSortie(modifie, SCHEMAS_VISIO.emailSuivi.nom).schema).not.toEqual(fige);
  });
});
