/**
 * ADR 0052 §g : tant que l'outil d'envoi de Will (MailWizz + PowerMTA) n'existe pas,
 * AUCUN code ne parle à MailWizz ni à PowerMTA. On écrit le contrat, pas le connecteur.
 *
 * Un connecteur construit d'avance n'a aucun consommateur : il dérive sans que personne
 * le voie, et le jour du branchement on découvre qu'il ne correspond plus au contrat.
 * Cette garde rougit, dans `src/` et `scripts/` :
 *   - dès qu'un fichier cite une variable `MAILWIZZ_*`, `PMTA_*` ou `POWERMTA_*` (clé
 *     d'API, secret de webhook…) hors de sa déclaration (`src/env.ts`) et de l'inventaire
 *     des sous-traitants ;
 *   - dès qu'un fichier ou un dossier porte `mailwizz`, `pmta` ou `powermta` dans son
 *     chemin (une route `api/mailwizz/…`, un client `mailwizz.ts`), hors de cette garde.
 * Elle ne voit pas un client écrit sous un autre nom avec une URL en dur : aucune
 * recherche textuelle ne le peut, c'est la relecture qui le rattrape.
 *
 * Le jour où l'outil est construit, on retire cette garde DANS la PR qui construit
 * l'entrée de retour de l'ADR 0052 §d : c'est une décision, pas un oubli.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");
const MOTIF_VARIABLE = "(MAILWIZZ|PMTA|POWERMTA)_[A-Z0-9_]+";
const MOTIF_CHEMIN = /mailwizz|pmta|powermta/i;
const DOSSIERS = ["src", "scripts"];
const CETTE_GARDE = "src/lib/email/__tests__/aucun-connecteur-mailwizz-avant-l-outil.spec.ts";

/** Seuls endroits où ces noms de variables ont le droit d'apparaître. */
const AUTORISES = new Set([
  "src/env.ts",
  "src/content/__tests__/sous-traitants-serveur.spec.ts",
  CETTE_GARDE,
]);

function git(args: string[]): string[] {
  try {
    const sortie = execFileSync("git", args, { cwd: RACINE, encoding: "utf8" });
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

let citent: string[] = [];
let fichiers: string[] = [];

beforeAll(() => {
  // `--untracked` : un fichier pas encore commité compte aussi.
  citent = git(["grep", "--untracked", "-l", "-E", MOTIF_VARIABLE, "--", ...DOSSIERS]);
  fichiers = git(["ls-files", "--cached", "--others", "--exclude-standard", "--", ...DOSSIERS]);
});

describe("aucun connecteur MailWizz / PowerMTA avant l'outil (ADR 0052)", () => {
  it("témoins : la recherche trouve bien la déclaration et cette garde", () => {
    // Sans ces témoins, une recherche cassée (mauvais dossier, motif faux) rendrait
    // la garde verte pour la mauvaise raison.
    expect(citent).toContain("src/env.ts");
    expect(fichiers).toContain(CETTE_GARDE);
    expect(fichiers.length).toBeGreaterThan(100);
  });

  it("🔴 aucun autre fichier ne cite une variable MAILWIZZ_*, PMTA_* ou POWERMTA_*", () => {
    expect(citent.filter((f) => !AUTORISES.has(f))).toEqual([]);
  });

  it("🔴 aucun fichier ni dossier nommé d'après MailWizz ou PowerMTA", () => {
    expect(fichiers.filter((f) => f !== CETTE_GARDE && MOTIF_CHEMIN.test(f))).toEqual([]);
  });
});
