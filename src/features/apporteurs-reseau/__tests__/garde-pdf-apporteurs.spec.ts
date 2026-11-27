import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Le dépôt est PUBLIC : tout fichier suivi y est lisible par tout le monde, `private/` compris
// (Next ne le sert pas, GitHub l'affiche). Les documents d'apporteur qui portent des montants
// (fiche des commissions, livret, guide) vivent UNIQUEMENT sur R2 (`documents-apporteurs/…`).
//
// Cette garde refuse, sans liste blanche pour les trois pièces ci-dessus :
//   1. tout fichier suivi sous `private/apporteurs/`, et tout PDF sous `public/documents/apporteurs/`
//      (ce dossier garde ses polices et visuels d'outils, sans montant) ;
//   2. tout PDF suivi, n'importe où, dont le chemin contient « apporteur » (hors liste ci-dessous) ;
//   3. tout fichier TEXTE (md, txt, html, json, csv, xml, svg) sous `private/` ou `public/` dont
//      le chemin contient « apporteur » ou dont le contenu parle d'apporteur ET porte un montant.
//
// Liste justifiée : deux PDF d'apporteur encore suivis, en attente de la décision de Will
// (support de recrutement public par choix, ou retrait). Les retirer de la liste ET du dépôt le
// jour où la décision est prise ; en ajouter un nouveau exige une justification ici.
const PDF_APPORTEUR_EN_ATTENTE_DE_DECISION = new Set([
  // Imprimé INTERNE lu à l'exécution par la route console `api/admin/imprimes` (Dockerfile).
  "private/imprimes/trame-echange-apporteur.pdf",
  // Support de recrutement hors ligne, hors `public/`.
  "docs/pdf-hors-ligne-certification/apporteur/devenir-apporteur-d-affaires-axion-ia.pdf",
]);

// Texte public d'apporteur qui cite des pourcentages : messages de recrutement de Will, servis à
// une adresse non référencée. Public par choix À CONFIRMER par Will (signalé dans la PR #2399).
const TEXTE_PUBLIC_EN_ATTENTE_DE_DECISION = new Set([
  "public/outils-will/aujourdhui-k7m2.html",
  "public/outils-will/reponses-facebook-k7m2.html",
]);

const TEXTE = /\.(md|mdx|txt|html?|json|csv|xml|svg)$/i;
const MONTANT = /\d[\d\s .\u00a0\u202f]*(€|euros?\b|%)|(€|EUR)\s?\d/i;

function suivis(...motifs: string[]): string[] {
  const sortie = execFileSync("git", ["ls-files", "-z", "--", ...motifs], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return sortie.split("\0").filter(Boolean);
}

describe("aucun document d'apporteur à montants dans le dépôt public", () => {
  it("rien du tout sous private/apporteurs/, aucun PDF sous public/documents/apporteurs/", () => {
    expect(suivis("private/apporteurs")).toEqual([]);
    expect(suivis("public/documents/apporteurs").filter((p) => /\.pdf$/i.test(p))).toEqual([]);
  });

  it("aucun PDF d'apporteur suivi, où que ce soit (hors liste justifiée)", () => {
    const pdf = suivis("*.pdf", "*.PDF").filter((p) => /apporteur/i.test(p));
    expect(pdf.filter((p) => !PDF_APPORTEUR_EN_ATTENTE_DE_DECISION.has(p))).toEqual([]);
  });

  it("la liste justifiée ne garde pas de fichier fantôme", () => {
    const presents = new Set(suivis("*.pdf"));
    for (const p of PDF_APPORTEUR_EN_ATTENTE_DE_DECISION) expect(presents.has(p)).toBe(true);
  });

  it("aucun texte d'apporteur avec montants sous private/ ni public/", () => {
    const fautifs = suivis("private", "public")
      .filter((p) => TEXTE.test(p) && !TEXTE_PUBLIC_EN_ATTENTE_DE_DECISION.has(p))
      .filter((p) => {
        if (/apporteur/i.test(p)) return true;
        const t = readFileSync(p, "utf8");
        return /apporteur/i.test(t) && MONTANT.test(t);
      });
    expect(fautifs).toEqual([]);
  });
});
