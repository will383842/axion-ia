/**
 * 🔴 LE CRON « FACTURE DU LENDEMAIN » NE PEUT PAS MOURIR EN SILENCE.
 *
 * Le worker BullMQ tourne `tsx src/server/queue/worker.ts`, HORS de Next. Trois
 * choses y tuent un job sans que le worker ne plante — il se déclare `ready`,
 * puis le job échoue à chaque déclenchement :
 *
 *   - `import "server-only"` : le paquet ne résout que dans la compilation Next
 *     (défaut mesuré en production le 2026-09-04, cf.
 *     `tests/unit/ci/aucun-module-du-worker-nimporte-server-only.spec.ts`) ;
 *   - `next/headers` : `headers()` lève hors d'une requête — c'est ce que font
 *     `logQualiopiActivity` et toute garde d'accès ;
 *   - un fichier `"use server"` : ses exports sont des Server Actions, gardées
 *     par la session du navigateur. Appelées depuis le worker, elles lèvent dès
 *     leur première ligne.
 *
 * La garde générale ne suit que le premier. Celle-ci suit les TROIS, sur la
 * fermeture transitive du module du cron — c'est ce qui a imposé d'extraire les
 * corps de « Générer la facture » et « Envoyer par email » dans des services
 * purs, les actions n'en restant que les enveloppes.
 *
 * Statiques ET dynamiques (`await import(...)`), comme la garde générale.
 */

import { readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "../../../..");
const SRC = join(RACINE, "src");
const DEPART = join(SRC, "server/qualiopi/financements/facture-auto-session.ts");

/**
 * Spécificateurs importés À L'EXÉCUTION. Les `import type … from` et
 * `export type … from` sont écartés : ils sont effacés à la compilation, et les
 * suivre fabrique de faux chemins — `queues.ts` importe le TYPE des jobs depuis
 * le fichier du worker, qui importe paresseusement une Server Action.
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
 * ÉCRITURES de configuration. Le cron n'en fait aucune : il LIT la config
 * (`getQualiopiConfig`), comme l'attestation automatique et dix autres jobs le
 * font déjà en production. Le module se charge sous `tsx` ; seul un APPEL à la
 * garde lèverait.
 *
 * ⚠️ Liste tapée à dessein : si cette arête disparaît, le témoin plus bas rougit
 * et l'exception doit partir ; si une AUTRE apparaît, c'est précisément le
 * signal attendu.
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

describe("🔴 le cron de la facture du lendemain tourne hors de Next", () => {
  const graphe = fermeture(DEPART);
  const modules = [...graphe.keys()];

  it("TÉMOIN+ : la marche atteint bien les deux chemins partagés avec les boutons", () => {
    const noms = modules.map(rel);
    expect(noms.length).toBeGreaterThan(20);
    expect(noms).toContain("src/server/qualiopi/financements/facture-formation-emission.ts");
    expect(noms).toContain("src/server/qualiopi/financements/facture-envoi-email.ts");
    expect(noms).toContain("src/server/queue/queues.ts");
    expect(noms).toContain("src/server/qualiopi/documents/documents-service.ts");
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
    expect(
      fautifs.map(rel),
      "Le cron atteint une Server Action : ses gardes lisent la session du navigateur et " +
        "lèvent sous `tsx`. Extraire le corps utile dans un service pur (cf. " +
        "`facture-formation-emission.ts`).",
    ).toEqual([]);
  });

  it("aucun module du graphe n'importe `next/headers`", () => {
    const fautifs = [...graphe.entries()]
      .filter(([, specs]) => specs.includes("next/headers"))
      .map(([f]) => rel(f));
    expect(fautifs).toEqual([]);
  });

  it("TÉMOIN− : la marche SAIT voir une Server Action — sans l'exception, site-settings y mène", () => {
    const sansException = fermeture(DEPART, new Set()).keys();
    expect([...sansException].map(rel)).toContain("src/server/actions/qualiopi/_guards.ts");
  });

  it('TÉMOIN− : l\'action du bouton est bien détectée comme `"use server"`', () => {
    const action = join(SRC, "server/actions/qualiopi/financements.ts");
    expect(DIRECTIVE_USE_SERVER.test(readFileSync(action, "utf8"))).toBe(true);
  });

  it("le worker atteint bien ce module par son handler (import paresseux)", () => {
    const worker = readFileSync(
      join(SRC, "server/queue/workers/qualiopi-formation-crons-worker.ts"),
      "utf8",
    );
    expect(worker).toContain('await import("@/server/qualiopi/financements/facture-auto-session")');
    expect(worker).toMatch(/"formation-crons\.factures-lendemain":\s*handleFacturesLendemain/);
  });
});
