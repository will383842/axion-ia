// PR E #2464 — le gabarit est inscrit partout où l'est un gabarit d'apporteur, sauf « argent ».
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const NOM = "apporteur-file-attente-premier-rang";
const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("gabarit apporteur-file-attente-premier-rang : inscriptions", () => {
  it.each([
    "src/server/queue/types.ts",
    "src/server/email/outbox-policy.ts",
    "src/server/email/apercu/catalogue.ts",
    "src/lib/email/templates/index.tsx",
  ])("inscrit dans %s", (f) => {
    expect(lire(f)).toContain(`"${NOM}"`);
  });

  it("envois.ts : le type ET les deux listes", () => {
    const n = lire("src/features/apporteurs-reseau/envois.ts").split(`"${NOM}"`).length - 1;
    expect(n).toBe(3);
  });

  it("n'est PAS un gabarit d'argent (retrait.ts)", () => {
    expect(lire("src/features/apporteurs-reseau/retrait.ts")).not.toContain(NOM);
  });
});
