/**
 * Verrou — le dossier intervenant de Williams Jullin EST servi, et la console le montre.
 *
 * ## Le constat (2026-09-27, demande Will)
 *
 * « Le PDF doit être visible directement depuis la console d'administration,
 * comme le catalogue et le flyer. » Le dossier est envoyé en pièce jointe aux
 * organisateurs d'événements qui répondent, et partagé par lien (LinkedIn,
 * formulaires d'organisateurs) : son URL publique part hors du site, où rien
 * ne la relit. Un renommage ou une suppression la casserait en silence.
 *
 * ## Ce que ce verrou fige
 *
 * - le fichier existe sous `public/`, en 12 pages, et reste sous 3 Mo (il part
 *   en pièce jointe : un poids qui dérive finit refusé par une messagerie) ;
 * - l'onglet Imprimés de la console le liste.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { IMPRIMES } from "@/content/imprimes";

const DOSSIER = "imprimes/dossier-intervenant-williams-jullin-axion-ia.pdf";

/** Même méthode que `le-guide-promis-existe.spec.ts` : le rendu Chrome ne compresse pas les objets de page. */
function pagesDuPdf(fichier: string): number {
  return (readFileSync(fichier, "latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

describe("le dossier intervenant", () => {
  it("est servi, en 12 pages, sous 3 Mo", () => {
    const fichier = path.join(process.cwd(), "public", DOSSIER);
    expect(existsSync(fichier)).toBe(true);
    expect(statSync(fichier).size).toBeLessThan(3_000_000);
    expect(pagesDuPdf(fichier)).toBe(12);
  });

  it("l'onglet Imprimés de la console le liste", () => {
    const dossier = IMPRIMES.find((i) => i.id === "dossier-intervenant");
    expect(dossier?.fichiersPublics.map((f) => f.chemin)).toContain(DOSSIER);
  });
});
