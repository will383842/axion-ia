/**
 * 🔴 Le bloc Documents faisait défiler LA PAGE horizontalement.
 *
 * ## La cause, trouvée par le code et non par l'œil
 *
 * Ce n'est pas le tableau du registre : il vit dans un `overflow-x-auto` depuis
 * toujours. Ce sont les GRILLES DE BOUTONS de génération.
 *
 * `.admin-button` et `.admin-button-ghost` portent `white-space: nowrap`
 * (`src/app/admin.css`), et l'étiquette d'une pièce déjà générée est de la forme
 * « Questionnaire de positionnement · génération du 05/09/2026 — régénérer » :
 * une ligne insécable de plusieurs centaines de pixels. Les pistes d'une grille
 * Tailwind valent `minmax(0, 1fr)` et ne s'élargissent donc pas — c'est le
 * BOUTON qui déborde de sa piste, puis de la carte, puis de la page. Rien ne le
 * retenait.
 *
 * ## La règle gardée
 *
 * Contrainte du dépôt : *tout contenu large défile dans son propre conteneur
 * `overflow-x: auto`, jamais la page.* Toute grille de ce fichier — c'est-à-dire
 * tout conteneur susceptible de porter des boutons `nowrap` — doit donc être un
 * conteneur de défilement.
 *
 * ⚠️ Ce témoin ne dit PAS « posez `whitespace-normal` sur les boutons ». Cet
 * utilitaire serait INERTE (`.admin-button*` vit hors couche CSS, il l'emporte
 * sur `utilities`) et `admin-design-tokens.test.ts` le refuserait, à raison. Le
 * retour à la ligne se réglerait dans `admin.css`, hors du périmètre de ce
 * fichier.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FICHIER = path.join(process.cwd(), "src/components/admin/qualiopi/DocumentsSection.tsx");
const SOURCE = fs.readFileSync(FICHIER, "utf-8");

/** Toutes les listes de classes du fichier qui déclarent une grille. */
function grilles(): string[] {
  return [...SOURCE.matchAll(/"([^"\n]*\bgrid\b[^"\n]*)"/g)].map((m) => m[1] as string);
}

describe("🔴 le bloc Documents défile DANS son conteneur, jamais la page", () => {
  // Témoin positif obligatoire : un motif cassé rendrait une liste vide, et une
  // liste vide passerait l'assertion suivante sans rien mesurer. « Aucune
  // grille en faute » et « je ne sais pas lire le fichier » seraient
  // indiscernables.
  it("le recensement TROUVE des grilles — sinon la garde ne garde rien", () => {
    expect(grilles().length).toBeGreaterThanOrEqual(4);
  });

  it("chaque grille est un conteneur de défilement horizontal", () => {
    const fautives = grilles().filter((g) => !g.includes("overflow-x-auto"));
    expect(fautives).toEqual([]);
  });

  // Contre-témoin : le tableau du registre était DÉJÀ contenu, et il ne doit pas
  // être « corrigé » par-dessus. Si cette ligne rougit, quelqu'un a retiré la
  // protection historique en croyant que la nouvelle la remplaçait.
  it("le tableau du registre reste, lui aussi, dans son propre conteneur", () => {
    expect(SOURCE).toContain('<div className="overflow-x-auto">');
  });
});
