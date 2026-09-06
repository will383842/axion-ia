/**
 * 🔴 Aucun bouton de génération ne doit FORCER le filigrane « COPIE ».
 *
 * ## Le défaut, et pourquoi il a survécu à son propre correctif
 *
 * Régénérer une pièce sans motif la fait sortir filigranée « COPIE ». Avec un
 * motif, elle sort en ORIGINAL et déclare au registre ce qu'elle remplace. Le
 * correctif du 2026-08-04 a donc introduit `useMotifRectification` et l'a câblé
 * dans `SessionDocButton` et `EnrollmentDocButton` — les deux boutons
 * GÉNÉRIQUES.
 *
 * `ConventionDocButton`, lui, a son PROPRE composant : il porte un champ que les
 * autres n'ont pas (l'acompte). Il vivait à côté du patron, et il n'a rien reçu.
 * Résultat vérifié le 2026-09-04 : régénérer une convention produisait TOUJOURS
 * une pièce « COPIE », sans aucun moyen de faire autrement depuis l'écran. Il
 * ne restait qu'à choisir devant l'auditeur entre un original faux et une copie
 * exacte — sur la pièce contractuelle la plus importante du dossier.
 *
 * ## Ce que ce témoin garde, et pourquoi il est STRUCTUREL
 *
 * Vérifier « `ConventionDocButton` appelle le hook » ne garderait rien : le
 * défaut n'est pas ce bouton-là, c'est le fait qu'un bouton puisse se
 * fabriquer À CÔTÉ du patron. Le prochain document à réglage particulier
 * repartirait d'un composant neuf et referait exactement la même chose.
 *
 * La règle gardée est donc : **le composant qui DESSINE lui-même l'affordance
 * « régénérer » doit posséder le motif.** Le repérage est le ternaire sur
 * `dejaGenereLe` — c'est-à-dire l'endroit précis où le composant affirme
 * « cette pièce existe déjà ». Un composant qui se contente de TRANSMETTRE
 * `dejaGenereLe` à un bouton générique (`LettreMissionButtons`) n'est pas
 * concerné, et ne doit pas l'être : le motif est porté par le bouton délégué.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FICHIER = path.join(process.cwd(), "src/components/admin/qualiopi/DocumentsSection.tsx");
const SOURCE = fs.readFileSync(FICHIER, "utf-8");

/**
 * Découpe le fichier en fonctions de premier niveau.
 *
 * Volontairement grossier — pas d'AST : la garde doit rester lisible et ne
 * dépend d'aucune dépendance. Le fichier n'a que des `function X(` en colonne 0,
 * et la suivante borne la précédente.
 */
function composants(): ReadonlyArray<{ nom: string; corps: string }> {
  const lignes = SOURCE.split("\n");
  const debuts: Array<{ nom: string; ligne: number }> = [];
  lignes.forEach((l, i) => {
    const m = /^(?:export )?function ([A-Za-z0-9_]+)\s*\(/.exec(l);
    if (m?.[1] !== undefined) debuts.push({ nom: m[1], ligne: i });
  });
  return (
    debuts
      .map((d, i) => ({
        nom: d.nom,
        corps: lignes.slice(d.ligne, debuts[i + 1]?.ligne ?? lignes.length).join("\n"),
      }))
      // Les COMPOSANTS seuls : majuscule initiale. `useMotifRectification` est
      // déclaré au même niveau et contient forcément son propre nom — l'inclure
      // ferait rougir la garde sur sa propre définition, bruit qui masquerait
      // un vrai fautif.
      .filter((c) => /^[A-Z]/.test(c.nom))
  );
}

/**
 * Le composant dessine-t-il lui-même le « … — régénérer » ?
 *
 * ⚠️ `(?!:)` n'est pas un détail. Sans lui, le motif attrapait la DÉCLARATION
 * de propriété optionnelle `dejaGenereLe?: string` — présente dans les
 * `interface …Props` que le découpage grossier rattache au composant précédent.
 * La garde désignait alors `AnnulerDocumentButton`, qui ne génère rien. Un
 * faux positif dans une garde structurelle est un poison lent : on finit par
 * l'élargir jusqu'à ce qu'elle ne dise plus rien.
 */
function dessineLAffordanceRegenerer(corps: string): boolean {
  return /dejaGenereLe\s*(\?(?!:)|&&)/.test(corps);
}

describe("🔴 aucun bouton de génération ne force le filigrane « COPIE »", () => {
  it("le recensement TROUVE des composants — sinon la garde ne garde rien", () => {
    // Témoin positif obligatoire : un découpage cassé rendrait une liste vide,
    // et une liste vide passe toutes les assertions ci-dessous sans rien
    // mesurer. C'est le piège du « dix zéros » : « aucune violation » et « je
    // ne sais pas lire le fichier » sont indiscernables sans cette ligne.
    const tous = composants();
    expect(tous.length).toBeGreaterThan(5);
    expect(tous.map((c) => c.nom)).toContain("ConventionDocButton");
    expect(tous.map((c) => c.nom)).toContain("SessionDocButton");
  });

  it("le recensement TROUVE des composants qui dessinent « régénérer »", () => {
    // Second témoin positif, sur le prédicat cette fois : si
    // `dessineLAffordanceRegenerer` ne reconnaissait plus rien, la garde
    // resterait verte en n'inspectant aucun composant.
    const concernes = composants().filter((c) => dessineLAffordanceRegenerer(c.corps));
    expect(concernes.map((c) => c.nom)).toEqual(
      expect.arrayContaining(["SessionDocButton", "ConventionDocButton", "EnrollmentDocButton"]),
    );
  });

  it("tout composant qui dessine « régénérer » APPELLE useMotifRectification", () => {
    const fautifs = composants()
      .filter((c) => dessineLAffordanceRegenerer(c.corps))
      .filter((c) => !c.corps.includes("useMotifRectification("))
      .map((c) => c.nom);
    expect(fautifs).toEqual([]);
  });

  it("… et TRANSMET le motif à l'action — l'appeler sans le passer ne sert à rien", () => {
    // Le hook peut être appelé et son `argument` jamais épandu : la pièce
    // ressortirait « COPIE » avec un champ de motif rempli à l'écran, ce qui
    // est pire que pas de champ du tout.
    const fautifs = composants()
      .filter((c) => c.corps.includes("useMotifRectification("))
      .filter((c) => !/\.\.\.\s*rect\.argument/.test(c.corps))
      .map((c) => c.nom);
    expect(fautifs).toEqual([]);
  });

  it("… et REND le champ de saisie, sinon le motif est inatteignable", () => {
    const fautifs = composants()
      .filter((c) => c.corps.includes("useMotifRectification("))
      .filter((c) => !/rect\.champ\(/.test(c.corps))
      .map((c) => c.nom);
    expect(fautifs).toEqual([]);
  });
});
