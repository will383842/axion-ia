/**
 * Les boutons de sortie vivent sur fond SOMBRE — leur couleur doit le savoir.
 *
 * ## Le défaut
 *
 * Trouvé en production le 2026-08-04. La refonte des espaces a mis ces boutons
 * dans une coquille `bg-mocha` (pied de barre latérale, puis en-tête mobile),
 * mais les boutons eux-mêmes n'ont pas suivi :
 *
 *  - `FormateurLogoutButton` restait en `text-terracotta` — le terracotta de
 *    MARQUE, qui donne **2,61:1 sur mocha**, très sous le seuil AA de 4,5. Il
 *    est calibré comme FOND sous du texte ivoire, jamais comme texte sur fond
 *    sombre. C'est exactement le piège pour lequel `--color-terracotta-on-mocha`
 *    (5,82:1) avait été créé lors de cette même refonte — sans être appliqué ici.
 *  - `QuitterPortailButton` était un bouton BLANC bordé de gris, posé au milieu
 *    du mocha.
 *
 * ## Pourquoi `contrast:check` ne l'a pas vu, et ne le verra jamais seul
 *
 * Ce script vérifie une liste de paires **déclarées à la main**. Il dit « cette
 * couleur-ci sur ce fond-là passe AA » ; il ne sait pas quelles couleurs sont
 * réellement employées ensemble à l'écran. La paire `terracotta-on-mocha` y
 * était bien, et verte — pendant que le composant utilisait l'autre teinte.
 * Le gate passait par vacuité.
 *
 * D'où ce test : il regarde le CODE des composants, pas la palette.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Composants de sortie rendus dans la coquille sombre (`EspaceShell`). */
const BOUTONS_SUR_MOCHA = [
  "src/components/espace-formateur/FormateurLogoutButton.tsx",
  "src/components/portail/QuitterPortailButton.tsx",
];

/**
 * Décape les commentaires avant de chercher.
 *
 * 🔴 Sans ça, ce test se trouverait LUI-MÊME : chaque composant explique en
 * commentaire pourquoi `text-terracotta` était faux. Chercher cette chaîne dans
 * le fichier brut la trouverait dans l'explication et rougirait sur du code
 * pourtant correct.
 */
function codeSansCommentaires(chemin: string): string {
  return readFileSync(chemin, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("boutons de sortie sur fond sombre", () => {
  for (const chemin of BOUTONS_SUR_MOCHA) {
    const nom = chemin.split("/").pop();

    it(`${nom} — utilise la teinte calibrée pour le mocha`, () => {
      const code = codeSansCommentaires(chemin);
      expect(code).toContain("text-terracotta-on-mocha");
    });

    it(`🔴 ${nom} — n'emploie NI le terracotta de marque, NI de fond clair`, () => {
      const code = codeSansCommentaires(chemin);
      // `text-terracotta` sans le suffixe `-on-mocha` : 2,61:1, échec AA.
      expect(code).not.toMatch(/text-terracotta(?!-on-mocha)/);
      // Une surface claire au milieu du mocha attire l'œil plus que la
      // navigation, pour un geste qui ne sert qu'à partir.
      expect(code).not.toMatch(/bg-white|bg-gray-|border-gray-|text-gray-/);
    });
  }
});
