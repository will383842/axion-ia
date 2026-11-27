import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

// Le dépôt est PUBLIC. Un PDF d'apporteur committé y est lisible par tout le monde.
//   · `public/documents/apporteurs/` : servi tel quel par Next -> AUCUN PDF, jamais.
//   · `private/apporteurs/` : les trois PDF ci-dessous sont lus à l'exécution (copie embarquée
//     déposée sur R2 si l'objet manque) ; toute AUTRE pièce doit aller directement sur R2.
const PRIVES_TOLERES = new Set([
  "private/apporteurs/fiche-des-commissions.pdf",
  "private/apporteurs/guide-demarrage-apporteur.pdf",
  "private/apporteurs/livret-apporteur.pdf",
]);

function pdfSuivis(dossier: string): string[] {
  const sortie = execFileSync("git", ["ls-files", "--", dossier], { encoding: "utf8" });
  return sortie.split("\n").filter((l) => /\.pdf$/i.test(l));
}

describe("aucun PDF d'apporteur dans le dépôt public", () => {
  it("rien de .pdf sous public/documents/apporteurs/", () => {
    expect(pdfSuivis("public/documents/apporteurs")).toEqual([]);
  });

  it("sous private/apporteurs/, seulement les trois pièces lues à l'exécution", () => {
    const inattendus = pdfSuivis("private/apporteurs").filter((p) => !PRIVES_TOLERES.has(p));
    expect(inattendus).toEqual([]);
  });
});
