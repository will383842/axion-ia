// Garde-fou des étiquettes de formulaire — 2026-08-02.
//
// POURQUOI CE TEST EXISTE
// -----------------------
// Un champ sans nom accessible n'est pas annonçable : un lecteur d'écran dit
// « zone de texte, vide » sans jamais dire de quoi il s'agit (WCAG 1.3.1,
// 3.3.2, 4.1.2). Le défaut est INVISIBLE à l'œil — l'audit du 2026-08-02 en a
// trouvé 120 sur 860 contrôles, dans 29 fichiers, alors que tous portaient un
// libellé parfaitement lisible à l'écran : il était simplement posé À CÔTÉ,
// sans lien programmatique.
//
// Est considéré nommé un contrôle qui a `aria-label`, `aria-labelledby`, un
// `id` (relié par un `<label htmlFor>`) — ou qui est enveloppé dans un
// `<label>` (association implicite, tout aussi valide).
//
// QUE FAIRE SI CE TEST ÉCHOUE
// ---------------------------
// Reliez le libellé visible au champ : `htmlFor` sur le `<label>` + `id` de
// même valeur sur le contrôle. C'est la vraie association — le lecteur d'écran
// nomme le champ ET le clic sur le libellé donne le focus. À défaut de libellé
// visible, `aria-label` décrivant le rôle du champ.
//
// 🔴 NE PAS analyser une balise JSX avec `[^>]*` : la recherche s'arrête au
// « > » de la flèche `=>` d'un gestionnaire d'événement et fait croire qu'un
// champ n'a pas l'attribut posé plus loin. Ce test compte les accolades pour
// trouver la vraie fin de balise — c'est l'erreur qui avait surestimé l'audit
// initial de 35 cas.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");
const SCAN_DIRS = [join(ROOT, "src/app/[locale]/(admin)"), join(ROOT, "src/components/admin")];

/**
 * Contrôles dont les attributs arrivent par diffusion (`{...props}`) : le
 * nom accessible est posé par le composant appelant, invisible ici. Vérifiés
 * à la main le 2026-08-02 — `ImageUploadDropzone` porte bien un
 * `<label htmlFor={sharedProps.id}>`.
 */
const DIFFUSION_VERIFIEE: readonly string[] = [
  "src/components/admin/image-bank/ImageUploadDropzone.tsx",
];

/** Fin réelle d'une balise ouvrante : premier « > » hors accolade et hors chaîne. */
function finDeBalise(src: string, debut: number): number {
  let profondeur = 0;
  let quote: string | null = null;
  for (let i = debut; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") profondeur++;
    else if (c === "}") profondeur--;
    else if (c === ">" && profondeur === 0) return i;
  }
  return -1;
}

/** Remplace les commentaires par des espaces (positions et lignes préservées). */
function neutraliserCommentaires(s: string): string {
  const blanc = (m: string): string => m.replace(/[^\n]/g, " ");
  return s
    .replace(/\/\*[\s\S]*?\*\//g, blanc)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + blanc(m.slice(p1.length)));
}

function fichiersTsx(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) fichiersTsx(p, acc);
    else if (/\.tsx$/.test(e.name) && !/\.(test|spec)\.tsx$/.test(e.name)) acc.push(p);
  }
  return acc;
}

describe("étiquettes des formulaires de la console", () => {
  it("nomme chaque contrôle de formulaire", () => {
    const anonymes: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const fichier of fichiersTsx(dir)) {
        const rel = fichier.slice(ROOT.length + 1).replace(/\\/g, "/");
        if (DIFFUSION_VERIFIEE.includes(rel)) continue;

        const src = neutraliserCommentaires(readFileSync(fichier, "utf8"));
        const re = /<(input|textarea|select)\b/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) {
          const finNom = m.index + m[0].length;
          const fin = finDeBalise(src, finNom);
          if (fin === -1) continue;
          const attrs = src.slice(finNom, fin);
          if (/type="(hidden|submit|button|image)"/.test(attrs)) continue;
          if (/aria-label|aria-labelledby|\bid=/.test(attrs)) continue;

          // Enveloppé dans un <label> ? (association implicite)
          const avant = src.slice(0, m.index);
          const ouverts = (avant.match(/<label\b/g) ?? []).length;
          const fermes = (avant.match(/<\/label>/g) ?? []).length;
          if (ouverts > fermes) continue;

          const ligne = avant.split("\n").length;
          anonymes.push(`${rel}:${ligne} <${m[1]}>`);
        }
      }
    }

    expect(
      anonymes,
      `${anonymes.length} contrôle(s) de formulaire sans nom accessible — un lecteur ` +
        `d'écran ne peut pas dire de quoi il s'agit :\n  - ${anonymes.join("\n  - ")}`,
    ).toEqual([]);
  });
});
