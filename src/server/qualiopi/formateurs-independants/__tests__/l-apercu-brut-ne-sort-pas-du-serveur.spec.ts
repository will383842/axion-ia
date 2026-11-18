/**
 * Fiche I2-4-S1 (point 4) — garde de source : l'aperçu BRUT d'un e-mail (HTML non masqué,
 * liens personnels en clair) ne doit jamais être joignable depuis le navigateur.
 *
 *  · l'aperçu brut des formateurs s'appelle `apercuBrutServeurSeulement` ;
 *  · aucun fichier `"use server"` ni `.tsx` de `src/` n'importe ce nom, ni le `apercu` de
 *    `features/apporteurs-reseau/envois`, sauf `actions-apporteurs.ts` (qui passe par
 *    `apercu`, dont le type `ApercuRendu.apercu` est masqué et inerte).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "src");
const AUTORISE = "src/features/apporteurs-reseau/actions-apporteurs.ts";

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "node_modules" || nom === "__tests__") continue;
      fichiers(chemin, sortie);
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

const IMPORT_ENVOIS = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']*\/envois)["']/g;

function importsDangereux(source: string): string[] {
  const trouves: string[] = [];
  for (const m of source.matchAll(IMPORT_ENVOIS)) {
    const noms = m[1]!.split(",").map((n) =>
      n
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]!
        .trim(),
    );
    for (const n of noms) if (n === "apercu" || n === "apercuBrutServeurSeulement") trouves.push(n);
  }
  return trouves;
}

describe("l'aperçu brut ne sort pas du serveur", () => {
  it("l'aperçu formateur non masqué n'est plus exporté sous le nom « apercu »", () => {
    const source = readFileSync(
      join(RACINE, "server/qualiopi/formateurs-independants/envois.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/export\s+(async\s+)?function\s+apercu\s*\(/);
    expect(source).toMatch(/export\s+(async\s+)?function\s+apercuBrutServeurSeulement\s*\(/);
  });

  it("aucun fichier « use server » ni .tsx n'importe un aperçu brut", () => {
    const fautes: string[] = [];
    for (const f of fichiers(RACINE)) {
      const rel = relative(process.cwd(), f).replace(/\\/g, "/");
      if (rel === AUTORISE) continue;
      const source = readFileSync(f, "utf8");
      const client = f.endsWith(".tsx") || /^\s*["']use server["']/m.test(source.slice(0, 600));
      if (!client) continue;
      for (const n of importsDangereux(source)) fautes.push(`${rel} importe « ${n} »`);
    }
    expect(fautes).toEqual([]);
  });

  it("test du test : la garde reconnaît un import fautif", () => {
    expect(importsDangereux(`import { apercu, envoyer } from "../envois";`)).toEqual(["apercu"]);
    expect(
      importsDangereux(
        `import { apercuBrutServeurSeulement as a } from "@/server/qualiopi/formateurs-independants/envois";`,
      ),
    ).toEqual(["apercuBrutServeurSeulement"]);
    expect(importsDangereux(`import { envoyer } from "../envois";`)).toEqual([]);
  });

  it("garde de l'exception : actions-apporteurs.ts passe par l'`apercu` masqué", () => {
    const source = readFileSync(join(process.cwd(), AUTORISE), "utf8");
    expect(source).toMatch(/import\s+\{\s*apercu,\s*type\s+ApercuRendu\s*\}\s+from\s+"\.\/envois"/);
    const envois = readFileSync(join(RACINE, "features/apporteurs-reseau/envois.ts"), "utf8");
    expect(envois).toMatch(
      /ApercuRenduMonde<GabaritApporteur>\s*&\s*\{\s*apercu:\s*ApercuLecteur\s*\}/,
    );
  });
});
