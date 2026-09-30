/**
 * ⛔ LES CODES D'ALERTE DU CIRCUIT SONT AU CATALOGUE (anti-doublon A3).
 *
 * Une alerte `visio.*` absente du catalogue n'a ni guichet ni motif : elle
 * resterait ouverte pour toujours sans que personne sache qui doit agir. Et
 * aucun code d'alerte n'est écrit en dur dans le circuit : tous viennent de
 * `CODES_ALERTES_CIRCUIT`.
 *
 * Mutation qui rougit : écrire `code: "visio.nouvelle"` dans `etapes.ts` →
 * 2ᵉ cas. V1 C3 : recréer un objet de codes `visio.*` hors de `alertes.ts`
 * (comme l'était `CODES_ALERTES_VISIO` de `balayage-enregistreur.ts`), ou
 * marquer « envoyée » ailleurs que par `signalerUneFois` (`notifiedAt:`,
 * `telegramLe`) → 3ᵉ cas. Contre-témoin : chaque code déclaré est bien au catalogue, avec le
 * guichet de la direction. Angle mort : un code construit par concaténation.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ALERTE_CATALOGUE } from "@/server/qualiopi/alertes/catalogue";
import { CODES_ALERTES_VISIO } from "../alertes";
import { CODES_ALERTES_CIRCUIT } from "../alertes-circuit";

describe("les codes d'alerte du circuit sont au catalogue", () => {
  it("chaque code déclaré est au catalogue, sans résolution automatique, pour la direction", () => {
    for (const code of Object.values(CODES_ALERTES_CIRCUIT)) {
      expect(ALERTE_CATALOGUE[code], code).toBeDefined();
      expect(ALERTE_CATALOGUE[code]?.resolutionAuto).toBe(false);
      expect(ALERTE_CATALOGUE[code]?.guichet).toBe("direction");
    }
  });

  it("aucun code `visio.*` écrit en dur dans les modules du circuit", () => {
    const dossier = path.resolve(__dirname, "..");
    const fautifs = readdirSync(dossier)
      .filter(
        (f) =>
          f.endsWith(".ts") &&
          f !== "alertes-circuit.ts" &&
          f !== "balayage-enregistreur.ts" &&
          f !== "temoin-cle.ts",
      )
      .filter((f) => /code:\s*["'`]visio\./.test(readFileSync(path.join(dossier, f), "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("un seul objet de codes visio.*, une seule règle « envoyée une fois » (V1 C3)", () => {
    expect(CODES_ALERTES_CIRCUIT).toBe(CODES_ALERTES_VISIO);
    const dossier = path.resolve(__dirname, "..");
    const modules = readdirSync(dossier).filter((f) => f.endsWith(".ts") && f !== "alertes.ts");
    const lire = (f: string) => readFileSync(path.join(dossier, f), "utf8");
    expect(modules.filter((f) => /["']visio\.[a-z_]+["']/.test(lire(f)))).toEqual([]);
    expect(modules.filter((f) => /notifiedAt\s*:|telegramLe/.test(lire(f)))).toEqual([]);
  });
});
