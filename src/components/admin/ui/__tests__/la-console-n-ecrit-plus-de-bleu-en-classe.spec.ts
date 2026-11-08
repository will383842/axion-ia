import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Les classes `primary` / `info` / `blue` de Tailwind lisent les jetons PUBLICS
// (bleu dense). La console doit passer par ses propres jetons --color-admin-*.
const RACINES = ["src/components/admin", "src/app/[locale]/(admin)"];
const BLEU =
  /(?:^|[\s"'`:])(?:bg|text|border|ring|outline|fill|stroke)-(?:primary|info|blue|sky|indigo)(?:-[a-z0-9]+)?(?![\w-])/;

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === "__tests__" || n === "node_modules") return [];
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.tsx?$/.test(n) && !/\.(test|spec)\./.test(n) ? [p] : [];
  });
}

describe("la console n'écrit plus de bleu en classe", () => {
  it("aucune classe bg/text/border/ring primary, info ou blue dans la console", () => {
    const fautes: string[] = [];
    for (const f of RACINES.flatMap(fichiers)) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((l, i) => {
          if (l.trim().startsWith("//") || l.trim().startsWith("*")) return;
          if (BLEU.test(l)) fautes.push(`${f}:${i + 1}: ${l.trim()}`);
        });
    }
    expect(fautes).toEqual([]);
  });
});
