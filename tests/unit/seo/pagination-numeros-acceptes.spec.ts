// @vitest-environment node
//
// Environnement `node` : lecture de fichiers du dépôt.

/**
 * Les numéros de page acceptés par les routes paginées.
 *
 * ## Le défaut, mesuré en production le 2026-08-17
 *
 * `/connaissances/page/[num]` et `/blog/page/[num]` validaient le numéro avec
 * `/^[2-9]\d*$/`. Cette classe de caractères porte sur le **premier chiffre**,
 * pas sur la valeur : elle rejetait donc **10 à 19**, **100 à 199**… tout en
 * acceptant 20 et 99.
 *
 * L'intention était « pas de zéro en tête, et ≥ 2 ». L'écriture disait « ne
 * commence pas par 1 ».
 *
 * Conséquence sur `/connaissances` : 507 fiches publiques, soit **11 pages** —
 * mais `page/10` et `page/11` répondaient 404. Neuf pages atteignables × 48 =
 * **432 fiches liées**, et **75 restaient orphelines** alors que le correctif
 * GEO-088 était censé les avoir toutes reliées.
 *
 * ## 🔑 Ce que cette histoire coûte, et pourquoi la garde existe
 *
 * Le compte en base était **juste depuis le début**. J'ai cherché le défaut du
 * côté des DONNÉES pendant des heures — embargo, `publishedAt: null`, fiches
 * `deprecated`, divergence des prédicats sitemap/hub — et il a fallu **trois
 * requêtes en production** pour innocenter successivement chaque piste avant
 * que je regarde la ligne de validation.
 *
 * Un écart entre « ce que le système contient » et « ce qu'il sert » n'est pas
 * forcément dans les données ni dans la requête : il peut être dans le
 * ROUTEUR, qui refuse l'adresse avant que quiconque interroge quoi que ce soit.
 *
 * Sur `/blog`, le même défaut était **latent** — le blog n'a que 5 pages
 * aujourd'hui. Il aurait mordu à la dixième, des mois plus tard, sans lien
 * visible avec la cause.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const lire = (r: string): string => readFileSync(path.join(RACINE, r), "utf8");

const ROUTES = [
  "src/app/[locale]/connaissances/page/[num]/page.tsx",
  "src/app/[locale]/blog/page/[num]/page.tsx",
];

/**
 * Rejoue la validation telle qu'elle est ÉCRITE dans la route, en extrayant sa
 * regex du fichier. On ne recopie pas la règle ici : une garde qui réimplémente
 * ce qu'elle vérifie ne vérifie qu'elle-même.
 */
function validateurDe(fichier: string): (raw: string) => number | "one" | null {
  const src = lire(fichier);
  const m = /if \(!\/(\^[^/]+\$)\/\.test\(raw\)\) return null;/.exec(src);
  if (!m?.[1]) throw new Error(`regex de validation introuvable dans ${fichier}`);
  const re = new RegExp(m[1]);
  const exigeDeux = /return n >= 2 \? n : null;/.test(src);
  return (raw: string) => {
    if (raw === "1") return "one";
    if (!re.test(raw)) return null;
    const n = parseInt(raw, 10);
    return exigeDeux ? (n >= 2 ? n : null) : n;
  };
}

describe.each(ROUTES)("%s — numéros de page acceptés", (fichier) => {
  const valide = validateurDe(fichier);

  it("🔴 accepte les pages de la deuxième dizaine (10 à 19)", () => {
    // Le défaut d'origine : `[2-9]` porte sur le premier CHIFFRE. 10-19 étaient
    // refusés alors que 20 et 99 passaient.
    for (const n of ["10", "11", "12", "15", "19"]) {
      expect(valide(n), `page/${n} doit être acceptée`).toBe(Number(n));
    }
  });

  it("accepte aussi la centaine et au-delà", () => {
    for (const n of ["100", "137", "1000"]) {
      expect(valide(n), `page/${n} doit être acceptée`).toBe(Number(n));
    }
  });

  it("accepte les pages simples déjà couvertes avant", () => {
    for (const n of ["2", "5", "9", "20", "99"]) {
      expect(valide(n)).toBe(Number(n));
    }
  });

  it("`1` reste l'exception canonique — 308 vers le hub, pas une page", () => {
    expect(valide("1")).toBe("one");
  });

  it("🔴 refuse toujours les écritures non canoniques", () => {
    // On ne relâche pas la règle en corrigeant le défaut : une URL malformée ne
    // doit pas créer d'alias indexable de la même page.
    for (const brut of ["01", "007", "0", "+2", "2.0", "-3", "2a", "", " 2", "٢"]) {
      expect(valide(brut), `page/${brut} doit rester un 404`).toBeNull();
    }
  });
});

describe("la règle elle-même, pas la prose qui l'entoure", () => {
  it("la regex EXÉCUTÉE ne porte plus la classe qui rejette 10-19", () => {
    // Première rédaction de ce test : `expect(lire(f)).not.toContain("[2-9]")`.
    // Il a rougi sur le COMMENTAIRE ci-dessus, qui cite la classe fautive pour
    // expliquer le défaut — troisième fois cette nuit qu'une garde statique
    // trouve sa propre documentation. On extrait donc la regex réellement
    // compilée par la route et on n'inspecte qu'elle.
    for (const f of ROUTES) {
      const m = /if \(!\/(\^[^/]+\$)\/\.test\(raw\)\) return null;/.exec(lire(f));
      expect(m?.[1], `regex de validation introuvable dans ${f}`).toBeTruthy();
      expect(m?.[1], `${f} : la classe porte sur le 1er chiffre, pas sur la valeur`).not.toContain(
        "[2-9]",
      );
    }
  });
});
