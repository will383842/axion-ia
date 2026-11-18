/**
 * Câblage du registre de l'enfileur d'e-mail (texte statique) : sans ces trois poses, le doublon
 * e-mail d'une demande de client ne partirait jamais, en silence.
 *  - l'app Next : `instrumentation.ts`, DANS la branche nodejs, chargeur paresseux ;
 *  - le worker : `queues.ts` pose à son chargement, et `worker.ts` l'importe statiquement.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lire = (p: string): string => readFileSync(p, "utf8");

describe("l'enfileur d'e-mail est posé par les deux points d'entrée", () => {
  it("instrumentation.ts pose le chargeur dans la branche nodejs, avant le seed", () => {
    const s = lire("src/instrumentation.ts");
    const branche = s.indexOf('if (process.env["NEXT_RUNTIME"] === "nodejs")');
    const fin = s.indexOf('if (process.env["NEXT_RUNTIME"] === "edge")');
    const pose = s.indexOf("poserChargeurEnfileurEmail(");
    expect(branche).toBeGreaterThan(-1);
    expect(pose).toBeGreaterThan(branche);
    expect(pose).toBeLessThan(fin);
    expect(pose).toBeLessThan(s.indexOf("await seedQualiopiReferenceDataOnBoot();"));
    // Paresseux : `queues.ts` n'est importé qu'à l'appel du chargeur.
    expect(s).toMatch(
      /poserChargeurEnfileurEmail\(\(\) =>\s*import\("@\/server\/queue\/queues"\)\.then\(\(m\) => m\.enqueueEmail\)/,
    );
  });

  it("queues.ts pose son propre enfileur après la définition d'enqueueEmail", () => {
    const s = lire("src/server/queue/queues.ts");
    const def = s.indexOf("export async function enqueueEmail(");
    const pose = s.indexOf("poserChargeurEnfileurEmail(async () => enqueueEmail)");
    expect(def).toBeGreaterThan(-1);
    expect(pose).toBeGreaterThan(def);
  });

  it("worker.ts importe ./queues statiquement", () => {
    expect(lire("src/server/queue/worker.ts")).toMatch(/^import .* from "\.\/queues";/m);
  });

  it("la feuille n'a aucun import d'exécution (seulement `import type`)", () => {
    const s = lire("src/server/notifications/enfileur-email.ts").replace(/^\s*\/\/.*$/gm, "");
    const imports = s.match(/^\s*import\s.*$/gm) ?? [];
    for (const i of imports) expect(i).toMatch(/^\s*import type \{/);
  });
});
