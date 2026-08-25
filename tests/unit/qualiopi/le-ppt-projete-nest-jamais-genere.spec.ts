/**
 * 🛑 GARDE — le PowerPoint PROJETÉ n'est jamais fabriqué par le système.
 *
 * Décision de Will du 2026-07-15, réaffirmée le 2026-08-25 : le support de
 * projection d'une formation est réalisé À L'EXTÉRIEUR et téléversé, pour que
 * Will garde la main sur le visuel et puisse le retoucher à tout moment. Un
 * support généré ne le permet pas commodément.
 *
 * ## Pourquoi cette garde existe
 *
 * La décision a été prise le 2026-07-15. La liste `TOUS_SUPPORT_TYPES` avait été
 * écrite le 2026-07-07 (#268) — HUIT JOURS PLUS TÔT — et contenait déjà
 * `slides_formateur` et `slides_stagiaire`. La décision n'a jamais été portée
 * dans le code : pendant six semaines, « Générer tous les supports » a produit
 * les deux PowerPoints en silence, écrasant un visuel déposé à la main sans
 * rien dire à personne.
 *
 * Une consigne qui n'existe que dans une note ne garde rien. Celle-ci rougit.
 *
 * ## Ce que cette garde ne couvre PAS
 *
 * `genererDiaporamaAction` (`src/server/actions/qualiopi/diaporama.ts`) produit
 * un .pptx projeté par un AUTRE chemin, sur un clic explicite, et pose toujours
 * une version en `brouillon` qui ne remplace pas le fichier déposé tant que Will
 * ne l'a pas publiée. C'est une décision distincte, qui n'est pas tranchée ici :
 * ce test ne prétend pas la couvrir, et un futur lecteur ne doit pas croire le
 * contraire.
 */
import { describe, expect, it } from "vitest";

import { TOUS_SUPPORT_TYPES } from "@/server/qualiopi/supports/types";

const SLIDES_INTERDITES = ["slides_formateur", "slides_stagiaire"] as const;

describe("« Générer tous les supports » ne fabrique aucun PowerPoint projeté", () => {
  it("n'inclut ni slides_formateur ni slides_stagiaire", () => {
    for (const interdit of SLIDES_INTERDITES) {
      expect(
        TOUS_SUPPORT_TYPES,
        `${interdit} est de nouveau généré en lot. Le PowerPoint projeté est ` +
          `téléversé, jamais fabriqué (décision Will du 2026-07-15). ` +
          `Si la décision a changé, c'est ce commentaire qu'il faut réécrire, ` +
          `pas l'assertion qu'il faut supprimer.`,
      ).not.toContain(interdit);
    }
  });

  /**
   * Contre-témoin. Sans lui, vider `TOUS_SUPPORT_TYPES` rendrait le test
   * ci-dessus vert tout en cassant la génération — un vert imaginaire.
   */
  it("produit toujours les supports pédagogiques attendus", () => {
    expect(TOUS_SUPPORT_TYPES.length).toBeGreaterThanOrEqual(5);
    for (const attendu of [
      "livret_stagiaire",
      "memo",
      "guide_animation",
      "exercices",
      "grille_eval",
    ]) {
      expect(TOUS_SUPPORT_TYPES).toContain(attendu);
    }
  });

  /**
   * `kit_formateur_imprime` n'est pas produit par le moteur : `construireSupport`
   * lève volontairement pour ce type. L'ajouter ferait échouer le lot entier.
   */
  it("n'inclut pas kit_formateur_imprime, que le moteur ne sait pas produire", () => {
    expect(TOUS_SUPPORT_TYPES).not.toContain("kit_formateur_imprime");
  });
});
