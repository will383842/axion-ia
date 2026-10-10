/**
 * Verrou du lot S1 (ADR 0066) — `activation.ts` est le SEUL écrivain de
 * `Trainer.actif` dans `src/**`.
 *
 * Avant ce lot, quatre portes l'écrivaient chacune à sa façon, toutes ouvertes
 * à `editor`, aucune ne regardant une pièce. Une cinquième porte qui écrirait
 * `actif` en direct contournerait la garde sans que rien ne le signale : ce
 * test la nomme.
 *
 * Méthode : chaque appel d'écriture sur le modèle `trainer`
 * (`create`, `createMany`, `update`, `updateMany`, `upsert`) est découpé en
 * suivant ses parenthèses ; une clé `actif` dans son argument est une écriture.
 * La seule forme tolérée hors de l'écrivain est l'étalement de
 * `actifALaCreation(...)`, qui en décide.
 *
 * Seeds et scripts (`prisma/seeds/**`, `scripts/**`) sont hors règle — ils
 * fabriquent des jeux d'essai — mais LISTÉS dans le rapport du lot.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RACINE = join(__dirname, "..", "..", "..", "..");
const SRC = join(RACINE, "src");
const ECRIVAIN = join("src", "server", "qualiopi", "formateurs-independants", "activation.ts");

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) {
      if (nom === "node_modules" || nom === "generated") continue;
      out.push(...fichiers(p));
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.(ts|tsx)$/.test(nom)) {
      out.push(p);
    }
  }
  return out;
}

/** Extrait l'argument d'un appel à partir de la parenthèse ouvrante. */
function argument(source: string, ouvrante: number): string {
  let profondeur = 0;
  for (let i = ouvrante; i < source.length; i++) {
    const c = source[i];
    if (c === "(") profondeur++;
    else if (c === ")") {
      profondeur--;
      if (profondeur === 0) return source.slice(ouvrante + 1, i);
    }
  }
  return source.slice(ouvrante + 1);
}

const APPEL_ECRITURE = /\btrainer\s*\.\s*(create|createMany|update|updateMany|upsert)\s*\(/g;

/** Écritures de `actif` sur `trainer` hors de l'écrivain, au format `fichier: extrait`. */
function ecrituresHorsEcrivain(): string[] {
  const fautes: string[] = [];
  for (const f of fichiers(SRC)) {
    const rel = relative(RACINE, f).split(sep).join("/");
    if (rel === ECRIVAIN.split(sep).join("/")) continue;
    const source = readFileSync(f, "utf8");
    for (const m of source.matchAll(APPEL_ECRITURE)) {
      const ouvrante = (m.index ?? 0) + m[0].length - 1;
      const arg = argument(source, ouvrante)
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (/\bactif\s*:/.test(arg) || /["']actif["']\s*:/.test(arg)) {
        fautes.push(`${rel}: ${m[0]}…`);
      }
    }
  }
  return fautes;
}

describe("Trainer.actif — un seul écrivain", () => {
  it("aucune écriture de `actif` sur Trainer hors de `activation.ts`", () => {
    expect(ecrituresHorsEcrivain()).toEqual([]);
  });

  it("l'écrivain lui-même est bien vu par le détecteur (le test n'est pas aveugle)", () => {
    const source = readFileSync(join(RACINE, ECRIVAIN), "utf8");
    const vus = [...source.matchAll(APPEL_ECRITURE)].filter((m) =>
      /\bactif\s*:/.test(argument(source, (m.index ?? 0) + m[0].length - 1)),
    );
    expect(vus.length).toBeGreaterThanOrEqual(2);
  });

  it("les quatre portes historiques appellent l'écrivain", () => {
    const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
    const trainers = lire("src/server/actions/qualiopi/trainers.ts");
    expect(trainers).toMatch(/changerActivationFormateur\(/);
    expect(trainers).toMatch(/actifALaCreation\(/);
    expect(trainers).toMatch(/desactiverSiGardeNonRemplie\(/);
    expect(lire("src/server/actions/coaching-admin/formateurs.actions.ts")).toMatch(
      /changerActivationFormateur\(/,
    );
  });
});
