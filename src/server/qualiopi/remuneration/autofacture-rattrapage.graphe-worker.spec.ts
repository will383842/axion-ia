/**
 * 🔴 LE CRON DE RATTRAPAGE DES AUTOFACTURES NE PEUT PAS MOURIR EN SILENCE.
 *
 * Le worker BullMQ tourne `tsx src/server/queue/worker.ts`, HORS de Next. Trois
 * choses y tuent un passage sans que le worker ne plante :
 *
 *   - `import "server-only"` : le paquet ne résout que dans la compilation Next
 *     (cf. `tests/unit/ci/aucun-module-du-worker-nimporte-server-only.spec.ts`) ;
 *   - `next/headers` : `headers()` lève hors d'une requête — c'est ce que font
 *     `logQualiopiActivity` et `auth()` ;
 *   - un fichier `"use server"` : ses exports sont des Server Actions, gardées
 *     par la session du navigateur.
 *
 * C'est le TROISIÈME qui a tué ce cron jusqu'au 2026-09-15 : il appelait
 * `emettreAutofactureAction`, dont la garde levait à chaque relevé, et le
 * `catch` comptait « refusée ». Aucune pièce n'est jamais sortie du rattrapage.
 *
 * Même marche que `facture-auto-session.graphe-worker.spec.ts` (#1097) :
 * fermeture transitive À L'EXÉCUTION, statiques ET dynamiques.
 */

import { readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "../../../..");
const SRC = join(RACINE, "src");
const DEPART = join(SRC, "server/qualiopi/remuneration/autofacture-rattrapage.ts");
const ACTION_DU_BOUTON = join(SRC, "server/actions/qualiopi/autofacture.ts");

/**
 * Spécificateurs importés À L'EXÉCUTION. Les `import type … from` et
 * `export type … from` sont écartés : ils sont effacés à la compilation, et les
 * suivre fabrique de faux chemins.
 */
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

/**
 * 🔑 LA SEULE ARÊTE CONNUE vers `server/actions/**`, et elle précède ce cron.
 *
 * `config/site-settings.ts` importe `logQualiopiActivity` pour journaliser ses
 * ÉCRITURES de configuration. Le chemin du cron n'en fait aucune : il LIT la
 * config, comme la facture du lendemain et dix autres jobs en production. Le
 * module se charge sous `tsx` ; seul un APPEL à la garde lèverait.
 *
 * ⚠️ Liste tapée à dessein : si cette arête disparaît du graphe, le témoin plus
 * bas rougit et l'exception doit partir ; si une AUTRE apparaît, c'est
 * précisément le signal attendu.
 */
const ARETES_CONNUES = new Set([
  "src/server/qualiopi/config/site-settings.ts -> @/server/actions/qualiopi/_guards",
]);

/** Fermeture transitive À L'EXÉCUTION + les spécificateurs de chaque module. */
function fermeture(depart: string, ignorer = ARETES_CONNUES): Map<string, string[]> {
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
    const specs = specificateurs(source).filter((s) => !ignorer.has(`${rel(f)} -> ${s}`));
    vus.set(f, specs);
    for (const s of specs) {
      const cible = resoudre(s, f);
      if (cible !== null && !vus.has(cible)) file.push(cible);
    }
  }
  return vus;
}

/** Directive `"use server"` de MODULE : ancrée en début de ligne. */
const DIRECTIVE_USE_SERVER = /^\s*["']use server["'];?\s*$/m;
const IMPORTE_SERVER_ONLY = /^\s*import\s+["']server-only["']/m;

/** Les trois fautes, sur un graphe donné. */
function fautes(graphe: Map<string, string[]>) {
  const modules = [...graphe.keys()];
  return {
    serverOnly: modules.filter((f) => IMPORTE_SERVER_ONLY.test(readFileSync(f, "utf8"))).map(rel),
    actions: modules
      .filter(
        (f) =>
          DIRECTIVE_USE_SERVER.test(readFileSync(f, "utf8")) ||
          rel(f).startsWith("src/server/actions/"),
      )
      .map(rel),
    nextHeaders: [...graphe.entries()]
      .filter(([, specs]) => specs.includes("next/headers"))
      .map(([f]) => rel(f)),
  };
}

describe("🔴 le cron de rattrapage des autofactures tourne hors de Next", () => {
  const graphe = fermeture(DEPART);
  const noms = [...graphe.keys()].map(rel);
  const trouve = fautes(graphe);

  it("TÉMOIN+ : la marche atteint bien le chemin partagé avec le bouton, jusqu'au PDF et à l'envoi", () => {
    expect(noms.length).toBeGreaterThan(20);
    expect(noms).toContain("src/server/qualiopi/remuneration/autofacture-emission.ts");
    expect(noms).toContain("src/server/qualiopi/remuneration/mandat-source.ts");
    expect(noms).toContain("src/server/qualiopi/documents/documents-service.ts");
    expect(noms).toContain("src/server/queue/queues.ts");
  });

  it("aucun module du graphe n'importe `server-only`", () => {
    expect(trouve.serverOnly).toEqual([]);
  });

  it("aucun module du graphe n'est une Server Action, ni sous `server/actions/`", () => {
    expect(
      trouve.actions,
      "Le cron atteint une Server Action : ses gardes lisent la session du navigateur et " +
        "lèvent sous `tsx`. Extraire le corps utile dans un service pur (cf. " +
        "`autofacture-emission.ts`).",
    ).toEqual([]);
  });

  it("aucun module du graphe n'importe `next/headers`", () => {
    expect(trouve.nextHeaders).toEqual([]);
  });

  it("TÉMOIN− : la marche SAIT voir une Server Action — sans l'exception, site-settings y mène", () => {
    const sansException = [...fermeture(DEPART, new Set()).keys()].map(rel);
    expect(sansException).toContain("src/server/actions/qualiopi/_guards.ts");
  });

  it("🔴 TÉMOIN− : partie de l'ACTION du bouton — l'ancien chemin du cron — la garde MORD sur les trois fautes qui comptent", () => {
    // C'est le défaut exact d'avant le 2026-09-15, rejoué sur le code actuel :
    // l'action reste `"use server"` et atteint `next/headers` par sa garde. Si
    // ce témoin cesse de rougir, la marche ou les motifs sont devenus aveugles.
    const ancien = fautes(fermeture(ACTION_DU_BOUTON));
    expect(ancien.actions).toContain("src/server/actions/qualiopi/autofacture.ts");
    expect(ancien.actions).toContain("src/server/actions/qualiopi/_guards.ts");
    expect(ancien.nextHeaders).toContain("src/server/actions/qualiopi/_guards.ts");
  });

  it("le worker atteint ce module par son handler (import paresseux), et plus l'action", () => {
    const worker = readFileSync(
      join(SRC, "server/queue/workers/qualiopi-formation-crons-worker.ts"),
      "utf8",
    );
    expect(worker).toContain(
      'await import("@/server/qualiopi/remuneration/autofacture-rattrapage")',
    );
    expect(worker).toMatch(/"formation-crons\.autofactures":\s*handleAutofactures/);
    expect(specificateurs(worker).filter((s) => s.startsWith("@/server/actions/"))).toEqual([]);
  });
});
