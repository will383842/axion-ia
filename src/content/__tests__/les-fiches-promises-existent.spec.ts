/**
 * Verrou — les fiches promises en message privé par les réseaux sociaux EXISTENT.
 *
 * ## Le constat (2026-09-25)
 *
 * La publication Instagram du 25/09 disait « écrivez-moi FICHE en message privé,
 * je vous l'envoie ». Aucun PDF n'existait. Deux autres mots-clés (FUITES, PLAN)
 * étaient programmés pour novembre et janvier, dans le même cas.
 *
 * ## Ce que ce verrou fige
 *
 * La réponse automatique de la messagerie Meta porte les trois URL ci-dessous,
 * écrites à la main dans Meta Business Suite : rien, côté site, ne les relit.
 * Un renommage ou une suppression casserait la promesse en silence. Ce test
 * rougit à la place.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { IMPRIMES } from "@/content/imprimes";

const FICHES = [
  "imprimes/fiche-test-20-minutes-axion-ia.pdf",
  "imprimes/fiche-7-fuites-de-temps-axion-ia.pdf",
  "imprimes/fiche-plan-90-jours-axion-ia.pdf",
] as const;

/** Même méthode que `le-guide-promis-existe.spec.ts` : le rendu Chrome ne compresse pas les objets de page. */
function pagesDuPdf(fichier: string): number {
  return (readFileSync(fichier, "latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

describe("les fiches promises en message privé", () => {
  it.each(FICHES)("%s est servie, en 2 pages, sous 1,5 Mo", (chemin) => {
    const fichier = path.join(process.cwd(), "public", chemin);
    expect(existsSync(fichier)).toBe(true);
    expect(statSync(fichier).size).toBeLessThan(1_500_000);
    expect(pagesDuPdf(fichier)).toBe(2);
  });

  it("l'onglet Imprimés de la console les liste toutes", () => {
    const chemins = IMPRIMES.flatMap((i) => i.fichiersPublics.map((f) => f.chemin));
    for (const chemin of FICHES) expect(chemins).toContain(chemin);
  });
});
