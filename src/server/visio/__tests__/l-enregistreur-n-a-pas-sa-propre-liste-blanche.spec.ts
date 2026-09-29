// @vitest-environment node

/**
 * ⛔ L'ENREGISTREUR N'A PAS SA PROPRE LISTE BLANCHE, NI SA PROPRE LISTE DU
 * JOUR, NI SA PROPRE CRÉATION DE RENCONTRE (PR 5 ; anti-doublon D1 de l'audit
 * du 29/09, `07-execution/AUDIT-DOUBLONS.md`, correction 3).
 *
 * Une seule implémentation, celle de la PR 4 :
 *   · la liste blanche : `estRendezVousDuDossier` (`liste-blanche-types.ts`) —
 *     type « Discutons… » ET jamais un rendez-vous lié à une candidature ;
 *   · la liste du jour : `rencontresEnregistrablesDuJour` (`rencontres-du-jour.ts`) ;
 *   · la création : `assurerRencontrePourCalendly` (`dossier-client/rencontre-calendly.ts`).
 * L'enregistreur (`liste-enregistreur.ts`, `enregistreur-calendly.ts`,
 * `sessions.ts`, `battement-appareil.ts`) les IMPORTE.
 *
 * Mutation qui rougit : remettre dans `enregistreur-calendly.ts` une fonction
 * `estTypeEnregistrable` ou le début de nom `"discutons de votre projet"` →
 * 1er et 2e cas ; faire créer une rencontre par `liste-enregistreur.ts` → 3e cas.
 * Contre-témoin : le début de nom est bien trouvé dans `liste-blanche-types.ts`
 * (le scanner n'est pas aveugle).
 * Angle mort : la garde lit les SOURCES de `src/server/visio` et
 * `src/app/api/enregistreur` ; une liste blanche recodée sous un autre nom et
 * sans le littéral ne se verrait pas.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const DOSSIERS = ["src/server/visio", "src/app/api/enregistreur"];

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (nom === "__tests__") continue;
    if (statSync(chemin).isDirectory()) fichiers(chemin, acc);
    else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) acc.push(chemin);
  }
  return acc;
}

const SOURCES: ReadonlyArray<readonly [string, string]> = DOSSIERS.flatMap((d) =>
  fichiers(join(RACINE, d)),
).map((f) => [relative(RACINE, f).split(sep).join("/"), readFileSync(f, "utf8")] as const);

function lire(chemin: string): string {
  const trouve = SOURCES.find(([c]) => c === chemin);
  if (!trouve) throw new Error(`${chemin} introuvable`);
  return trouve[1];
}

/** Le code sans ses commentaires. */
function code(texte: string): string {
  return texte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("⛔ l'enregistreur n'a pas sa propre liste blanche", () => {
  it("aucune fonction locale de liste blanche ou de création ne réapparaît", () => {
    const interdits =
      /\b(estTypeEnregistrable|estTypeEntretien|assurerRencontreMinimale|DEBUT_TYPE_ENREGISTRABLE)\b/;
    const fautifs = SOURCES.filter(([, t]) => interdits.test(code(t))).map(([c]) => c);
    expect(fautifs).toEqual([]);
  });

  it("le début de nom « discutons de votre projet » n'est écrit que dans liste-blanche-types.ts", () => {
    const litteral = /["'`]discutons de votre projet["'`]/;
    const porteurs = SOURCES.filter(([, t]) => litteral.test(code(t))).map(([c]) => c);
    // Contre-témoin : le scanner voit bien la déclaration unique.
    expect(porteurs).toEqual(["src/server/visio/liste-blanche-types.ts"]);
  });

  it("la liste de l'extension importe la liste du jour de la PR 4, sans créer ni lister elle-même", () => {
    const liste = code(lire("src/server/visio/liste-enregistreur.ts"));
    expect(liste).toMatch(
      /import \{ rencontresEnregistrablesDuJour \} from "\.\/rencontres-du-jour";/,
    );
    expect(liste).toMatch(/rencontresEnregistrablesDuJour\(/);
    expect(liste).not.toMatch(/rencontre\.(create|upsert|createMany)\(/);
    expect(liste).not.toMatch(/calendlyEvent\.findMany\(/);
    expect(liste).toMatch(/from "\.\/liste-blanche-types";/);
  });

  it("la liste du jour n'est déclarée qu'une fois", () => {
    const declarations = SOURCES.filter(([, t]) =>
      /export async function (rencontresEnregistrablesDuJour|listerRencontresDuJour)\b/.test(t),
    ).map(([c]) => c);
    expect(declarations.sort()).toEqual([
      "src/server/visio/liste-enregistreur.ts",
      "src/server/visio/rencontres-du-jour.ts",
    ]);
  });

  it("sessions et battement passent par la liste blanche du dossier", () => {
    for (const f of ["src/server/visio/sessions.ts", "src/server/visio/battement-appareil.ts"]) {
      const t = code(lire(f));
      expect(t, f).toMatch(/import \{ estRendezVousDuDossier \} from "\.\/liste-blanche-types";/);
      expect(t, f).toMatch(/estRendezVousDuDossier\(/);
    }
  });

  it("enregistreur-calendly.ts ne lit que la réponse d'enregistrement, par le lecteur de la console", () => {
    const t = code(lire("src/server/visio/enregistreur-calendly.ts"));
    expect(t).toMatch(/from "@\/features\/admin-rendezvous\/a-venir";/);
    expect(t).not.toMatch(/estAppelApporteur|linkedJobApplicationId|eventTypeName/);
  });
});
