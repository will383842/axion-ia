/**
 * Garde — le nom d'une pièce à l'écran est celui qui s'imprime dessus, et deux
 * pièces différentes ne portent jamais presque le même nom.
 *
 * ## Le défaut que cette garde ferme (2026-09-05)
 *
 * `LIBELLES_TYPE_DOCUMENT.attestation` valait « Attestation de RÉALISATION » —
 * le vocabulaire du CERTIFICAT de réalisation, qui est une autre pièce, due à un
 * autre destinataire (le financeur, R.6313-3) sur un autre fondement que
 * l'attestation de fin de formation (le stagiaire, L.6353-1).
 *
 * Ce libellé n'est pas décoratif : il s'affiche dans la matrice des indicateurs,
 * il s'écrit dans le dossier d'audit remis en séance (`audit-dossier.ts`), et
 * surtout il devient le NOM DE FICHIER téléchargé et transmis
 * (`nom-fichier.ts`). Un auditeur qui lit deux lignes voisines « Attestation de
 * réalisation » et « Certificat de réalisation » ne peut pas les distinguer.
 *
 * Or le bon mot était déjà imprimé sur la pièce elle-même : le gabarit porte
 * `docTitle="Attestation de fin de formation"`. C'est le vocabulaire d'écran qui
 * avait dérivé du papier.
 *
 * ## Pourquoi cette garde-ci, et pas un simple test d'égalité de chaîne
 *
 * Un test qui écrirait « attendu : Attestation de fin de formation » recopierait
 * la valeur qu'il contrôle : il verdirait le jour où quelqu'un change les deux
 * dans le même geste. Le titre attendu est donc LU dans le gabarit — la seule
 * source qui atteigne réellement le lecteur du PDF.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { DocumentType } from "../../../../prisma/generated/client";
import { LIBELLES_TYPE_DOCUMENT, libelleTypeDocument } from "./libelles-type-document";

const TEMPLATES_DIR = join(process.cwd(), "src", "server", "qualiopi", "documents", "templates");

/**
 * Le titre RÉELLEMENT imprimé en tête du PDF, extrait du gabarit.
 *
 * `docTitle` est passé en littéral à `QualiopiPage` dans les trois gabarits
 * concernés. Une expression (variable, ternaire) ne matcherait pas — et c'est
 * volontaire : le test doit alors échouer et être relu, plutôt que de retomber
 * silencieusement sur une chaîne vide qui rendrait la comparaison triviale.
 */
function docTitleDuGabarit(fichier: string): string {
  const source = readFileSync(join(TEMPLATES_DIR, fichier), "utf8");
  const m = /docTitle="([^"]+)"/.exec(source);
  if (m === null) {
    throw new Error(
      `Aucun \`docTitle="…"\` littéral trouvé dans ${fichier}. Si le titre est ` +
        "devenu une expression, cette garde ne mesure plus rien : la réécrire " +
        "plutôt que la supprimer.",
    );
  }
  return m[1] as string;
}

/** Les trois pièces de fin de parcours, celles que l'on confond. */
const PIECES_DE_FIN: ReadonlyArray<{ type: DocumentType; gabarit: string }> = [
  { type: "attestation" as DocumentType, gabarit: "attestation.tsx" },
  { type: "attestation_partielle" as DocumentType, gabarit: "attestation-partielle.tsx" },
  { type: "certificat_realisation" as DocumentType, gabarit: "certificat-realisation.tsx" },
];

describe("le libellé d'écran est celui qui s'imprime", () => {
  it.each(PIECES_DE_FIN)(
    "$type : le libellé du registre est le titre du PDF (lu dans $gabarit)",
    ({ type, gabarit }) => {
      const titreImprime = docTitleDuGabarit(gabarit);
      // Témoin de non-vacuité : une regex qui rendrait "" passerait tout.
      expect(titreImprime.length).toBeGreaterThan(10);
      expect(LIBELLES_TYPE_DOCUMENT[type]).toBe(titreImprime);
    },
  );
});

describe("deux pièces différentes ne portent pas presque le même nom", () => {
  it("l'attestation de fin de formation n'emprunte PAS le mot du certificat", () => {
    // Garde étroite ET orientée : elle vise le mot qui appartient à l'autre
    // pièce, sur la seule entrée qui l'avait emprunté. Elle n'interdit pas le
    // mot « réalisation » en général — il est légitime, et exigé, ailleurs.
    expect(libelleTypeDocument("attestation").toLowerCase()).not.toContain("réalisation");
    expect(libelleTypeDocument("attestation_partielle").toLowerCase()).not.toContain("réalisation");
  });

  it("TÉMOIN POSITIF — le certificat, lui, DOIT porter ce mot", () => {
    // Sans ce témoin, la garde ci-dessus resterait verte si quelqu'un retirait
    // « réalisation » de partout : elle ne distinguerait plus « le vocabulaire
    // est en ordre » de « il n'y a plus de vocabulaire ».
    expect(libelleTypeDocument("certificat_realisation").toLowerCase()).toContain("réalisation");
  });

  it("aucun libellé n'est porté par deux types de pièce", () => {
    const parLibelle = new Map<string, string[]>();
    for (const [type, libelle] of Object.entries(LIBELLES_TYPE_DOCUMENT)) {
      parLibelle.set(libelle, [...(parLibelle.get(libelle) ?? []), type]);
    }
    const collisions = [...parLibelle.entries()].filter(([, types]) => types.length > 1);
    expect(collisions).toEqual([]);
    // Témoin de non-vacuité : un Record vide passerait le test ci-dessus.
    expect(parLibelle.size).toBeGreaterThan(20);
  });
});
