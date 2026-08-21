/**
 * 🔴 Deux fonctionnalités écrites, testées, et que personne ne pouvait déclencher.
 *
 * ## Ce que la garde générique ne voyait pas
 *
 * `toute-action-a-une-surface.spec.ts` raisonne au grain du FICHIER : un module
 * d'actions dont aucune n'atteint un écran est signalé. C'est le bon grain pour
 * un module entier oublié — mais `presence.ts` et `piece-lien-signature.ts`
 * avaient chacun d'autres actions parfaitement branchées. Les deux ci-dessous
 * étaient donc invisibles à ce filtre, et ce fichier les tient nommément.
 *
 * ## 1. Le relevé de connexion (`D2-3-C3`)
 *
 * `genererReleveConnexionDocumentAction` était écrite et testée. L'écran d'import
 * affichait la référence d'import en police mono… et n'offrait aucun moyen d'en
 * produire le relevé.
 *
 * ⚠️ Ce n'est pas un PDF de confort : le relevé porte, en toutes lettres, « Ce
 * document remplace la feuille d'émargement pour les formations dispensées à
 * distance ». C'est la pièce qu'un OPCO réclame pour financer une action
 * distancielle. La chaîne s'arrêtait une marche avant la fin — l'import
 * calculait le taux, mais la preuve archivée n'existait pas.
 *
 * ## 2. La coupure des liens de signature (`D3-3-06`)
 *
 * `revoquerLiensSignatureAction` était écrite, gardée, et nommait elle-même ses
 * cas d'usage : « erreur de destinataire, pièce retirée, demande RGPD ». Aucun
 * écran ne l'offrait — un lien parti à la mauvaise adresse restait VIVANT
 * jusqu'à son expiration, sans aucun moyen de le couper.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();

/**
 * Le fichier, commentaires ôtés.
 *
 * 🔑 Sans cela un test statique trouve ses PROPRES commentaires : les en-têtes
 * ci-dessus nomment les deux actions pour expliquer le défaut, et cette mention
 * suffirait à les faire compter comme un usage.
 */
function lireCode(...segments: string[]): string {
  return readFileSync(join(RACINE, ...segments), "utf-8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const SESSIONS = ["src", "app", "[locale]", "(admin)", "[adminPrefix]", "qualiopi", "sessions"];

describe("les actions raccordées à un écran", () => {
  describe("🔴 `D2-3-C3` — le relevé de connexion peut être produit", () => {
    const formulaire = lireCode("src", "components", "admin", "qualiopi", "ImportReleveForm.tsx");
    const page = lireCode(...SESSIONS, "[id]", "emargement", "page.tsx");

    it("le formulaire OFFRE la génération", () => {
      expect(formulaire, "le formulaire n'appelle plus la génération du relevé").toContain(
        "genererReleveAction(",
      );
    });

    it("la page lui passe la vraie action", () => {
      // ⚠️ Deux moitiés distinctes : un formulaire qui appelle une prop jamais
      // fournie compilerait mal, mais une page qui passe une AUTRE action
      // compilerait très bien — et produirait le mauvais document.
      expect(page).toContain("genererReleveConnexionDocumentAction");
      expect(page).toMatch(/genererReleveAction=\{genererReleveConnexionDocumentAction\}/);
    });

    it("le témoin : l'import, lui, était déjà branché", () => {
      // 🔑 Sans ce témoin, un formulaire vidé passerait les deux tests
      // ci-dessus au vert : on aurait « raccordé » la génération en cassant
      // l'import qui la précède.
      expect(formulaire).toContain("importAction(");
      expect(page).toMatch(/importAction=\{importReleveConnexionAction\}/);
    });
  });

  describe("🔴 `D3-3-06` — les liens de signature peuvent être coupés", () => {
    const panneau = lireCode("src", "components", "admin", "qualiopi", "PieceSignaturePanel.tsx");
    const page = lireCode(...SESSIONS, "[id]", "page.tsx");

    it("le panneau OFFRE la coupure", () => {
      expect(panneau, "le panneau n'appelle plus la coupure des liens").toContain(
        "revoquerLiensAction(",
      );
    });

    it("la coupure exige un MOTIF non vide", () => {
      // Le service le refuse aussi, et c'est très bien : l'écran le dit AVANT
      // le clic plutôt que de laisser découvrir le refus après coup. Le motif
      // est inscrit au registre — c'est lui que l'auditeur lira.
      expect(panneau).toMatch(/motifCoupure\.trim\(\)\s*===\s*""/);
      expect(panneau).toMatch(/motif:\s*motifCoupure\.trim\(\)/);
    });

    it("la page lui passe la vraie action", () => {
      expect(page).toMatch(/revoquerLiensAction=\{revoquerLiensSignatureAction\}/);
    });

    it("le témoin : l'émission, elle, était déjà branchée", () => {
      expect(panneau).toContain("emettreAction(");
      expect(page).toMatch(/emettreAction=\{emettreLienSignatureAction\}/);
    });
  });
});
