// @vitest-environment node

/**
 * Le document de présentation apporteur (PDF du kit) ne promet ni financement
 * acquis ni revenu par paliers (2026-09-19).
 *
 * ## Ce qu'il disait
 *
 * « Nos formations sont éligibles aux dispositifs OPCO et France Travail »,
 * « le reste à charge devient minime », « Souvent financé par l'OPCO », et une
 * page de cinq barres montant de « 2 formations / mois » à « 20 formations /
 * mois » (10 000 €). Trois citations « Ce qui l'intéresse » mettaient en outre
 * des phrases toutes faites dans la bouche de la personne qui recommande.
 *
 * Un financement dépend de l'éligibilité de l'entreprise et de son opérateur :
 * il se dit au conditionnel. Et des paliers de volume par mois, dans un document
 * remis à un indépendant, ressemblent à un objectif — exactement ce que le
 * contrat d'apporteur exclut.
 *
 * ## Ce qu'il vérifie
 *
 * Sur le PDF PUBLIÉ (celui que le kit envoie), pas sur sa source HTML : un HTML
 * corrigé sans PDF régénéré laisserait partir l'ancien texte. Le texte est
 * extrait par `pdftotext -enc UTF-8` (sans l'encodage explicite, la sortie est
 * binaire et un `grep` sans `-a` sous-compte). Les pages se comptent aux sauts
 * de page (`\f`) de cette même sortie.
 *
 * ⚠️ `pdftotext` (poppler) n'est pas installé partout : le test est alors
 * IGNORÉ, avec un avertissement. Il ne doit pas passer en vert sans avoir lu.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const PDF = join(process.cwd(), "public/imprimes/devenir-apporteur-d-affaires-axion-ia.pdf");

function extraire(): string | null {
  try {
    return execFileSync("pdftotext", ["-enc", "UTF-8", PDF, "-"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

const texte = existsSync(PDF) ? extraire() : null;
if (texte === null) {
  console.warn(
    "[document-apporteur] pdftotext indisponible (ou PDF absent) : contrôle du texte du PDF IGNORÉ.",
  );
}

describe.skipIf(texte === null)("le document apporteur publié", () => {
  const t = texte ?? "";

  it("compte exactement 13 pages", () => {
    // `pdftotext` termine chaque page par un saut de page.
    expect(t.split("\f").length - 1).toBe(13);
  });

  it("🔴 dit « selon éligibilité », au moins deux fois", () => {
    expect(t.match(/selon éligibilité/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it.each([
    ["reste à charge devient", /reste à charge devient/i],
    ["formations / mois", /formations \/ mois/i],
    ["Ce qui l'intéresse", /ce qui l.intéresse/i],
    ["Souvent financé", /souvent financé/i],
  ])("🔴 ne contient plus « %s »", (_nom, motif) => {
    expect(t).not.toMatch(motif);
  });

  it("donne le lien du dossier d'un seul tenant", () => {
    expect(t).toContain("axion-ia.com/fr/devenir-commercial-ia/candidature");
  });
});
