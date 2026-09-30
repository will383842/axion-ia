/**
 * ⛔ LE CONTRAT GÉNÉRÉ SUIT LE ZOD (chantier visio, PR 5).
 *
 * `extensions/enregistreur-meet/contrat.json` est GÉNÉRÉ depuis
 * `src/lib/schemas/enregistreur.ts` par `pnpm enregistreur:contrat`. Un
 * changement d'un seul côté — le Zod modifié sans régénérer, ou le fichier
 * retouché à la main — rougit ici. Même garde pour l'empreinte `contrat.sha256`.
 *
 * Mutation qui rougit : changer une constante de `DELAIS_LOCAUX` (ou un champ
 * d'un schéma) sans relancer la commande → le 1er cas rougit.
 * Contre-témoin : le fichier régénéré est identique octet pour octet.
 * Angle mort : une extension déjà chargée dans Chrome garde l'ANCIEN contrat
 * tant que Will ne l'a pas rechargée ; l'en-tête `x-enregistreur-contrat` et le
 * battement de l'appareil (version) le montrent.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { texteDuContrat } from "@/lib/schemas/enregistreur";

const DOSSIER = join(process.cwd(), "extensions", "enregistreur-meet");

function lireSansCr(chemin: string): string {
  // Une copie Windows peut porter des fins de ligne CRLF : le contrat, lui, est en LF.
  return readFileSync(chemin, "utf8").replace(/\r\n/g, "\n");
}

describe("⛔ le contrat généré suit le Zod", () => {
  it("contrat.json est exactement ce que produit le Zod (pnpm enregistreur:contrat)", () => {
    expect(lireSansCr(join(DOSSIER, "contrat.json"))).toBe(texteDuContrat());
  });

  it("contrat.sha256 est l'empreinte du contrat produit", () => {
    const attendue = createHash("sha256").update(texteDuContrat(), "utf8").digest("hex");
    expect(lireSansCr(join(DOSSIER, "contrat.sha256")).trim()).toBe(attendue);
  });

  it("contre-témoin : un contrat modifié ne serait pas accepté", () => {
    const modifie = texteDuContrat().replace('"accordMaxMs": 180000', '"accordMaxMs": 181000');
    expect(modifie).not.toBe(texteDuContrat());
  });
});
