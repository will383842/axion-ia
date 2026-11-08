import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * La coquille de l'assistant est un composant CLIENT : sa fermeture d'imports ne doit tirer
 * ni catalogue de prix, ni base, ni module Node. Les imports `import type` sont effacés à la
 * compilation et ne comptent pas.
 */
const RACINE = resolve(__dirname, "../../../../..");
const INTERDITS = [
  /(^|\/)pricing(\.|\/|$)/,
  /pricing-resolver/,
  /facture-libre-pur/,
  /@\/lib\/prisma/,
  /(^|\/)lib\/prisma(\.|$)/,
  /server-only/,
  /^node:/,
];

/** Chemin relatif à la racine, en `/` (sous Windows `resolve` rend des `\\`). */
const relatif = (chemin: string): string => chemin.replace(RACINE, "").replaceAll("\\", "/");

function resoudre(depuis: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? resolve(RACINE, "src", spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(depuis), spec)
      : null;
  if (base === null) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts"]) {
    try {
      if (readFileSync(base + ext, "utf8") !== undefined && /\.(tsx?)$/.test(base + ext)) {
        return base + ext;
      }
    } catch {
      /* suivant */
    }
  }
  return null;
}

/** Spécificateurs importés À L'EXÉCUTION (hors `import type` / `export type`). */
function importsExecutes(src: string): string[] {
  const out: string[] = [];
  const re = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)([^;]*?)\bfrom\s+["']([^"']+)["']/g;
  for (const m of src.matchAll(re)) out.push(m[2]!);
  for (const m of src.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) out.push(m[1]!);
  for (const m of src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]!);
  return out;
}

function fermeture(entree: string): { fichiers: Set<string>; violations: string[] } {
  const vus = new Set<string>();
  const violations: string[] = [];
  const pile = [entree];
  while (pile.length > 0) {
    const f = pile.pop()!;
    if (vus.has(f)) continue;
    vus.add(f);
    for (const spec of importsExecutes(readFileSync(f, "utf8"))) {
      const r = resoudre(f, spec);
      if (INTERDITS.some((re) => re.test(spec) || (r !== null && re.test(relatif(r)))))
        violations.push(`${relatif(f)} -> ${spec}`);
      if (r !== null) pile.push(r);
    }
  }
  return { fichiers: vus, violations };
}

/** Tous les fichiers de l'assistant que le navigateur charge. */
const POINTS_D_ENTREE = [
  "AssistantDevis.tsx",
  "vers-offre.ts",
  "calculs.ts",
  "lignes.ts",
  "useBrouillonAuto.ts",
  "StatutSauvegarde.tsx",
  "etapes/un/ChoixModele.tsx",
  "etapes/un/BlocClient.tsx",
  "etapes/un/NouveauContact.tsx",
  "etapes/un/BlocMotsDuClient.tsx",
  "etapes/un/ListeLignes.tsx",
  "etapes/un/LigneContenu.tsx",
  "etapes/un/EtapeClientProjet.tsx",
  "ApercuDirect.tsx",
  "etapes/phases/EditeurPhases.tsx",
  "etapes/phases/EtapePhases.tsx",
  "etapes/phases/BlocDelais.tsx",
  "etapes/phases/BlocMaintenance.tsx",
  "etapes/phases/BlocGarantie.tsx",
];

describe("l'assistant de devis est sûr côté client", () => {
  it.each(POINTS_D_ENTREE)(
    "%s : la fermeture d'imports ne contient ni pricing, ni prisma, ni server-only, ni node:*",
    (entree) => {
      const { fichiers, violations } = fermeture(resolve(__dirname, entree));
      expect(fichiers.size).toBeGreaterThan(0);
      expect(violations).toEqual([]);
    },
  );

  it("AssistantDevis.tsx tire bien plus de cinq fichiers (la garde parcourt vraiment)", () => {
    expect(fermeture(resolve(__dirname, "AssistantDevis.tsx")).fichiers.size).toBeGreaterThan(5);
  });

  it("relatif() normalise un chemin Windows", () => {
    expect(relatif(`${RACINE}\\src\\lib\\prisma.ts`)).toBe("/src/lib/prisma.ts");
  });

  it("le détecteur voit une violation (import interdit à l'exécution) mais pas un import de type", () => {
    expect(importsExecutes('import { x } from "node:crypto";\n')).toEqual(["node:crypto"]);
    expect(importsExecutes('import type { x } from "node:crypto";\n')).toEqual([]);
    expect(importsExecutes('import { a,\n b } from "@/lib/prisma";\n')).toEqual(["@/lib/prisma"]);
  });
});
