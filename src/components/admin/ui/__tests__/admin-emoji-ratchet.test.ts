// Cliquet anti-emoji de la console — 2026-08-02.
//
// POURQUOI CE TEST EXISTE
// -----------------------
// Le chantier icônes a remplacé les emojis de la NAVIGATION par des composants
// lucide (`src/lib/admin-nav-icons.ts`, verrouillé par son propre test). Mais
// les emojis employés comme pictogrammes DANS LES PAGES n'étaient couverts par
// rien : il y en avait 340 au plus haut, et rien n'empêchait d'en réintroduire.
//
// Deux raisons de fond, au-delà du goût :
//   1. le dessin, la chasse et la graisse d'un emoji dépendent du système et de
//      la police du poste — impossible à aligner sur une grille, et le rendu
//      change d'un utilisateur à l'autre ;
//   2. deux emojis peuvent ne différer QUE par la couleur (🔴 / 🟠), ce qui rend
//      l'information invisible en vision des couleurs déficiente. C'était le cas
//      du niveau d'alerte, l'information la plus urgente de la console.
//
// Le chantier est terminé (2026-08-02) : il ne reste qu'une occurrence, et elle
// est volontaire — voir la note sur le plafond. Le test verrouille ce résultat.
//
// QUE FAIRE SI CE TEST ÉCHOUE
// ---------------------------
// Il n'échoue QUE si le compte remonte : vous venez d'ajouter un emoji dans une
// vue admin. Utilisez un composant `lucide-react` — c'est la convention de la
// console, et `NAV_ICONS` (src/lib/admin-nav-icons.ts) montre le motif.
//
// Si le compte a BAISSÉ, rien ne casse (cf. la note sur l'égalité stricte plus
// bas) : descendez simplement la constante à la valeur mesurée, en datant la
// ligne, pour verrouiller le terrain gagné.
//
// Les lignes de COMMENTAIRE sont exclues du décompte : elles ne sont pas rendues,
// et un commentaire qui cite l'emoji qu'il vient de remplacer est légitime.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");
const SCAN_DIRS = [join(ROOT, "src/app/[locale]/(admin)"), join(ROOT, "src/components/admin")];

/**
 * Modules HORS des deux dossiers admin dont les chaînes sont pourtant RENDUES
 * dans la console — donc soumis à la même règle.
 *
 * 🔴 Le trou a coûté deux jours : `QUALIOPI_POLE_LABELS` (`src/lib`) affichait
 * six emojis dans la barre latérale, c'est-à-dire sur CHAQUE page de la
 * console, pendant que ce test annonçait « 1 occurrence ». `PERIMETRE_LABELS`
 * (`src/server`) en affichait deux de plus sur la page Dossiers.
 *
 * La liste est nominative et pas un dossier entier, à dessein : `src/lib` et
 * `src/server` contiennent aussi des gabarits d'e-mail et de PDF, où un
 * pictogramme relève d'une autre décision que celle-ci.
 *
 * ⚠️ ELLE NE PEUT PAS TOUT COUVRIR. Le garde-fou d'isolation du dépôt
 * (`pnpm isolation-check`, § 4.1bis) interdit à un fichier hors zone dédiée de
 * seulement NOMMER le domaine de la génération éditoriale. Les libellés de ce
 * domaine portent encore 3 emojis rendus dans la console : ils échappent donc
 * à ce cliquet-ci et doivent recevoir le leur, à l'intérieur de leur propre
 * zone. Noté pour que le trou soit connu plutôt que redécouvert.
 */
const FICHIERS_SSOT_CONSOLE = [
  join(ROOT, "src/lib/admin-nav.ts"),
  join(ROOT, "src/server/qualiopi/perimetre.ts"),
];

/**
 * Plafond courant, à ne jamais remonter.
 *
 * Trajectoire : 340 au plus haut → 248 → 94 → 1 (2026-08-02) → **45** puis
 * **40** (2026-08-03).
 *
 * 🔴 LE PLAFOND REMONTE, ET AUCUN EMOJI N'A ÉTÉ AJOUTÉ. C'est la MESURE qui
 * était fausse : la plage de caractères sautait `U+2600`–`U+26FF` (cf. la note
 * sur `EMOJI`), et le scan ignorait les libellés vivant hors des deux dossiers
 * admin (cf. `FICHIERS_SSOT_CONSOLE`). Le « 1 » du 2026-08-02 en cachait 51.
 * On repart de ce qui est réellement rendu — 45 après le retrait des 8 les
 * plus exposés (barre latérale ×6, badge de périmètre ×2) et du « ⚠ » du
 * bandeau des indicateurs.
 *
 * Reste à reprendre, par ordre de visibilité : les « ⚠ » des bandeaux
 * d'avertissement (≈ 25 occurrences, une par écran), les « ★ » des notes
 * d'avis et de la matrice d'indicateurs, les « ⛔ » des états bloqués.
 *
 * UNE OCCURRENCE EST VOLONTAIRE — ne la « corrigez » pas. Le champ
 * « Avantages » d'une offre d'emploi accepte un JSON dont la clé `icon` porte
 * réellement un emoji côté site public ; le formulaire en montre un EXEMPLE à
 * l'administrateur. Retirer l'emoji de cet exemple mentirait sur le format
 * attendu et produirait des saisies invalides.
 */
const PLAFOND = 38;

/**
 * 🔴 CETTE PLAGE SAUTAIT `U+2600`–`U+26FF`, et c'est le bloc qui contient les
 * pictogrammes les plus employés de la console : « ⚠ » (U+26A0), « ⚙ »
 * (U+2699), « ⛔ » (U+26D4), « ⚪ » (U+26AA), « ★ » (U+2605), « ⚖ » (U+2696),
 * « ♻ » (U+267B).
 *
 * Conséquence mesurée le 2026-08-03 : le compteur affichait 1 alors que les
 * deux dossiers scannés en contenaient 43. La trajectoire « 340 → 248 → 94 →
 * 1 » ne mesurait donc pas ce qu'elle croyait mesurer sur sa dernière marche.
 * On élargit la plage ; le plafond repart de la valeur réellement constatée.
 */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}]/gu;

/**
 * Retire les lignes de commentaire — un emoji cité en commentaire n'est pas
 * rendu, et un commentaire qui nomme le glyphe qu'il vient de remplacer est
 * précisément ce qu'on veut lire.
 *
 * ⚠️ Le filtre ne reconnaissait que `//`, `*` et `/*`. Un commentaire JSX
 * commence par `{` — sa PREMIÈRE ligne (`{/* … `) passait donc au travers, et
 * expliquer en commentaire pourquoi on retire un 🔴 faisait remonter le
 * compteur. On a réellement perdu le bénéfice d'une passe de nettoyage
 * comme ça. Les lignes SUIVANTES du bloc commencent par `*` : elles étaient
 * déjà couvertes, seule l'ouverture manquait.
 */
function codeSeul(source: string): string {
  const gardees: string[] = [];
  let dansBloc = false;
  for (const ligne of source.split(/\r?\n/)) {
    if (dansBloc) {
      // Une ligne de CONTINUATION de bloc ne commence pas forcément par `*` :
      // un commentaire JSX aligné sur l'indentation du code ressemble à du
      // code. Tant que `*/` n'est pas passé, tout est du commentaire.
      if (/\*\//.test(ligne)) dansBloc = false;
      continue;
    }
    if (/^\s*(\/\/)/.test(ligne)) continue;
    // Ouverture d'un bloc `/* …` ou `{/* …` — JSX inclus. S'il se referme sur
    // la même ligne, on ne bascule pas d'état.
    if (/^\s*(\{\s*)?\/\*/.test(ligne)) {
      if (!/\*\//.test(ligne)) dansBloc = true;
      continue;
    }
    gardees.push(ligne);
  }
  return gardees.join("\n");
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

    const aScanner = [...SCAN_DIRS.flatMap((dir) => fichiersTsx(dir)), ...FICHIERS_SSOT_CONSOLE];
    for (const fichier of aScanner) {
      const trouves = codeSeul(readFileSync(fichier, "utf8")).match(EMOJI);
      if (!trouves) continue;
      total += trouves.length;
      parFichier.push({ fichier: fichier.slice(ROOT.length + 1), n: trouves.length });
    }

    const pires = parFichier
      .sort((a, b) => b.n - a.n)
      .slice(0, 10)
      .map((f) => `${String(f.n).padStart(3)} × ${f.fichier}`)
      .join("\n  ");

    // ⚠️ CE TEST EXIGEAIT L'ÉGALITÉ STRICTE (`toBe`), et ça a cassé `main`.
    //
    // Deux PR qui retirent chacune des emojis passent au vert SÉPARÉMENT — le
    // gate mesure chaque branche contre le plafond du moment. Une fois les
    // deux fusionnées, le compte tombe SOUS le plafond et `main` devient
    // rouge, alors qu'aucune des deux n'a rien cassé : elles ont toutes deux
    // fait exactement ce que le chantier demande. Il a fallu un correctif à
    // chaud (2026-08-01) pour rouvrir la voie.
    //
    // Un cliquet n'a pas besoin de l'égalité : il a besoin d'un PLAFOND. On
    // interdit la remontée, on laisse la descente libre. Le plafond se baisse
    // quand quelqu'un y pense — et s'il traîne, personne n'est bloqué.
    expect(
      total,
      `Le nombre d'emojis rendus dans la console est passé de ${PLAFOND} à ${total}.\n` +
        "La convention est un composant lucide-react.\n" +
        `Fichiers les plus chargés :\n  ${pires}`,
    ).toBeLessThanOrEqual(PLAFOND);
  });
});
