/**
 * 🔴 LE DEADLINE-CHECKER NE PEUT PAS PERDRE SA TRACE EN SILENCE.
 *
 * Le worker BullMQ tourne `tsx src/server/queue/worker.ts`, HORS de Next. Trois
 * choses y tuent une écriture sans que le worker ne plante :
 *
 *   - `import "server-only"` : le paquet ne résout que dans la compilation Next
 *     (cf. `tests/unit/ci/aucun-module-du-worker-nimporte-server-only.spec.ts`) ;
 *   - `next/headers` : `headers()` lève hors d'une requête ;
 *   - un fichier `"use server"` : ses exports sont des Server Actions, gardées
 *     par la session du navigateur.
 *
 * C'est le DEUXIÈME qui a tué la trace SOC2 `content-gen.campaign.auto-stopped`
 * jusqu'au 2026-09-16 : `logActivity` ouvrait son `try` par `await headers()`,
 * et le `prisma.activityLog.create` qui suivait, dans le MÊME `try`, n'était
 * jamais atteint. Aucune campagne arrêtée automatiquement n'a laissé de ligne.
 *
 * Même marche que `facture-auto-session.graphe-worker.spec.ts` (#1097) et
 * `autofacture-rattrapage.graphe-worker.spec.ts` (#1098) : fermeture transitive
 * À L'EXÉCUTION, statiques ET dynamiques.
 */

import { readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { describe, expect, it } from "vitest";

// 🔑 CINQ crans, pas quatre : ce fichier vit sous `src/server/queue/workers/__tests__/`.
// La première version en comptait quatre, s'arrêtait sur `src/`, et la fermeture rendait
// ZÉRO module — les trois assertions de faute passaient alors en vert, sur du vide. C'est
// tout l'objet du TÉMOIN+ ci-dessous, et il a mordu du premier coup.
const RACINE = resolve(__dirname, "../../../../..");
const SRC = join(RACINE, "src");
const DEPART = join(SRC, "server/queue/workers/content-gen-deadline-checker.ts");
/** L'enveloppe de la console : l'ANCIEN chemin d'écriture du cron. */
const HELPER_DE_LA_CONSOLE = join(SRC, "server/content-gen/shared/activity-log.ts");

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

/** Fermeture transitive À L'EXÉCUTION + les spécificateurs de chaque module. */
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

describe("🔴 le deadline-checker des campagnes tourne hors de Next", () => {
  const graphe = fermeture(DEPART);
  const noms = [...graphe.keys()].map(rel);
  const trouve = fautes(graphe);

  it("TÉMOIN+ : la marche atteint bien le chemin d'écriture du journal et le client Prisma", () => {
    expect(noms.length).toBeGreaterThan(3);
    expect(noms).toContain("src/server/content-gen/shared/activity-log-writer.ts");
    expect(noms).toContain("src/lib/prisma.ts");
    expect(noms).toContain("src/server/queue/lib/sentry-worker.ts");
  });

  it("aucun module du graphe n'importe `server-only`", () => {
    expect(trouve.serverOnly).toEqual([]);
  });

  it("aucun module du graphe n'est une Server Action, ni sous `server/actions/`", () => {
    expect(
      trouve.actions,
      "Le cron atteint une Server Action : ses gardes et ses lectures de session lèvent " +
        "sous `tsx`. Extraire le corps utile dans un service pur (cf. " +
        "`activity-log-writer.ts`).",
    ).toEqual([]);
  });

  it("aucun module du graphe n'importe `next/headers`", () => {
    expect(
      trouve.nextHeaders,
      "`headers()` lève hors d'une requête. Si l'appel est dans le même `try` que " +
        "l'écriture, l'écriture n'a jamais lieu — et le `catch` best-effort le cache.",
    ).toEqual([]);
  });

  it("🔴 TÉMOIN− : partie du helper de la console — l'ancien chemin du cron — la garde MORD", () => {
    // C'est le défaut exact d'avant le 2026-09-16, rejoué sur le code actuel :
    // l'enveloppe reste `"use server"` et lit `next/headers`, à bon droit. Si ce
    // témoin cesse de rougir, la marche ou les motifs sont devenus aveugles.
    const ancien = fautes(fermeture(HELPER_DE_LA_CONSOLE));
    expect(ancien.actions).toContain("src/server/content-gen/shared/activity-log.ts");
    expect(ancien.nextHeaders).toContain("src/server/content-gen/shared/activity-log.ts");
  });

  it("le worker est bien enregistré dans l'entrée du conteneur worker", () => {
    const entree = readFileSync(join(SRC, "server/queue/worker.ts"), "utf8");
    expect(entree).toContain("content-gen-deadline-checker");
  });
});
