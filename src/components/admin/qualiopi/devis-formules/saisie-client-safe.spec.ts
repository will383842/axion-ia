import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `saisie.ts` est importé par un composant CLIENT : sa fermeture d'imports ne doit contenir
 * aucun module Node (`node:crypto` y a fait échouer le build webpack de Gate B).
 */
const RACINE = resolve(__dirname, "../../../../..");

function resoudre(depuis: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? resolve(RACINE, "src", spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(depuis), spec)
      : null;
  if (base === null) return null;
  for (const ext of [".ts", ".tsx", "/index.ts"]) {
    try {
      readFileSync(base + ext);
      return base + ext;
    } catch {
      /* suivant */
    }
  }
  return null;
}

function fermeture(entree: string): { fichiers: Set<string>; nodes: string[] } {
  const vus = new Set<string>();
  const nodes: string[] = [];
  const pile = [entree];
  while (pile.length > 0) {
    const f = pile.pop()!;
    if (vus.has(f)) continue;
    vus.add(f);
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
      const spec = m[1]!;
      if (spec.startsWith("node:")) nodes.push(`${f} -> ${spec}`);
      const r = resoudre(f, spec);
      if (r !== null) pile.push(r);
    }
  }
  return { fichiers: vus, nodes };
}

describe("saisie.ts est sûr côté client", () => {
  it("aucun import node:* dans sa fermeture", () => {
    const { fichiers, nodes } = fermeture(resolve(__dirname, "saisie.ts"));
    expect(fichiers.size).toBeGreaterThan(3);
    expect(nodes).toEqual([]);
  });
});
