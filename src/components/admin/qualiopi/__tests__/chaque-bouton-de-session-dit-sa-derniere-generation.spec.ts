/**
 * 🔴 Le bouton « Organisation de l'action » ne disait jamais « · génération du
 * JJ/MM/AAAA — régénérer » (constaté le 2026-09-30, audit de la fiche session).
 *
 * La pièce « Organisation de l'action (R.6351-5) » existait bien au registre de
 * la session, et `dernierSessionParType` la connaissait sous la clé
 * `organisation_action`. Mais le bouton était le seul de la grille « Session »
 * à ne pas recevoir `dejaGenereLe` : il restait en primary « Générer », comme
 * une pièce encore à produire, et régénérer ne demandait aucun motif de
 * rectification.
 *
 * Garde STRUCTURELLE (même parti que les deux gardes voisines de ce dossier) :
 * chaque bouton de pièce de session porte `dejaGenereLe`, lu dans
 * `dernierSessionParType` sous SA PROPRE clé — un copier-coller qui lirait la
 * date d'un autre type rougit aussi.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "src/components/admin/qualiopi/DocumentsSection.tsx"),
  "utf8",
);

/** Les éléments `<SessionDocButton … key="x" … />` / `<ConventionDocButton …>` à clé littérale. */
function boutonsDeSession(): Array<{ cle: string; bloc: string }> {
  return [
    ...SOURCE.matchAll(/<(?:Session|Convention)DocButton\s+key="([a-z_]+)"([\s\S]*?)\/>/g),
  ].map((m) => ({ cle: m[1] as string, bloc: m[2] as string }));
}

describe("bloc Documents — chaque bouton de session dit sa dernière génération", () => {
  it("le recensement TROUVE les boutons — sinon la garde ne garde rien", () => {
    const cles = boutonsDeSession().map((b) => b.cle);
    expect(cles.length).toBeGreaterThanOrEqual(8);
    expect(cles).toContain("organisation_action");
  });

  it("chaque bouton reçoit dejaGenereLe lu sous sa propre clé", () => {
    const fautifs = boutonsDeSession()
      .filter(
        ({ cle, bloc }) => !bloc.includes(`dejaGenereLe={dernierSessionParType.get("${cle}")}`),
      )
      .map((b) => b.cle);
    expect(fautifs).toEqual([]);
  });
});
