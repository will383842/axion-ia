/**
 * Garde — pas d'interpolation nue dans un `<Text>` de la procédure.
 *
 * ## Le défaut observé, et ce qu'il a coûté de le comprendre
 *
 * Constaté le 04/08/2026 sur la pièce RÉELLE `AXI-DOC-2026-026` (procédure de
 * sous-traitance, indicateur 27), générée depuis la console de production : le
 * PDF imprimait « les dispositions de AXION IA SAS**en** matière » et « à qui
 * AXION IA SAS**confie** tout ou partie ». Deux mots soudés sur la pièce qu'un
 * auditeur ouvre en premier pour le critère 6. Vérifié à 450 dpi et au niveau
 * des boîtes de mots : `SASen` et `SASconfie` sont bien des mots UNIQUES.
 *
 * Mécanisme : un `<Text>` dont les enfants alternent expression et littéral
 * (`{organisme} en matière de…`) produit des « runs » distincts. Sur une ligne
 * JUSTIFIÉE et serrée, @react-pdf comprime les espaces — et celui qui tombe
 * exactement à la frontière de deux runs peut être réduit à rien. Les deux
 * lignes fautives sont précisément les deux lignes pleine largeur du document ;
 * les deux autres occurrences de `{organisme}`, sur des lignes non tendues,
 * sortaient correctement espacées.
 *
 * ## 🔴 Pourquoi cette garde est SOURCE et non RENDU
 *
 * J'ai d'abord écrit une garde qui rendait le PDF et lisait son texte. Elle est
 * restée VERTE avec le défaut réintroduit, y compris avec les polices réelles
 * et l'identité exacte de production (NDA et Qualiopi vides) : le défaut ne se
 * reproduit pas hors du conteneur, la ligne ne se coupant pas au même endroit.
 * Une garde qui ne rougit pas ne garde rien — la publier aurait été pire que
 * rien, puisqu'elle aurait fait croire le sujet couvert.
 *
 * ⚠️ Deux tests existaient déjà sur cette procédure et ne pouvaient pas non plus
 * le voir : `collectPdfTextNormalized` parcourt l'ARBRE REACT et joint les
 * enfants d'un tableau par `" "` — il FABRIQUE l'espace que le rendu supprime.
 *
 * Ce qui EST vérifiable de façon déterministe, c'est le mécanisme lui-même :
 * s'il n'existe aucune frontière de run, la justification n'a rien à écraser.
 * La garde interdit donc l'interpolation nue et exige une chaîne unique.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const GABARIT = path.join(
  process.cwd(),
  "src/server/qualiopi/documents/templates/procedure-sous-traitance.tsx",
);

describe("🔴 procédure de sous-traitance — aucune interpolation nue dans un <Text>", () => {
  const source = fs.readFileSync(GABARIT, "utf8");

  it("le gabarit est bien lu (sinon la garde ne garde rien)", () => {
    // Sans ceci, un chemin faux rendrait "" et toutes les assertions
    // ci-dessous passeraient — exactement le piège qu'on vient de payer.
    expect(source.length).toBeGreaterThan(2000);
    expect(source).toContain("ProcedureSousTraitancePdf");
  });

  it("`{organisme}` n'apparaît jamais nu, seulement dans une chaîne unique", () => {
    // Nu = `{organisme}` précédé d'une accolade ouvrante SANS backtick, donc
    // voisin d'un littéral JSX. Dans une chaîne, la forme est `${organisme}`.
    const nues = [...source.matchAll(/(?<!\$)\{organisme\}/g)]
      .map((m) => {
        const debut = Math.max(0, m.index - 60);
        return source.slice(debut, m.index + 40).replace(/\s+/g, " ");
      })
      // Les commentaires citent la forme fautive pour l'expliquer : ils ne
      // rendent rien. Les exclure, sans quoi la garde s'auto-déclenche.
      .filter((extrait) => !extrait.includes("*") && !extrait.includes("//"));

    expect(nues, `interpolations nues : ${nues.join(" | ")}`).toHaveLength(0);
  });

  it("les cinq phrases portant la raison sociale sont des chaînes uniques", () => {
    // Ancrage sur le contenu : si quelqu'un rescinde une de ces phrases en
    // `{organisme} + littéral`, le fragment cherché disparaît.
    for (const fragment of [
      "${organisme} en matière de sous-traitance",
      "${organisme} est conçue et animée",
      "${organisme} confie tout ou partie",
      "${organisme} reste responsable",
      "${organisme} demeure, en toute hypothèse",
    ]) {
      expect(source, `fragment absent : ${fragment}`).toContain(fragment);
    }
  });
});
