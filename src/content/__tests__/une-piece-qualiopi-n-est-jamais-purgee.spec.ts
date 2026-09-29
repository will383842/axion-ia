// @vitest-environment node

/**
 * Verrou — la conservation du dossier client ne purge JAMAIS une pièce légale
 * (chantier visio, PR 8 ; ADR 0056 ; préparé pour V-17, où des pièces Qualiopi
 * naîtront des rencontres).
 *
 * Devis, factures, conventions, attestations, documents générés, e-mails
 * envoyés : ils ont leur propre durée (`DOCUMENT_RETENTION_YEARS`, obligation
 * comptable et Qualiopi). La purge du dossier les LIT comme ancres de date
 * (dernière facture émise, dernier devis accepté), et ne doit jamais les
 * supprimer ni les modifier.
 *
 * La garde lit le code de la conservation — la section « CONSERVATION CODÉE »
 * de `rgpd-erase.ts` et `src/server/visio/conservation.ts` — et refuse toute
 * écriture (`delete`, `deleteMany`, `update`, `updateMany`, `upsert`) sur un
 * modèle de pièce.
 *
 * Contre-témoin : un extrait fictif qui supprime des factures est refusé.
 * Angle mort : un appel à une AUTRE fonction qui, elle, toucherait une pièce
 * ne se voit pas ici (aucune n'est appelée aujourd'hui depuis ces sections).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const PIECES = [
  "devis",
  "factureFormation",
  "facture",
  "avoir",
  "convention",
  "documentGenere",
  "attestation",
  "emailOutbox",
  "emailLog",
  "trainingSession",
  "enrollment",
] as const;

const ECRITURE = /\.(delete|deleteMany|update|updateMany|upsert)\(/;

function ecrituresSurPieces(code: string): string[] {
  const trouvees: string[] = [];
  for (const modele of PIECES) {
    const re = new RegExp(`\\b(?:tx|prisma)\\.${modele}${ECRITURE.source}`, "g");
    for (const m of code.matchAll(re)) trouvees.push(m[0]);
  }
  return trouvees;
}

function sectionConservation(): string {
  const erase = readFileSync(join(process.cwd(), "src/lib/rgpd-erase.ts"), "utf8");
  const debut = erase.indexOf("CONSERVATION CODÉE DU DOSSIER CLIENT");
  return debut < 0 ? "" : erase.slice(debut);
}

describe("une pièce légale n'est jamais purgée par la conservation du dossier", () => {
  it("🔑 la section de conservation est bien lue", () => {
    expect(sectionConservation()).toContain("purgerDossiersVisioEchus");
  });

  it("🔴 rgpd-erase.ts (conservation) n'écrit sur aucune pièce", () => {
    expect(ecrituresSurPieces(sectionConservation())).toEqual([]);
  });

  it("🔴 conservation.ts n'écrit sur rien (fonctions pures)", () => {
    const src = readFileSync(join(process.cwd(), "src/server/visio/conservation.ts"), "utf8");
    expect(src).not.toMatch(/prisma|\btx\./);
  });

  it("🔑 CONTRE-TÉMOIN : une suppression de factures est reconnue", () => {
    expect(ecrituresSurPieces("await tx.factureFormation.deleteMany({ where: {} });")).toEqual([
      "tx.factureFormation.deleteMany(",
    ]);
    expect(ecrituresSurPieces("await prisma.devis.groupBy({ by: ['clientId'] });")).toEqual([]);
  });
});
