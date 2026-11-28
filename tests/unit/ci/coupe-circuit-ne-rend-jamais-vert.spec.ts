/**
 * CI rapide, PR 1 (2026-11-27) — le coupe-circuit ne peut que rendre un contexte
 * non vert PLUS TÔT ; il ne peut jamais en rendre un vert.
 *
 * Gate A rouge sur une PR prête ⇒ `gh run cancel` : couverture et Gate B
 * s'arrêtent, mais leurs verdicts (`always()`) tournent et rougissent.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const yaml = readFileSync(path.join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");

function job(id: string): string {
  const debut = yaml.search(new RegExp(`^ {2}${id}:\\s*$`, "m"));
  expect(debut, `job « ${id} » introuvable dans ci.yml`).toBeGreaterThanOrEqual(0);
  const reste = yaml.slice(debut + 1);
  const fin = reste.search(/^ {2}[a-z0-9-]+:\s*$/m);
  return fin === -1 ? reste : reste.slice(0, fin);
}

const COUPE = job("coupe-circuit");
const EXIGES = [
  "Gate A · per-commit",
  "Gate A · couverture",
  "Gate B · per-PR",
  "Gate D · Prisma migrate deploy (DB fresh)",
];

describe("coupe-circuit", () => {
  it("dépend de gate-a et ne s'exécute que sur un échec", () => {
    expect(COUPE).toMatch(/^ {4}needs: gate-a\s*$/m);
    expect(COUPE).toMatch(/^ {4}if: >-\s*\n\s+failure\(\)/m);
  });

  it("ne couvre ni schedule ni le brouillon, mais couvre merge_group", () => {
    expect(COUPE).not.toContain("schedule");
    expect(COUPE).toContain("github.event.pull_request.draft == false");
    expect(COUPE).toContain("github.event_name == 'merge_group'");
  });

  it("n'exécute aucune autre commande que `gh run cancel`", () => {
    const commandes = [...COUPE.matchAll(/^\s+run:\s*(.+)$/gm)].map((m) => m[1]);
    expect(commandes).toHaveLength(1);
    expect(commandes[0]).toMatch(/^gh run cancel /);
    expect(COUPE).not.toMatch(/uses:/);
  });

  it("`actions: write` n'apparaît que sur ce job", () => {
    expect(COUPE).toMatch(/permissions:\s*\n\s+actions: write/);
    expect([...yaml.matchAll(/actions:\s*write/g)]).toHaveLength(1);
  });

  it("son nom n'est pas un des contextes exigés", () => {
    const nom = /^ {4}name: (.+)$/m.exec(COUPE)?.[1]?.trim();
    expect(nom).toBeTruthy();
    expect(EXIGES).not.toContain(nom);
  });

  it("aucun autre job ne le cite dans `needs`", () => {
    const refs = [...yaml.matchAll(/^\s+needs:.*$/gm)].filter((m) =>
      m[0].includes("coupe-circuit"),
    );
    expect(refs).toHaveLength(0);
    expect(yaml).not.toMatch(/needs:\s*\n(\s+- .+\n)*\s+- coupe-circuit/);
  });

  it("les deux verdicts gardent `always()` et rougissent sur tout résultat ≠ success", () => {
    for (const id of ["gate-a-couverture", "gate-b-verdict"]) {
      const bloc = job(id);
      expect(bloc, id).toMatch(/if: (>-\s*\n\s+)?always\(\)/);
      expect(bloc, id).toMatch(/!= "success"/);
    }
  });
});
