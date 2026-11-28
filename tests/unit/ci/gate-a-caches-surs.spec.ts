/**
 * CI rapide, PR 1 (2026-11-27) — caches de Gate A (ESLint, Prettier, tsc).
 * Un cache n'est sûr que si sa clé porte tout ce dont le résultat dépend.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const racine = process.cwd();
const yaml = readFileSync(path.join(racine, ".github", "workflows", "ci.yml"), "utf8");

const debut = yaml.search(/^ {2}gate-a:\s*$/m);
const reste = yaml.slice(debut + 1);
const fin = reste.search(/^ {2}[a-z0-9-]+:\s*$/m);
const GATE_A = fin === -1 ? reste : reste.slice(0, fin);

const iCache = GATE_A.indexOf("- name: Caches lint / format / types");
const ETAPE = GATE_A.slice(iCache, GATE_A.indexOf("\n      - name:", iCache + 10));

describe("Gate A : caches sûrs", () => {
  it("l'étape de cache existe", () => {
    expect(iCache).toBeGreaterThan(-1);
  });

  it("la clé et les restore-keys portent lockfile et configs", () => {
    for (const f of ["pnpm-lock.yaml", "eslint.config.mjs", ".prettierrc.json"]) {
      const occurrences = ETAPE.split(`'${f}'`).length - 1;
      expect(occurrences, `${f} doit figurer dans key ET restore-keys`).toBeGreaterThanOrEqual(2);
    }
  });

  it("--cache-strategy content pour ESLint et Prettier", () => {
    expect(GATE_A).toMatch(/pnpm lint [^\n]*--cache-strategy content/);
    expect(GATE_A).toMatch(/pnpm format:check [^\n]*--cache-strategy content/);
  });

  it("le passage quotidien tourne sans cache", () => {
    expect(ETAPE).toContain("github.event_name != 'schedule'");
  });

  it("le cache est restauré avant typegen/tsc/lint", () => {
    for (const n of [
      "Types de routes Next",
      "TypeScript strict",
      "- name: ESLint",
      "- name: Prettier",
    ]) {
      expect(GATE_A.indexOf(n), n).toBeGreaterThan(iCache);
    }
  });

  it("la config ESLint n'a pas de règle typée (le cache ne verrait pas les autres fichiers)", () => {
    const cfg = readFileSync(path.join(racine, "eslint.config.mjs"), "utf8");
    expect(cfg).not.toContain("parserOptions.project");
    expect(cfg).not.toContain("projectService");
  });
});
