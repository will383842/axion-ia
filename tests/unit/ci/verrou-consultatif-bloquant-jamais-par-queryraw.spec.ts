// @vitest-environment node
/**
 * Cliquet de source : un verrou consultatif BLOQUANT ne se prend jamais par `$queryRaw`.
 *
 * `pg_advisory_xact_lock(…)` et `pg_advisory_lock(…)` renvoient `void` ; Prisma ne sait pas
 * désérialiser cette colonne (« Failed to deserialize column of type 'void' ») et l'appel plante
 * en production alors que le simulacre de test passe. Ils se prennent par `$executeRaw`.
 * Les variantes `pg_try_advisory_…` renvoient un booléen : `$queryRaw` leur convient.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../..");

// Appel `$queryRaw` / `$queryRawUnsafe` (gabarit ou parenthèse) jusqu'à son `;` ou la fin du texte.
const APPEL = /\$queryRaw(?:Unsafe)?\s*(?:<[^>`(]*>)?\s*[`(][^;]*/g;
const VERROU = /pg_advisory_(?:xact_)?lock\s*\(/;

/** Rend les positions (ligne) des verrous bloquants posés par `$queryRaw*` dans `texte`. */
export function verrousBloquantsParQueryRaw(source: string): number[] {
  // Les commentaires qui CITENT `$queryRaw` ne sont pas des appels : on les blanchit sans toucher aux sauts de ligne.
  const texte = source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (_, avant: string) => avant);
  const lignes: number[] = [];
  for (const m of texte.matchAll(APPEL)) {
    if (VERROU.test(m[0])) {
      lignes.push(texte.slice(0, m.index).split("\n").length);
    }
  }
  return lignes;
}

function fichiersSource(dir: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) {
      if (nom === "__tests__" || nom === "node_modules") continue;
      fichiersSource(p, sortie);
    } else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      sortie.push(p);
    }
  }
  return sortie;
}

describe("verrou consultatif bloquant — face ROUGE (texte synthétique)", () => {
  it("attrape pg_advisory_xact_lock lu par $queryRaw", () => {
    const fautif = 'await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"x:" + id}))`;';
    expect(verrousBloquantsParQueryRaw(fautif)).toEqual([1]);
  });

  it("attrape pg_advisory_lock par $queryRawUnsafe et sur plusieurs lignes", () => {
    const fautif = [
      "const a = 1;",
      "await tx.$queryRawUnsafe(",
      "  `SELECT pg_advisory_lock(1)`,",
      ");",
    ].join("\n");
    expect(verrousBloquantsParQueryRaw(fautif)).toEqual([2]);
  });

  it("ignore un commentaire qui cite $queryRaw avant un $executeRaw", () => {
    const ok = [
      "// `$executeRaw`, pas `$queryRaw` : void",
      "await tx.$executeRaw`SELECT pg_advisory_xact_lock(1)`;",
    ].join("\n");
    expect(verrousBloquantsParQueryRaw(ok)).toEqual([]);
  });

  it("laisse passer $executeRaw et pg_try_advisory_xact_lock en $queryRaw", () => {
    expect(
      verrousBloquantsParQueryRaw("await tx.$executeRaw`SELECT pg_advisory_xact_lock(1)`;"),
    ).toEqual([]);
    expect(
      verrousBloquantsParQueryRaw(
        "await tx.$queryRaw<{ l: boolean }[]>`SELECT pg_try_advisory_xact_lock(1) AS l`;",
      ),
    ).toEqual([]);
  });
});

describe("verrou consultatif bloquant — face VERTE (dépôt réel)", () => {
  it("aucun fichier de src/ ne prend pg_advisory_[xact_]lock par $queryRaw", () => {
    const fautes: string[] = [];
    for (const f of fichiersSource(path.join(RACINE, "src"))) {
      for (const l of verrousBloquantsParQueryRaw(readFileSync(f, "utf8"))) {
        fautes.push(`${path.relative(RACINE, f)}:${l}`);
      }
    }
    expect(fautes).toEqual([]);
  });
});
