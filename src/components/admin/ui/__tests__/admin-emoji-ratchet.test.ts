// Cliquet anti-emoji de la console — 2026-08-02.
//
// POURQUOI CE TEST EXISTE
// -----------------------
// Le chantier icônes a remplacé les emojis de la NAVIGATION par des composants
// lucide (`src/lib/admin-nav-icons.ts`, verrouillé par son propre test). Mais
// les emojis employés comme pictogrammes DANS LES PAGES n'étaient couverts par
// rien : il en reste 292 dans 108 fichiers, et rien n'empêche d'en réintroduire.
//
// Deux raisons de fond, au-delà du goût :
//   1. le dessin, la chasse et la graisse d'un emoji dépendent du système et de
//      la police du poste — impossible à aligner sur une grille, et le rendu
//      change d'un utilisateur à l'autre ;
//   2. deux emojis peuvent ne différer QUE par la couleur (🔴 / 🟠), ce qui rend
//      l'information invisible en vision des couleurs déficiente. C'était le cas
//      du niveau d'alerte, l'information la plus urgente de la console.
//
// La reprise se fait page par page sur plusieurs sessions. Ce test n'exige donc
// pas zéro tout de suite : il VERROUILLE le terrain gagné. Le compte ne peut que
// descendre.
//
// QUE FAIRE SI CE TEST ÉCHOUE
// ---------------------------
// - « le compte a AUGMENTÉ » → vous venez d'ajouter un emoji dans une vue admin.
//   Utilisez un composant `lucide-react` : c'est la convention de la console, et
//   `NAV_ICONS` (src/lib/admin-nav-icons.ts) montre le motif.
// - « le compte a BAISSÉ » → parfait, c'est le sens du chantier : descendez la
//   constante ci-dessous à la valeur mesurée, en datant la ligne.
//
// Les lignes de COMMENTAIRE sont exclues du décompte : elles ne sont pas rendues,
// et un commentaire qui cite l'emoji qu'il vient de remplacer est légitime.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");
const SCAN_DIRS = [join(ROOT, "src/app/[locale]/(admin)"), join(ROOT, "src/components/admin")];

/**
 * Plafond courant, à ne jamais remonter.
 *
 * 2026-08-02 — 94 occurrences dans 53 fichiers, après la passe globale (les
 * marques de statut posées en tête de libellé, les spans décoratifs et les
 * glyphes cités dans les commentaires JSX). Était 248 avant cette passe, 340
 * au plus haut.
 */
const PLAFOND = 94;

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}]/gu;

/** Retire les lignes de commentaire — un emoji cité en commentaire n'est pas rendu. */
function codeSeul(source: string): string {
  return source
    .split(/\r?\n/)
    .filter((ligne) => !/^\s*(\/\/|\*|\/\*)/.test(ligne))
    .join("\n");
}

function fichiersTsx(dir: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dir, { withFileTypes: true })) {
    const chemin = join(dir, entree.name);
    if (entree.isDirectory()) fichiersTsx(chemin, acc);
    else if (/\.tsx?$/.test(entree.name)) acc.push(chemin);
  }
  return acc;
}

describe("cliquet anti-emoji de la console", () => {
  it("ne réintroduit pas d'emoji dans les vues admin", () => {
    const parFichier: Array<{ fichier: string; n: number }> = [];
    let total = 0;

    for (const dir of SCAN_DIRS) {
      for (const fichier of fichiersTsx(dir)) {
        const trouves = codeSeul(readFileSync(fichier, "utf8")).match(EMOJI);
        if (!trouves) continue;
        total += trouves.length;
        parFichier.push({ fichier: fichier.slice(ROOT.length + 1), n: trouves.length });
      }
    }

    const pires = parFichier
      .sort((a, b) => b.n - a.n)
      .slice(0, 10)
      .map((f) => `${String(f.n).padStart(3)} × ${f.fichier}`)
      .join("\n  ");

    expect(
      total,
      total > PLAFOND
        ? `Le nombre d'emojis rendus dans la console est passé de ${PLAFOND} à ${total}.\n` +
            "La convention est un composant lucide-react.\n" +
            `Fichiers les plus chargés :\n  ${pires}`
        : `Le compte est descendu à ${total} (plafond ${PLAFOND}) — descendez PLAFOND ` +
            "à cette valeur, en datant la ligne.",
    ).toBe(PLAFOND);
  });
});
