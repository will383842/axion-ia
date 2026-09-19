/**
 * 🔴 LE WORKER D'E-MAILS NE PEUT PAS MOURIR EN SILENCE — graphe d'imports.
 *
 * Le 2026-09-19, le worker gagne un filet : il relit l'opposition et l'état de
 * la fiche au moment de faire partir une sollicitation. Le chemin évident —
 * importer `verdictAvantEnvoi` depuis `suppression.ts` — l'aurait tué : ce
 * module importe paresseusement `alertes-service`, qui tire une garde
 * `next/headers`, un fichier `"use server"` et `next-auth`. Sous `tsx`, hors de
 * Next, le worker démarrerait, se déclarerait `ready`, et CHAQUE e-mail du site
 * échouerait — convocations, factures, accusés compris.
 *
 * D'où le module pur `verdict-envoi.ts`, et cette garde : sur la fermeture
 * transitive d'`email-worker.ts` (imports statiques ET dynamiques, imports de
 * type écartés car effacés à la compilation), aucun module n'importe
 * `server-only`, `next/headers`, `next/server`, `next-auth`, ni n'est une
 * Server Action. Même méthode que
 * `src/server/qualiopi/financements/facture-auto-session.graphe-worker.spec.ts`.
 */

import { readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "../../../../..");
const SRC = join(RACINE, "src");
const DEPART = join(SRC, "server/queue/workers/email-worker.ts");

/** Spécificateurs importés À L'EXÉCUTION (les `import type` sont écartés). */
function specificateurs(source: string): string[] {
  const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const statiques = /\b(?:import|export)\s+(type\s+)?[^;'"]*?\bfrom\s+["']([^"']+)["']/g;
  while ((m = statiques.exec(sansCommentaires)) !== null) {
    if (m[1] === undefined) out.push(m[2] as string);
  }
  for (const re of [/\bimport\s+["']([^"']+)["']/g, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g]) {
    while ((m = re.exec(sansCommentaires)) !== null) out.push(m[1] as string);
  }
  return out;
}

function resoudre(spec: string, depuis: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) base = resolve(dirname(depuis), spec);
  else return null;
  for (const cand of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    try {
      if (statSync(cand).isFile()) return cand;
    } catch {
      /* pas ce candidat */
    }
  }
  return null;
}

const rel = (f: string) => f.slice(RACINE.length + 1).replace(/\\/g, "/");

function fermeture(depart: string): Map<string, string[]> {
  const vus = new Map<string, string[]>();
  const file = [depart];
  while (file.length > 0) {
    const f = file.pop() as string;
    if (vus.has(f)) continue;
    let source: string;
    try {
      source = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    const specs = specificateurs(source);
    vus.set(f, specs);
    for (const s of specs) {
      const cible = resoudre(s, f);
      if (cible !== null && !vus.has(cible)) file.push(cible);
    }
  }
  return vus;
}

const DIRECTIVE_USE_SERVER = /^\s*["']use server["'];?\s*$/m;
const IMPORTE_SERVER_ONLY = /^\s*import\s+["']server-only["']/m;
/** Paquets qui ne se chargent pas, ou lèvent, hors d'une requête Next. */
const PAQUETS_INTERDITS = (s: string) =>
  s === "next/headers" || s === "next/server" || s === "next-auth" || s.startsWith("next-auth/");

describe("🔴 le worker d'e-mails tourne hors de Next", () => {
  const graphe = fermeture(DEPART);
  const modules = [...graphe.keys()];
  const noms = modules.map(rel);

  it("TÉMOIN+ : la marche atteint le filet pur, et PAS `suppression.ts`", () => {
    expect(noms.length).toBeGreaterThan(50);
    expect(noms).toContain("src/server/email/verdict-envoi.ts");
    expect(noms).toContain("src/server/email/email-log.ts");
    expect(noms).toContain("src/lib/email/templates/index.tsx");
    expect(noms).not.toContain("src/server/email/suppression.ts");
  });

  it("aucun module du graphe n'importe `server-only`", () => {
    const fautifs = modules.filter((f) => IMPORTE_SERVER_ONLY.test(readFileSync(f, "utf8")));
    expect(fautifs.map(rel)).toEqual([]);
  });

  it("aucun module du graphe n'est une Server Action, ni sous `server/actions/`", () => {
    const fautifs = modules.filter(
      (f) =>
        DIRECTIVE_USE_SERVER.test(readFileSync(f, "utf8")) ||
        rel(f).startsWith("src/server/actions/"),
    );
    expect(fautifs.map(rel)).toEqual([]);
  });

  it("aucun module du graphe n'importe `next/headers`, `next/server` ni `next-auth`", () => {
    const fautifs = [...graphe.entries()]
      .filter(([, specs]) => specs.some(PAQUETS_INTERDITS))
      .map(([f, specs]) => `${rel(f)} -> ${specs.filter(PAQUETS_INTERDITS).join(", ")}`);
    expect(fautifs).toEqual([]);
  });

  it("TÉMOIN− : la marche SAIT voir la chaîne interdite — `suppression.ts` y mène", () => {
    const depuisSuppression = [...fermeture(join(SRC, "server/email/suppression.ts")).entries()];
    const interdits = depuisSuppression.filter(
      ([f, specs]) =>
        specs.some(PAQUETS_INTERDITS) || DIRECTIVE_USE_SERVER.test(readFileSync(f, "utf8")),
    );
    expect(interdits.length).toBeGreaterThan(0);
  });
});
