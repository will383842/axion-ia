/**
 * CLIQUET — deux composants du même nom sont une divergence en attente.
 *
 * ## Le défaut mesuré (2026-08-25, cahier D7-2)
 *
 * `AdminTabs.tsx` existait à **deux** emplacements :
 *
 * | | `admin/AdminTabs.tsx` | `admin/ui/AdminTabs.tsx` |
 * |---|---|---|
 * | appelants | **2** (`tunnels/layout`, `documents-interventions/layout`) | **0** |
 * | `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls` | **oui** | **NON** |
 * | testé | oui | non |
 *
 * 🔴 **Et le barrel exportait la MAUVAISE.** `index.ts` faisait
 * `export { AdminTabs } from "./AdminTabs"` — c'est-à-dire la version **sans
 * aucun rôle ARIA**. Un `import { AdminTabs } from "@/components/admin/ui"`
 * rendait donc silencieusement des onglets qu'un lecteur d'écran ne peut pas
 * annoncer, alors que l'implémentation correcte existait à côté.
 *
 * *Le piège n'était pas la duplication : c'était que le chemin le plus naturel
 * — le barrel — menait à la moins bonne des deux.*
 *
 * ## Ce que ce fichier verrouille
 *
 * Il ne nomme pas `AdminTabs`. Il **dérive la classe** : deux fichiers de
 * composant portant le même nom sous `components/admin/**` sont refusés.
 * Le prochain doublon sera vu sans qu'on touche à ce fichier — *une garde qui
 * nomme sa cible ne peut pas voir le jumeau*, et ce dépôt l'a payé assez de fois.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

import { describe, it, expect } from "vitest";

const ADMIN = join(process.cwd(), "src", "components", "admin");

/** Tous les composants `.tsx` de production sous `components/admin/**`. */
function composants(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    if (entree === "__tests__") continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      composants(chemin, acc);
    } else if (entree.endsWith(".tsx") && !/\.(test|spec)\.tsx$/.test(entree)) {
      acc.push(chemin);
    }
  }
  return acc;
}

describe("aucun composant admin n'existe en double", () => {
  const fichiers = composants(ADMIN);

  it("🔑 CONTRE-TÉMOIN : le balayage voit réellement les composants", () => {
    // Sans ceci, un dossier renommé rendrait une liste vide de doublons et le
    // test central passerait au vert sans avoir examiné un seul fichier.
    expect(
      fichiers.length,
      "le balayage ne trouve plus aucun composant sous components/admin/",
    ).toBeGreaterThanOrEqual(50);
  });

  it("deux fichiers du même nom ne coexistent pas", () => {
    const parNom = new Map<string, string[]>();
    for (const chemin of fichiers) {
      const nom = basename(chemin);
      const relatif = relative(ADMIN, chemin).split(sep).join("/");
      parNom.set(nom, [...(parNom.get(nom) ?? []), relatif]);
    }

    const doublons = [...parNom.entries()]
      .filter(([, chemins]) => chemins.length > 1)
      .map(([nom, chemins]) => `${nom} → ${chemins.join(" · ")}`);

    expect(
      doublons,
      "deux composants du même nom coexistent. Ils divergeront au premier " +
        "amendement, et le chemin le plus naturel — le barrel — n'en désigne " +
        "qu'un seul : rien ne garantit que ce soit le meilleur. C'est ce qui est " +
        "arrivé à `AdminTabs`, dont le barrel exportait la version SANS aucun " +
        "rôle ARIA alors que la version testée et accessible vivait à côté.",
    ).toEqual([]);
  });
});

describe("le barrel désigne bien l'implémentation accessible des onglets", () => {
  /**
   * ⚠️ Ce test-ci NOMME `AdminTabs`, et c'est délibéré.
   *
   * Le test précédent garde la CLASSE (pas de doublon). Celui-ci garde le FAIT
   * particulier qui a coûté : le barrel doit pointer vers une implémentation qui
   * porte réellement les rôles ARIA. Un doublon supprimé mais remplacé par un
   * ré-export vers une version muette repasserait le test de classe.
   */
  it("l'`AdminTabs` atteignable depuis le barrel porte ses rôles ARIA", () => {
    const barrel = readFileSync(join(ADMIN, "ui", "index.ts"), "utf8");
    const ligne = barrel.split("\n").find((l) => /export\s*\{[^}]*\bAdminTabs\b/.test(l));

    expect(ligne, "`AdminTabs` n'est plus exporté par le barrel admin/ui").toBeDefined();

    // Résout la cible du ré-export, relative au barrel.
    const cible = /from\s+"(\.[^"]+)"/.exec(ligne ?? "")?.[1];
    expect(cible, `cible du ré-export illisible dans : ${ligne}`).toBeDefined();

    const source = readFileSync(join(ADMIN, "ui", `${cible}.tsx`), "utf8");
    for (const marqueur of ['role="tablist"', 'role="tab"', "aria-selected", "aria-controls"]) {
      expect(
        source.includes(marqueur),
        `l'\`AdminTabs\` exporté par le barrel ne porte pas \`${marqueur}\` : ` +
          "un lecteur d'écran ne peut pas annoncer ces onglets.",
      ).toBe(true);
    }
  });
});
