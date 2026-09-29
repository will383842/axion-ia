/**
 * Les trois liens épinglés dans la « Sélection » du profil LinkedIn portent
 * une image de partage dédiée, et elle mesure ce que la page déclare.
 *
 * 🔴 CE QUE CETTE GARDE EMPÊCHE DE REVENIR — 2026-09-27.
 *
 * Sur le profil, la vignette d'un lien fait ~190 px de large. La carte
 * générique `/api/og` y devenait illisible (« catastrophique », dit Will).
 * Chaque page déclare donc un PNG calibré pour cette taille, avec ses
 * dimensions en dur. Deux façons de casser ça sans que rien ne rougisse :
 *
 *   · remplacer le fichier par un autre format → les dimensions déclarées
 *     mentent, et LinkedIn réserve la vignette d'après elles ;
 *   · retirer `ogImage` en refactorant la page → retour silencieux à la carte
 *     générique.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

const PAGES = [
  { page: "src/app/[locale]/appel/page.tsx", image: "appel-45-min-gratuit.png" },
  { page: "src/app/[locale]/guide-ia/page.tsx", image: "guide-ia-2026-gratuit.png" },
  {
    page: "src/app/[locale]/certification-qualiopi/page.tsx",
    image: "formations-certifiees-qualiopi.png",
  },
] as const;

/** Largeur et hauteur lues dans l'en-tête IHDR du PNG (octets 16 à 23). */
function dimensionsPng(chemin: string): { largeur: number; hauteur: number } {
  const octets = readFileSync(chemin);
  expect(octets.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
}

describe("images de partage de la Sélection LinkedIn", () => {
  for (const { page, image } of PAGES) {
    it(`${page} déclare /og/pages/${image} avec ses dimensions réelles`, () => {
      const source = readFileSync(join(RACINE, page), "utf8");
      expect(source).toContain(`/og/pages/${image}`);
      expect(source).toMatch(/ogImageWidth: 1200,/);
      expect(source).toMatch(/ogImageHeight: 628,/);

      const { largeur, hauteur } = dimensionsPng(join(RACINE, "public/og/pages", image));
      expect({ largeur, hauteur }).toEqual({ largeur: 1200, hauteur: 628 });
    });
  }
});
