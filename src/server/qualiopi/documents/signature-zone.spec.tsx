/**
 * Tests — `SignatureZone` et le rendu d'une signature RÉELLEMENT apposée.
 *
 * Deux familles d'invariants :
 *
 *  1. **ZÉRO régression sur le circuit papier.** Sans preuve, la zone rend
 *     exactement ce qu'elle rendait avant : des cadres à remplir au stylo. Ce
 *     n'est pas un état dégradé — c'est le seul chemin qui fonctionne quand la
 *     salle n'a pas de réseau, et neuf templates en dépendent.
 *  2. **Le PDF ne ment jamais sur la NATURE de la preuve.** Une confirmation
 *     accessible n'est pas présentée comme un tracé, et une image purgée à la
 *     demande du signataire n'est pas présentée comme une signature manquante.
 *     C'est exactement le défaut retiré côté AFEST : des cases « signé » que
 *     rien n'étayait.
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { SignatureZone, type PreuveSignature, type SignaturePartie } from "./base-layout";
import { collectPdfTextNormalized } from "./collect-pdf-text";

const EMPREINTE = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

function preuve(over: Partial<PreuveSignature> = {}): PreuveSignature {
  return {
    signataireNom: "Camille Durand",
    signataireQualite: "Directrice des ressources humaines",
    signeAtLisible: "10 juin 2026 à 10:15 (heure de Paris)",
    empreinte: EMPREINTE,
    methode: "trace",
    // PNG 1×1 valide — le rendu doit accepter une data-URL sans aller sur le réseau.
    imageSrc:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    ...over,
  };
}

/**
 * Texte réellement rendu par la zone.
 *
 * ⚠️ On extrait l'arbre React (`collect-pdf-text`, l'outil du dépôt) plutôt que
 * de rendre un PDF : `renderToString` produit le binaire compressé, où aucune
 * assertion de texte ne tient. Un test qui rendrait le PDF ne vérifierait que
 * l'absence de crash.
 */
function rendre(parties: SignaturePartie[]): string {
  return collectPdfTextNormalized(React.createElement(SignatureZone, { parties }));
}

describe("🔴 zéro régression sur le circuit papier", () => {
  it("sans preuve, rend les cadres vides — comportement historique INCHANGÉ", () => {
    const texte = rendre([
      { titre: "Pour le client", nom: "ACME SAS" },
      { titre: "Pour l'organisme", nom: "Axion-IA" },
    ]);
    expect(texte).toContain("Lu et approuvé");
    expect(texte).toContain("Nom, qualité, signature et cachet");
    expect(texte).not.toContain("Empreinte :");
  });

  it("une preuve `null` équivaut à une absence de preuve", () => {
    // ⚠️ L'appelant lira souvent une signature en base : `null` est le cas
    // NORMAL d'une pièce non encore signée, pas une erreur de programmation.
    const texte = rendre([{ titre: "Pour le client", nom: "ACME SAS", signature: null }]);
    expect(texte).toContain("Lu et approuvé");
    expect(texte).not.toContain("Empreinte :");
  });

  it("mélange les deux états dans la même zone sans se troubler", () => {
    // Cas RÉEL d'une pièce partiellement signée : une partie a signé, l'autre
    // pas encore. Les deux doivent coexister sans que l'une contamine l'autre.
    const texte = rendre([
      { titre: "Pour le client", signature: preuve() },
      { titre: "Pour l'organisme", nom: "Axion-IA" },
    ]);
    expect(texte).toContain("Camille Durand");
    expect(texte).toContain("Lu et approuvé");
  });
});

describe("🔴 le PDF ne ment pas sur la nature de la preuve", () => {
  it("un tracé affiche l'identité, la qualité, l'horodatage et l'empreinte ENTIÈRE", () => {
    const texte = rendre([{ titre: "Pour le client", signature: preuve() }]);
    expect(texte).toContain("Camille Durand");
    expect(texte).toContain("Directrice des ressources humaines");
    expect(texte).toContain("10 juin 2026");
    // Empreinte entière : une empreinte tronquée ne se vérifie pas, et une
    // preuve invérifiable n'en est pas une.
    expect(texte).toContain(EMPREINTE);
  });

  it("🔴 une confirmation accessible est DITE, pas déguisée en tracé manquant", () => {
    // La personne a déclaré ne pas pouvoir tracer. Sa confirmation nominative
    // vaut autant (plan II.2bis) ; un cadre vide se lirait « pas signé ».
    const texte = rendre([
      {
        titre: "Pour le client",
        signature: preuve({ methode: "confirmation_accessible", imageSrc: null }),
      },
    ]);
    expect(texte).toContain("confirmation nominative");
    expect(texte).toContain("même valeur");
    expect(texte).toContain(EMPREINTE);
    expect(texte).not.toContain("Lu et approuvé");
  });

  it("🔴 une image purgée (art. 17) est DITE — sinon un droit exercé se lit comme un manquement", () => {
    const texte = rendre([
      {
        titre: "Pour le client",
        signature: preuve({ imageSrc: null, imagePurgee: true }),
      },
    ]);
    expect(texte).toContain("supprimée à la demande du signataire");
    // 🔴 La signature RESTE établie : l'effacement porte sur l'image, pas sur le
    // fait — opposable et fondé sur une obligation légale — qu'elle a eu lieu.
    expect(texte).toContain("reste établie");
    expect(texte).toContain(EMPREINTE);
  });

  it("le papier scanné dit qu'il vient du papier", () => {
    // Sa valeur probante est la même, mais son mode de recueil est différent, et
    // le taire priverait un contrôle d'une information exacte.
    const texte = rendre([
      { titre: "Pour le client", signature: preuve({ methode: "papier_scanne" }) },
    ]);
    expect(texte).toContain("manuscrite sur papier");
  });

  it("une image absente sans purge ni modalité accessible est signalée, pas masquée", () => {
    // Ce cas ne devrait pas exister — un CHECK de la base l'interdit. S'il
    // survient quand même, le PDF doit le DIRE plutôt que d'afficher un blanc
    // qui se lirait comme une signature normale.
    const texte = rendre([{ titre: "Pour le client", signature: preuve({ imageSrc: null }) }]);
    expect(texte).toContain("indisponible");
  });
});
