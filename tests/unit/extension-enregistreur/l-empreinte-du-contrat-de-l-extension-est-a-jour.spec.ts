/**
 * L'empreinte du contrat de l'extension est à jour (PR 5) : `contrat.sha256`
 * est le SHA-256 de `contrat.json`. Un contrat retouché à la main (sans
 * `pnpm enregistreur:contrat`) rougit ici, même si le Zod n'a pas bougé.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DOSSIER_EXTENSION } from "./outils";

describe("l'empreinte du contrat de l'extension est à jour", () => {
  it("contrat.sha256 = sha256(contrat.json)", () => {
    const texte = readFileSync(join(DOSSIER_EXTENSION, "contrat.json"), "utf8").replace(
      /\r\n/g,
      "\n",
    );
    const attendue = createHash("sha256").update(texte, "utf8").digest("hex");
    const lue = readFileSync(join(DOSSIER_EXTENSION, "contrat.sha256"), "utf8").trim();
    expect(lue).toBe(attendue);
  });
});
