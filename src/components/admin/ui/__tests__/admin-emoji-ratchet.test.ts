// Cliquet anti-emoji de la console — refonte UI 2026-08-01 (couche 4).
//
// POURQUOI CE TEST EXISTE
// -----------------------
// Will juge la console « catastrophique et vraiment vieillot ». L'un des
// marqueurs les plus visibles de cette impression, c'est l'emoji employé comme
// pictogramme d'interface : « 🔴 À traiter » en titre de page, 🖊️ contre ⏳ pour
// distinguer deux états, 🔴 contre 🟠 pour un niveau d'alerte.
//
// Deux raisons de fond, au-delà du goût :
//   1. le dessin, la chasse et la graisse d'un emoji dépendent du système et de
//      la police de l'utilisateur — impossible à aligner sur une grille ;
//   2. deux emojis peuvent ne différer QUE par la couleur (🔴 / 🟠), ce qui rend
//      l'information invisible en vision des couleurs déficiente. C'était le cas
//      du niveau d'alerte, l'information la plus urgente de la console.
//
// La reprise est page par page et s'étale sur plusieurs sessions. Ce test n'exige
// donc pas zéro tout de suite : il VERROUILLE le terrain gagné. Le compte ne peut
// que descendre.
//
// QUE FAIRE SI CE TEST ÉCHOUE
// ---------------------------
// - « le compte a AUGMENTÉ » → vous venez d'ajouter un emoji dans une vue admin.
//   Utilisez un composant `lucide-react` : c'est la convention de la console
//   depuis la couche 4, et `admin-nav-icons.ts` porte déjà le registre des
//   pictogrammes de navigation.
// - « le compte a BAISSÉ » → parfait, c'est le sens du chantier : descendez la
//   constante ci-dessous à la valeur mesurée, avec la date.
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
 * 2026-08-01 — 325 occurrences dans 117 fichiers, après le passage en lucide de
 * la barre latérale (145 entrées), de la boîte de réception, du hub Qualiopi,
 * de « À traiter » et du tableau de bord d'accueil.
 */
const PLAFOND = 325;

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
            "La convention depuis la couche 4 est un composant lucide-react.\n" +
            `Fichiers les plus chargés :\n  ${pires}`
        : `Le compte est descendu à ${total} (plafond ${PLAFOND}) — descendez PLAFOND ` +
            "à cette valeur, en datant la ligne.",
    ).toBe(PLAFOND);
  });

  it("garde les pages déjà reprises exemptes d'emoji", () => {
    // Verrou fort sur ce qui est FINI : ces pages ne doivent jamais régresser,
    // même si le plafond global reste haut.
    const REPRISES = [
      "src/components/admin/ui/AdminSidebarNav.tsx",
      "src/components/admin/ui/admin-nav-icons.ts",
      "src/app/[locale]/(admin)/[adminPrefix]/contacts/page.tsx",
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/page.tsx",
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/a-traiter/page.tsx",
      "src/app/[locale]/(admin)/[adminPrefix]/_v2/DashboardV2.tsx",
    ];

    const fautives = REPRISES.filter((rel) => {
      const trouves = codeSeul(readFileSync(join(ROOT, rel), "utf8")).match(EMOJI);
      return trouves !== null;
    });

    expect(
      fautives,
      `Page déjà reprise en couche 4 qui réintroduit un emoji :\n  - ${fautives.join("\n  - ")}`,
    ).toEqual([]);
  });
});
