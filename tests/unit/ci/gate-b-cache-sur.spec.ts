/**
 * CI rapide, PR 2 (2026-11-27, corrigée 2026-11-28) — caches de Gate B (webpack, Playwright).
 *
 * Gate B ne tourne PAS sur `schedule`. Les caches sont donc écrits par un job dédié,
 * `gate-b-cache-chauffe`, jamais par `gate-b` (qui ne fait que restaurer) : une PR ne doit
 * pas pouvoir écrire dans le cache de la branche par défaut.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const racine = process.cwd();
const yaml = readFileSync(path.join(racine, ".github", "workflows", "ci.yml"), "utf8");

function job(nom: string): string {
  const debut = yaml.search(new RegExp(`^ {2}${nom}:\\s*$`, "m"));
  if (debut === -1) return "";
  const reste = yaml.slice(debut + 1);
  const fin = reste.search(/^ {2}[a-z0-9-]+:\s*$/m);
  return fin === -1 ? reste : reste.slice(0, fin);
}

const GATE_B = job("gate-b");
const CHAUFFE = job("gate-b-cache-chauffe");
const VERDICT = job("gate-b-verdict");

const normaliser = (s: string) => s.replace(/\s+/g, " ").trim();
const CONDITION_CHAUFFE =
  "github.event_name == 'schedule' || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main')";

/** Condition `if:` d'un job (premier `if:` à 4 espaces), pliée en une ligne. */
function conditionDuJob(bloc: string): string {
  const m = bloc.match(/^ {4}if:\s*(?:>-?\s*\n((?: {6}.*\n?)+)|(.*))$/m);
  if (!m) return "";
  return normaliser(m[1] ?? m[2] ?? "");
}

/** Étapes (blocs « - name: ») d'un job. */
const etapes = (bloc: string) => bloc.split(/\n(?=      - name:)/);

/** Déclencheurs du bloc `on:`. */
const ON = yaml.slice(yaml.search(/^on:/m), yaml.search(/^concurrency:/m));

describe("Gate B : caches sûrs", () => {
  it("les jobs gate-b, gate-b-verdict et gate-b-cache-chauffe existent", () => {
    expect(GATE_B).not.toBe("");
    expect(VERDICT).not.toBe("");
    expect(CHAUFFE).not.toBe("");
  });

  it("(a) gate-b ne sauvegarde AUCUN cache : ni cache/save, ni actions/cache@ (sauvegarde implicite)", () => {
    expect(GATE_B).not.toMatch(/uses:\s*actions\/cache\/save/);
    expect(GATE_B).not.toMatch(/uses:\s*actions\/cache@/);
    expect(GATE_B).toMatch(/uses:\s*actions\/cache\/restore@/);
  });

  it("(b) toute actions/cache/save du fichier est dans le job de chauffe, dont le if: est EXACTEMENT la condition attendue", () => {
    const noms = [...yaml.matchAll(/^ {2}([a-z0-9-]+):\s*$/gm)].map((m) => m[1] ?? "");
    const ecrivains = noms.filter((n) => /uses:\s*actions\/cache\/save@/.test(job(n)));
    expect(ecrivains).toEqual(["gate-b-cache-chauffe"]);
    expect(conditionDuJob(CHAUFFE)).toBe(CONDITION_CHAUFFE);
  });

  it("(c) le job de chauffe n'est déclenché ni sur pull_request ni sur merge_group, et n'est pas dans gate-b-verdict", () => {
    expect(conditionDuJob(CHAUFFE)).not.toMatch(/pull_request|merge_group/);
    expect(/^ {2}schedule:/m.test(ON)).toBe(true);
    expect(/^ {2}workflow_dispatch:/m.test(ON)).toBe(true);
    expect(VERDICT).not.toContain("gate-b-cache-chauffe");
    expect(GATE_B).not.toContain("gate-b-cache-chauffe\n    needs");
    expect(CHAUFFE).not.toMatch(/^ {4}needs:/m);
  });

  it("le job de chauffe sauvegarde webpack et Playwright, après Build / après l'installation", () => {
    const saves = etapes(CHAUFFE).filter((e) => /uses: actions\/cache\/save@/.test(e));
    expect(saves).toHaveLength(2);
    expect(saves.some((e) => e.includes("path: .next/cache/webpack"))).toBe(true);
    expect(saves.some((e) => e.includes("path: ~/.cache/ms-playwright"))).toBe(true);
    const iBuild = CHAUFFE.indexOf("\n      - name: Build\n");
    const iInstall = CHAUFFE.indexOf("playwright install --with-deps chromium");
    expect(iBuild).toBeGreaterThan(-1);
    expect(CHAUFFE.indexOf("path: .next/cache/webpack")).toBeGreaterThan(iBuild);
    expect(CHAUFFE.indexOf("path: ~/.cache/ms-playwright")).toBeGreaterThan(iInstall);
    expect(iInstall).toBeGreaterThan(-1);
    // Relocate .next avant le build, comme gate-b
    expect(CHAUFFE.indexOf("- name: Relocate .next to /mnt")).toBeLessThan(iBuild);
  });

  it("les clés webpack de sauvegarde et de restauration sont identiques (lockfile, config Next, tsconfig, sha)", () => {
    const cle = (bloc: string, outil: string) =>
      normaliser(
        etapes(bloc)
          .find((e) => e.includes(`actions/cache/${outil}@`) && e.includes(".next/cache/webpack"))
          ?.match(/key:\s*(.*)/)?.[1] ?? "",
      );
    const restaure = cle(GATE_B, "restore");
    const sauve = cle(CHAUFFE, "save");
    expect(restaure).toContain("hashFiles('pnpm-lock.yaml', 'next.config.*', 'tsconfig.json')");
    expect(restaure).toContain("github.sha");
    expect(sauve).toBe(restaure);
    const restore =
      etapes(GATE_B).find((e) => /cache\/restore@/.test(e) && e.includes("webpack")) ?? "";
    expect(restore).toContain("restore-keys:");
  });

  it("la restauration webpack est après Relocate .next et avant Build", () => {
    const iRel = GATE_B.indexOf("- name: Relocate .next to /mnt");
    const iRes = GATE_B.indexOf("path: .next/cache/webpack");
    const iBuild = GATE_B.indexOf("\n      - name: Build\n");
    expect(iRel).toBeGreaterThan(-1);
    expect(iRes).toBeGreaterThan(iRel);
    expect(iBuild).toBeGreaterThan(iRes);
  });

  it("aucun cache ne contient .next entier, un .env ou un secret", () => {
    for (const bloc of [GATE_B, CHAUFFE]) {
      for (const e of etapes(bloc).filter((x) => /uses: actions\/cache/.test(x))) {
        const b = e.slice(e.indexOf("path:")).split("\n").slice(0, 3).join("\n");
        expect(b).not.toMatch(/path:\s*\.next\/?\s*$/m);
        expect(b).not.toMatch(/\.env|secret|credential|\.npmrc|id_rsa|\.pem/i);
      }
    }
  });

  it("cache Playwright : clé exacte pw-<lockfile>, SANS restore-keys, et playwright install --with-deps chromium APRÈS la restauration", () => {
    const pw = etapes(GATE_B).find((e) => e.includes("ms-playwright")) ?? "";
    expect(pw).toMatch(/uses: actions\/cache\/restore@/);
    expect(pw).toContain("key: pw-${{ hashFiles('pnpm-lock.yaml') }}");
    expect(pw).not.toContain("restore-keys");
    const iRes = GATE_B.indexOf("path: ~/.cache/ms-playwright");
    const iInst = GATE_B.indexOf("playwright install --with-deps chromium");
    expect(iRes).toBeGreaterThan(-1);
    expect(iInst).toBeGreaterThan(iRes);
    // même clé à l'écriture
    const sauve = etapes(CHAUFFE).find((e) => e.includes("ms-playwright")) ?? "";
    expect(sauve).toContain("key: pw-${{ hashFiles('pnpm-lock.yaml') }}");
    expect(sauve).not.toContain("restore-keys");
  });
});
