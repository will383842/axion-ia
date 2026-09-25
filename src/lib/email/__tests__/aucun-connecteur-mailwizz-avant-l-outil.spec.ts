/**
 * ADR 0052 §g : tant que l'outil d'envoi de Will (MailWizz + PowerMTA) n'existe pas,
 * AUCUN code ne parle à MailWizz ni à PowerMTA. On écrit le contrat, pas le connecteur.
 *
 * Un connecteur construit d'avance n'a aucun consommateur : il dérive sans que personne
 * le voie, et le jour du branchement on découvre qu'il ne correspond plus au contrat.
 * Cette garde rougit dès qu'un fichier de `src/` lit une variable `MAILWIZZ_*` ou
 * `PMTA_*` hors de leur déclaration (`src/env.ts`) et de l'inventaire des sous-traitants.
 *
 * Le jour où l'outil est construit, on retire cette garde DANS la PR qui construit
 * l'entrée de retour de l'ADR 0052 §d : c'est une décision, pas un oubli.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");
const MOTIF = "(MAILWIZZ|PMTA)_API_(URL|KEY)";

/** Seuls endroits où ces noms ont le droit d'apparaître. */
const AUTORISES = new Set([
  "src/env.ts",
  "src/content/__tests__/sous-traitants-serveur.spec.ts",
  "src/lib/email/__tests__/aucun-connecteur-mailwizz-avant-l-outil.spec.ts",
]);

function fichiersQuiCitent(motif: string): string[] {
  try {
    const sortie = execFileSync("git", ["grep", "--untracked", "-l", "-E", motif, "--", "src"], {
      cwd: RACINE,
      encoding: "utf8",
    });
    return sortie
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch (e) {
    // `git grep` sort en 1 quand rien ne correspond : c'est un résultat, pas une erreur.
    if ((e as { status?: number }).status === 1) return [];
    throw e;
  }
}

describe("aucun connecteur MailWizz / PowerMTA avant l'outil (ADR 0052)", () => {
  it("témoin : la recherche trouve bien la déclaration dans env.ts", () => {
    // Sans ce témoin, une recherche cassée (mauvais dossier, motif faux) rendrait
    // la garde verte pour la mauvaise raison.
    expect(fichiersQuiCitent(MOTIF)).toContain("src/env.ts");
    expect(readFileSync(path.join(RACINE, "src/env.ts"), "utf8")).toMatch(/MAILWIZZ_API_URL/);
  });

  it("🔴 aucun autre fichier de src/ ne lit MAILWIZZ_* ni PMTA_*", () => {
    const intrus = fichiersQuiCitent(MOTIF).filter((f) => !AUTORISES.has(f));
    expect(intrus).toEqual([]);
  });
});
