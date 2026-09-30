/**
 * UX-05 : l'onglet « État du circuit » est visible de Williams ; il parle sa
 * langue, et dit quoi faire (« prévenez Claude ») au lieu du jargon de
 * développeur (« balayage », « drapeau vu par le worker », « ne pas
 * fusionner »).
 *
 * Mutation qui fait rougir : remettre un des libellés techniques.
 * Angle mort : le composant (serveur, asynchrone, lit la base) est lu comme
 * un texte, pas rendu ; le titre de l'alerte « base pas migrée » est écrit
 * par le circuit (`etapes.ts`), hors de ce correctif.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync("src/components/admin/dossier-client/EtatDuCircuitVue.tsx", "utf8");
// Le texte affiché seulement : le commentaire d'en-tête peut garder les termes techniques.
const RENDU = SRC.slice(SRC.indexOf("export async function EtatDuCircuitVue"));

describe("l'état du circuit parle la langue de Will", () => {
  it("aucun libellé de développeur", () => {
    for (const jargon of [
      "balayage",
      "Drapeau vu par le worker",
      "fusionner",
      "circuit en cours",
    ]) {
      expect(RENDU, jargon).not.toContain(jargon);
    }
  });

  it("un arrêt dit quoi faire", () => {
    expect(RENDU.match(/prévenez Claude/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(RENDU).toContain("Le traitement automatique");
  });
});
