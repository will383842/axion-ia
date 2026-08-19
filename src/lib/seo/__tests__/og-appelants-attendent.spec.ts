/**
 * Tout appelant de `buildProductMetadata` doit ATTENDRE sa promesse.
 *
 * 🔴 CE QUE CETTE GARDE PROTÈGE — recensement OG du 2026-08-17.
 *
 * En branchant la surcharge d'aperçu, `buildProductMetadata` est devenue
 * asynchrone. 39 pages l'appelaient sous une forme que TypeScript ne peut pas
 * corriger :
 *
 *     const meta = buildProductMetadata({ … });      // meta est une PROMESSE
 *     return { ...meta, robots: { index: false } };  // …et un spread de
 *                                                    //   promesse ne rend RIEN
 *
 * 🔑 LE COMPILATEUR EST AVEUGLE À CE DÉFAUT, ET C'EST TOUT LE SUJET.
 * Répandre une promesse dans un objet littéral est légal : elle n'a aucune
 * propriété énumérable propre, donc le spread ajoute zéro champ. Tous les
 * champs de `Metadata` étant optionnels, l'objet vide reste un `Metadata`
 * valide. `tsc --noEmit` passait au VERT sur les 39 pages — vérifié.
 *
 * Le résultat en production n'aurait pas été « un aperçu un peu faux » : la
 * page d'accueil, `/fr/audit`, `/fr/appel`, `/fr/catalogue` et 35 autres
 * auraient perdu leur `<title>`, leur canonique, leurs hreflang et tout leur
 * bloc OpenGraph d'un seul coup. Rien dans le build ne l'aurait signalé.
 *
 * 🔑 POURQUOI `return` EST TOLÉRÉ. `return buildProductMetadata({ … })` depuis
 * une fonction déclarée `Promise<Metadata>` est correct — Next attend la valeur
 * rendue — et le jour où quelqu'un écrit cette ligne dans une fonction typée
 * `Metadata`, c'est TypeScript qui rougit. Cette garde ne couvre donc que les
 * deux formes que le compilateur ne voit PAS : l'affectation et le spread.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Racines parcourues : là où vivent les `generateMetadata` du site. */
const RACINES = ["src/app", "src/components"] as const;

const APPEL = "buildProductMetadata(";

/**
 * Les tests sont exclus du parcours.
 *
 * Sans cette exclusion, la garde trouverait ses propres exemples — ceux du
 * cartouche ci-dessus, écrits exprès sous la forme fautive — et rougirait
 * éternellement sur elle-même. Un test statique qui se lit lui-même ne prouve
 * plus rien sur le code.
 */
function fichiersSources(racine: string): ReadonlyArray<string> {
  const trouves: string[] = [];
  const parcourir = (dossier: string): void => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) {
        if (entree.name === "__tests__" || entree.name === "node_modules") continue;
        parcourir(chemin);
        continue;
      }
      if (/\.tsx?$/.test(entree.name) && !entree.name.endsWith(".d.ts")) trouves.push(chemin);
    }
  };
  parcourir(join(process.cwd(), racine));
  return trouves;
}

/** Les appels d'un fichier qui ne sont ni attendus, ni rendus directement. */
function appelsNonAttendus(chemin: string): ReadonlyArray<string> {
  const source = readFileSync(chemin, "utf8");
  if (!source.includes(APPEL)) return [];

  const fautifs: string[] = [];
  source.split("\n").forEach((ligne, i) => {
    const colonne = ligne.indexOf(APPEL);
    if (colonne < 0) return;
    const avant = ligne.slice(0, colonne);
    // `await` couvre l'affectation et le spread ; `return` est déjà couvert par
    // le typage de la fonction appelante. Le reste est un défaut silencieux.
    if (/\b(await|return)\s*$/.test(avant)) return;
    fautifs.push(
      `${chemin.replace(process.cwd(), "").replace(/\\/g, "/")}:${i + 1} → ${ligne.trim()}`,
    );
  });
  return fautifs;
}

describe("buildProductMetadata — aucun appelant ne laisse traîner la promesse", () => {
  const fichiers = RACINES.flatMap(fichiersSources);
  const appelants = fichiers.filter((f) => readFileSync(f, "utf8").includes(APPEL));

  it("sanity — le parcours voit bien les appelants (une garde qui ne lit rien ne garde rien)", () => {
    expect(fichiers.length).toBeGreaterThan(500);
    // Le site compte ~146 pages qui passent par la fabrique. Le seuil est bas
    // exprès : il n'attrape pas une page retirée, il attrape un parcours cassé.
    expect(appelants.length).toBeGreaterThan(100);
  });

  it("aucun appel n'est laissé sans `await`", () => {
    const fautifs = appelants.flatMap(appelsNonAttendus);
    expect(
      fautifs,
      "Ces appels rendent une promesse là où un objet est attendu. Un spread de " +
        "promesse n'ajoute AUCUN champ : la page perdrait titre, canonique, " +
        "hreflang et OpenGraph, sans que TypeScript ni le build ne rougissent.\n" +
        fautifs.join("\n"),
    ).toEqual([]);
  });
});
