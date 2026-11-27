/**
 * CI rapide, PR 2 (2026-11-27) — caches de Gate B (webpack, Playwright).
 * Un cache écrit depuis une PR, ou qui contient un secret ou `.next` entier, est un risque.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const racine = process.cwd();
const yaml = readFileSync(path.join(racine, ".github", "workflows", "ci.yml"), "utf8");

const debut = yaml.search(/^ {2}gate-b:\s*$/m);
const reste = yaml.slice(debut + 1);
const fin = reste.search(/^ {2}[a-z0-9-]+:\s*$/m);
const GATE_B = fin === -1 ? reste : reste.slice(0, fin);

/** Les étapes (blocs « - name: ») du job qui utilisent un cache. */
const etapes = GATE_B.split(/\n(?=      - name:)/).filter((e) => /uses: actions\/cache/.test(e));

describe("Gate B : caches sûrs", () => {
  it("le job gate-b a été trouvé et porte des caches", () => {
    expect(debut).toBeGreaterThan(-1);
    expect(etapes.length).toBeGreaterThanOrEqual(3);
  });

  it("la sauvegarde du cache webpack n'a lieu que sur schedule et tranche 1", () => {
    const save = etapes.filter((e) => /cache\/save@/.test(e));
    expect(save).toHaveLength(1);
    expect(save[0]).toContain("path: .next/cache/webpack");
    expect(save[0]).toContain("github.event_name == 'schedule'");
    expect(save[0]).toContain("matrix.tranche == 1");
  });

  it("le cache webpack n'est jamais écrit par actions/cache@ (écriture implicite en post-étape)", () => {
    const webpack = etapes.filter((e) => e.includes(".next/cache/webpack"));
    expect(webpack).toHaveLength(2);
    expect(webpack.some((e) => /actions\/cache@/.test(e))).toBe(false);
  });

  it("les clés webpack portent lockfile, config Next, tsconfig et sha, avec restore-keys par préfixe", () => {
    const restore = etapes.find((e) => /cache\/restore@/.test(e)) ?? "";
    expect(restore).toContain("hashFiles('pnpm-lock.yaml', 'next.config.*', 'tsconfig.json')");
    expect(restore).toContain("github.sha");
    expect(restore).toContain("restore-keys:");
  });

  it("la restauration est après Relocate .next et avant Build ; la sauvegarde après Build", () => {
    const iRel = GATE_B.indexOf("- name: Relocate .next to /mnt");
    const iRes = GATE_B.indexOf("uses: actions/cache/restore@");
    const iBuild = GATE_B.indexOf("\n      - name: Build\n");
    expect(iRel).toBeGreaterThan(-1);
    expect(iRes).toBeGreaterThan(iRel);
    expect(iBuild).toBeGreaterThan(iRes);
    expect(GATE_B.indexOf("uses: actions/cache/save@")).toBeGreaterThan(iBuild);
  });

  it("aucun cache ne contient .next entier, un .env ou un secret", () => {
    for (const e of etapes) {
      const bloc = e.slice(e.indexOf("path:")).split("\n").slice(0, 3).join("\n");
      expect(bloc).not.toMatch(/path:\s*\.next\/?\s*$/m);
      expect(bloc).not.toMatch(/\.env|secret|credential|\.npmrc|id_rsa|\.pem/i);
    }
  });

  it("le cache Playwright est clé sur le lockfile", () => {
    const pw = etapes.find((e) => e.includes("ms-playwright")) ?? "";
    expect(pw).toContain("key: pw-${{ hashFiles('pnpm-lock.yaml') }}");
  });
});
