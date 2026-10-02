/**
 * ⛔ LES DÉLAIS DU SERVEUR DÉRIVENT DU CONTRAT (PR 5).
 *
 * La règle des 3 minutes d'accord et les seuils d'alerte du jeton n'ont
 * qu'UNE déclaration. `DELAIS_SERVEUR` (publié à l'extension) lit la même
 * valeur : il ne peut pas s'en écarter.
 *
 * Révision du 02/10 : le jeton n'expire plus, le serveur n'applique plus les
 * seuils J-14/J-3. Ils restent PUBLIÉS dans le contrat v1 (inertes) : le
 * contrat de l'extension 1.3.0 ne change pas.
 *
 * Mutations qui rougissent : retaper `accordMaxMs: 180_000` dans
 * `DELAIS_SERVEUR` ; redéclarer `[14, 3]` dans `jeton.ts`.
 * Contre-témoin : les valeurs publiées restent 3 min et J-14/J-3.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DELAIS_LOCAUX,
  DELAIS_SERVEUR,
  SEUILS_ALERTE_JETON_JOURS,
} from "@/lib/schemas/enregistreur";

const lire = (chemin: string): string => readFileSync(join(process.cwd(), chemin), "utf8");

describe("⛔ les délais du serveur dérivent du contrat", () => {
  it("contre-témoin : 3 min, J-14 puis J-3", () => {
    expect(DELAIS_SERVEUR.accordMaxMs).toBe(180_000);
    expect([...DELAIS_SERVEUR.alerteJetonJours]).toEqual([14, 3]);
  });

  it("mêmes objets, pas des copies égales", () => {
    expect(DELAIS_SERVEUR.accordMaxMs).toBe(DELAIS_LOCAUX.accordMaxMs);
    expect(DELAIS_SERVEUR.alerteJetonJours).toBe(SEUILS_ALERTE_JETON_JOURS);
  });

  it("aucune valeur n'est retapée dans les sources", () => {
    const contrat = lire("src/lib/schemas/enregistreur.ts");
    const bloc = contrat.slice(contrat.indexOf("export const DELAIS_SERVEUR"));
    const serveur = bloc.slice(0, bloc.indexOf("} as const"));
    expect(serveur).toContain("accordMaxMs: DELAIS_LOCAUX.accordMaxMs");
    expect(serveur).toContain("alerteJetonJours: SEUILS_ALERTE_JETON_JOURS");
    expect(contrat.match(/\[\s*14\s*,\s*3\s*\]/g) ?? []).toHaveLength(1);
    expect(lire("src/server/visio/jeton.ts")).not.toMatch(/\[\s*14\s*,\s*3\s*\]/);
  });
});
