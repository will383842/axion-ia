/**
 * Le build ne va chercher aucune fonte chez un tiers.
 *
 * POURQUOI CE FICHIER EXISTE. Le chargeur de fontes Google de Next télécharge
 * le CSS puis les `.woff2` **pendant le build**. Le build de production
 * dépendait donc d'un fetch vivant vers un serveur qu'on ne maîtrise pas.
 *
 * Le 2026-08-16 la facture est tombée : gstatic a répondu `404` sur des URLs
 * que son propre CSS venait de servir aux runners GitHub. Dernier déploiement
 * réussi à 14 h 51 ; **plus un seul build n'est passé après 15 h 56**, et trois
 * gates ont rougi sur du code parfaitement sain. Un correctif de documentation
 * (#648) et un correctif de chemins d'images (#657) ont été bloqués par une
 * panne qui n'avait rien à voir avec eux.
 *
 * Ce défaut ne figurait dans AUCUN des 155 constats de l'audit GEO/AEO du
 * 2026-08-14 : on audite les tiers dont dépend une PAGE, jamais ceux dont
 * dépend un BUILD.
 *
 * Ce que ce fichier interdit, c'est la RÉCIDIVE. Réintroduire le chargeur
 * Google quelque part sous `src/` remet le point de rupture en place, et il ne
 * se verra que le jour où le tiers tombera — c'est-à-dire au pire moment.
 *
 * ⚠️ RÈGLE DE RÉDACTION. Un test statique qui cherche une chaîne dans le dépôt
 * finit par trouver SES PROPRES commentaires (piège payé plusieurs fois ici).
 * L'aiguille est donc ASSEMBLÉE À L'EXÉCUTION à partir de morceaux : le
 * littéral complet n'apparaît nulle part dans ce fichier, et le premier test
 * ci-dessous le vérifie en s'inspectant lui-même.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Vitest s'exécute depuis la racine du dépôt (`pnpm test`). On évite
// `import.meta.dirname` : la transformation SSR de Vitest ne le garantit pas.
const RACINE = process.cwd();

const MOI_MEME = "tests/unit/ci/fontes-build-hermetique.spec.ts";

// Assemblé à l'exécution — voir la règle de rédaction en tête de fichier.
const MODULE_DISTANT = ["next", "font", "google"].join("/");

/**
 * On cherche l'IMPORT, pas la mention.
 *
 * Première rédaction de ce garde : il cherchait le nom du module tout court.
 * Il a rougi sur les commentaires des deux layouts, qui expliquent justement
 * pourquoi on a quitté ce chargeur. Interdire d'en PARLER effacerait la seule
 * trace du raisonnement au premier refactor venu — c'est le contraire du but.
 * Ce qui doit être interdit, c'est le mécanisme : la clause d'import.
 */
const IMPORTS_INTERDITS = [
  `from "${MODULE_DISTANT}"`,
  `from '${MODULE_DISTANT}'`,
  `require("${MODULE_DISTANT}")`,
  `import("${MODULE_DISTANT}")`,
];

function importeLeChargeurDistant(source: string): boolean {
  return IMPORTS_INTERDITS.some((clause) => source.includes(clause));
}

/** Les deux layouts qui déclarent les fontes du site et de la console. */
const LAYOUTS = [
  "src/app/[locale]/layout.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/layout.tsx",
];

function lire(relatif: string): string {
  return readFileSync(path.join(RACINE, relatif), "utf8");
}

/** Tous les `.ts`/`.tsx` sous `src/`, hors dossiers générés. */
function fichiersSource(): string[] {
  const ignores = new Set(["node_modules", ".next", "generated"]);
  const trouves: string[] = [];

  const parcourir = (relatif: string) => {
    for (const entree of readdirSync(path.join(RACINE, relatif), { withFileTypes: true })) {
      if (ignores.has(entree.name)) continue;
      const enfant = `${relatif}/${entree.name}`;
      if (entree.isDirectory()) parcourir(enfant);
      else if (/\.tsx?$/.test(entree.name)) trouves.push(enfant);
    }
  };
  parcourir("src");
  return trouves;
}

/**
 * Les fichiers de fonte réellement cités par les layouts — lus dans le code,
 * pas recopiés ici. Une liste en dur dériverait du code sans que rien ne le
 * signale, et le test protégerait alors un état passé.
 */
function fontesDeclarees(): string[] {
  const noms = new Set<string>();
  for (const layout of LAYOUTS) {
    for (const m of lire(layout).matchAll(/fonts\/([A-Za-z0-9._-]+\.woff2)/g)) {
      if (m[1]) noms.add(m[1]);
    }
  }
  return [...noms].sort();
}

describe("le build ne dépend d'aucun tiers pour ses fontes", () => {
  it("ce fichier ne contient pas lui-même l'aiguille qu'il cherche", () => {
    // Garde-fou du garde-fou : si quelqu'un écrivait un jour la clause
    // d'import en clair dans un commentaire ci-dessus, les assertions
    // suivantes deviendraient auto-réalisatrices et cesseraient de protéger
    // quoi que ce soit.
    expect(importeLeChargeurDistant(lire(MOI_MEME))).toBe(false);
  });

  it("aucun fichier de `src/` ne charge une fonte depuis le chargeur Google", () => {
    const fautifs = fichiersSource().filter((f) => importeLeChargeurDistant(lire(f)));
    expect(fautifs).toEqual([]);
  });

  it("les deux layouts déclarent bien leurs fontes en local", () => {
    // L'inverse du test précédent : « plus de chargeur Google » serait aussi
    // vrai d'un layout qui ne déclarerait plus AUCUNE fonte.
    for (const layout of LAYOUTS) {
      expect(lire(layout)).toContain('from "next/font/local"');
    }
    expect(fontesDeclarees().length).toBeGreaterThanOrEqual(5);
  });

  it("chaque fichier de fonte déclaré existe réellement dans le dépôt", () => {
    // Un chemin mort ne casse pas le typecheck : il ne casse que le BUILD.
    // C'est exactement la classe de panne qu'on vient d'arrêter de tolérer.
    const manquants = fontesDeclarees().filter(
      (f) => !existsSync(path.join(RACINE, "src", "fonts", f)),
    );
    expect(manquants).toEqual([]);
  });

  it("les fichiers de fonte sont de vrais woff2, pas des marque-places", () => {
    // Signature `wOF2` en tête. Un fichier vide, tronqué, ou remplacé par un
    // pointeur LFS passerait `existsSync` sans qu'aucun glyphe ne s'affiche.
    const suspects = fontesDeclarees().filter((f) => {
      const octets = readFileSync(path.join(RACINE, "src", "fonts", f));
      return octets.length < 1024 || octets.subarray(0, 4).toString("latin1") !== "wOF2";
    });
    expect(suspects).toEqual([]);
  });
});
