/**
 * Verrou — le formulaire d'entrée parle d'apport d'affaires, pas d'embauche.
 *
 * Plan « sept points salariat » (2026-11-25), lot L5a. Un formulaire qui parle
 * de « poste », de « candidature » et de « prérequis » décrit un recrutement :
 * indice de subordination retenu contre le réseau d'apporteurs.
 *
 * Le verrou lit le texte RENDU (littéraux de chaînes et texte JSX), jamais les
 * commentaires ni les noms d'événements Plausible (« Candidature Step »…).
 * « poste » reste toléré dans les champs du parcours (écran des expériences) :
 * leur retrait attend la décision D5 (lot L5b).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = path.resolve(__dirname, "..");
const FICHIERS = ["steps.tsx", "CommercialApplicationWizard.tsx"] as const;

/** Source sans commentaires ni appels `trackFunnel("…")` (noms techniques de mesure). */
function sourceRendue(fichier: string): string {
  return readFileSync(path.join(DOSSIER, fichier), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/trackFunnel\(\s*"[^"]*"/g, "trackFunnel(")
    .replace(/^\s*"?\d+"?:\s*"[^"]*",?$/gm, "");
}

/** Mots interdits ; « poste » est retiré des seules lignes du parcours (D5). */
const INTERDITS: ReadonlyArray<{ mot: string; re: RegExp }> = [
  { mot: "poste", re: /\bpostes?\b/i },
  { mot: "candidature", re: /candidatures?/i },
  { mot: "prérequis", re: /pr[ée]requis/i },
  { mot: "profil recherché", re: /profil recherch/i },
  { mot: "indispensable", re: /indispensable/i },
];

/** Champs du parcours (écran des expériences), tolérés jusqu'à D5. */
const PARCOURS =
  /poste occupé|mon poste actuel|"Poste \?"|exp\.poste|posteActuel|\{ poste:|-poste`|errors\[`\$\{pre\}-poste`\]/i;

describe("le formulaire d'entrée emploie le vocabulaire de l'apport d'affaires", () => {
  for (const fichier of FICHIERS) {
    for (const { mot, re } of INTERDITS) {
      it(`${fichier} ne rend pas « ${mot} »`, () => {
        const lignes = sourceRendue(fichier)
          .split("\n")
          .filter((l) => re.test(l))
          .filter((l) => !(mot === "poste" && PARCOURS.test(l)));
        expect(lignes, lignes.join("\n")).toEqual([]);
      });
    }
  }

  it("le texte de consentement parle d'une demande d'apport d'affaires", () => {
    const steps = readFileSync(path.join(DOSSIER, "steps.tsx"), "utf8");
    expect(steps.replace(/\s+/g, " ")).toContain("l’étude de ma demande d’apport d’affaires.");
  });
});
