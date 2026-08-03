// Garde-fou « carte-lien » de la console — 2026-08-03.
//
// POURQUOI CE TEST EXISTE
// -----------------------
// `.admin-card` pose padding / fond / bordure / ombre mais PAS `display`.
// Un `<div className="admin-card">` est un bloc : tout va bien. Un
// `<a>` ou un `<Link>` reste `display: inline` — et là, silencieusement :
//
//   1. le `padding` n'entre plus dans la mise en page (la boîte garde la
//      hauteur d'une ligne de texte) ;
//   2. le fond de la carte déborde et se peint PAR-DESSUS le contenu voisin.
//
// Mesuré en production le 2026-08-03 sur `/image-bank/library` : les 60
// vignettes affichaient « le · score 90 · publié » au lieu de « ville · score
// 90 · publié », les premiers caractères recouverts par le fond de la carte.
// Aucun test ne pouvait le voir : le DOM était correct, seul le rendu était
// faux. D'où un garde-fou sur la CLASSE, pas sur le rendu.
//
// QUE FAIRE SI CE TEST ÉCHOUE
// ---------------------------
// Vous venez d'écrire un `<Link className="admin-card …">` sans classe qui
// pose `display`. Ajoutez `admin-card-inline` (block, cf. admin.css),
// `admin-infra-card` (block), ou une utilitaire `block` / `flex` / `grid`.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");
const SCAN_DIRS = [join(ROOT, "src/app/[locale]/(admin)"), join(ROOT, "src/components/admin")];

/**
 * Classes et utilitaires qui posent `display` sur l'ancre. `admin-card-inline`
 * et `admin-infra-card` sont définies `display: block` dans `admin.css` ;
 * les autres sont des utilitaires Tailwind.
 */
const POSE_DISPLAY = /\b(admin-card-inline|admin-infra-card|block|flex|grid|inline-flex)\b/;

function fichiersTsx(dir: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dir, { withFileTypes: true })) {
    const chemin = join(dir, entree.name);
    if (entree.isDirectory()) fichiersTsx(chemin, acc);
    else if (/\.tsx$/.test(entree.name)) acc.push(chemin);
  }
  return acc;
}

/**
 * Remonte du `className` jusqu'à l'ouverture de balise qui le porte, et rend
 * le nom de la balise. On ne parse pas le JSX : on lit à rebours jusqu'au
 * premier `<` non refermé, ce qui suffit ici — un `className` appartient
 * toujours à la balise ouverte la plus proche à sa gauche.
 */
function baliseDe(source: string, indexClassName: number): string | null {
  const avant = source.slice(0, indexClassName);
  const ouverture = avant.lastIndexOf("<");
  if (ouverture === -1) return null;
  const m = /^<\/?([A-Za-z][\w.]*)/.exec(source.slice(ouverture));
  return m ? (m[1] ?? null) : null;
}

describe("garde-fou carte-lien", () => {
  it("toute ancre portant `admin-card` pose aussi un `display`", () => {
    const fautifs: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const fichier of fichiersTsx(dir)) {
        const source = readFileSync(fichier, "utf8");
        // Chaque `className="…"` littéral contenant le mot `admin-card`.
        const re = /className=\{?"([^"]*\badmin-card\b[^"]*)"/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(source)) !== null) {
          const balise = baliseDe(source, m.index);
          if (balise !== "a" && balise !== "Link") continue;
          const classes = m[1] ?? "";
          if (POSE_DISPLAY.test(classes)) continue;
          const ligne = source.slice(0, m.index).split("\n").length;
          fautifs.push(`${fichier.slice(ROOT.length + 1)}:${ligne} — <${balise} class="${classes}">`);
        }
      }
    }

    expect(
      fautifs,
      "Ces ancres restent `display: inline` : leur padding ne met rien en page et\n" +
        "le fond de la carte recouvre le contenu voisin.\n  " +
        fautifs.join("\n  "),
    ).toEqual([]);
  });
});
