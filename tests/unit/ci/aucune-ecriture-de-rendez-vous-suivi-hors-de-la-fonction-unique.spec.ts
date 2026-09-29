/**
 * ⛔ Aucune écriture de `rendez_vous_suivis` ni de `rencontre_suivis` hors de
 * la fonction unique (chantier visio, PR 4 ; plan V-05, vérification C11).
 *
 * Les deux tables disent la même chose (issue, suite, échéance) tant que le
 * lien Calendly vit : si un second chemin écrivait l'une sans l'autre, elles
 * divergeraient en silence — l'onglet « Rendez-vous » dirait « devis à
 * envoyer », la fiche client « relance ». La garde énumère les écrivains
 * autorisés PAR FICHIER ET PAR FONCTION, jamais par nombre :
 *
 *   · `src/features/dossier-client/suivi.ts` → `enregistrerSuiviDans`
 *     (appelée par `enregistrerSuivi` et `enregistrerSuiviDansLaTransaction`) ;
 *   · `src/features/admin-rendezvous/issue-apporteur-actions.ts` → l'issue
 *     d'un échange APPORTEUR, qui n'a pas de rencontre (PA-9) ;
 *   · `src/lib/rgpd-erase.ts` → `eraseCalendlyEventsForEmail` (la note sur la
 *     personne part avec elle).
 *
 * Balaye `src/` et `scripts/` (hors tests). Mutation qui fait rougir :
 * remettre l'ancien `prisma.rendezVousSuivi.upsert` dans
 * `admin-rendezvous/suivi-actions.ts` → rouge, en nommant fichier et fonction.
 * Contre-témoin : une source synthétique qui écrit ailleurs est détectée.
 * Angle mort : une écriture en SQL brut (`$executeRaw … rendez_vous_suivis`)
 * n'est pas vue — aucune n'existe, et le SQL brut est gardé à part.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const ECRITURE =
  /\b(rendezVousSuivi|rencontreSuivi)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;

/** Les écrivains autorisés : fichier → fonctions. */
const AUTORISES: Readonly<Record<string, ReadonlyArray<string>>> = {
  "src/features/dossier-client/suivi.ts": ["enregistrerSuiviDans"],
  "src/features/admin-rendezvous/issue-apporteur-actions.ts": ["*"],
  "src/lib/rgpd-erase.ts": ["eraseCalendlyEventsForEmail"],
};

function fichiers(dossier: string): string[] {
  const res: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "node_modules" || nom === "__tests__" || nom === "generated") continue;
      res.push(...fichiers(chemin));
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      res.push(chemin);
    }
  }
  return res;
}

/** La fonction qui contient la position `i` : la dernière déclaration qui la précède. */
function fonctionEnglobante(source: string, i: number): string {
  const avant = source.slice(0, i);
  const decl = [...avant.matchAll(/(?:async\s+)?function\s+(\w+)\s*[(<]/g)];
  return decl[decl.length - 1]?.[1] ?? "(module)";
}

function ecrivainsHorsDeLaFonctionUnique(
  sources: ReadonlyArray<{ chemin: string; source: string }>,
): string[] {
  const fautes: string[] = [];
  for (const { chemin, source } of sources) {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    for (const m of code.matchAll(ECRITURE)) {
      const fonction = fonctionEnglobante(code, m.index ?? 0);
      const permis = AUTORISES[chemin];
      if (permis && (permis.includes("*") || permis.includes(fonction))) continue;
      fautes.push(`${chemin} › ${fonction} : ${m[1]}.${m[2]}`);
    }
  }
  return fautes;
}

describe("⛔ aucune écriture du suivi hors de la fonction unique", () => {
  const sources = [...fichiers(join(RACINE, "src")), ...fichiers(join(RACINE, "scripts"))].map(
    (c) => ({
      chemin: relative(RACINE, c).split("\\").join("/"),
      source: readFileSync(c, "utf8"),
    }),
  );

  it("témoin : le balayage trouve les écrivains autorisés", () => {
    const unique = new RegExp(ECRITURE.source);
    const trouves = sources.filter((s) => unique.test(s.source)).map((s) => s.chemin);
    expect(trouves).toEqual(expect.arrayContaining(Object.keys(AUTORISES)));
  });

  it("aucun autre écrivain", () => {
    expect(ecrivainsHorsDeLaFonctionUnique(sources)).toEqual([]);
  });

  it("contre-témoin : une écriture ailleurs est nommée par fichier et fonction", () => {
    const fautes = ecrivainsHorsDeLaFonctionUnique([
      {
        chemin: "src/features/admin-rendezvous/suivi-actions.ts",
        source:
          "export async function enregistrerSuiviAction() {\n  await prisma.rendezVousSuivi.upsert({});\n}\n",
      },
      {
        chemin: "src/features/dossier-client/suivi.ts",
        source: "export async function autreChose() {\n  await tx.rencontreSuivi.update({});\n}\n",
      },
    ]);
    expect(fautes).toEqual([
      "src/features/admin-rendezvous/suivi-actions.ts › enregistrerSuiviAction : rendezVousSuivi.upsert",
      "src/features/dossier-client/suivi.ts › autreChose : rencontreSuivi.update",
    ]);
  });
});
